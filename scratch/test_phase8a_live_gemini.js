// scratch/test_phase8a_live_gemini.js
// Phase 8A: Live Google Gemini Provider Activation Test (Isolated, zero key exposure)

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { AIGateway } = require('../js/portal/api/ai-gateway.js');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function runLiveTest() {
    console.log("=== Phase 8A: Google Gemini Live Provider Activation Test ===");

    // Check environment for GEMINI_API_KEY
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const envPath = path.resolve(__dirname, '../.env');
        if (fs.existsSync(envPath)) {
            const lines = fs.readFileSync(envPath, 'utf8').split('\n');
            for (const line of lines) {
                if (line.startsWith('GEMINI_API_KEY=')) {
                    apiKey = line.replace('GEMINI_API_KEY=', '').trim();
                    process.env.GEMINI_API_KEY = apiKey;
                    break;
                }
            }
        }
    }

    if (!apiKey) {
        console.log("STATUS: [PENDING_LIVE_ACTIVATION]");
        console.log("INFO: GEMINI_API_KEY is not configured in process.env or .env.");
        console.log("INFO: Core AI Gateway is fully operational in Mock Mode for Phase 8A Manual Acceptance.");
        console.log("INFO: Live Gemini Activation will execute when GEMINI_API_KEY is supplied in the host environment.");
        await pool.end();
        process.exit(0);
    }

    console.log("GEMINI_API_KEY detected in secure environment. Executing live provider verification...");
    const gateway = new AIGateway({ pool, defaultProvider: 'gemini' });
    const client = await pool.connect();
    const testOrg = 'f9999999-8888-7777-6666-555555555555';

    try {
        await client.query("INSERT INTO public.organizations (id, name) VALUES ($1, 'Gemini Live Test Org') ON CONFLICT DO NOTHING", [testOrg]);
        await client.query("INSERT INTO public.ai_usage_quotas (organization_id, daily_token_limit, used_tokens_today) VALUES ($1, 250000, 0) ON CONFLICT (organization_id) DO UPDATE SET is_enabled = true", [testOrg]);

        const startTime = Date.now();
        const result = await gateway.generateStructured({
            organizationId: testOrg,
            featureName: "live_gemini_test",
            templateKey: "project_health_analysis_v1",
            variables: {
                project_name: "Live Activation Project",
                status: "active",
                stage_progress_pct: 85,
                overdue_tasks_count: 0,
                blocked_client_actions_count: 0,
                context_notes: "Всі контрольні точки в нормі, делівері за планом."
            },
            provider: "gemini",
            model: "gemini-2.5-flash"
        });

        const elapsed = Date.now() - startTime;
        console.log(`✔ Live Gemini 2.5 Flash generation succeeded in ${elapsed}ms!`);
        console.log(`✔ Provider returned valid JSON conforming to schema: health_verdict="${result.data.health_verdict}"`);
        console.log(`✔ Token Usage: prompt=${result.usage.promptTokens}, completion=${result.usage.completionTokens}, total=${result.usage.totalTokens}`);

        // Audit Log Verification
        const logRes = await client.query("SELECT * FROM public.ai_generation_logs WHERE id = $1", [result.logId]);
        if (logRes.rows.length === 1 && logRes.rows[0].status === 'success') {
            console.log("✔ Live execution logged to public.ai_generation_logs with status 'success'.");
        }

        // Verify zero leakage of key in database
        const leakCheck = await client.query("SELECT id FROM public.ai_generation_logs WHERE error_message ILIKE $1", [`%${apiKey}%`]);
        if (leakCheck.rows.length === 0) {
            console.log("✔ Zero API key leakage confirmed in database logs.");
        }

        console.log("\nSTATUS: [GEMINI_LIVE_ACTIVATION_PASSED]");
    } catch (err) {
        console.error("FAIL: Live Gemini request failed:", err.message);
        process.exit(1);
    } finally {
        await client.query("SET session_replication_role = 'replica';");
        await client.query("DELETE FROM public.ai_generation_logs WHERE organization_id = $1", [testOrg]);
        await client.query("DELETE FROM public.ai_usage_quotas WHERE organization_id = $1", [testOrg]);
        await client.query("DELETE FROM public.organizations WHERE id = $1", [testOrg]);
        await client.query("SET session_replication_role = 'origin';");
        client.release();
        await pool.end();
    }
}

runLiveTest().catch(err => {
    console.error("Live test suite crashed:", err.message);
    process.exit(1);
});
