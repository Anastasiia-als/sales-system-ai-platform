const { Pool } = require('pg');
const { AIGateway } = require('../js/portal/api/ai-gateway.js');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const gateway = new AIGateway({ pool });

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        process.exit(1);
    }
    console.log("PASS: " + message);
}

async function run() {
    console.log("=== Phase 8B: Protocol Generation & Schema Compliance Test ===");

    // 0. Ensure server mock mode is enabled
    try {
        await fetch('http://localhost:8002/api/v1/ai/mock-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true })
        });
    } catch (_) {}

    // 1. Verify prompt template exists in database
    const tplRes = await pool.query(
        "SELECT template_key, is_active, expected_schema FROM public.ai_prompt_templates WHERE template_key = $1",
        ['meeting_intelligence_v1']
    );
    assert(tplRes.rows.length === 1, "Template 'meeting_intelligence_v1' is registered in database");
    const tpl = tplRes.rows[0];
    assert(tpl.is_active === true, "Template is active");
    assert(tpl.expected_schema && tpl.expected_schema.properties && tpl.expected_schema.properties.summary, "JSON schema defines 'summary'");
    assert(tpl.expected_schema.properties.decisions, "JSON schema defines 'decisions'");
    assert(tpl.expected_schema.properties.candidate_actions, "JSON schema defines 'candidate_actions'");

    // 2. Fetch a valid user & organization for test execution
    const userRes = await pool.query("SELECT id FROM public.profiles LIMIT 1");
    const testUserId = userRes.rows[0]?.id;
    assert(!!testUserId, "Found test user profile");

    const orgRes = await pool.query("SELECT organization_id FROM public.organization_memberships WHERE user_id = $1 AND is_active = true LIMIT 1", [testUserId]);
    const testOrgId = orgRes.rows[0]?.organization_id || "cccccccc-cccc-cccc-cccc-cccccccccccc";

    // 3. Test generateStructured via AIGateway direct call (Mock Transport)
    process.env.AI_MOCK_TRANSPORT = 'true';

    const participants = [
        { name: "Олександр Коваленко", role: "Project Manager", alias: "Team Member 1" },
        { name: "Ірина Савченко", role: "Client Lead", alias: "Client Contact 1" }
    ];

    const rawNotes = `
        Обговорення вимог до другого релізу.
        Ірина погодила дизайн-концепцію головної сторінки.
        Домовилися запустити QA тестування у вівторок.
        Потрібно надати доступ до аналітики GA4 для команди.
        Термін виконання аналітики: 3 дні, пріоритет високий.
    `;

    const result = await gateway.generateStructured({
        templateKey: 'meeting_intelligence_v1',
        featureName: 'meeting_intelligence',
        organizationId: testOrgId,
        userId: testUserId,
        variables: {
            project_name: "Phase 8B E2E Project",
            organization_name: "Acme Digital",
            participants: participants,
            raw_notes: rawNotes
        }
    });

    assert(result && result.data, "Gateway returned structured response");
    assert(typeof result.data.summary === 'string' && result.data.summary.length > 0, "Generated summary is non-empty string");
    assert(Array.isArray(result.data.decisions) && result.data.decisions.length > 0, "Decisions array is populated");
    assert(Array.isArray(result.data.candidate_actions) && result.data.candidate_actions.length > 0, "Candidate actions array is populated");

    // Validate decision structure
    const firstDec = result.data.decisions[0];
    assert(typeof firstDec === 'string' && firstDec.length > 0, "Decision item is non-empty string");

    // Validate candidate action structure
    const firstAct = result.data.candidate_actions[0];
    assert(typeof firstAct.title === 'string', "Candidate action has 'title' string");
    assert(typeof firstAct.responsibility === 'string', "Candidate action has 'responsibility'");
    assert(typeof firstAct.priority === 'string', "Candidate action has 'priority'");

    // 4. Verify telemetry log record
    assert(!!result.logId, "Generation log ID returned");
    const logRes = await pool.query(
        "SELECT * FROM public.ai_generation_logs WHERE id = $1",
        [result.logId]
    );
    assert(logRes.rows.length === 1, "Log row persisted in ai_generation_logs");
    const log = logRes.rows[0];
    assert(log.feature_name === 'meeting_intelligence', "Log feature_name is 'meeting_intelligence'");
    assert(log.template_key === 'meeting_intelligence_v1', "Log template_key is 'meeting_intelligence_v1'");
    assert(log.status === 'success', "Log status is 'success'");
    assert(Number(log.total_tokens) > 0, "Log total_tokens > 0");

    // 5. Test HTTP API endpoint (/api/v1/ai/generate-structured)
    const { getOwnerAuthToken } = require('./auth_test_helper.js');
    const testToken = await getOwnerAuthToken();

    const httpResp = await fetch("http://localhost:8002/api/v1/ai/generate-structured", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${testToken}`
        },
        body: JSON.stringify({
            templateKey: 'meeting_intelligence_v1',
            featureName: 'meeting_intelligence',
            organizationId: testOrgId,
            variables: {
                project_name: "HTTP Test Project",
                organization_name: "HTTP Org",
                participants: participants,
                raw_notes: rawNotes
            }
        })
    });

    assert(httpResp.status === 200, `HTTP status is 200 (got ${httpResp.status})`);
    const httpJson = await httpResp.json();
    assert(httpJson.ok === true, "HTTP response has ok: true");
    assert(httpJson.data && httpJson.data.summary, "HTTP response contains summary");
    assert(Array.isArray(httpJson.data.candidate_actions), "HTTP response contains candidate actions");

    await pool.end();
    console.log("=== Phase 8B Protocol Generation Suite 100% Passed ===");
}

run().catch(err => {
    console.error("FAIL with exception:", err);
    process.exit(1);
});
