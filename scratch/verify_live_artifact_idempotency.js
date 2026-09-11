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

async function main() {
    console.log("=== Phase 8B: Live Applied Artifact Idempotency Acceptance Check ===");

    const artifactId = 'e7bcafc4-d96e-4481-a956-b63a996b4647';
    const meetingId = '5601b9e6-2efd-4a97-b99b-36d602ffa42b';
    const callerId = '27852879-0d5f-4c72-889d-69a0989302d2'; // Anastasiia (Owner)

    // 1. Inspect existing artifact in DB
    const artRes = await pool.query("SELECT * FROM public.meeting_ai_artifacts WHERE id = $1", [artifactId]);
    assert(artRes.rows.length === 1, "Target artifact found in database");
    const art = artRes.rows[0];
    console.log("Artifact status:", art.status);
    console.log("Applied at:", art.applied_at);
    console.log("Applied tasks count:", art.applied_tasks_count);
    console.log("Applied decisions count:", art.applied_decisions_count);

    assert(art.status === 'applied', "Target artifact status is 'applied'");
    assert(art.applied_tasks_count === 3, "Initial applied_tasks_count is 3");
    assert(art.applied_decisions_count === 2, "Initial applied_decisions_count is 2");

    // 2. Count existing DB rows before re-apply attempt
    const tasksBefore = await pool.query("SELECT COUNT(*) FROM public.tasks WHERE source_meeting_id = $1", [meetingId]);
    const countTasksBefore = parseInt(tasksBefore.rows[0].count, 10);
    assert(countTasksBefore === 3, `Initial tasks count for Meeting 1 is 3 (got ${countTasksBefore})`);

    const decBefore = await pool.query("SELECT COUNT(*) FROM public.meeting_decisions WHERE meeting_id = $1", [meetingId]);
    const countDecBefore = parseInt(decBefore.rows[0].count, 10);
    assert(countDecBefore === 2, `Initial decisions count for Meeting 1 is 2 (got ${countDecBefore})`);

    const notesBefore = await pool.query("SELECT COUNT(*) FROM public.meeting_notes WHERE meeting_id = $1 AND note_type = 'summary'", [meetingId]);
    const countNotesBefore = parseInt(notesBefore.rows[0].count, 10);
    assert(countNotesBefore === 1, `Initial summary notes count for Meeting 1 is 1 (got ${countNotesBefore})`);

    // 3. Attempt to re-apply the already applied artifact via RPC
    console.log("\nAttempting to re-apply already applied artifact via apply_meeting_intelligence_items RPC...");
    const client = await pool.connect();
    let reapplyError = null;
    try {
        await client.query("BEGIN;");
        await client.query(`SET LOCAL request.jwt.claim.sub = '${callerId}';`);

        const dummyDecisions = JSON.stringify([{ decision_text: "Duplicate Decision", is_client_visible: true }]);
        const dummyTasks = JSON.stringify([{
            title: "Duplicate Task",
            responsibility_type: "internal",
            priority: "high"
        }]);

        await client.query(
            "SELECT public.apply_meeting_intelligence_items($1, true, 'Duplicate Summary', $2::jsonb, $3::jsonb)",
            [artifactId, dummyDecisions, dummyTasks]
        );
        await client.query("COMMIT;");
    } catch (err) {
        reapplyError = err;
        await client.query("ROLLBACK;");
    } finally {
        client.release();
    }

    assert(!!reapplyError, "Re-applying already applied artifact threw an error");
    console.log("Error message received:", reapplyError.message);
    const is409Conflict = reapplyError.message.includes('409') && reapplyError.message.includes('already been applied');
    assert(is409Conflict, "Error is controlled 409 Conflict: 'Meeting AI artifact has already been applied'");

    // 4. Verify DB state AFTER the re-apply attempt
    console.log("\nVerifying DB state integrity post re-apply attempt...");

    const artAfter = (await pool.query("SELECT * FROM public.meeting_ai_artifacts WHERE id = $1", [artifactId])).rows[0];
    assert(artAfter.status === 'applied', "Artifact status remains 'applied'");
    assert(artAfter.applied_tasks_count === 3, "applied_tasks_count NOT incremented (still 3)");
    assert(artAfter.applied_decisions_count === 2, "applied_decisions_count NOT incremented (still 2)");
    assert(artAfter.applied_at.toISOString() === art.applied_at.toISOString(), "applied_at timestamp unchanged");

    const tasksAfter = await pool.query("SELECT COUNT(*) FROM public.tasks WHERE source_meeting_id = $1", [meetingId]);
    const countTasksAfter = parseInt(tasksAfter.rows[0].count, 10);
    assert(countTasksAfter === countTasksBefore, `Tasks count unchanged: ${countTasksAfter} === ${countTasksBefore}`);

    const decAfter = await pool.query("SELECT COUNT(*) FROM public.meeting_decisions WHERE meeting_id = $1", [meetingId]);
    const countDecAfter = parseInt(decAfter.rows[0].count, 10);
    assert(countDecAfter === countDecBefore, `Decisions count unchanged: ${countDecAfter} === ${countDecBefore}`);

    const notesAfter = await pool.query("SELECT COUNT(*) FROM public.meeting_notes WHERE meeting_id = $1 AND note_type = 'summary'", [meetingId]);
    const countNotesAfter = parseInt(notesAfter.rows[0].count, 10);
    assert(countNotesAfter === countNotesBefore, `Summary notes count unchanged: ${countNotesAfter} === ${countNotesBefore}`);

    // 5. Concurrent double-submit scenario on already applied artifact
    console.log("\nTesting concurrent double-submit scenario on already applied artifact...");
    const runConcurrentCall = async (callId) => {
        const c = await pool.connect();
        try {
            await c.query("BEGIN;");
            await c.query(`SET LOCAL request.jwt.claim.sub = '${callerId}';`);
            await c.query(
                "SELECT public.apply_meeting_intelligence_items($1, false, '', '[]'::jsonb, '[]'::jsonb)",
                [artifactId]
            );
            await c.query("COMMIT;");
            return { callId, success: true };
        } catch (e) {
            await c.query("ROLLBACK;");
            return { callId, success: false, error: e.message };
        } finally {
            c.release();
        }
    };

    const [res1, res2] = await Promise.all([runConcurrentCall(1), runConcurrentCall(2)]);
    assert(res1.success === false, "Concurrent call 1 rejected");
    assert(res2.success === false, "Concurrent call 2 rejected");
    assert(res1.error.includes('409') && res1.error.includes('already been applied'), "Concurrent call 1 threw 409 Conflict");
    assert(res2.error.includes('409') && res2.error.includes('already been applied'), "Concurrent call 2 threw 409 Conflict");

    const finalTasks = await pool.query("SELECT COUNT(*) FROM public.tasks WHERE source_meeting_id = $1", [meetingId]);
    assert(parseInt(finalTasks.rows[0].count, 10) === 3, "Final tasks count strictly remains 3");

    const finalDec = await pool.query("SELECT COUNT(*) FROM public.meeting_decisions WHERE meeting_id = $1", [meetingId]);
    assert(parseInt(finalDec.rows[0].count, 10) === 2, "Final decisions count strictly remains 2");

    await pool.end();
    console.log("\n=== Idempotency Verification for Applied Artifact 100% PASS ===");
}

main().catch(err => {
    console.error("FAIL:", err);
    process.exit(1);
});
