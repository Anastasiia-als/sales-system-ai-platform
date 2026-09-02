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
    console.log("=== Starting Phase 6D.1.1 Transaction Rollback & Failure Recovery Suite ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];
    const createdRuleIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        // Setup Org & Project
        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Rollback Invariant', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, title) VALUES ($1, 'Rollback Project', 'active', 'Rollback Project') RETURNING id",
            [orgId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Task For Rollback Testing', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        // Generate Token
        const gRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskId}') AS res;
        `);
        const token = gRes[gRes.length - 1].rows[0].res;

        // 1. Execute Simulated Injected Failure inside Transaction
        console.log("1. Executing transaction with injected failure after submission insertion...");
        const client = await pool.connect();
        let transactionRolledBack = false;

        try {
            await client.query("BEGIN;");
            
            // Execute submission inside transaction
            await client.query("SELECT public.submit_public_client_action($1, '{\"notes\":\"Draft submission\"}'::jsonb)", [token.raw_token]);
            
            // Invalidate/Fail the transaction before commit
            await client.query("RAISE EXCEPTION 'Simulated Post-Insert Failure';");
            await client.query("COMMIT;");
        } catch(e) {
            await client.query("ROLLBACK;");
            transactionRolledBack = true;
            assert(e.message.includes('Simulated Post-Insert Failure') || e.message.includes('syntax error'), "Transaction aborted with injected failure");
        } finally {
            client.release();
        }

        assert(transactionRolledBack, "Injected transaction failure triggered rollback");

        // 2. Verify Database State After Rollback: Total Clean State
        console.log("2. Verifying database state after transaction rollback...");
        const subCount = await pool.query("SELECT COUNT(*) as c FROM public.task_submissions WHERE task_id = $1", [taskId]);
        assert(parseInt(subCount.rows[0].c, 10) === 0, `task_submissions count after rollback = 0 (Found: ${subCount.rows[0].c})`);

        const taskState = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [taskId]);
        assert(taskState.rows[0].status === 'todo', "Task status remains 'todo'");
        assert(taskState.rows[0].completed_at === null, "Task completed_at remains NULL");

        const tokenState = await pool.query("SELECT status, used_at FROM public.client_action_tokens WHERE id = $1", [token.token_id]);
        assert(tokenState.rows[0].status === 'active', "Token status remains 'active'");
        assert(tokenState.rows[0].used_at === null, "Token used_at remains NULL");

        const eventCount = await pool.query("SELECT COUNT(*) as c FROM public.automation_execution_events WHERE project_id = $1", [projectId]);
        assert(parseInt(eventCount.rows[0].c, 10) === 0, "Automation execution events count after rollback = 0");

        // 3. Execute Subsequent Normal Successful Submission
        console.log("3. Executing subsequent normal submission after rollback recovery...");
        const validSubmit = await pool.query("SELECT public.submit_public_client_action($1, '{\"notes\":\"Final Valid Submission\"}'::jsonb) AS res", [token.raw_token]);
        assert(validSubmit.rows[0].res.success === true, "Subsequent submission succeeded normally");

        const finalSubCount = await pool.query("SELECT COUNT(*) as c FROM public.task_submissions WHERE task_id = $1", [taskId]);
        assert(parseInt(finalSubCount.rows[0].c, 10) === 1, "task_submissions count after valid submit = 1");

        const finalTaskState = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [taskId]);
        assert(finalTaskState.rows[0].status === 'done', "Task marked 'done'");
        assert(finalTaskState.rows[0].completed_at !== null, "Task completed_at is set");

        const finalTokenState = await pool.query("SELECT status, used_at FROM public.client_action_tokens WHERE id = $1", [token.token_id]);
        assert(finalTokenState.rows[0].status === 'used', "Token marked 'used'");

        console.log("PASS: Phase 6D.1.1 Transaction Rollback & Failure Recovery Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Rollback Suite:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (createdRuleIds.length > 0) {
                await pool.query("DELETE FROM public.automation_execution_events WHERE rule_id = ANY($1::uuid[])", [createdRuleIds]);
                await pool.query("DELETE FROM public.automation_rules WHERE id = ANY($1::uuid[])", [createdRuleIds]);
            }
            if (createdTaskIds.length > 0) {
                await pool.query("DELETE FROM public.task_submissions WHERE task_id = ANY($1::uuid[])", [createdTaskIds]);
                await pool.query("DELETE FROM public.client_action_tokens WHERE task_id = ANY($1::uuid[])", [createdTaskIds]);
                await pool.query("DELETE FROM public.tasks WHERE id = ANY($1::uuid[])", [createdTaskIds]);
            }
            if (createdProjectIds.length > 0) {
                await pool.query("DELETE FROM public.project_memberships WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            if (createdOrgIds.length > 0) {
                await pool.query("DELETE FROM public.client_portal_access WHERE organization_id = ANY($1::uuid[])", [createdOrgIds]);
                await pool.query("DELETE FROM public.contacts WHERE organization_id = ANY($1::uuid[])", [createdOrgIds]);
                await pool.query("DELETE FROM public.organization_memberships WHERE organization_id = ANY($1::uuid[])", [createdOrgIds]);
                await pool.query("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", [createdOrgIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error in rollback suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
