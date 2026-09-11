const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        process.exit(1);
    }
    console.log("PASS: " + message);
}

async function run() {
    console.log("=== Phase 8B: Atomic Apply RPC & Idempotency Test ===");

    const orgId = 'e1111111-1111-1111-1111-111111111111';
    const projId = 'e2222222-2222-2222-2222-222222222222';
    const meetingId = 'e3333333-3333-3333-3333-333333333333';
    const artifactId = 'e4444444-4444-4444-4444-444444444444';

    const userRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
    const testOwnerId = userRes.rows[0]?.id;
    assert(!!testOwnerId, "Found test owner profile");

    // Clean up fixtures if previously existing
    try {
        await pool.query("SET session_replication_role = 'replica';");
        await pool.query("DELETE FROM public.meeting_ai_artifacts WHERE id = $1", [artifactId]);
        await pool.query("DELETE FROM public.tasks WHERE source_meeting_id = $1", [meetingId]);
        await pool.query("DELETE FROM public.meeting_decisions WHERE meeting_id = $1", [meetingId]);
        await pool.query("DELETE FROM public.meeting_notes WHERE meeting_id = $1", [meetingId]);
        await pool.query("DELETE FROM public.meetings WHERE id = $1", [meetingId]);
        await pool.query("DELETE FROM public.projects WHERE id = $1", [projId]);
        await pool.query("DELETE FROM public.organization_memberships WHERE organization_id = $1", [orgId]);
        await pool.query("DELETE FROM public.organizations WHERE id = $1", [orgId]);
        await pool.query("SET session_replication_role = 'origin';");
    } catch (_) {}

    // Setup base fixtures
    await pool.query("INSERT INTO public.organizations (id, name) VALUES ($1, 'Atomic RPC Org')", [orgId]);
    await pool.query(
        "INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'owner', true)",
        [orgId, testOwnerId]
    );
    await pool.query(
        "INSERT INTO public.projects (id, organization_id, name, status) VALUES ($1, $2, 'Atomic Project', 'in_progress')",
        [projId, orgId]
    );
    await pool.query(
        "INSERT INTO public.meetings (id, organization_id, project_id, title, meeting_type, status, start_at, end_at) VALUES ($1, $2, $3, 'Atomic Apply Sync', 'review', 'completed', NOW(), NOW() + interval '1 hour')",
        [meetingId, orgId, projId]
    );

    // Insert draft artifact
    await pool.query(`
        INSERT INTO public.meeting_ai_artifacts (
            id, organization_id, project_id, meeting_id, status, raw_input_hash,
            summary, decisions, candidate_actions
        ) VALUES (
            $1, $2, $3, $4, 'draft', 'hash_test_atomic_123',
            'AI generated draft summary of meeting',
            '["Decision 1: Approved scope", "Decision 2: Approved timeline"]'::jsonb,
            '[{"title":"Action 1","description":"Desc 1","responsibility":"internal","priority":"high"},{"title":"Action 2","description":"Desc 2","responsibility":"client","priority":"medium"}]'::jsonb
        )
    `, [artifactId, orgId, projId, meetingId]);

    // 1. Test Unauthorized caller (auth.uid() is null)
    const client = await pool.connect();
    try {
        await client.query("BEGIN;");
        await client.query("SET LOCAL request.jwt.claim.sub = '';");
        let threw401 = false;
        try {
            await client.query("SELECT public.apply_meeting_intelligence_items($1, true, 'Summary', '[]'::jsonb, '[]'::jsonb)", [artifactId]);
        } catch (e) {
            threw401 = e.message.includes('401') || e.message.includes('Unauthorized');
        }
        await client.query("ROLLBACK;");
        assert(threw401, "Unauthenticated call without auth.uid() throws 401 Unauthorized");
    } finally {
        client.release();
    }

    // 2. Test Successful Atomic Application
    const applyClient = await pool.connect();
    let rpcResult;
    try {
        await applyClient.query("BEGIN;");
        await applyClient.query(`SET LOCAL request.jwt.claim.sub = '${testOwnerId}';`);

        const decisionsPayload = JSON.stringify([
            { decision_text: "Затверджено фінальний обсяг робіт", is_client_visible: true },
            { decision_text: "Внутрішній технічний борг закрити наступного тижня", is_client_visible: false }
        ]);

        const actionItemsPayload = JSON.stringify([
            {
                title: "Створити документацію по API для клієнта",
                description: "Описати формат вебхуків та схем даних",
                responsibility_type: "internal",
                priority: "high",
                due_date: "2026-09-18",
                assignee_user_id: testOwnerId,
                is_client_visible: false
            },
            {
                title: "Підписати додаток до договору №3",
                description: "Передати скан-копію через портал",
                responsibility_type: "client",
                priority: "medium",
                due_date: "2026-09-22",
                is_client_visible: true
            }
        ]);

        const res = await applyClient.query(
            "SELECT public.apply_meeting_intelligence_items($1, $2, $3, $4::jsonb, $5::jsonb) as res",
            [
                artifactId,
                true,
                "Узгоджено ключові вимоги та графік запуску пілотного проєкту.",
                decisionsPayload,
                actionItemsPayload
            ]
        );
        rpcResult = res.rows[0].res;
        await applyClient.query("COMMIT;");
    } catch (e) {
        await applyClient.query("ROLLBACK;");
        console.error("Apply execution failed:", e);
        process.exit(1);
    } finally {
        applyClient.release();
    }

    assert(rpcResult && rpcResult.ok === true, "RPC returned ok: true");
    assert(rpcResult.created_tasks_count === 2, "RPC reported 2 tasks created");
    assert(rpcResult.created_decisions_count === 2, "RPC reported 2 decisions created");
    assert(Array.isArray(rpcResult.created_task_ids) && rpcResult.created_task_ids.length === 2, "RPC returned created task IDs array");

    // Verify artifact status in DB
    const artCheck = await pool.query("SELECT * FROM public.meeting_ai_artifacts WHERE id = $1", [artifactId]);
    const appliedArt = artCheck.rows[0];
    assert(appliedArt.status === 'applied', "Artifact status updated to 'applied'");
    assert(appliedArt.applied_tasks_count === 2, "applied_tasks_count is 2");
    assert(appliedArt.applied_decisions_count === 2, "applied_decisions_count is 2");
    assert(appliedArt.applied_at !== null, "applied_at timestamp set");
    assert(appliedArt.applied_by === testOwnerId, "applied_by matches caller ID");

    // Verify tasks table
    const taskCheck = await pool.query("SELECT * FROM public.tasks WHERE source_meeting_id = $1 ORDER BY created_at ASC", [meetingId]);
    assert(taskCheck.rows.length === 2, "Exactly 2 tasks created in public.tasks with source_meeting_id");
    const internalTask = taskCheck.rows[0];
    assert(internalTask.title === "Створити документацію по API для клієнта", "Internal task title matches");
    assert(internalTask.responsibility_type === "internal", "Internal task responsibility_type is internal");
    assert(internalTask.status === "todo", "Task status is todo");
    assert(internalTask.created_by === testOwnerId, "Task created_by matches caller");

    const clientTask = taskCheck.rows[1];
    assert(clientTask.responsibility_type === "client", "Client task responsibility_type is client");
    assert(clientTask.is_client_visible === true, "Client task is client visible");

    // Verify decisions table
    const decCheck = await pool.query("SELECT * FROM public.meeting_decisions WHERE meeting_id = $1 ORDER BY created_at ASC", [meetingId]);
    assert(decCheck.rows.length === 2, "Exactly 2 decisions created in public.meeting_decisions");
    assert(decCheck.rows[0].decision_text === "Затверджено фінальний обсяг робіт", "Decision text matches");

    // Verify meeting_notes table
    const noteCheck = await pool.query("SELECT * FROM public.meeting_notes WHERE meeting_id = $1 AND note_type = 'summary'", [meetingId]);
    assert(noteCheck.rows.length === 1, "Meeting summary note created in public.meeting_notes");
    assert(noteCheck.rows[0].body.includes("Узгоджено ключові вимоги"), "Summary body matches");

    // 3. Test Idempotency / Duplicate Prevention: Re-applying already applied artifact MUST fail (409)
    const reapplyClient = await pool.connect();
    try {
        await reapplyClient.query("BEGIN;");
        await reapplyClient.query(`SET LOCAL request.jwt.claim.sub = '${testOwnerId}';`);
        let threw409 = false;
        try {
            await reapplyClient.query(
                "SELECT public.apply_meeting_intelligence_items($1, false, '', '[]'::jsonb, '[]'::jsonb)",
                [artifactId]
            );
        } catch (e) {
            threw409 = e.message.includes('409') || e.message.includes('already been applied');
        }
        await reapplyClient.query("ROLLBACK;");
        assert(threw409, "Re-applying already applied artifact throws 409 Conflict");
    } finally {
        reapplyClient.release();
    }

    // Verify task count is still exactly 2 (no duplicate side effects)
    const taskCountAfterReapply = await pool.query("SELECT COUNT(*) FROM public.tasks WHERE source_meeting_id = $1", [meetingId]);
    assert(parseInt(taskCountAfterReapply.rows[0].count, 10) === 2, "Task count remains 2 (idempotency preserved)");

    // 4. Test Concurrent Double-Submit / Race Condition on Draft Artifact
    const concurrentMeetingId = 'e6666666-6666-6666-6666-666666666666';
    const concurrentArtifactId = 'e5555555-5555-5555-5555-555555555555';

    await pool.query(
        "INSERT INTO public.meetings (id, organization_id, project_id, title, meeting_type, status, start_at, end_at) VALUES ($1, $2, $3, 'Concurrent Race Sync', 'review', 'completed', NOW(), NOW() + interval '1 hour')",
        [concurrentMeetingId, orgId, projId]
    );

    await pool.query(`
        INSERT INTO public.meeting_ai_artifacts (
            id, organization_id, project_id, meeting_id, status, raw_input_hash,
            summary, decisions, candidate_actions
        ) VALUES (
            $1, $2, $3, $4, 'draft', 'hash_test_concurrent_123',
            'Draft summary for concurrent test',
            '["Decision Concurrent"]'::jsonb,
            '[{"title":"Task Concurrent","responsibility":"internal","priority":"high"}]'::jsonb
        )
    `, [concurrentArtifactId, orgId, projId, concurrentMeetingId]);

    const runConcurrentAttempt = async (attemptId) => {
        const c = await pool.connect();
        try {
            await c.query("BEGIN;");
            await c.query(`SET LOCAL request.jwt.claim.sub = '${testOwnerId}';`);
            const res = await c.query(
                "SELECT public.apply_meeting_intelligence_items($1, $2, $3, $4::jsonb, $5::jsonb) as res",
                [
                    concurrentArtifactId,
                    true,
                    "Concurrent applied summary",
                    JSON.stringify([{ decision_text: `Concurrent Decision from attempt ${attemptId}`, is_client_visible: true }]),
                    JSON.stringify([{
                        title: `Concurrent Task from attempt ${attemptId}`,
                        description: "Desc",
                        responsibility_type: "internal",
                        priority: "high"
                    }])
                ]
            );
            await c.query("COMMIT;");
            return { attemptId, success: true, result: res.rows[0].res };
        } catch (e) {
            await c.query("ROLLBACK;");
            return { attemptId, success: false, error: e.message };
        } finally {
            c.release();
        }
    };

    const [attemptA, attemptB] = await Promise.all([
        runConcurrentAttempt('A'),
        runConcurrentAttempt('B')
    ]);

    const successes = [attemptA, attemptB].filter(a => a.success);
    const failures = [attemptA, attemptB].filter(a => !a.success);

    assert(successes.length === 1, "Exactly one concurrent attempt succeeded");
    assert(failures.length === 1, "Exactly one concurrent attempt failed");
    assert(failures[0].error.includes('409') || failures[0].error.includes('already been applied'), "Failed concurrent attempt received 409 Conflict");

    // Verify DB integrity for concurrent artifact
    const concurrentArtCheck = (await pool.query("SELECT * FROM public.meeting_ai_artifacts WHERE id = $1", [concurrentArtifactId])).rows[0];
    assert(concurrentArtCheck.status === 'applied', "Concurrent artifact status transitioned to 'applied'");
    assert(concurrentArtCheck.applied_tasks_count === 1, "applied_tasks_count is exactly 1");
    assert(concurrentArtCheck.applied_decisions_count === 1, "applied_decisions_count is exactly 1");

    const concurrentTasks = await pool.query("SELECT COUNT(*) FROM public.tasks WHERE source_meeting_id = $1", [concurrentMeetingId]);
    assert(parseInt(concurrentTasks.rows[0].count, 10) === 1, "Exactly 1 task created in DB despite concurrent double-submit");

    const concurrentDec = await pool.query("SELECT COUNT(*) FROM public.meeting_decisions WHERE meeting_id = $1", [concurrentMeetingId]);
    assert(parseInt(concurrentDec.rows[0].count, 10) === 1, "Exactly 1 decision created in DB despite concurrent double-submit");

    // Clean up fixtures
    try {
        await pool.query("SET session_replication_role = 'replica';");
        await pool.query("DELETE FROM public.tasks WHERE source_meeting_id IN ($1, $2)", [meetingId, concurrentMeetingId]);
        await pool.query("DELETE FROM public.meeting_decisions WHERE meeting_id IN ($1, $2)", [meetingId, concurrentMeetingId]);
        await pool.query("DELETE FROM public.meeting_notes WHERE meeting_id IN ($1, $2)", [meetingId, concurrentMeetingId]);
        await pool.query("DELETE FROM public.meeting_ai_artifacts WHERE id IN ($1, $2)", [artifactId, concurrentArtifactId]);
        await pool.query("DELETE FROM public.meetings WHERE id IN ($1, $2)", [meetingId, concurrentMeetingId]);
        await pool.query("DELETE FROM public.projects WHERE id = $1", [projId]);
        await pool.query("DELETE FROM public.organization_memberships WHERE organization_id = $1", [orgId]);
        await pool.query("DELETE FROM public.organizations WHERE id = $1", [orgId]);
        await pool.query("SET session_replication_role = 'origin';");
    } catch (_) {}

    await pool.end();
    console.log("=== Phase 8B Atomic Apply RPC Suite 100% Passed ===");
}

run().catch(err => {
    console.error("FAIL with exception:", err);
    process.exit(1);
});
