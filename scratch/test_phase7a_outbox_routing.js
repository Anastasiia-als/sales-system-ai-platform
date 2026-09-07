// scratch/test_phase7a_outbox_routing.js
// Tests Phase 7A: Transactional Outbox, Composite Identity, Server-Side Routing, and Deduplication

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const createdIds = {
    organizations: [],
    projects: [],
    tasks: [],
    endpoints: [],
    events: [],
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
    try {
        console.log('--- Suite 2: Phase 7A Outbox Routing & Deduplication ---');

        // 1. Setup isolated test fixtures
        const orgARes = await client.query(
            "INSERT INTO public.organizations (name) VALUES ('Test Org 7A Routing A') RETURNING id"
        );
        const orgAId = orgARes.rows[0].id;
        createdIds.organizations.push(orgAId);

        const orgBRes = await client.query(
            "INSERT INTO public.organizations (name) VALUES ('Test Org 7A Routing B') RETURNING id"
        );
        const orgBId = orgBRes.rows[0].id;
        createdIds.organizations.push(orgBId);

        const projARes = await client.query(
            "INSERT INTO public.projects (organization_id, name, title) VALUES ($1, 'Test Proj 7A Routing', 'Test Proj 7A Routing') RETURNING id",
            [orgAId]
        );
        const projAId = projARes.rows[0].id;
        createdIds.projects.push(projAId);

        const taskARes = await client.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type) VALUES ($1, $2, 'Test Task 7A Routing', 'todo', 'internal') RETURNING id",
            [orgAId, projAId]
        );
        const taskAId = taskARes.rows[0].id;
        createdIds.tasks.push(taskAId);

        // 2. Create endpoints for Org A and Org B
        // Endpoint A1: Active, subscribes to all events (*)
        const epA1Res = await client.query(`
            SELECT public.create_integration_endpoint(
                '${orgAId}',
                'Endpoint A1 All Events',
                'Receives all events',
                'https://api.example.com/webhook/a1',
                ARRAY['*']
            ) as res;
        `);
        const epA1 = epA1Res.rows[0].res;
        createdIds.endpoints.push(epA1.id);

        // Endpoint A2: Active, subscribes only to 'task.completed'
        const epA2Res = await client.query(`
            SELECT public.create_integration_endpoint(
                '${orgAId}',
                'Endpoint A2 Task Completed',
                'Receives only task completed',
                'https://api.example.com/webhook/a2',
                ARRAY['task.completed']
            ) as res;
        `);
        const epA2 = epA2Res.rows[0].res;
        createdIds.endpoints.push(epA2.id);

        // Endpoint A3: Inactive (is_active = false)
        const epA3Res = await client.query(`
            SELECT public.create_integration_endpoint(
                '${orgAId}',
                'Endpoint A3 Inactive',
                'Inactive endpoint',
                'https://api.example.com/webhook/a3',
                ARRAY['*']
            ) as res;
        `);
        const epA3 = epA3Res.rows[0].res;
        createdIds.endpoints.push(epA3.id);
        await client.query("UPDATE public.integration_endpoints SET is_active = false WHERE id = $1", [epA3.id]);

        // Endpoint A4: Active, subscribes only to 'document.approved'
        const epA4Res = await client.query(`
            SELECT public.create_integration_endpoint(
                '${orgAId}',
                'Endpoint A4 Doc Approved',
                'Receives only doc approved',
                'https://api.example.com/webhook/a4',
                ARRAY['document.approved']
            ) as res;
        `);
        const epA4 = epA4Res.rows[0].res;
        createdIds.endpoints.push(epA4.id);

        // Endpoint B1: Org B endpoint (foreign tenant)
        const epB1Res = await client.query(`
            SELECT public.create_integration_endpoint(
                '${orgBId}',
                'Endpoint B1 Foreign',
                'Belongs to Org B',
                'https://api.example.com/webhook/b1',
                ARRAY['*']
            ) as res;
        `);
        const epB1 = epB1Res.rows[0].res;
        createdIds.endpoints.push(epB1.id);

        // Collect Vault secret IDs for cleanup
        const secretRows = await client.query(
            "SELECT url_secret_id, signing_secret_id FROM public.integration_endpoints WHERE id = ANY($1)",
            [createdIds.endpoints]
        );
        for (const r of secretRows.rows) {
            if (r.url_secret_id) createdIds.vaultSecrets.push(r.url_secret_id);
            if (r.signing_secret_id) createdIds.vaultSecrets.push(r.signing_secret_id);
        }

        // Test 2A & 2B: Emit 'task.completed' event for Org A
        await client.query("BEGIN");
        await client.query("SET LOCAL \"request.jwt.claim.role\" = 'service_role'");
        const emitRes = await client.query(
            "SELECT public._emit_integration_event('task', $1, 'task.completed') as event_id",
            [taskAId]
        );
        const eventId = emitRes.rows[0].event_id;
        await client.query("COMMIT");
        createdIds.events.push(eventId);

        // Query Outbox deliveries created for this event
        const outboxDeliveries = await client.query(
            "SELECT * FROM public.integration_outbox WHERE event_id = $1 ORDER BY destination_id",
            [eventId]
        );

        // Multi-destination delivery cardinality: exactly 2 rows (Endpoint A1 wildcard + Endpoint A2 task.completed)
        assert(outboxDeliveries.rows.length === 2, 'Multi-destination delivery cardinality: exactly 2 distinct rows created for 1 event');

        const destIds = outboxDeliveries.rows.map(r => r.destination_id);
        assert(destIds.includes(epA1.id), 'Endpoint A1 (wildcard) received delivery row');
        assert(destIds.includes(epA2.id), 'Endpoint A2 (task.completed) received delivery row');

        // Test 2C: Inactive destination received 0 deliveries
        assert(!destIds.includes(epA3.id), 'Inactive destination received exactly 0 deliveries');

        // Test 2D: Cross-tenant destination received 0 deliveries
        assert(!destIds.includes(epB1.id), 'Cross-tenant destination (Org B) received exactly 0 deliveries');

        // Test 2E: Unmatched event subscription received 0 deliveries
        assert(!destIds.includes(epA4.id), 'Endpoint A4 (subscribed only to document.approved) received 0 deliveries for task.completed');

        // Test 2F: Delivery identity uniqueness: (event_id, channel_type, destination_id)
        for (const row of outboxDeliveries.rows) {
            assert(row.channel_type === 'webhook', 'Delivery channel_type is webhook');
            assert(row.status === 'pending', 'Initial delivery status is pending');
            assert(row.attempts_count === 0, 'Initial attempts_count is 0');
        }

        // Test 2G: Idempotency & Deduplication under repeated enqueue calls
        const reEnqueueRes = await client.query(
            "SELECT public._enqueue_integration_outbox_deliveries($1) as count",
            [eventId]
        );
        assert(reEnqueueRes.rows[0].count === 0, 'Repeated enqueue invocation created 0 new rows (ON CONFLICT DO NOTHING)');

        const afterCount = await client.query(
            "SELECT COUNT(*) FROM public.integration_outbox WHERE event_id = $1",
            [eventId]
        );
        assert(parseInt(afterCount.rows[0].count, 10) === 2, 'Total outbox rows for event remains exactly 2');

        // Test 2H: Retry updates the same Outbox row, preserving logical identity
        const targetRow = outboxDeliveries.rows[0];
        await client.query(`
            UPDATE public.integration_outbox
            SET status = 'retrying',
                attempts_count = attempts_count + 1,
                last_error = 'Simulated 500 server error',
                last_http_status = 500,
                updated_at = NOW()
            WHERE id = $1
        `, [targetRow.id]);

        const updatedRowRes = await client.query(
            "SELECT * FROM public.integration_outbox WHERE id = $1",
            [targetRow.id]
        );
        const updatedRow = updatedRowRes.rows[0];
        assert(updatedRow.status === 'retrying', 'Delivery row status updated to retrying');
        assert(updatedRow.attempts_count === 1, 'Delivery attempts_count incremented to 1');
        assert(updatedRow.last_http_status === 500, 'Last HTTP status recorded on same row');

        const totalDeliveriesCheck = await client.query(
            "SELECT COUNT(*) FROM public.integration_outbox WHERE event_id = $1",
            [eventId]
        );
        assert(parseInt(totalDeliveriesCheck.rows[0].count, 10) === 2, 'Retry updated the existing row in-place (0 duplicate rows created)');

        // Test 2I: Transactional rollback guarantees no phantom events or deliveries
        let rolledBackEventId = null;
        await client.query("BEGIN");
        await client.query("SET LOCAL \"request.jwt.claim.role\" = 'service_role'");
        const tempEmitRes = await client.query(
            "SELECT public._emit_integration_event('task', $1, 'task.completed') as event_id",
            [taskAId]
        );
        rolledBackEventId = tempEmitRes.rows[0].event_id;
        // Intentionally ROLLBACK
        await client.query("ROLLBACK");

        const phantomEventCheck = await client.query(
            "SELECT * FROM public.integration_events WHERE id = $1",
            [rolledBackEventId]
        );
        assert(phantomEventCheck.rows.length === 0, 'Rolled back event does NOT exist (no phantom event)');

        const phantomOutboxCheck = await client.query(
            "SELECT * FROM public.integration_outbox WHERE event_id = $1",
            [rolledBackEventId]
        );
        assert(phantomOutboxCheck.rows.length === 0, 'Rolled back transaction produced 0 outbox deliveries (no phantom deliveries)');

        console.log(`\nSuite 2 Summary: Passed ${passed}, Failed ${failed}`);
    } catch (err) {
        console.error('Unexpected error in Suite 2:', err);
        failed++;
    } finally {
        try {
            await client.query("SET integration.allow_cleanup = 'on'");
            if (createdIds.tasks.length > 0) {
                await client.query("DELETE FROM public.tasks WHERE id = ANY($1)", [createdIds.tasks]);
            }
            if (createdIds.projects.length > 0) {
                await client.query("DELETE FROM public.projects WHERE id = ANY($1)", [createdIds.projects]);
            }
            if (createdIds.events.length > 0) {
                await client.query("DELETE FROM public.integration_outbox WHERE event_id = ANY($1)", [createdIds.events]);
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
            console.error("Cleanup error in Suite 2:", cleanErr);
        }
        client.release();
        await pool.end();
        process.exit(failed > 0 ? 1 : 0);
    }
}

run();
