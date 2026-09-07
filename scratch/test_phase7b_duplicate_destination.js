// scratch/test_phase7b_duplicate_destination.js
// Tests Phase 7B: Canonical Telegram Destination Identity & Deduplication Invariant

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
        console.log('--- Phase 7B: Destination Identity & Deduplication Suite ---');

        const orgRes = await client.query(
            "INSERT INTO public.organizations (name) VALUES ('Test Org 7B Deduplication') RETURNING id"
        );
        const orgId = orgRes.rows[0].id;
        createdIds.organizations.push(orgId);

        const botToken = '987654321:XYZ_Test_Token_1234567890';
        const chatId = '-1009988776655';

        // 1. Create initial active destination with thread_id = NULL
        const res1 = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'Primary Alerts Channel',
                p_bot_token => $2,
                p_chat_id => $3,
                p_thread_id => NULL
            ) as res
        `, [orgId, botToken, chatId]);
        const destId1 = res1.rows[0].res.id;
        createdIds.destinations.push(destId1);

        const secRow1 = await client.query("SELECT bot_token_vault_id FROM public.telegram_destinations WHERE id = $1", [destId1]);
        createdIds.vaultSecrets.push(secRow1.rows[0].bot_token_vault_id);
        assert(Boolean(destId1), 'First active Telegram destination created successfully');

        // 2. Attempt to create duplicate active destination (same org, bot, chat, null thread)
        let dupBlocked = false;
        try {
            await client.query(`
                SELECT public.create_telegram_destination(
                    p_organization_id => $1,
                    p_name => 'Duplicate Alerts Channel',
                    p_bot_token => $2,
                    p_chat_id => $3,
                    p_thread_id => NULL
                ) as res
            `, [orgId, botToken, chatId]);
        } catch (err) {
            dupBlocked = err.code === '23505'; // unique_violation
        }
        assert(dupBlocked, 'Duplicate active destination with NULL thread_id is blocked by uq_telegram_dest_active_endpoint');

        // 3. Create destination in SAME chat but with specific thread_id (topic)
        const resTopic1 = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'Topic 42 Alerts',
                p_bot_token => $2,
                p_chat_id => $3,
                p_thread_id => 42
            ) as res
        `, [orgId, botToken, chatId]);
        const destTopic1Id = resTopic1.rows[0].res.id;
        createdIds.destinations.push(destTopic1Id);

        const secRowTopic1 = await client.query("SELECT bot_token_vault_id FROM public.telegram_destinations WHERE id = $1", [destTopic1Id]);
        createdIds.vaultSecrets.push(secRowTopic1.rows[0].bot_token_vault_id);
        assert(Boolean(destTopic1Id), 'Different thread_id in same chat is allowed as distinct destination identity');

        // 4. Attempt duplicate for same topic
        let topicDupBlocked = false;
        try {
            await client.query(`
                SELECT public.create_telegram_destination(
                    p_organization_id => $1,
                    p_name => 'Duplicate Topic 42',
                    p_bot_token => $2,
                    p_chat_id => $3,
                    p_thread_id => 42
                ) as res
            `, [orgId, botToken, chatId]);
        } catch (err) {
            topicDupBlocked = err.code === '23505';
        }
        assert(topicDupBlocked, 'Duplicate active destination with same thread_id is blocked');

        // 5. Deactivate initial destination, then re-creating becomes permitted
        await client.query("UPDATE public.telegram_destinations SET is_active = false WHERE id = $1", [destId1]);

        const resReactivated = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'Replacement Active Channel',
                p_bot_token => $2,
                p_chat_id => $3,
                p_thread_id => NULL
            ) as res
        `, [orgId, botToken, chatId]);
        const reactivatedId = resReactivated.rows[0].res.id;
        createdIds.destinations.push(reactivatedId);

        const secRowReact = await client.query("SELECT bot_token_vault_id FROM public.telegram_destinations WHERE id = $1", [reactivatedId]);
        createdIds.vaultSecrets.push(secRowReact.rows[0].bot_token_vault_id);
        assert(Boolean(reactivatedId), 'Deactivated destination no longer conflicts with new active destination');

        console.log(`\nResults: ${passed} passed, ${failed} failed`);
        if (failed > 0) process.exit(1);
    } finally {
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
