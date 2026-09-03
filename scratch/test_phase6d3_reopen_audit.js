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
    console.log("=== Starting Phase 6D.3 Reopen Action & Audit Immutability Suite (Tests Q-R) ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];
    const createdUserIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        // 1. Setup Organization & Project & Task
        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Reopen Audit 6D3', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pmRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'pm_reopen_6d3@example.com') RETURNING id;`);
        const pmId = pmRes.rows[0].id;
        createdUserIds.push(pmId);
        await pool.query("UPDATE public.profiles SET global_role = 'pm' WHERE id = $1", [pmId]);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Project Reopen Audit 6D3', 'active', $2) RETURNING id",
            [orgId, pmId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Task Reopen Audit 6D3', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        async function runAsPM(sql) {
            const res = await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${pmId}"}';
                ${sql}
            `);
            return res[res.length - 1];
        }

        // ====================================================================
        // Test Q: Complete and Reopen Action
        // ====================================================================
        console.log("\n--- Test Q: Complete and Reopen Action ---");
        // 1. Generate token 1
        const genRes1 = await runAsPM(`SELECT public.generate_action_token('${taskId}') AS res;`);
        const token1 = genRes1.rows[0].res;
        assert(token1.success === true, "Token 1 generated");

        // 2. Submit token 1
        const subRes1 = await pool.query(`
            SELECT public.submit_public_client_action(
                $1,
                '{"text": "First iteration answer", "attachments": [{"name":"draft_v1.pdf","size":1024}]}'::jsonb
            ) AS res;
        `, [token1.raw_token]);
        assert(subRes1.rows[0].res.success === true, "First submission completed");

        // Verify task state is 'done'
        const checkDone = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [taskId]);
        assert(checkDone.rows[0].status === 'done', "Task status is 'done'");
        assert(checkDone.rows[0].completed_at !== null, "Task completed_at is set");

        // Verify status before Reopen is 'done'
        const statusBeforeReopen = await runAsPM(`SELECT public.get_client_action_token_status('${taskId}') AS res;`);
        assert(statusBeforeReopen.rows[0].res.status === 'done', "Token status before reopen is 'done'");
        assert(statusBeforeReopen.rows[0].res.is_completed === true, "is_completed before reopen is true");

        // 3. PM executes Reopen
        console.log("Executing reopen_client_action...");
        const reopenRes = await runAsPM(`SELECT public.reopen_client_action('${taskId}') AS res;`);
        assert(reopenRes.rows[0].res.success === true, "reopen_client_action returned success");
        assert(reopenRes.rows[0].res.status === 'todo', "reopen_client_action returned status 'todo'");

        // Verify task table state after Reopen
        const checkReopened = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [taskId]);
        assert(checkReopened.rows[0].status === 'todo', "Task status reset to 'todo'");
        assert(checkReopened.rows[0].completed_at === null, "Task completed_at reset to NULL");

        // Verify token status immediately after Reopen is STRICTLY 'none' («Не згенеровано»)
        const statusAfterReopen = await runAsPM(`SELECT public.get_client_action_token_status('${taskId}') AS res;`);
        assert(statusAfterReopen.rows[0].res.status === 'none', "Token status immediately after reopen is strictly 'none' («Не згенеровано»)");
        assert(statusAfterReopen.rows[0].res.is_completed === false, "is_completed after reopen is false");
        assert(statusAfterReopen.rows[0].res.reopened === true, "Status flags task as reopened");

        // Verify historic token remains permanently used
        const token1Check = await pool.query("SELECT status, used_at FROM public.client_action_tokens WHERE id = $1", [token1.token_id]);
        assert(token1Check.rows[0].status === 'used', "Historic token 1 remains permanently 'used'");
        assert(token1Check.rows[0].used_at !== null, "Historic token 1 used_at is preserved");

        // Verify historic submission remains intact
        const subsCheck1 = await pool.query("SELECT COUNT(*) AS cnt FROM public.task_submissions WHERE task_id = $1", [taskId]);
        assert(parseInt(subsCheck1.rows[0].cnt, 10) === 1, "Historic submission preserved in DB (0 deletions)");

        // ====================================================================
        // Test R: Lifecycle Continuation after Reopen
        // ====================================================================
        console.log("\n--- Test R: Lifecycle Continuation after Reopen ---");
        // Generate new token for reopened task
        const genRes2 = await runAsPM(`SELECT public.generate_action_token('${taskId}') AS res;`);
        const token2 = genRes2.rows[0].res;
        assert(token2.success === true, "New token 2 generated for reopened task");
        assert(token2.token_id !== token1.token_id, "Token 2 has unique ID");

        // Status becomes 'active'
        const statusActive2 = await runAsPM(`SELECT public.get_client_action_token_status('${taskId}') AS res;`);
        assert(statusActive2.rows[0].res.status === 'active', "Status transitions to 'active' after new generation");
        assert(statusActive2.rows[0].res.token_id === token2.token_id, "Active status points to token 2");

        // Submit token 2 (Iteration 2)
        const subRes2 = await pool.query(`
            SELECT public.submit_public_client_action(
                $1,
                '{"text": "Second iteration revised answer", "attachments": [{"name":"final_spec.pdf","size":2048}]}'::jsonb
            ) AS res;
        `, [token2.raw_token]);
        assert(subRes2.rows[0].res.success === true, "Second submission completed successfully");

        // Verify both submissions are preserved chronologically
        const allSubsRes = await runAsPM(`SELECT public.get_task_submissions('${taskId}') AS res;`);
        const allSubs = allSubsRes.rows[0].res;
        assert(Array.isArray(allSubs) && allSubs.length === 2, "Task submissions history contains exactly 2 submissions");
        assert(allSubs[0].payload.text === "First iteration answer", "Submission #1 text matches");
        assert(allSubs[0].attachments[0].name === "draft_v1.pdf", "Submission #1 attachment matches");
        assert(allSubs[1].payload.text === "Second iteration revised answer", "Submission #2 text matches");
        assert(allSubs[1].attachments[0].name === "final_spec.pdf", "Submission #2 attachment matches");

        console.log("\n=== ALL REOPEN ACTION & AUDIT IMMUTABILITY TESTS (Q-R) PASSED! ===");
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
            await pool.query("DELETE FROM public.profiles WHERE id = $1", [uid]);
            await pool.query("DELETE FROM auth.users WHERE id = $1", [uid]);
        }
        for (const oid of createdOrgIds) {
            await pool.query("DELETE FROM public.organizations WHERE id = $1", [oid]);
        }
        await pool.end();
        process.exit(exitCode);
    }
}

run();
