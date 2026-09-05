const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        throw new Error(message);
    }
    console.log("PASS: " + message);
}

async function run() {
    console.log("=== Phase 6D.4: Isolated Multi-Iteration Lifecycle Test ===");
    const client = await pool.connect();
    let tempTaskId = null;

    try {
        const demoOrgId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
        const projectRes = await client.query("SELECT id FROM public.projects WHERE organization_id = $1 LIMIT 1", [demoOrgId]);
        const projectId = projectRes.rows[0].id;

        const contactRes = await client.query("SELECT id FROM public.contacts WHERE organization_id = $1 LIMIT 1", [demoOrgId]);
        const contactId = contactRes.rows[0].id;

        const userRes = await client.query("SELECT id FROM public.profiles WHERE email = 'anzaitseva96@gmail.com' LIMIT 1");
        const userId = userRes.rows[0].id;

        // 1. Create temporary test task
        const taskInsert = await client.query(`
            INSERT INTO public.tasks (
                title, status, responsibility_type, organization_id, project_id, client_contact_id
            ) VALUES (
                'Temporary Multi-Iteration Verification Task', 'todo', 'client', $1, $2, $3
            ) RETURNING id
        `, [demoOrgId, projectId, contactId]);
        tempTaskId = taskInsert.rows[0].id;
        console.log("Created isolated temp task:", tempTaskId);

        // 2. Add first submission (e.g. via public link)
        const sub1 = await client.query(`
            INSERT INTO public.task_submissions (
                task_id, organization_id, submission_type, payload, attachments, submitted_by_contact_id, created_at
            ) VALUES (
                $1, $4, 'public_link', $2::jsonb, '[]'::jsonb, $3, NOW() - INTERVAL '1 hour'
            ) RETURNING id
        `, [tempTaskId, JSON.stringify({ text: "Перша відповідь клієнта" }), contactId, demoOrgId]);
        assert(sub1.rows.length === 1, "Iteration 1 inserted");

        // Mark task done
        await client.query("UPDATE public.tasks SET status = 'done', completed_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [tempTaskId]);

        // 3. Simulate PM Reopen
        await client.query("UPDATE public.tasks SET status = 'todo', completed_at = NULL WHERE id = $1", [tempTaskId]);
        const reopenedTask = await client.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [tempTaskId]);
        assert(reopenedTask.rows[0].status === 'todo', "Task successfully reopened to 'todo'");

        // 4. Add second submission (e.g. via authenticated portal)
        const sub2 = await client.query(`
            INSERT INTO public.task_submissions (
                task_id, organization_id, submission_type, payload, attachments, submitted_by_user_id, created_at
            ) VALUES (
                $1, $4, 'authenticated_portal', $2::jsonb, '[]'::jsonb, $3, NOW()
            ) RETURNING id
        `, [tempTaskId, JSON.stringify({ text: "Друга уточнена відповідь клієнта" }), userId, demoOrgId]);
        assert(sub2.rows.length === 1, "Iteration 2 inserted");

        await client.query("UPDATE public.tasks SET status = 'done', completed_at = NOW() WHERE id = $1", [tempTaskId]);

        // 5. Query submissions in chronological order
        const allSubs = await client.query(`
            SELECT id, submission_type, payload->>'text' as text, created_at 
            FROM public.task_submissions 
            WHERE task_id = $1 
            ORDER BY created_at ASC
        `, [tempTaskId]);

        assert(allSubs.rows.length === 2, "Exactly 2 iterations exist in history");
        assert(allSubs.rows[0].id === sub1.rows[0].id, "Iteration 1 is first chronologically");
        assert(allSubs.rows[0].submission_type === 'public_link', "Iteration 1 channel is 'public_link'");
        assert(allSubs.rows[0].text === "Перша відповідь клієнта", "Iteration 1 text preserved intact");

        assert(allSubs.rows[1].id === sub2.rows[0].id, "Iteration 2 is second chronologically");
        assert(allSubs.rows[1].submission_type === 'authenticated_portal', "Iteration 2 channel is 'authenticated_portal'");
        assert(allSubs.rows[1].text === "Друга уточнена відповідь клієнта", "Iteration 2 text preserved intact");

        console.log("PASS: Multi-iteration history is strictly additive, preserving both iterations without overwrite");
    } finally {
        // Cleanup isolated temp task only
        if (tempTaskId) {
            await client.query("DELETE FROM public.task_submissions WHERE task_id = $1", [tempTaskId]);
            await client.query("DELETE FROM public.tasks WHERE id = $1", [tempTaskId]);
            console.log("Cleaned up isolated temp task:", tempTaskId);
        }
        client.release();
        await pool.end();
    }
}

run();
