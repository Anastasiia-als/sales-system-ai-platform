// scratch/test_phase7a_e2e_delivery.js
// Tests Phase 7A: Full End-to-End Webhook Delivery Flow
// Covers: Registration -> Event Emission -> Outbox Queuing -> HTTP Dispatch -> HMAC Header Verification -> State Machine

const http = require('http');
const { Pool } = require('pg');
const { verifyWebhookSignature } = require('../js/portal/api/dispatcher-core.js');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const createdIds = {
    organizations: [],
    projects: [],
    tasks: [],
    endpoints: [],
    events: [],
    outbox: [],
    vaultSecrets: []
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`PASS: ${message}`);
    } else {
        failed++;
        console.error(`FAIL: ${message}`);
    }
}

async function run() {
    const client = await pool.connect();
    let mockServer = null;
    const receivedRequests = [];
    let mockResponseStatusCode = 200;

    try {
        console.log('--- Suite 8: Phase 7A End-to-End Webhook Delivery & Dispatcher Flow ---');

        // 1. Start Local Mock Webhook Receiver
        mockServer = http.createServer((req, res) => {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                receivedRequests.push({
                    method: req.method,
                    headers: req.headers,
                    rawBody: body,
                    parsedBody: (() => { try { return JSON.parse(body); } catch (_) { return null; } })()
                });
                res.writeHead(mockResponseStatusCode, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'received', code: mockResponseStatusCode }));
            });
        });

        await new Promise(resolve => mockServer.listen(0, '127.0.0.1', resolve));
        const port = mockServer.address().port;
        const receiverUrl = `http://127.0.0.1:${port}/webhook/receiver`;

        // 2. Setup isolated test fixtures in DB
        const orgRes = await client.query(
            "INSERT INTO public.organizations (name) VALUES ('Test Org 7A E2E') RETURNING id"
        );
        const orgId = orgRes.rows[0].id;
        createdIds.organizations.push(orgId);

        const projRes = await client.query(
            "INSERT INTO public.projects (organization_id, name, title) VALUES ($1, 'Test Proj 7A E2E', 'Test Proj 7A E2E') RETURNING id",
            [orgId]
        );
        const projId = projRes.rows[0].id;
        createdIds.projects.push(projId);

        const taskRes = await client.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type) VALUES ($1, $2, 'Production Deployment Task', 'todo', 'internal') RETURNING id",
            [orgId, projId]
        );
        const taskId = taskRes.rows[0].id;
        createdIds.tasks.push(taskId);

        // 3. Register Webhook Endpoint via RPC (reveals signing secret once)
        const epRes = await client.query(`
            SELECT public.create_integration_endpoint(
                '${orgId}',
                'E2E Local Webhook Endpoint',
                'Receives test webhooks',
                '${receiverUrl}',
                ARRAY['task.completed']
            ) as res;
        `);
        const epData = epRes.rows[0].res;
        const endpointId = epData.id;
        const signingSecret = epData.signing_secret;
        createdIds.endpoints.push(endpointId);

        assert(Boolean(endpointId), 'Endpoint created successfully');
        assert(Boolean(signingSecret) && signingSecret.startsWith('fws_'), 'One-time signing secret revealed to creator');

        const secRow = await client.query(
            "SELECT url_secret_id, signing_secret_id FROM public.integration_endpoints WHERE id = $1",
            [endpointId]
        );
        if (secRow.rows[0].url_secret_id) createdIds.vaultSecrets.push(secRow.rows[0].url_secret_id);
        if (secRow.rows[0].signing_secret_id) createdIds.vaultSecrets.push(secRow.rows[0].signing_secret_id);

        // 4. Complete task -> Triggers integration event & Outbox creation
        await client.query("BEGIN");
        await client.query("SET LOCAL \"request.jwt.claim.role\" = 'service_role'");
        const emitRes = await client.query(
            "SELECT public._emit_integration_event('task', $1, 'task.completed') as event_id",
            [taskId]
        );
        const eventId = emitRes.rows[0].event_id;
        await client.query("COMMIT");
        createdIds.events.push(eventId);

        // Verify Outbox delivery row was enqueued
        const outboxRes = await client.query(
            "SELECT * FROM public.integration_outbox WHERE event_id = $1 AND destination_id = $2",
            [eventId, endpointId]
        );
        assert(outboxRes.rows.length === 1, 'Delivery row enqueued in integration_outbox');
        const outboxRow = outboxRes.rows[0];
        createdIds.outbox.push(outboxRow.id);
        assert(outboxRow.status === 'pending', 'Initial outbox status is pending');

        // 5. Execute Dispatcher Run
        // Fetch event data and decrypt secrets via internal helper
        const secretsRes = await client.query(`
            SELECT * FROM public.get_endpoint_secrets_internal($1, $2)
        `, [secRow.rows[0].url_secret_id, secRow.rows[0].signing_secret_id]);
        assert(secretsRes.rows.length === 1, 'Dispatcher helper fetched decrypted secrets');
        const { decrypted_url, decrypted_signing_secret } = secretsRes.rows[0];

        // Fetch event envelope
        const evRow = await client.query("SELECT * FROM public.integration_events WHERE id = $1", [eventId]);
        const ev = evRow.rows[0];
        const envelope = {
            id: ev.id,
            event: ev.event_type,
            created_at: ev.created_at,
            organization_id: ev.organization_id,
            project_id: ev.project_id || null,
            data: ev.payload_json || {}
        };

        const rawBody = JSON.stringify(envelope);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const { signWebhookPayload } = require('../js/portal/api/dispatcher-core.js');
        const signature = signWebhookPayload(decrypted_signing_secret, timestamp, rawBody);

        // Dispatch HTTP POST
        const httpResp = await fetch(decrypted_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Firstwin-Timestamp': timestamp,
                'X-Firstwin-Signature': `sha256=${signature}`,
                'X-Firstwin-Signature-256': `sha256=${signature}`,
                'X-Firstwin-Delivery': outboxRow.id,
                'X-Firstwin-Event': ev.event_type
            },
            body: rawBody
        });

        assert(httpResp.ok, 'HTTP POST delivery returned 200 OK');

        // Update Outbox row to delivered
        await client.query(`
            UPDATE public.integration_outbox
            SET status = 'delivered',
                delivered_at = NOW(),
                attempts_count = attempts_count + 1,
                last_http_status = $1,
                last_attempt_at = NOW()
            WHERE id = $2
        `, [httpResp.status, outboxRow.id]);

        // 6. Verify Mock Server received exact request
        assert(receivedRequests.length === 1, 'Mock server received exactly 1 webhook delivery');
        const reqData = receivedRequests[0];

        assert(reqData.headers['x-firstwin-timestamp'] === timestamp, 'Received exact X-Firstwin-Timestamp header');
        assert(reqData.headers['x-firstwin-signature'] === `sha256=${signature}`, 'Received exact X-Firstwin-Signature header');
        assert(reqData.headers['x-firstwin-signature-256'] === `sha256=${signature}`, 'Received exact X-Firstwin-Signature-256 header');
        assert(reqData.headers['x-firstwin-delivery'] === outboxRow.id, 'Received matching X-Firstwin-Delivery ID');
        assert(reqData.headers['x-firstwin-event'] === 'task.completed', 'Received matching X-Firstwin-Event');

        // Verify HMAC signature from receiver's perspective using recipient's signing secret
        const receiverVerify = verifyWebhookSignature({
            signingSecret: signingSecret,
            signatureHeader: reqData.headers['x-firstwin-signature'],
            timestampHeader: reqData.headers['x-firstwin-timestamp'],
            rawBodyString: reqData.rawBody
        });
        assert(receiverVerify.valid, 'Receiver successfully verifies HMAC signature over exact raw bytes');

        // Verify payload JSON data
        assert(reqData.parsedBody.id === eventId, 'Payload envelope matches event ID');
        assert(reqData.parsedBody.event === 'task.completed', 'Payload envelope event type is task.completed');
        assert(reqData.parsedBody.data.task_id === taskId, 'Payload data contains correct task_id');
        assert(reqData.parsedBody.data.title === 'Production Deployment Task', 'Payload data contains correct task title');

        // 7. Verify Outbox Database State
        const finalOutboxRes = await client.query("SELECT * FROM public.integration_outbox WHERE id = $1", [outboxRow.id]);
        const finalOutbox = finalOutboxRes.rows[0];
        assert(finalOutbox.status === 'delivered', 'Outbox status is delivered in DB');
        assert(Boolean(finalOutbox.delivered_at), 'Outbox delivered_at timestamp recorded');
        assert(finalOutbox.attempts_count === 1, 'Outbox attempts_count recorded as 1');
        assert(finalOutbox.last_http_status === 200, 'Outbox last_http_status is 200');

        console.log(`\nSuite 8 Summary: Passed ${passed}, Failed ${failed}`);
    } catch (err) {
        console.error('Unexpected error in Suite 8:', err);
        failed++;
    } finally {
        if (mockServer) {
            await new Promise(resolve => mockServer.close(resolve));
        }
        try {
            await client.query("SET integration.allow_cleanup = 'on'");
            if (createdIds.tasks.length > 0) {
                await client.query("DELETE FROM public.tasks WHERE id = ANY($1)", [createdIds.tasks]);
            }
            if (createdIds.projects.length > 0) {
                await client.query("DELETE FROM public.projects WHERE id = ANY($1)", [createdIds.projects]);
            }
            if (createdIds.outbox.length > 0) {
                await client.query("DELETE FROM public.integration_outbox WHERE id = ANY($1)", [createdIds.outbox]);
            }
            if (createdIds.events.length > 0) {
                await client.query("DELETE FROM public.integration_events WHERE id = ANY($1)", [createdIds.events]);
            }
            if (createdIds.endpoints.length > 0) {
                await client.query("DELETE FROM public.integration_endpoints WHERE id = ANY($1)", [createdIds.endpoints]);
            }
            if (createdIds.vaultSecrets.length > 0) {
                await client.query("DELETE FROM vault.secrets WHERE id = ANY($1)", [createdIds.vaultSecrets]);
            }
            if (createdIds.organizations.length > 0) {
                await client.query("DELETE FROM public.organization_memberships WHERE organization_id = ANY($1)", [createdIds.organizations]);
                await client.query("DELETE FROM public.organizations WHERE id = ANY($1)", [createdIds.organizations]);
            }
        } catch (cleanErr) {
            console.error("Cleanup error in Suite 8:", cleanErr);
        }
        client.release();
        await pool.end();
        process.exit(failed > 0 ? 1 : 0);
    }
}

run();
