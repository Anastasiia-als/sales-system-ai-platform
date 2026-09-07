// scratch/test_phase7b_lifecycle_and_integrity.js
// Tests Phase 7B: Lifecycle, Referential Integrity & Audit Deletion Protection

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const createdIds = {
    organizations: [],
    destinations: [],
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
        console.log('--- Phase 7B: Lifecycle & Referential Integrity Protection Suite ---');

        const orgRes = await client.query("INSERT INTO public.organizations (name) VALUES ('Org 7B Lifecycle') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdIds.organizations.push(orgId);

        const botToken = '5566778899:ABC_Lifecycle_Bot_Token_123';
        const chatId = '-1003344556677';

        // 1. Create Telegram Destination
        const res = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'Audit Protected Channel',
                p_bot_token => $2,
                p_chat_id => $3
            ) as res
        `, [orgId, botToken, chatId]);
        const destId = res.rows[0].res.id;
        createdIds.destinations.push(destId);

        const secRow = await client.query("SELECT bot_token_vault_id FROM public.telegram_destinations WHERE id = $1", [destId]);
        const vaultId = secRow.rows[0].bot_token_vault_id;
        createdIds.vaultSecrets.push(vaultId);

        // Check 1: Toggle active status
        const toggleRes = await client.query("SELECT public.toggle_telegram_destination_active($1, false) as res", [destId]);
        assert(toggleRes.rows[0].res.is_active === false, 'toggle_telegram_destination_active successfully deactivated destination');

        await client.query("SELECT public.toggle_telegram_destination_active($1, true)", [destId]);
        const activeCheck = await client.query("SELECT is_active FROM public.telegram_destinations WHERE id = $1", [destId]);
        assert(activeCheck.rows[0].is_active === true, 'toggle_telegram_destination_active successfully reactivated destination');

        // 2. Simulate historical delivery in integration_outbox
        const evRes = await client.query(`
            INSERT INTO public.integration_events (
                organization_id, entity_type, entity_id, event_type, payload_json
            ) VALUES (
                $1, 'task', gen_random_uuid(), 'task.completed', '{"task_id":"123","title":"Audit Task"}'::jsonb
            ) RETURNING id
        `, [orgId]);
        const eventId = evRes.rows[0].id;
        createdIds.events.push(eventId);

        const outboxRes = await client.query(`
            INSERT INTO public.integration_outbox (
                organization_id, event_id, channel_type, destination_id, status, attempts_count, max_attempts
            ) VALUES (
                $1, $2, 'telegram', $3, 'delivered', 1, 5
            ) RETURNING id
        `, [orgId, eventId, destId]);
        createdIds.outbox.push(outboxRes.rows[0].id);

        // Check 2: Attempting to delete destination with historical deliveries must fail with 23001
        let deleteBlocked = false;
        try {
            await client.query("DELETE FROM public.telegram_destinations WHERE id = $1", [destId]);
        } catch (err) {
            deleteBlocked = err.code === '23001'; // restrict_violation
        }
        assert(deleteBlocked, 'Deletion of Telegram destination with delivery history is blocked by trigger with 23001 RESTRICT_VIOLATION');

        // Check 3: Attempting to delete via RPC delete_telegram_destination also fails
        let rpcDeleteBlocked = false;
        try {
            await client.query("SELECT public.delete_telegram_destination($1)", [destId]);
        } catch (err) {
            rpcDeleteBlocked = err.code === '23001';
        }
        assert(rpcDeleteBlocked, 'RPC delete_telegram_destination preserves audit trail and raises 23001');

        // 3. Create another destination with ZERO delivery history
        const cleanDestRes = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'Temporary Channel',
                p_bot_token => $2,
                p_chat_id => '-1009988771122'
            ) as res
        `, [orgId, botToken]);
        const cleanDestId = cleanDestRes.rows[0].res.id;
        const cleanVaultId = (await client.query("SELECT bot_token_vault_id FROM public.telegram_destinations WHERE id = $1", [cleanDestId])).rows[0].bot_token_vault_id;

        // Check 4: Deletion of destination with 0 deliveries succeeds
        const delRes = await client.query("SELECT public.delete_telegram_destination($1) as res", [cleanDestId]);
        assert(delRes.rows[0].res.deleted === true, 'Deletion of Telegram destination with zero history succeeds');

        // Check 5: Vault secret is cleaned up automatically by trigger
        const vaultCheck = await client.query("SELECT 1 FROM vault.secrets WHERE id = $1", [cleanVaultId]);
        assert(vaultCheck.rows.length === 0, 'Vault secret is cleaned up upon deletion of destination with zero history');

        console.log(`\nResults: ${passed} passed, ${failed} failed`);
        if (failed > 0) process.exit(1);
    } finally {
        await client.query("SET integration.allow_cleanup = 'on'");
        for (const outId of createdIds.outbox) {
            await client.query("DELETE FROM public.integration_outbox WHERE id = $1", [outId]);
        }
        for (const evId of createdIds.events) {
            await client.query("DELETE FROM public.integration_events WHERE id = $1", [evId]);
        }
        for (const destId of createdIds.destinations) {
            await client.query("DELETE FROM public.telegram_destinations WHERE id = $1", [destId]);
        }
        for (const secId of createdIds.vaultSecrets) {
            await client.query("DELETE FROM vault.secrets WHERE id = $1", [secId]);
        }
        for (const orgId of createdIds.organizations) {
            await client.query("DELETE FROM public.organizations WHERE id = $1", [orgId]);
        }
        client.release();
    }
}

run().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
