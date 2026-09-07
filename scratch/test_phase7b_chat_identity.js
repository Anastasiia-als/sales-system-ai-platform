// scratch/test_phase7b_chat_identity.js
// Tests Phase 7B: 64-bit Negative Chat IDs, Channel Usernames, and Nullable Thread IDs

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
        console.log('--- Phase 7B: Chat Identity & 64-bit ID Precision Suite ---');

        const orgRes = await client.query("INSERT INTO public.organizations (name) VALUES ('Org 7B Chat Precision') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdIds.organizations.push(orgId);

        const botToken = '888888888:ABC_Precision_Token_123456';

        // 1. Negative 64-bit Supergroup Chat ID (e.g. -1002345678901234)
        const supergroupId = '-1002345678901234';
        const res1 = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'Supergroup Destination',
                p_bot_token => $2,
                p_chat_id => $3,
                p_chat_type => 'supergroup'
            ) as res
        `, [orgId, botToken, supergroupId]);
        const id1 = res1.rows[0].res.id;
        createdIds.destinations.push(id1);

        const check1 = await client.query("SELECT chat_id, chat_type, bot_token_vault_id FROM public.telegram_destinations WHERE id = $1", [id1]);
        createdIds.vaultSecrets.push(check1.rows[0].bot_token_vault_id);
        assert(check1.rows[0].chat_id === supergroupId, 'Negative 64-bit supergroup ID stored without sign or precision loss');
        assert(check1.rows[0].chat_type === 'supergroup', 'Chat type supergroup preserved');

        // 2. Channel with @username as chat_id
        const channelUsername = '@firstwin_official_announcements';
        const res2 = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'Public Channel',
                p_bot_token => $2,
                p_chat_id => $3,
                p_chat_type => 'channel'
            ) as res
        `, [orgId, botToken, channelUsername]);
        const id2 = res2.rows[0].res.id;
        createdIds.destinations.push(id2);

        const check2 = await client.query("SELECT chat_id, chat_type, bot_token_vault_id FROM public.telegram_destinations WHERE id = $1", [id2]);
        createdIds.vaultSecrets.push(check2.rows[0].bot_token_vault_id);
        assert(check2.rows[0].chat_id === channelUsername, 'Channel @username chat_id stored verbatim');
        assert(check2.rows[0].chat_type === 'channel', 'Chat type channel preserved');

        // 3. Negative Standard Group ID (e.g. -456789012)
        const standardGroupId = '-456789012';
        const res3 = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'Legacy Group',
                p_bot_token => $2,
                p_chat_id => $3,
                p_chat_type => 'group'
            ) as res
        `, [orgId, botToken, standardGroupId]);
        const id3 = res3.rows[0].res.id;
        createdIds.destinations.push(id3);

        const check3 = await client.query("SELECT chat_id, chat_type, bot_token_vault_id FROM public.telegram_destinations WHERE id = $1", [id3]);
        createdIds.vaultSecrets.push(check3.rows[0].bot_token_vault_id);
        assert(check3.rows[0].chat_id === standardGroupId, 'Legacy group ID stored accurately');

        // 4. Thread ID with large BIGINT number (e.g. topic ID 999999999999)
        const largeThreadId = 999999999999;
        const res4 = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'Forum Supergroup Topic',
                p_bot_token => $2,
                p_chat_id => '-1003333333333333',
                p_thread_id => $3,
                p_chat_type => 'supergroup'
            ) as res
        `, [orgId, botToken, largeThreadId]);
        const id4 = res4.rows[0].res.id;
        createdIds.destinations.push(id4);

        const check4 = await client.query("SELECT thread_id, bot_token_vault_id FROM public.telegram_destinations WHERE id = $1", [id4]);
        createdIds.vaultSecrets.push(check4.rows[0].bot_token_vault_id);
        assert(Number(check4.rows[0].thread_id) === largeThreadId, 'Large 64-bit thread_id preserved without precision truncation');

        // 5. Verify get_telegram_destinations returns chat_id as string
        const listRes = await client.query("SELECT public.get_telegram_destinations($1) as list", [orgId]);
        const list = listRes.rows[0].list;
        const supergroupItem = list.find(d => d.id === id1);
        assert(typeof supergroupItem.chat_id === 'string' && supergroupItem.chat_id === supergroupId,
            'get_telegram_destinations returns chat_id as exact string type'
        );

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
