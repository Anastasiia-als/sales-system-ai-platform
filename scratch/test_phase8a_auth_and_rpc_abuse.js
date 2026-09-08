// scratch/test_phase8a_auth_and_rpc_abuse.js
// Phase 8A: Authoritative Identity, Multi-Tenant Boundaries, RPC Privilege Revocation & Production Mock Lockdown Suite

const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const { getOwnerAuthToken, SUPABASE_URL, SUPABASE_ANON_KEY } = require('./auth_test_helper.js');

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
    console.log("=== Starting Phase 8A: Auth, RPC Abuse & Boundary Hardening Suite ===");
    const client = await pool.connect();
    const created = { orgs: [], projs: [], users: [] };

    try {
        const ownerToken = await getOwnerAuthToken();

        // 1. Test Unauthenticated & Invalid Token Access
        console.log("\n--- 1. Testing Unauthenticated & Invalid Token Rejection ---");
        const noAuthResp = await fetch("http://localhost:8002/api/v1/ai/generate-structured", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId: "e8b4f668-058f-4817-93bb-83229a18f9ec", featureName: "test", templateKey: "meeting_intelligence_v1" })
        });
        assert(noAuthResp.status === 401, `Unauthenticated request returned HTTP 401 (got ${noAuthResp.status})`);
        const noAuthJson = await noAuthResp.json();
        assert(noAuthJson.code === 'UNAUTHORIZED', "Response code is 'UNAUTHORIZED'");

        const fakeAuthResp = await fetch("http://localhost:8002/api/v1/ai/generate-structured", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.token"
            },
            body: JSON.stringify({ organizationId: "e8b4f668-058f-4817-93bb-83229a18f9ec", featureName: "test", templateKey: "meeting_intelligence_v1" })
        });
        assert(fakeAuthResp.status === 401, `Tampered token request returned HTTP 401 (got ${fakeAuthResp.status})`);

        // 2. Setup Multi-Tenant Test Data
        console.log("\n--- 2. Setting Up Tenant Fixtures ---");
        const orgA = 'b2222222-3333-4444-5555-666666666666';
        const orgB = 'c3333333-4444-5555-6666-777777777777';
        created.orgs.push(orgA, orgB);

        await client.query("INSERT INTO public.organizations (id, name) VALUES ($1, 'Tenant Org A'), ($2, 'Tenant Org B') ON CONFLICT DO NOTHING", [orgA, orgB]);
        await client.query("INSERT INTO public.ai_usage_quotas (organization_id, daily_token_limit, used_tokens_today) VALUES ($1, 200000, 0), ($2, 200000, 0) ON CONFLICT DO NOTHING", [orgA, orgB]);

        const projA = 'd4444444-5555-6666-7777-888888888888';
        created.projs.push(projA);
        await client.query("INSERT INTO public.projects (id, organization_id, name) VALUES ($1, $2, 'Org A Project') ON CONFLICT DO NOTHING", [projA, orgA]);

        // 3. Test Cross-Tenant Project Mismatch (Project belonging to Org A requested under Org B)
        console.log("\n--- 3. Testing Cross-Tenant Project Mismatch Rejection ---");
        const crossTenantResp = await fetch("http://localhost:8002/api/v1/ai/generate-structured", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ownerToken}`
            },
            body: JSON.stringify({
                organizationId: orgB, // Org B
                projectId: projA,     // But project belongs to Org A!
                featureName: "meeting_intelligence",
                templateKey: "meeting_intelligence_v1",
                variables: { project_name: "Project A", meeting_date: "2026-09-09", raw_notes: "Test" },
                provider: "mock"
            })
        });
        assert(crossTenantResp.status === 403, `Cross-tenant project mismatch rejected with HTTP 403 (got ${crossTenantResp.status})`);
        const crossJson = await crossTenantResp.json();
        assert(crossJson.error.includes("Forbidden") || crossJson.code === 'FORBIDDEN', "Cross-tenant project error indicates Forbidden");

        // 4. Test Provider and Model Allowlist Enforcement
        console.log("\n--- 4. Testing Provider and Model Allowlists ---");
        const invalidProviderResp = await fetch("http://localhost:8002/api/v1/ai/generate-structured", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ownerToken}`
            },
            body: JSON.stringify({
                organizationId: orgA,
                featureName: "meeting_intelligence",
                templateKey: "meeting_intelligence_v1",
                variables: { project_name: "Project A", meeting_date: "2026-09-09", raw_notes: "Test" },
                provider: "unapproved_llm"
            })
        });
        assert(invalidProviderResp.status === 400, `Unapproved provider returned HTTP 400 (got ${invalidProviderResp.status})`);
        const invProvJson = await invalidProviderResp.json();
        assert(invProvJson.code === 'INVALID_PROVIDER', "Response code is 'INVALID_PROVIDER'");

        const invalidModelResp = await fetch("http://localhost:8002/api/v1/ai/generate-structured", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ownerToken}`
            },
            body: JSON.stringify({
                organizationId: orgA,
                featureName: "meeting_intelligence",
                templateKey: "meeting_intelligence_v1",
                variables: { project_name: "Project A", meeting_date: "2026-09-09", raw_notes: "Test" },
                provider: "gemini",
                model: "unapproved_model_v1"
            })
        });
        assert(invalidModelResp.status === 400, `Unapproved model returned HTTP 400 (got ${invalidModelResp.status})`);
        const invModelJson = await invalidModelResp.json();
        assert(invModelJson.code === 'INVALID_MODEL', "Response code is 'INVALID_MODEL'");

        // 5. Test Authoritative User Identity Derivation
        console.log("\n--- 5. Testing Authoritative Identity Overwrite ---");
        const spoofedUserId = '99999999-9999-9999-9999-999999999999';
        const validResp = await fetch("http://localhost:8002/api/v1/ai/generate-structured", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${ownerToken}`
            },
            body: JSON.stringify({
                organizationId: orgA,
                projectId: projA,
                userId: spoofedUserId, // Client attempts to spoof a foreign user ID!
                featureName: "meeting_intelligence",
                templateKey: "meeting_intelligence_v1",
                variables: { project_name: "Project A", meeting_date: "2026-09-09", raw_notes: "Discussed deliverables" },
                provider: "mock"
            })
        });
        assert(validResp.status === 200, `Valid request returned HTTP 200 (got ${validResp.status})`);
        const validJson = await validResp.json();
        const genLogRes = await client.query("SELECT * FROM public.ai_generation_logs WHERE id = $1", [validJson.logId]);
        assert(genLogRes.rows.length === 1, "Log record created");
        assert(genLogRes.rows[0].user_id !== spoofedUserId, "Spoofed user_id was ignored and overwritten by server");
        assert(genLogRes.rows[0].user_id === '27852879-0d5f-4c72-889d-69a0989302d2', "Log record has authoritative Owner user_id");

        // 6. Test Direct RPC Execution Privileges (REVOKE from anon and authenticated)
        console.log("\n--- 6. Testing RPC Function Execution Revocation ---");
        const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        let anonRpcBlocked = false;
        try {
            const { error } = await anonClient.rpc('check_and_consume_ai_quota', {
                p_organization_id: orgA,
                p_requested_tokens: 500
            });
            if (error) anonRpcBlocked = true;
        } catch (e) {
            anonRpcBlocked = true;
        }
        assert(anonRpcBlocked === true, "Direct call to check_and_consume_ai_quota by anon/client is rejected");

        let anonLogRpcBlocked = false;
        try {
            const { error } = await anonClient.rpc('record_ai_generation_log', {
                p_organization_id: orgA,
                p_project_id: null,
                p_user_id: null,
                p_feature_name: 'abuse',
                p_template_key: 'test',
                p_provider: 'mock',
                p_model: 'mock',
                p_prompt_tokens: 0,
                p_completion_tokens: 0,
                p_latency_ms: 0,
                p_status: 'success'
            });
            if (error) anonLogRpcBlocked = true;
        } catch (e) {
            anonLogRpcBlocked = true;
        }
        assert(anonLogRpcBlocked === true, "Direct call to record_ai_generation_log by anon/client is rejected");

        // 7. Test ai_prompt_templates RLS Hardening (Ordinary user cannot view raw prompt templates)
        console.log("\n--- 7. Testing ai_prompt_templates RLS Protection ---");
        const { data: anonTpls, error: anonTplErr } = await anonClient
            .from('ai_prompt_templates')
            .select('system_prompt, template_key');
        assert(anonTplErr || (!anonTpls || anonTpls.length === 0), "Anon / client user cannot SELECT raw prompt templates from database");

        // 8. Test Production Mock Mode Lockdown
        console.log("\n--- 8. Testing Production Mock Mode Lockdown ---");
        const originalEnv = process.env.NODE_ENV;
        try {
            process.env.NODE_ENV = 'production';
            const mockToggleResp = await fetch("http://localhost:8002/api/v1/ai/mock-mode", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-test-env-mode": "production"
                },
                body: JSON.stringify({ enabled: true })
            });
            assert(mockToggleResp.status === 403, `Mock mode toggle in production returns HTTP 403 (got ${mockToggleResp.status})`);
            const mockJson = await mockToggleResp.json();
            assert(mockJson.code === 'FORBIDDEN_IN_PRODUCTION', "Response code is 'FORBIDDEN_IN_PRODUCTION'");

            const mockGetResp = await fetch("http://localhost:8002/api/v1/ai/mock-mode", {
                headers: { "x-test-env-mode": "production" }
            });
            assert(mockGetResp.status === 403, `Mock mode GET in production returns HTTP 403 (got ${mockGetResp.status})`);
        } finally {
            process.env.NODE_ENV = originalEnv;
        }

        console.log(`\nResults: ${passed} passed, ${failed} failed`);
        if (failed > 0) process.exit(1);
    } finally {
        try {
            await client.query("SET session_replication_role = 'replica';");
            for (const orgId of created.orgs) {
                await client.query("DELETE FROM public.ai_generation_logs WHERE organization_id = $1", [orgId]);
                await client.query("DELETE FROM public.ai_usage_quotas WHERE organization_id = $1", [orgId]);
                await client.query("DELETE FROM public.projects WHERE organization_id = $1", [orgId]);
                await client.query("DELETE FROM public.organizations WHERE id = $1", [orgId]);
            }
            await client.query("SET session_replication_role = 'origin';");
        } catch (e) {
            console.error("Cleanup error:", e.message);
        }
        client.release();
        await pool.end();
    }
}

run().catch(err => {
    console.error("Auth & Abuse suite failed:", err);
    process.exit(1);
});
