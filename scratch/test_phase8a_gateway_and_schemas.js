// scratch/test_phase8a_gateway_and_schemas.js
// Phase 8A: AI Gateway Structured Output, Schema Validation & Error Handling Suite

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
    console.log("=== Starting Phase 8A: Gateway & Schemas Test Suite ===");
    const client = await pool.connect();

    const createdIds = {
        orgs: [],
        projects: [],
        logs: []
    };

    try {
        // 1. Setup isolated test organization & project
        const orgRes = await client.query("INSERT INTO public.organizations (name) VALUES ('Org Phase 8A Gateway') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdIds.orgs.push(orgId);

        const projRes = await client.query("INSERT INTO public.projects (organization_id, name, title) VALUES ($1, 'AI Test Project', 'AI Test Project') RETURNING id", [orgId]);
        const projId = projRes.rows[0].id;
        createdIds.projects.push(projId);

        // 2. Test template retrieval
        const tpl = await gateway.getTemplate('meeting_intelligence_v1');
        assert(tpl && tpl.template_key === 'meeting_intelligence_v1', "Template meeting_intelligence_v1 retrieved from DB");
        assert(tpl.expected_schema && tpl.expected_schema.type === 'object', "Template has expected JSON schema");

        // 3. Test prompt interpolation
        const interpolated = gateway.interpolatePrompt("Проєкт: {{project_name}} в {{organization_name}}", {
            project_name: "Idempotency Test",
            organization_name: "Demo Client Corp"
        });
        assert(interpolated === "Проєкт: Idempotency Test в Demo Client Corp", "Prompt interpolation correctly replaced variables");

        // 4. Test Schema Validator (Unit Level)
        const sampleValid = {
            summary: "Обговорили наступний спринт",
            decisions: ["Затвердити скоуп"],
            candidate_actions: [
                {
                    title: "Підготувати реліз",
                    description: "Зібрати артефакти",
                    responsibility: "internal",
                    priority: "high"
                }
            ]
        };
        const validCheck = gateway.validateSchema(sampleValid, tpl.expected_schema);
        assert(validCheck.valid === true, "Validator accepted compliant structured object");

        const sampleMissingField = {
            summary: "Обговорили наступний спринт",
            decisions: ["Затвердити скоуп"]
            // missing candidate_actions
        };
        const missingCheck = gateway.validateSchema(sampleMissingField, tpl.expected_schema);
        assert(missingCheck.valid === false && missingCheck.error.includes("candidate_actions"), "Validator rejected object missing required property 'candidate_actions'");

        const sampleInvalidEnum = {
            summary: "Обговорили наступний спринт",
            decisions: ["Затвердити скоуп"],
            candidate_actions: [
                {
                    title: "Підготувати реліз",
                    description: "Зібрати артефакти",
                    responsibility: "external_vendor", // invalid enum
                    priority: "high"
                }
            ]
        };
        const enumCheck = gateway.validateSchema(sampleInvalidEnum, tpl.expected_schema);
        assert(enumCheck.valid === false && enumCheck.error.includes("allowed enum"), "Validator rejected object with invalid enum value");

        // 5. Test Structured Generation via Gateway (Mock Transport)
        const genResult = await gateway.generateStructured({
            organizationId: orgId,
            projectId: projId,
            featureName: "meeting_protocol",
            templateKey: "meeting_intelligence_v1",
            variables: {
                project_name: "AI Test Project",
                organization_name: "Org Phase 8A Gateway",
                participants: "PM, Tech Lead, Client CEO",
                raw_notes: "Почали обговорення о 14:00. Вирішили оновити план делівері. PM підготує специфікацію."
            },
            provider: "mock",
            estimatedTokens: 1000
        });

        assert(genResult && genResult.ok === true, "Gateway structured generation succeeded with ok: true");
        assert(typeof genResult.data.summary === 'string' && genResult.data.summary.length > 0, "Response data contains valid summary");
        assert(Array.isArray(genResult.data.decisions) && genResult.data.decisions.length > 0, "Response data contains decisions array");
        assert(Array.isArray(genResult.data.candidate_actions) && genResult.data.candidate_actions.length > 0, "Response data contains candidate_actions array");
        assert(genResult.usage && genResult.usage.totalTokens > 0, "Gateway returned usage metrics with totalTokens");
        assert(Boolean(genResult.logId), "Generation logged with logId");

        // 6. Verify Log persisted in DB
        const logRes = await client.query("SELECT * FROM public.ai_generation_logs WHERE id = $1", [genResult.logId]);
        assert(logRes.rows.length === 1, "Generation log record found in database");
        const logRow = logRes.rows[0];
        assert(logRow.organization_id === orgId, "Log record has correct organization_id");
        assert(logRow.project_id === projId, "Log record has correct project_id");
        assert(logRow.feature_name === "meeting_protocol", "Log record has correct feature_name");
        assert(logRow.status === "success", "Log record status is 'success'");
        assert(logRow.total_tokens === genResult.usage.totalTokens, "Log record recorded exact token count");

        // 7. Test HTTP API Endpoint over Node Server
        const token = await getOwnerAuthToken();
        const httpResp = await fetch("http://localhost:8002/api/v1/ai/generate-structured", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                organizationId: orgId,
                projectId: projId,
                featureName: "health_advisor",
                templateKey: "project_health_analysis_v1",
                variables: {
                    project_name: "AI Test Project",
                    status: "active",
                    stage_progress_pct: 80,
                    overdue_tasks_count: 0,
                    blocked_client_actions_count: 0,
                    context_notes: "Всі контрольні точки в нормі"
                },
                provider: "mock"
            })
        });

        assert(httpResp.status === 200, `HTTP Endpoint returned status 200 (got ${httpResp.status})`);
        const httpJson = await httpResp.json();
        assert(httpJson.ok === true, "HTTP response has ok: true");
        assert(["on_track", "at_risk", "delayed"].includes(httpJson.data.health_verdict), "HTTP response data has valid health_verdict");
        assert(Boolean(httpJson.data.executive_summary), "HTTP response data has executive_summary");

        console.log(`\nResults: ${passed} passed, ${failed} failed`);
        if (failed > 0) process.exit(1);
    } finally {
        // Cleanup test fixtures
        try {
            await client.query("SET session_replication_role = 'replica';");
            for (const orgId of createdIds.orgs) {
                await client.query("DELETE FROM public.ai_generation_logs WHERE organization_id = $1", [orgId]);
                await client.query("DELETE FROM public.ai_usage_quotas WHERE organization_id = $1", [orgId]);
                await client.query("DELETE FROM public.projects WHERE organization_id = $1", [orgId]);
                await client.query("DELETE FROM public.organizations WHERE id = $1", [orgId]);
            }
            await client.query("SET session_replication_role = 'origin';");
        } catch (_) {}
        client.release();
        await pool.end();
    }
}

run();
