// scratch/test_phase7b_vault_and_leakage.js
// Tests Phase 7B: Vault-Only Secret Storage, Token Zero-Leakage & Internal RPC Isolation

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
        console.log('--- Phase 7B: Vault Secret Storage & Zero-Leakage Audit Suite ---');

        const orgRes = await client.query(
            "INSERT INTO public.organizations (name) VALUES ('Test Org 7B Vault Leakage') RETURNING id"
        );
        const orgId = orgRes.rows[0].id;
        createdIds.organizations.push(orgId);

        const secretBotToken = '123456789:TOP_SECRET_BOT_TOKEN_DO_NOT_LEAK_123';
        const chatId = '-1008877665544';

        // 1. Create destination via RPC
        const createRes = await client.query(`
            SELECT public.create_telegram_destination(
                p_organization_id => $1,
                p_name => 'Confidential Alerts Dest',
                p_bot_token => $2,
                p_chat_id => $3
            ) as res
        `, [orgId, secretBotToken, chatId]);

        const destData = createRes.rows[0].res;
        const destId = destData.id;
        createdIds.destinations.push(destId);

        // Check 1: Return value of create_telegram_destination MUST NOT contain bot token
        const createJsonStr = JSON.stringify(destData);
        assert(!createJsonStr.includes(secretBotToken), 'create_telegram_destination RPC response does NOT contain plaintext bot token');

        // Check 2: Table structure of public.telegram_destinations MUST NOT contain token column
        const colsRes = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'telegram_destinations'
        `);
        const colNames = colsRes.rows.map(r => r.column_name);
        assert(!colNames.includes('bot_token') && !colNames.includes('token'), 'public.telegram_destinations table has no plaintext token column');

        // Check 3: Public table row has vault secret id, and nowhere in row does the raw token appear
        const destRow = await client.query(
            "SELECT * FROM public.telegram_destinations WHERE id = $1",
            [destId]
        );
        const rowJsonStr = JSON.stringify(destRow.rows[0]);
        const vaultId = destRow.rows[0].bot_token_vault_id;
        createdIds.vaultSecrets.push(vaultId);
        assert(Boolean(vaultId), 'Destination row stores bot_token_vault_id pointer to Supabase Vault');
        assert(!rowJsonStr.includes(secretBotToken), 'Raw destination row in public table does NOT contain bot token string');

        // Check 4: Full bot token is safely stored in Supabase Vault and decryptable only via vault
        const vaultRes = await client.query(
            "SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = $1",
            [vaultId]
        );
        assert(
            vaultRes.rows.length === 1 && vaultRes.rows[0].decrypted_secret === secretBotToken,
            'Bot token successfully retrieved from vault.decrypted_secrets'
        );

        // Check 5: Query destinations RPC get_telegram_destinations does NOT leak token or vault secret
        const listRes = await client.query(`
            SELECT public.get_telegram_destinations($1) as list
        `, [orgId]);
        const listJsonStr = JSON.stringify(listRes.rows[0].list);
        assert(!listJsonStr.includes(secretBotToken), 'get_telegram_destinations RPC response does NOT leak bot token');
        assert(!listJsonStr.includes(vaultId), 'get_telegram_destinations RPC response does NOT leak bot_token_vault_id');

        // Check 6: Internal secret retrieval function is strictly restricted
        // Simulate authenticated / anon role attempting to call get_telegram_destination_secret_internal
        let anonAccessBlocked = false;
        try {
            await client.query('BEGIN');
            await client.query("SET LOCAL \"request.jwt.claim.role\" = 'authenticated'");
            await client.query("SELECT * FROM public.get_telegram_destination_secret_internal($1, $2)", [destId, orgId]);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            anonAccessBlocked = err.code === '42501'; // permission_denied
        }
        assert(anonAccessBlocked, 'get_telegram_destination_secret_internal blocks authenticated user with 42501 Access Denied');

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
