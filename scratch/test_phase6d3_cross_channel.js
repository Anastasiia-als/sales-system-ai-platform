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
    console.log("=== Starting Phase 6D.3 Cross-Channel Submissions Suite (Tests N-P) ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];
    const createdUserIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        // 1. Setup Organization & Project & Task
        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Submissions 6D3', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pmRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'pm_submissions_6d3@example.com') RETURNING id;`);
        const pmId = pmRes.rows[0].id;
        createdUserIds.push(pmId);
        await pool.query("UPDATE public.profiles SET global_role = 'pm' WHERE id = $1", [pmId]);

        const clientRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'client_submissions_6d3@example.com') RETURNING id;`);
        const clientUserId = clientRes.rows[0].id;
        createdUserIds.push(clientUserId);
        await pool.query("UPDATE public.profiles SET global_role = 'client' WHERE id = $1", [clientUserId]);

        const contactRes = await pool.query(
            "INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'John', 'Client', 'client_submissions_6d3@example.com') RETURNING id",
            [orgId]
        );
        const contactId = contactRes.rows[0].id;

        await pool.query(
            "INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active')",
            [orgId, contactId, clientUserId]
        );
        await pool.query(
            "INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true)",
            [orgId, clientUserId]
        );

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Project Submissions 6D3', 'active', $2) RETURNING id",
            [orgId, pmId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);
        await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'client_rep')", [projectId, clientUserId]);

        const tRes1 = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible, client_contact_id) VALUES ($1, $2, 'Task Public Submission 6D3', 'todo', 'client', true, $3) RETURNING id",
            [orgId, projectId, contactId]
        );
        const taskId1 = tRes1.rows[0].id;
        createdTaskIds.push(taskId1);

        const tRes2 = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible, client_contact_id) VALUES ($1, $2, 'Task Auth Submission 6D3', 'todo', 'client', true, $3) RETURNING id",
            [orgId, projectId, contactId]
        );
        const taskId2 = tRes2.rows[0].id;
        createdTaskIds.push(taskId2);

        async function runAsPM(sql) {
            const res = await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${pmId}"}';
                ${sql}
            `);
            return res[res.length - 1];
        }

        async function runAsClient(sql) {
            const res = await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${clientUserId}"}';
                ${sql}
            `);
            return res[res.length - 1];
        }

        // ====================================================================
        // Test N: Public Link Submission
        // ====================================================================
        console.log("\n--- Test N: Public Link Submission ---");
        const genRes = await runAsPM(`SELECT public.generate_action_token('${taskId1}') AS res;`);
        const rawToken = genRes.rows[0].res.raw_token;

        const publicSubmitRes = await pool.query(`
            SELECT public.submit_public_client_action(
                $1,
                '{"text": "Submitted via public magic link", "attachments": [{"name":"spec.pdf","size":1024,"path":"uploads/spec.pdf"}]}'::jsonb
            ) AS res;
        `, [rawToken]);
        assert(publicSubmitRes.rows[0].res.success === true, "submit_public_client_action returned success");

        // Verify task state updated to 'done'
        const task1Check = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [taskId1]);
        assert(task1Check.rows[0].status === 'done', "Task status updated to 'done'");
        assert(task1Check.rows[0].completed_at !== null, "Task completed_at is populated");

        // Verify get_client_action_token_status returns 'done'
        const statusDone1 = await runAsPM(`SELECT public.get_client_action_token_status('${taskId1}') AS res;`);
        assert(statusDone1.rows[0].res.status === 'done', "get_client_action_token_status returns 'done'");
        assert(statusDone1.rows[0].res.is_completed === true, "is_completed is true");

        // ====================================================================
        // Test O: Authenticated Portal Submission
        // ====================================================================
        console.log("\n--- Test O: Authenticated Portal Submission ---");
        const authSubmitRes = await runAsClient(`
            SELECT public.submit_authenticated_client_action(
                '${taskId2}',
                '{"text": "Submitted via authenticated client portal", "attachments": [{"name":"report.xlsx","size":2048,"path":"uploads/report.xlsx"}]}'::jsonb
            ) AS res;
        `);
        assert(authSubmitRes.rows[0].res.success === true, "submit_authenticated_client_action returned success");

        const task2Check = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [taskId2]);
        assert(task2Check.rows[0].status === 'done', "Task 2 status updated to 'done'");
        assert(task2Check.rows[0].completed_at !== null, "Task 2 completed_at is populated");

        const statusDone2 = await runAsPM(`SELECT public.get_client_action_token_status('${taskId2}') AS res;`);
        assert(statusDone2.rows[0].res.status === 'done', "Task 2 get_client_action_token_status returns 'done'");

        // ====================================================================
        // Test P: PM Submissions Review Retrieval
        // ====================================================================
        console.log("\n--- Test P: PM Submissions Review Retrieval ---");
        const subs1Res = await runAsPM(`SELECT public.get_task_submissions('${taskId1}') AS res;`);
        const subs1 = subs1Res.rows[0].res;
        assert(Array.isArray(subs1) && subs1.length === 1, "Task 1 has exactly 1 submission");
        assert(subs1[0].submission_type === 'public_link', "Task 1 submission recorded as 'public_link'");
        assert(subs1[0].submitted_by_user_id === null, "Task 1 public submission has null submitted_by_user_id (anonymous/unauthenticated)");

        const subs2Res = await runAsPM(`SELECT public.get_task_submissions('${taskId2}') AS res;`);
        const subs2 = subs2Res.rows[0].res;
        assert(Array.isArray(subs2) && subs2.length === 1, "Task 2 has exactly 1 submission");
        assert(subs2[0].submission_type === 'authenticated_portal', "Task 2 submission recorded as 'authenticated_portal'");
        assert(subs2[0].payload.text === "Submitted via authenticated client portal", "Task 2 payload text matches");
        assert(subs2[0].attachments[0].name === "report.xlsx", "Task 2 attachment preserved");
        assert(subs2[0].submitted_by_contact_name === "John Client", "Task 2 authenticated submission attributed to John Client");

        console.log("\n=== ALL CROSS-CHANNEL SUBMISSIONS TESTS (N-P) PASSED! ===");
    } catch (err) {
        console.error("Test Suite Failed:", err);
        exitCode = 1;
    } finally {
        for (const tid of createdTaskIds) {
            await pool.query("DELETE FROM public.task_submissions WHERE task_id = $1", [tid]);
            await pool.query("DELETE FROM public.client_action_tokens WHERE task_id = $1", [tid]);
            await pool.query("DELETE FROM public.tasks WHERE id = $1", [tid]);
        }
        for (const pid of createdProjectIds) {
            await pool.query("DELETE FROM public.projects WHERE id = $1", [pid]);
        }
        for (const uid of createdUserIds) {
            await pool.query("DELETE FROM public.client_portal_access WHERE user_id = $1", [uid]);
            await pool.query("DELETE FROM public.profiles WHERE id = $1", [uid]);
            await pool.query("DELETE FROM auth.users WHERE id = $1", [uid]);
        }
        for (const oid of createdOrgIds) {
            await pool.query("DELETE FROM public.contacts WHERE organization_id = $1", [oid]);
            await pool.query("DELETE FROM public.organizations WHERE id = $1", [oid]);
        }
        await pool.end();
        process.exit(exitCode);
    }
}

run();
