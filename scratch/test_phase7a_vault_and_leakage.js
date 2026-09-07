// scratch/test_phase7a_vault_and_leakage.js
// Tests Phase 7A: Vault-Only Secret Storage, URL Capability Token Masking, and Zero-Leakage Audit

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const createdIds = {
    organizations: [],
    endpoints: [],
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
        console.log('--- Suite 4: Phase 7A Vault Storage & Secret Leakage Audit ---');

        // 1. Setup isolated organization
        const orgRes = await client.query(
            "INSERT INTO public.organizations (name) VALUES ('Test Org 7A Vault Audit') RETURNING id"
        );
        const orgId = orgRes.rows[0].id;
        createdIds.organizations.push(orgId);

        // Capability token in target URL
        const capabilityToken = 'TOKEN_SECRET_XYZ_999888777';
        const targetUrl = `https://external-hook.service.com/relay/v1/${capabilityToken}?auth_key=SUPER_SECRET_KEY_123`;

        // Create endpoint via hardened RPC
        const createRes = await client.query(`
            SELECT public.create_integration_endpoint(
                '${orgId}',
                'Capability Token Webhook',
                'Webhook with capability token in URL',
                '${targetUrl}',
                ARRAY['*']
            ) as res;
        `);
        const ep = createRes.rows[0].res;
        createdIds.endpoints.push(ep.id);

        const secRow = await client.query(
            "SELECT url_secret_id, signing_secret_id FROM public.integration_endpoints WHERE id = $1",
            [ep.id]
        );
        const urlSecId = secRow.rows[0].url_secret_id;
        const sigSecId = secRow.rows[0].signing_secret_id;
        createdIds.vaultSecrets.push(urlSecId);
        createdIds.vaultSecrets.push(sigSecId);

        // Test 4A: Vault-only storage of full target URL
        const vaultUrlRow = await client.query(
            "SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = $1",
            [urlSecId]
        );
        assert(vaultUrlRow.rows.length === 1, 'Target URL exists in Vault');
        assert(vaultUrlRow.rows[0].decrypted_secret === targetUrl, 'Vault stores the exact target URL');

        // Test 4B: Vault-only storage of HMAC signing secret
        const vaultSigRow = await client.query(
            "SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = $1",
            [sigSecId]
        );
        assert(vaultSigRow.rows.length === 1, 'Signing secret exists in Vault');
        assert(vaultSigRow.rows[0].decrypted_secret.startsWith('fws_'), 'Signing secret has fws_ prefix');
        assert(vaultSigRow.rows[0].decrypted_secret.length === 68, 'Signing secret has 256-bit CSPRNG length (fws_ + 64 hex chars)');

        // Test 4C: Persistent application table contains ONLY non-secret metadata
        const epTableData = await client.query(
            "SELECT * FROM public.integration_endpoints WHERE id = $1",
            [ep.id]
        );
        const epRow = epTableData.rows[0];

        assert(epRow.url_hostname === 'external-hook.service.com', 'url_hostname is clean hostname without path/token');
        assert(epRow.url_masked === 'https://external-hook.service.com/***', 'url_masked contains only masked preview');
        assert(!epRow.url_masked.includes(capabilityToken), 'url_masked does NOT contain capability token');
        assert(!epRow.url_masked.includes('SUPER_SECRET_KEY_123'), 'url_masked does NOT contain query auth key');

        // Test 4D: Table columns schema audit - verify NO plaintext secret or URL columns exist
        const colNames = await client.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'integration_endpoints'"
        );
        const cols = colNames.rows.map(r => r.column_name);
        assert(!cols.includes('url'), 'Table integration_endpoints does not have plaintext url column');
        assert(!cols.includes('target_url'), 'Table integration_endpoints does not have plaintext target_url column');
        assert(!cols.includes('secret'), 'Table integration_endpoints does not have plaintext secret column');
        assert(!cols.includes('signing_secret'), 'Table integration_endpoints does not have plaintext signing_secret column');

        // Test 4E: Comprehensive full-row serialization scan on integration_endpoints
        const serializedRow = JSON.stringify(epRow);
        assert(!serializedRow.includes(capabilityToken), 'Capability token is 100% absent from integration_endpoints DB row');
        assert(!serializedRow.includes('SUPER_SECRET_KEY_123'), 'Query secret is 100% absent from integration_endpoints DB row');
        assert(!serializedRow.includes(vaultSigRow.rows[0].decrypted_secret), 'Raw signing secret is 100% absent from integration_endpoints DB row');

        // Test 4F: Safe client listing RPC get_integration_endpoints
        const listRes = await client.query(
            "SELECT public.get_integration_endpoints($1) as res",
            [orgId]
        );
        const listedEndpoints = listRes.rows[0].res;
        assert(Array.isArray(listedEndpoints) && listedEndpoints.length === 1, 'get_integration_endpoints returns array of endpoints');

        const listedEp = listedEndpoints[0];
        assert(listedEp.signing_secret === undefined, 'get_integration_endpoints does not return signing_secret');
        assert(listedEp.url_secret_id === undefined, 'get_integration_endpoints does not expose url_secret_id');
        assert(listedEp.signing_secret_id === undefined, 'get_integration_endpoints does not expose signing_secret_id');
        assert(listedEp.url_masked === 'https://external-hook.service.com/***', 'get_integration_endpoints returns masked preview');

        const serializedList = JSON.stringify(listedEndpoints);
        assert(!serializedList.includes(capabilityToken), 'Capability token is 100% absent from get_integration_endpoints response');
        assert(!serializedList.includes('SUPER_SECRET_KEY_123'), 'Query secret is 100% absent from get_integration_endpoints response');

        console.log(`\nSuite 4 Summary: Passed ${passed}, Failed ${failed}`);
    } catch (err) {
        console.error('Unexpected error in Suite 4:', err);
        failed++;
    } finally {
        try {
            await client.query("SET integration.allow_cleanup = 'on'");
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
            console.error("Cleanup error in Suite 4:", cleanErr);
        }
        client.release();
        await pool.end();
        process.exit(failed > 0 ? 1 : 0);
    }
}

run();
