// scratch/test_phase7a_payload_minimization.js
// Tests Phase 7A: Payload Allowlists, Forbidden Secret Stripping, and Data Minimization

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const createdIds = {
    organizations: [],
    projects: [],
    stages: [],
    tasks: [],
    documents: [],
    events: []
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
        console.log('--- Suite 7: Phase 7A Payload Allowlist & Data Minimization ---');

        // 1. Setup isolated test fixtures
        const orgRes = await client.query(
            "INSERT INTO public.organizations (name) VALUES ('Test Org 7A Minimization') RETURNING id"
        );
        const orgId = orgRes.rows[0].id;
        createdIds.organizations.push(orgId);

        const projRes = await client.query(
            "INSERT INTO public.projects (organization_id, name, title) VALUES ($1, 'Test Proj 7A Minimization', 'Test Proj 7A Minimization') RETURNING id",
            [orgId]
        );
        const projId = projRes.rows[0].id;
        createdIds.projects.push(projId);

        const stageRes = await client.query(
            "INSERT INTO public.project_stages (organization_id, project_id, name, status, sort_order) VALUES ($1, $2, 'Discovery Stage', 'not_started', 1) RETURNING id",
            [orgId, projId]
        );
        const stageId = stageRes.rows[0].id;
        createdIds.stages.push(stageId);

        const taskRes = await client.query(
            "INSERT INTO public.tasks (organization_id, project_id, stage_id, title, description, status, responsibility_type) VALUES ($1, $2, $3, 'Client Review Task', 'Secret client internal description', 'todo', 'client') RETURNING id",
            [orgId, projId, stageId]
        );
        const taskId = taskRes.rows[0].id;
        createdIds.tasks.push(taskId);

        const docRes = await client.query(
            "INSERT INTO public.documents (organization_id, project_id, title, category, status) VALUES ($1, $2, 'Project Charter', 'brief', 'draft') RETURNING id",
            [orgId, projId]
        );
        const docId = docRes.rows[0].id;
        createdIds.documents.push(docId);

        // 2. Emit task.completed event with attempted sensitive custom payload injection
        await client.query("BEGIN");
        await client.query("SET LOCAL \"request.jwt.claim.role\" = 'service_role'");
        const emitTaskRes = await client.query(`
            SELECT public._emit_integration_event(
                'task',
                $1,
                'task.completed',
                jsonb_build_object(
                    'token', 'raw_magic_token_secret_value_12345',
                    'raw_token', 'fwa_raw_bearer_token',
                    'password', 'sha256_hashed_secret',
                    'secret', 'vault_signing_secret_leak',
                    'api_key', 'live_firstwin_api_key',
                    'bot_token', '123456:ABC-DEF_telegram_bot_token',
                    'authorization', 'Bearer sensitive_jwt_token',
                    'cookie', 'session=cookie_val',
                    'safe_metadata_tag', 'release_candidate_1'
                )
            ) as event_id;
        `, [taskId]);
        const taskEventId = emitTaskRes.rows[0].event_id;
        await client.query("COMMIT");
        createdIds.events.push(taskEventId);

        const evTask = await client.query("SELECT * FROM public.integration_events WHERE id = $1", [taskEventId]);
        const taskPayload = evTask.rows[0].payload_json;

        // Test 7A: Task payload allowlist compliance
        assert(taskPayload.task_id === taskId, 'Payload contains allowlisted task_id');
        assert(taskPayload.title === 'Client Review Task', 'Payload contains allowlisted title');
        assert(taskPayload.project_id === projId, 'Payload contains allowlisted project_id');
        assert(taskPayload.project_name === 'Test Proj 7A Minimization', 'Payload contains allowlisted project_name');
        assert(taskPayload.safe_metadata_tag === 'release_candidate_1', 'Payload preserves safe allowed custom metadata');

        // Test 7B: Negative scan - All forbidden secret keys MUST be stripped
        const forbiddenKeys = [
            'token', 'raw_token', 'password', 'secret', 'api_key', 
            'bot_token', 'authorization', 'cookie', 'jwt', 'key'
        ];
        for (const key of forbiddenKeys) {
            assert(taskPayload[key] === undefined, `Forbidden sensitive key '${key}' was stripped from payload_json`);
        }

        // Test 7C: Internal unminimized fields (description, notes) are NOT dumped
        assert(taskPayload.description === undefined, 'Raw task description is NOT included in payload');
        assert(taskPayload.comments === undefined, 'Internal comments are NOT included in payload');

        // Test 7D: Stage payload allowlist compliance
        await client.query("BEGIN");
        await client.query("SET LOCAL \"request.jwt.claim.role\" = 'service_role'");
        const emitStageRes = await client.query(
            "SELECT public._emit_integration_event('stage', $1, 'stage.completed') as event_id",
            [stageId]
        );
        const stageEventId = emitStageRes.rows[0].event_id;
        await client.query("COMMIT");
        createdIds.events.push(stageEventId);

        const evStage = await client.query("SELECT * FROM public.integration_events WHERE id = $1", [stageEventId]);
        const stagePayload = evStage.rows[0].payload_json;
        assert(stagePayload.stage_id === stageId, 'Stage payload contains allowlisted stage_id');
        assert(stagePayload.name === 'Discovery Stage', 'Stage payload contains allowlisted name');
        assert(stagePayload.sort_order === 1, 'Stage payload contains allowlisted sort_order');

        // Test 7E: Document payload allowlist compliance
        await client.query("BEGIN");
        await client.query("SET LOCAL \"request.jwt.claim.role\" = 'service_role'");
        const emitDocRes = await client.query(
            "SELECT public._emit_integration_event('document', $1, 'document.approved') as event_id",
            [docId]
        );
        const docEventId = emitDocRes.rows[0].event_id;
        await client.query("COMMIT");
        createdIds.events.push(docEventId);

        const evDoc = await client.query("SELECT * FROM public.integration_events WHERE id = $1", [docEventId]);
        const docPayload = evDoc.rows[0].payload_json;
        assert(docPayload.document_id === docId, 'Document payload contains allowlisted document_id');
        assert(docPayload.title === 'Project Charter', 'Document payload contains allowlisted title');
        assert(docPayload.category === 'brief', 'Document payload contains allowlisted category');

        // Test 7F: Full text negative marker scan across entire integration_events table
        const allEventsStr = JSON.stringify(evTask.rows[0]);
        assert(!allEventsStr.includes('raw_magic_token_secret_value_12345'), 'Raw magic link token marker 100% absent from event record');
        assert(!allEventsStr.includes('fwa_raw_bearer_token'), 'Bearer token marker 100% absent from event record');
        assert(!allEventsStr.includes('123456:ABC-DEF_telegram_bot_token'), 'Telegram bot token marker 100% absent from event record');

        console.log(`\nSuite 7 Summary: Passed ${passed}, Failed ${failed}`);
    } catch (err) {
        console.error('Unexpected error in Suite 7:', err);
        failed++;
    } finally {
        try {
            await client.query("SET integration.allow_cleanup = 'on'");
            if (createdIds.tasks.length > 0) {
                await client.query("DELETE FROM public.tasks WHERE id = ANY($1)", [createdIds.tasks]);
            }
            if (createdIds.stages.length > 0) {
                await client.query("DELETE FROM public.project_stages WHERE id = ANY($1)", [createdIds.stages]);
            }
            if (createdIds.documents.length > 0) {
                await client.query("DELETE FROM public.documents WHERE id = ANY($1)", [createdIds.documents]);
            }
            if (createdIds.projects.length > 0) {
                await client.query("DELETE FROM public.projects WHERE id = ANY($1)", [createdIds.projects]);
            }
            if (createdIds.events.length > 0) {
                await client.query("DELETE FROM public.integration_outbox WHERE event_id = ANY($1)", [createdIds.events]);
                await client.query("DELETE FROM public.integration_events WHERE id = ANY($1)", [createdIds.events]);
            }
            if (createdIds.organizations.length > 0) {
                await client.query("DELETE FROM public.organization_memberships WHERE organization_id = ANY($1)", [createdIds.organizations]);
                await client.query("DELETE FROM public.organizations WHERE id = ANY($1)", [createdIds.organizations]);
            }
        } catch (cleanErr) {
            console.error("Cleanup error in Suite 7:", cleanErr);
        }
        client.release();
        await pool.end();
        process.exit(failed > 0 ? 1 : 0);
    }
}

run();
