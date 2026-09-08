// scratch/test_phase8a_vault_and_keys.js
// Phase 8A: Zero-Leakage & API Key Security Suite

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

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
    console.log("=== Starting Phase 8A: Vault & Key Security Suite ===");
    const client = await pool.connect();

    const createdIds = {
        orgs: []
    };

    try {
        const orgRes = await client.query("INSERT INTO public.organizations (name) VALUES ('Org 8A Security') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdIds.orgs.push(orgId);

        // 1. Invariant 1: Zero API Keys in public tables
        const tableCols = await client.query(`
            SELECT column_name, table_name
            FROM information_schema.columns
            WHERE table_schema = 'public' 
              AND (column_name ILIKE '%api_key%' OR column_name ILIKE '%secret_key%' OR column_name ILIKE '%gemini_key%')
              AND table_name LIKE 'ai_%';
        `);
        assert(tableCols.rows.length === 0, "No plain API key columns exist in public.ai_* tables");

        // 2. Invariant 2: Logs do not contain sensitive tokens or keys
        const logsAudit = await client.query(`
            SELECT id, feature_name, error_message
            FROM public.ai_generation_logs
            WHERE error_message ILIKE '%AIzaSy%' 
               OR error_message ILIKE '%sk-ant-%' 
               OR error_message ILIKE '%sk-%';
        `);
        assert(logsAudit.rows.length === 0, "No raw provider API keys leaked into ai_generation_logs error_message");

        // 3. Invariant 3: HTTP API does not leak provider credentials or stack traces
        const invalidTplResp = await fetch("http://localhost:8002/api/v1/ai/generate-structured", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                organizationId: orgId,
                featureName: "invalid_test",
                templateKey: "non_existent_template_xyz",
                variables: {},
                provider: "mock"
            })
        });
        assert(invalidTplResp.status === 400, `Invalid template returned HTTP 400 (got ${invalidTplResp.status})`);
        const invalidJson = await invalidTplResp.json();
        assert(invalidJson.ok === false, "Response body contains ok: false");
        assert(!JSON.stringify(invalidJson).includes("DATABASE_URL") && !JSON.stringify(invalidJson).includes("postgres://"), "Response does not leak database connection strings");
        assert(!JSON.stringify(invalidJson).includes("GEMINI_API_KEY"), "Response does not leak environment API key names or values");

        // 4. Invariant 4: OPTIONS Preflight Security Headers
        const optionsResp = await fetch("http://localhost:8002/api/v1/ai/generate-structured", {
            method: "OPTIONS"
        });
        assert(optionsResp.status === 204, `OPTIONS preflight returns HTTP 204 (got ${optionsResp.status})`);
        assert(optionsResp.headers.get("access-control-allow-methods").includes("POST"), "CORS allows POST method");

        console.log(`\nResults: ${passed} passed, ${failed} failed`);
        if (failed > 0) process.exit(1);
    } finally {
        try {
            await client.query("SET session_replication_role = 'replica';");
            for (const orgId of createdIds.orgs) {
                await client.query("DELETE FROM public.ai_generation_logs WHERE organization_id = $1", [orgId]);
                await client.query("DELETE FROM public.ai_usage_quotas WHERE organization_id = $1", [orgId]);
                await client.query("DELETE FROM public.organizations WHERE id = $1", [orgId]);
            }
            await client.query("SET session_replication_role = 'origin';");
        } catch (_) {}
        client.release();
        await pool.end();
    }
}

run();
