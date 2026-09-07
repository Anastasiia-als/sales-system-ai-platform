// scratch/test_phase7b_allowlist_and_events.js
// Tests Phase 7B: Event Allowlist Constraint and Server-Side Wildcard Expansion

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const createdIds = {
    organizations: [],
    destinations: [],
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
        console.log('--- Phase 7B: Event Allowlist & Wildcard Expansion Suite ---');

        // 1. Setup isolated organization
        const orgRes = await client.query(
            "INSERT INTO public.organizations (name) VALUES ('Test Org 7B Events') RETURNING id"
        );
        const orgId = orgRes.rows[0].id;
        createdIds.organizations.push(orgId);

        const dummyBotToken = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_test1';

        // 2. Test direct table INSERT with illegal event type (should fail chk_tg_dest_event_types)
        let checkViolated = false;
        try {
            await client.query(`
                INSERT INTO public.telegram_destinations (
                    organization_id, name, bot_id, bot_username, bot_token_vault_id,
                    chat_id, chat_title, chat_type, event_types
                ) VALUES (
                    $1, 'Illegal Event Dest', 123456789, 'test_bot', gen_random_uuid(),
                    '-1001234567890', 'Test Chat', 'supergroup', ARRAY['user.login']
                )
            `, [orgId]);
        } catch (err) {
            checkViolated = err.code === '23514'; // check_violation
        }
        assert(checkViolated, 'Direct table INSERT with non-allowlisted event fails check constraint chk_tg_dest_event_types');

        // 3. Test direct table INSERT with wildcard '*' (should fail chk_tg_dest_event_types because '*' is not an event)
        let wildcardDirectViolated = false;
        try {
            await client.query(`
                INSERT INTO public.telegram_destinations (
                    organization_id, name, bot_id, bot_username, bot_token_vault_id,
                    chat_id, chat_title, chat_type, event_types
                ) VALUES (
                    $1, 'Wildcard Dest', 123456789, 'test_bot', gen_random_uuid(),
                    '-1001234567890', 'Test Chat', 'supergroup', ARRAY['*']
                )
            `, [orgId]);
        } catch (err) {
            wildcardDirectViolated = err.code === '23514';
        }
        assert(wildcardDirectViolated, 'Direct table INSERT with wildcard * is blocked by DB check constraint');

        // 4. Test create_telegram_destination RPC with '*' (must expand strictly to 4 approved events)
        const rpcRes = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'Expanded Wildcard Dest',
                p_bot_token => $2,
                p_chat_id => '-1001234567891',
                p_description => 'Dest created with wildcard *',
                p_event_types => ARRAY['*']
            ) as res
        `, [orgId, dummyBotToken]);

        const destId = rpcRes.rows[0].res.id;
        createdIds.destinations.push(destId);

        const checkRow = await client.query(
            "SELECT event_types, bot_token_vault_id FROM public.telegram_destinations WHERE id = $1",
            [destId]
        );
        createdIds.vaultSecrets.push(checkRow.rows[0].bot_token_vault_id);

        const storedEvents = checkRow.rows[0].event_types;
        const expectedEvents = ['task.completed', 'stage.completed', 'document.approved', 'client_action.completed'];
        const matchesAllowlist = expectedEvents.every(e => storedEvents.includes(e)) && storedEvents.length === 4;
        assert(matchesAllowlist, 'RPC create_telegram_destination expands * strictly to the 4 approved production events in DB');

        // 5. Test create_telegram_destination with subset of events
        const subsetRes = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'Subset Event Dest',
                p_bot_token => $2,
                p_chat_id => '-1001234567892',
                p_description => 'Dest created with subset',
                p_event_types => ARRAY['document.approved', 'client_action.completed']
            ) as res
        `, [orgId, dummyBotToken]);
        const subsetDestId = subsetRes.rows[0].res.id;
        createdIds.destinations.push(subsetDestId);

        const subsetRow = await client.query(
            "SELECT event_types, bot_token_vault_id FROM public.telegram_destinations WHERE id = $1",
            [subsetDestId]
        );
        createdIds.vaultSecrets.push(subsetRow.rows[0].bot_token_vault_id);

        const subsetEvents = subsetRow.rows[0].event_types;
        assert(
            subsetEvents.length === 2 && subsetEvents.includes('document.approved') && subsetEvents.includes('client_action.completed'),
            'RPC create_telegram_destination stores exact approved subset'
        );

        console.log(`\nResults: ${passed} passed, ${failed} failed`);
        if (failed > 0) process.exit(1);
    } finally {
        // Cleanup
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
