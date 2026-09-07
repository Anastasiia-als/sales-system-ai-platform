// scratch/test_phase7b_auth_task_completed_fanout.js
// Tests Phase 7B: Authenticated user UI trigger path emits task.completed with fan-out to both Webhook and Telegram

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const ownerId = '27852879-0d5f-4c72-889d-69a0989302d2';

const createdIds = {
    organizations: [],
    projects: [],
    tasks: [],
    destinations: [],
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
    try {
        console.log('--- Phase 7B: Authenticated Trigger Fan-out Suite ---');

        // 1. Setup isolated organization, project, task
        const orgRes = await client.query("INSERT INTO public.organizations (name) VALUES ('Org 7B Auth Fanout Test') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdIds.organizations.push(orgId);

        // Add owner to organization
        await client.query(`
            INSERT INTO public.organization_memberships (organization_id, user_id, org_role)
            VALUES ($1, $2, 'owner')
            ON CONFLICT DO NOTHING
        `, [orgId, ownerId]);

        const projRes = await client.query(`
            INSERT INTO public.projects (organization_id, name, title)
            VALUES ($1, 'Fanout Test Project', 'Fanout Test Project')
            RETURNING id
        `, [orgId]);
        const projId = projRes.rows[0].id;
        createdIds.projects.push(projId);

        const taskRes = await client.query(`
            INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type)
            VALUES ($1, $2, 'Test Fanout Task', 'todo', 'internal')
            RETURNING id
        `, [orgId, projId]);
        const taskId = taskRes.rows[0].id;
        createdIds.tasks.push(taskId);

        // 2. Setup Webhook Endpoint
        const epRes = await client.query(`
            SELECT public.create_integration_endpoint(
                $1,
                'Fanout Webhook Endpoint',
                'Webhook endpoint for fanout test',
                'https://api.test-fanout-receiver.org/webhooks/test',
                ARRAY['task.completed']
            ) as res
        `, [orgId]);
        const epId = epRes.rows[0].res.id;
        createdIds.endpoints.push(epId);

        const epSec = await client.query("SELECT url_secret_id, signing_secret_id FROM public.integration_endpoints WHERE id = $1", [epId]);
        createdIds.vaultSecrets.push(epSec.rows[0].url_secret_id);
        createdIds.vaultSecrets.push(epSec.rows[0].signing_secret_id);

        // 3. Setup Telegram Destination
        const tgBotToken = '123456789:ABC_Fanout_Test_Telegram_Token_XYZ';
        const tgChatId = '-1009988776655';
        const tgRes = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'Fanout Telegram Alerts',
                p_bot_token => $2,
                p_chat_id => $3,
                p_chat_title => 'Fanout Ops Channel',
                p_chat_type => 'supergroup',
                p_event_types => ARRAY['task.completed']
            ) as res
        `, [orgId, tgBotToken, tgChatId]);
        const tgDestId = tgRes.rows[0].res.id;
        createdIds.destinations.push(tgDestId);

        const tgSec = await client.query("SELECT bot_token_vault_id FROM public.telegram_destinations WHERE id = $1", [tgDestId]);
        createdIds.vaultSecrets.push(tgSec.rows[0].bot_token_vault_id);

        // 4. Test 1: Direct invocation of _emit_integration_event by authenticated role must be denied (42501)
        await client.query('BEGIN');
        await client.query("SET LOCAL role TO authenticated");
        await client.query(`SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}","role":"authenticated"}'`);
        await client.query("SET LOCAL \"request.jwt.claim.role\" = 'authenticated'");
        await client.query(`SET LOCAL \"request.jwt.claim.sub\" = '${ownerId}'`);

        let directCallBlocked = false;
        try {
            await client.query("SELECT public._emit_integration_event('task', $1, 'task.completed')", [taskId]);
        } catch (err) {
            if (err.code === '42501') {
                directCallBlocked = true;
            }
        }
        await client.query('ROLLBACK');
        assert(directCallBlocked, "Direct invocation of _emit_integration_event by authenticated role is blocked (42501)");

        // 5. Test 2: Status transition todo -> done by authenticated user triggers event and outbox routing
        await client.query('BEGIN');
        await client.query("SET LOCAL role TO authenticated");
        await client.query(`SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}","role":"authenticated"}'`);
        await client.query("SET LOCAL \"request.jwt.claim.role\" = 'authenticated'");
        await client.query(`SET LOCAL \"request.jwt.claim.sub\" = '${ownerId}'`);

        const updateRes = await client.query("UPDATE public.tasks SET status = 'done' WHERE id = $1 RETURNING id, status", [taskId]);
        assert(updateRes.rows.length === 1 && updateRes.rows[0].status === 'done', "Task updated to done under authenticated session");
        await client.query('COMMIT');

        // Inspect event and outbox
        const evRes = await client.query(`
            SELECT id, event_type, organization_id, payload_json
            FROM public.integration_events
            WHERE entity_id = $1 AND event_type = 'task.completed'
            ORDER BY created_at DESC
            LIMIT 1
        `, [taskId]);
        assert(evRes.rows.length === 1, "Integration event task.completed was created via database trigger");
        const eventId = evRes.rows[0].id;
        createdIds.events.push(eventId);

        // 6. Test 3: Fan-out outbox routing created BOTH webhook and telegram deliveries
        const outboxRows = await client.query(`
            SELECT id, channel_type, destination_id, status, attempts_count
            FROM public.integration_outbox
            WHERE event_id = $1
            ORDER BY channel_type ASC
        `, [eventId]);

        assert(outboxRows.rows.length === 2, "Outbox fan-out router created exactly 2 deliveries (1 webhook, 1 telegram)");
        const whRow = outboxRows.rows.find(r => r.channel_type === 'webhook');
        const tgRow = outboxRows.rows.find(r => r.channel_type === 'telegram');

        assert(whRow && whRow.destination_id === epId, "Webhook delivery queued for the correct endpoint");
        assert(tgRow && tgRow.destination_id === tgDestId, "Telegram delivery queued for the correct destination");
        assert(whRow.status === 'pending' && tgRow.status === 'pending', "Both deliveries are initialized in pending state");

        // 7. Test 4: Idempotency: re-updating already 'done' task does not re-emit
        await client.query('BEGIN');
        await client.query("SET LOCAL role TO authenticated");
        await client.query(`SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}","role":"authenticated"}'`);
        await client.query("SET LOCAL \"request.jwt.claim.role\" = 'authenticated'");
        await client.query(`SET LOCAL \"request.jwt.claim.sub\" = '${ownerId}'`);

        await client.query("UPDATE public.tasks SET title = 'Test Fanout Task Updated' WHERE id = $1", [taskId]);
        await client.query('COMMIT');

        const outboxCountAfter = await client.query("SELECT COUNT(*) FROM public.integration_outbox WHERE event_id = $1", [eventId]);
        assert(parseInt(outboxCountAfter.rows[0].count, 10) === 2, "Re-updating already 'done' task is idempotent and does not create duplicate deliveries");

    } catch (err) {
        console.error("Test execution error:", err);
        failed++;
    } finally {
        // Clean up test data
        console.log("Cleaning up test resources...");
        try {
            await client.query("RESET ROLE");
            for (const outId of createdIds.outbox) {
                await client.query("DELETE FROM public.integration_outbox WHERE id = $1", [outId]);
            }
            for (const evId of createdIds.events) {
                await client.query("DELETE FROM public.integration_outbox WHERE event_id = $1", [evId]);
                await client.query("DELETE FROM public.integration_events WHERE id = $1", [evId]);
            }
            for (const tId of createdIds.tasks) {
                await client.query("DELETE FROM public.tasks WHERE id = $1", [tId]);
            }
            for (const pId of createdIds.projects) {
                await client.query("DELETE FROM public.projects WHERE id = $1", [pId]);
            }
            for (const epId of createdIds.endpoints) {
                await client.query("DELETE FROM public.integration_endpoints WHERE id = $1", [epId]);
            }
            for (const dId of createdIds.destinations) {
                await client.query("DELETE FROM public.telegram_destinations WHERE id = $1", [dId]);
            }
            for (const secId of createdIds.vaultSecrets) {
                if (secId) {
                    await client.query("DELETE FROM vault.secrets WHERE id = $1", [secId]);
                }
            }
            for (const oId of createdIds.organizations) {
                await client.query("DELETE FROM public.organization_memberships WHERE organization_id = $1", [oId]);
                await client.query("DELETE FROM public.organizations WHERE id = $1", [oId]);
            }
        } catch (cleanupErr) {
            console.warn("Cleanup warning:", cleanupErr.message);
        }
        client.release();
        await pool.end();

        console.log(`\nResults: ${passed} passed, ${failed} failed`);
        process.exit(failed === 0 ? 0 : 1);
    }
}

run();
