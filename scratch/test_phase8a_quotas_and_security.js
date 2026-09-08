// scratch/test_phase8a_quotas_and_security.js
// Phase 8A: Quota Enforcement, Multi-Tenant Isolation & Log Immutability Suite

const { Pool } = require('pg');
const { AIGateway } = require('../js/portal/api/ai-gateway.js');
const { getOwnerAuthToken } = require('./auth_test_helper.js');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const gateway = new AIGateway({ pool });

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
    console.log("=== Starting Phase 8A: Quotas & Security Suite ===");
    const client = await pool.connect();

    const createdIds = {
        orgs: []
    };

    try {
        // 1. Setup two isolated organizations: Org Alpha & Org Beta
        const orgARes = await client.query("INSERT INTO public.organizations (name) VALUES ('Org 8A Alpha') RETURNING id");
        const orgA = orgARes.rows[0].id;
        createdIds.orgs.push(orgA);

        const orgBRes = await client.query("INSERT INTO public.organizations (name) VALUES ('Org 8A Beta') RETURNING id");
        const orgB = orgBRes.rows[0].id;
        createdIds.orgs.push(orgB);

        // 2. Configure strict quota for Org Alpha (5000 tokens)
        await client.query(`
            INSERT INTO public.ai_usage_quotas (organization_id, daily_token_limit, used_tokens_today, is_enabled)
            VALUES ($1, 5000, 0, true)
            ON CONFLICT (organization_id) DO UPDATE SET daily_token_limit = 5000, used_tokens_today = 0, is_enabled = true
        `, [orgA]);

        // Configure quota for Org Beta (100,000 tokens)
        await client.query(`
            INSERT INTO public.ai_usage_quotas (organization_id, daily_token_limit, used_tokens_today, is_enabled)
            VALUES ($1, 100000, 0, true)
            ON CONFLICT (organization_id) DO UPDATE SET daily_token_limit = 100000, used_tokens_today = 0, is_enabled = true
        `, [orgB]);

        assert(true, "Quotas configured for Org Alpha (5k) and Org Beta (100k)");

        // 3. First request for Org Alpha consumes 3000 tokens -> Success
        const res1 = await gateway.generateStructured({
            organizationId: orgA,
            featureName: "meeting_summary",
            templateKey: "meeting_intelligence_v1",
            variables: { project_name: "Alpha Project" },
            provider: "mock",
            estimatedTokens: 3000
        });
        assert(res1.ok === true, "First generation for Org Alpha (3000 tokens) succeeded");

        // Verify Org Alpha quota in DB
        const quotaARes1 = await client.query("SELECT daily_token_limit, used_tokens_today FROM public.ai_usage_quotas WHERE organization_id = $1", [orgA]);
        assert(quotaARes1.rows[0].used_tokens_today > 0, "Org Alpha used_tokens_today updated in DB");

        // Verify Org Beta quota was completely untouched (Tenant Isolation)
        const quotaBRes1 = await client.query("SELECT daily_token_limit, used_tokens_today FROM public.ai_usage_quotas WHERE organization_id = $1", [orgB]);
        assert(quotaBRes1.rows[0].used_tokens_today === 0, "Org Beta used_tokens_today remained 0 (strict tenant isolation)");

        // 4. Second request for Org Alpha requesting 6000 tokens -> Exceeds 5000 daily limit -> Fails with QUOTA_EXCEEDED
        let quotaErrorCaught = false;
        try {
            await gateway.generateStructured({
                organizationId: orgA,
                featureName: "meeting_summary",
                templateKey: "meeting_intelligence_v1",
                variables: { project_name: "Alpha Project" },
                provider: "mock",
                estimatedTokens: 6000
            });
        } catch (err) {
            quotaErrorCaught = true;
            assert(err.code === 'QUOTA_EXCEEDED', `Quota error code is 'QUOTA_EXCEEDED' (got '${err.code}')`);
        }
        assert(quotaErrorCaught === true, "Request exceeding daily limit was blocked");

        // Verify quota_exceeded logged in database
        const exceededLog = await client.query(`
            SELECT id, organization_id, status, error_message
            FROM public.ai_generation_logs
            WHERE organization_id = $1 AND status = 'quota_exceeded'
            ORDER BY created_at DESC LIMIT 1
        `, [orgA]);
        assert(exceededLog.rows.length === 1, "Exceeded request recorded in ai_generation_logs with status 'quota_exceeded'");
        assert(exceededLog.rows[0].status === 'quota_exceeded', "Log status is 'quota_exceeded'");

        // 5. Test Disabled Organization
        await client.query("UPDATE public.ai_usage_quotas SET is_enabled = false WHERE organization_id = $1", [orgB]);
        let disabledErrorCaught = false;
        try {
            await gateway.generateStructured({
                organizationId: orgB,
                featureName: "meeting_summary",
                templateKey: "meeting_intelligence_v1",
                variables: { project_name: "Beta Project" },
                provider: "mock",
                estimatedTokens: 500
            });
        } catch (err) {
            disabledErrorCaught = true;
            assert(err.message.includes('ai_disabled_for_organization'), "Disabled organization blocked with 'ai_disabled_for_organization'");
        }
        assert(disabledErrorCaught === true, "Request for disabled organization blocked");

        // 6. Test Direct Mutation Prohibition on ai_generation_logs (Security / Immutability)
        let deleteBlocked = false;
        try {
            await client.query("DELETE FROM public.ai_generation_logs WHERE organization_id = $1", [orgA]);
        } catch (secErr) {
            deleteBlocked = true;
            assert(secErr.code === '23514' || secErr.code === '42501', `Direct DELETE blocked with code 23514/42501 (got ${secErr.code}: ${secErr.message})`);
        }
        assert(deleteBlocked === true, "Direct client deletion of ai_generation_logs is forbidden by append-only trigger");

        // 7. Test HTTP 429 Status Code over Network
        const token = await getOwnerAuthToken();
        const httpResp429 = await fetch("http://localhost:8002/api/v1/ai/generate-structured", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                organizationId: orgA,
                featureName: "meeting_summary",
                templateKey: "meeting_intelligence_v1",
                variables: { project_name: "Alpha Project" },
                provider: "mock",
                estimatedTokens: 999999
            })
        });
        assert(httpResp429.status === 429, `Server returned HTTP 429 Too Many Requests on quota exceed (got ${httpResp429.status})`);
        const json429 = await httpResp429.json();
        assert(json429.code === 'QUOTA_EXCEEDED', "HTTP 429 response body contains code: 'QUOTA_EXCEEDED'");

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
