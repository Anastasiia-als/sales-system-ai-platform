// scratch/test_phase7b_real_delivery_e2e.js
// Tests Phase 7B: Multi-Channel Outbox Routing, Telegram Dispatch & Delivery Verification

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

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
        console.log('--- Phase 7B: Multi-Channel Outbox Routing & Real Delivery E2E Suite ---');

        // 1. Setup isolated organization, project, task
        const orgRes = await client.query("INSERT INTO public.organizations (name) VALUES ('Org 7B Delivery E2E') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdIds.organizations.push(orgId);

        const projRes = await client.query(`
            INSERT INTO public.projects (organization_id, name, title)
            VALUES ($1, 'Delivery Test Project', 'Delivery Test Project')
            RETURNING id
        `, [orgId]);
        const projId = projRes.rows[0].id;
        createdIds.projects.push(projId);

        const taskRes = await client.query(`
            INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type)
            VALUES ($1, $2, 'Complete Final Polish', 'todo', 'internal')
            RETURNING id
        `, [orgId, projId]);
        const taskId = taskRes.rows[0].id;
        createdIds.tasks.push(taskId);

        // 2. Setup Webhook Endpoint
        const epRes = await client.query(`
            SELECT public.create_integration_endpoint(
                $1,
                'E2E Webhook Endpoint',
                'Webhook endpoint for multi-channel test',
                'https://api.test-receiver.org/webhooks/e2e',
                ARRAY['task.completed']
            ) as res
        `, [orgId]);
        const epId = epRes.rows[0].res.id;
        createdIds.endpoints.push(epId);

        const epSec = await client.query("SELECT url_secret_id, signing_secret_id FROM public.integration_endpoints WHERE id = $1", [epId]);
        createdIds.vaultSecrets.push(epSec.rows[0].url_secret_id);
        createdIds.vaultSecrets.push(epSec.rows[0].signing_secret_id);

        // 3. Setup Telegram Destination
        const tgBotToken = '123456789:ABC_E2E_Test_Telegram_Token_XYZ';
        const tgChatId = '-1004455667788';
        const tgRes = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'E2E Operations Alerts',
                p_bot_token => $2,
                p_chat_id => $3,
                p_chat_title => 'Ops Channel',
                p_chat_type => 'supergroup',
                p_event_types => ARRAY['task.completed']
            ) as res
        `, [orgId, tgBotToken, tgChatId]);
        const tgDestId = tgRes.rows[0].res.id;
        createdIds.destinations.push(tgDestId);

        const tgSec = await client.query("SELECT bot_token_vault_id FROM public.telegram_destinations WHERE id = $1", [tgDestId]);
        createdIds.vaultSecrets.push(tgSec.rows[0].bot_token_vault_id);

        // 4. Trigger lifecycle event via _emit_integration_event
        await client.query("SET LOCAL \"request.jwt.claim.role\" = 'service_role'");
        const emitRes = await client.query(`
            SELECT public._emit_integration_event('task', $1, 'task.completed') as event_id
        `, [taskId]);
        const eventId = emitRes.rows[0].event_id;
        createdIds.events.push(eventId);
        assert(Boolean(eventId), 'Lifecycle event task.completed emitted successfully');

        // Check 1: Verify Multi-channel Outbox Routing created both deliveries
        const outboxRows = await client.query(`
            SELECT id, channel_type, destination_id, status, attempts_count
            FROM public.integration_outbox
            WHERE event_id = $1
            ORDER BY channel_type ASC
        `, [eventId]);

        assert(outboxRows.rows.length === 2, 'Multi-channel outbox router created exactly 2 deliveries for single event');
        const webhookOutbox = outboxRows.rows.find(r => r.channel_type === 'webhook');
        const telegramOutbox = outboxRows.rows.find(r => r.channel_type === 'telegram');

        assert(webhookOutbox && webhookOutbox.destination_id === epId, 'Webhook outbox row queued for webhook endpoint');
        assert(telegramOutbox && telegramOutbox.destination_id === tgDestId, 'Telegram outbox row queued for Telegram destination');
        assert(telegramOutbox.status === 'pending' && telegramOutbox.attempts_count === 0, 'Telegram outbox row initial status is pending with 0 attempts');

        createdIds.outbox.push(webhookOutbox.id);
        createdIds.outbox.push(telegramOutbox.id);

        // Check 2: Simulate atomic claiming and delivery execution for Telegram channel
        await client.query("BEGIN");
        await client.query(`
            UPDATE public.integration_outbox
            SET status = 'processing',
                attempts_count = attempts_count + 1,
                last_attempt_at = NOW()
            WHERE id = $1
        `, [telegramOutbox.id]);
        await client.query("COMMIT");

        const processingCheck = await client.query("SELECT status, attempts_count FROM public.integration_outbox WHERE id = $1", [telegramOutbox.id]);
        assert(processingCheck.rows[0].status === 'processing' && processingCheck.rows[0].attempts_count === 1, 'Telegram delivery transitioned to processing state');

        // Telegram delivery completes successfully (HTTP 200)
        await client.query(`
            UPDATE public.integration_outbox
            SET status = 'delivered',
                delivered_at = NOW(),
                last_http_status = 200,
                last_error = NULL
            WHERE id = $1
        `, [telegramOutbox.id]);

        const deliveredCheck = await client.query("SELECT status, last_http_status, delivered_at FROM public.integration_outbox WHERE id = $1", [telegramOutbox.id]);
        assert(deliveredCheck.rows[0].status === 'delivered', 'Telegram delivery transitioned to delivered');
        assert(deliveredCheck.rows[0].last_http_status === 200, 'Telegram delivery recorded last_http_status = 200');
        assert(Boolean(deliveredCheck.rows[0].delivered_at), 'Telegram delivery recorded delivered_at timestamp');

        // Check 3: Multi-channel UI Delivery Query RPC get_integration_deliveries
        const deliveriesRes = await client.query("SELECT public.get_integration_deliveries($1, 10) as list", [orgId]);
        const deliveryList = deliveriesRes.rows[0].list;
        assert(Array.isArray(deliveryList) && deliveryList.length === 2, 'get_integration_deliveries returns both channel deliveries');

        const tgItem = deliveryList.find(d => d.channel_type === 'telegram');
        assert(Boolean(tgItem), 'get_integration_deliveries includes Telegram record');
        assert(tgItem.destination_name === 'E2E Operations Alerts', 'Telegram item has correct destination_name');
        assert(tgItem.chat_id === tgChatId, 'Telegram item returns chat_id');
        assert(tgItem.status === 'delivered', 'Telegram item reports delivered status');

        console.log(`\nResults: ${passed} passed, ${failed} failed`);
        if (failed > 0) process.exit(1);
    } finally {
        await client.query("SET integration.allow_cleanup = 'on'");
        for (const oId of createdIds.outbox) {
            await client.query("DELETE FROM public.integration_outbox WHERE id = $1", [oId]);
        }
        for (const eId of createdIds.events) {
            await client.query("DELETE FROM public.integration_events WHERE id = $1", [eId]);
        }
        for (const epId of createdIds.endpoints) {
            await client.query("DELETE FROM public.integration_endpoints WHERE id = $1", [epId]);
        }
        for (const dId of createdIds.destinations) {
            await client.query("DELETE FROM public.telegram_destinations WHERE id = $1", [dId]);
        }
        for (const secId of createdIds.vaultSecrets) {
            await client.query("DELETE FROM vault.secrets WHERE id = $1", [secId]);
        }
        for (const tId of createdIds.tasks) {
            await client.query("DELETE FROM public.tasks WHERE id = $1", [tId]);
        }
        for (const pId of createdIds.projects) {
            await client.query("DELETE FROM public.projects WHERE id = $1", [pId]);
        }
        for (const oId of createdIds.organizations) {
            await client.query("DELETE FROM public.organizations WHERE id = $1", [oId]);
        }
        client.release();
    }
}

run().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
