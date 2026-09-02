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
    console.log("=== Starting Phase 6D.1 Tenant Invariant, RLS Isolation & Rollback Suite ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        // 1. Setup Org Alpha & Org Beta
        const orgAlphaRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Alpha Invariant', 'active') RETURNING id");
        const orgAlphaId = orgAlphaRes.rows[0].id;
        createdOrgIds.push(orgAlphaId);

        const orgBetaRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Beta Invariant', 'active') RETURNING id");
        const orgBetaId = orgBetaRes.rows[0].id;
        createdOrgIds.push(orgBetaId);

        // Project & Task in Org Alpha
        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status) VALUES ($1, 'Alpha Project', 'active') RETURNING id",
            [orgAlphaId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Alpha Client Task', 'todo', 'client', true) RETURNING id",
            [orgAlphaId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        // 2. Test Tenant Invariant Trigger on client_action_tokens
        console.log("1. Testing client_action_tokens tenant mismatch blocker...");
        let tokenSpoofBlocked = false;
        try {
            await pool.query(`
                INSERT INTO public.client_action_tokens (
                    organization_id, task_id, token_hash, status, expires_at
                ) VALUES (
                    $1, $2, '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'active', NOW() + interval '1 day'
                )
            `, [orgBetaId, taskId]); // Org Beta passed for Task in Org Alpha
        } catch(e) {
            tokenSpoofBlocked = true;
            assert(e.message.includes('Tenant mismatch'), "DB trigger rejected mismatched organization_id on client_action_tokens");
        }
        assert(tokenSpoofBlocked, "Token creation with mismatched tenant threw exception");

        // 3. Test Tenant Invariant Trigger on task_submissions
        console.log("2. Testing task_submissions tenant mismatch blocker...");
        let subSpoofBlocked = false;
        try {
            await pool.query(`
                INSERT INTO public.task_submissions (
                    organization_id, task_id, submission_type, payload
                ) VALUES (
                    $1, $2, 'public_link', '{}'::jsonb
                )
            `, [orgBetaId, taskId]); // Org Beta passed for Task in Org Alpha
        } catch(e) {
            subSpoofBlocked = true;
            assert(e.message.includes('Tenant mismatch'), "DB trigger rejected mismatched organization_id on task_submissions");
        }
        assert(subSpoofBlocked, "Submission creation with mismatched tenant threw exception");

        // 4. Test RLS Direct-Table Bypass Protections
        console.log("3. Testing RLS Direct Table Access by Anonymous and Foreign Tenants...");
        
        // Generate valid token as Owner first
        const genRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskId}') AS res;
        `);
        const tokenData = genRes[genRes.length - 1].rows[0].res;

        // Anonymous direct SELECT on client_action_tokens -> 0 rows
        const anonTokens = await pool.query(`
            SET LOCAL role TO anon;
            SET LOCAL request.jwt.claims TO '{}';
            SELECT * FROM public.client_action_tokens WHERE id = '${tokenData.token_id}';
        `);
        const anonTokenRows = anonTokens[anonTokens.length - 1].rows;
        assert(anonTokenRows.length === 0, "Anonymous direct SELECT on client_action_tokens returned 0 rows (Denied by RLS)");

        // Anonymous direct SELECT on task_submissions -> 0 rows
        const anonSubs = await pool.query(`
            SET LOCAL role TO anon;
            SET LOCAL request.jwt.claims TO '{}';
            SELECT * FROM public.task_submissions WHERE task_id = '${taskId}';
        `);
        const anonSubRows = anonSubs[anonSubs.length - 1].rows;
        assert(anonSubRows.length === 0, "Anonymous direct SELECT on task_submissions returned 0 rows (Denied by RLS)");

        // 5. Test Atomic Rollback Guarantee
        console.log("4. Testing Atomic Rollback on Core Submission Failure...");
        const t2Res = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Rollback Test Task', 'todo', 'client', true) RETURNING id",
            [orgAlphaId, projectId]
        );
        const task2Id = t2Res.rows[0].id;
        createdTaskIds.push(task2Id);

        // Mark task done first so next submit fails
        await pool.query("UPDATE public.tasks SET status = 'done' WHERE id = $1", [task2Id]);

        let rollbackSucceeded = false;
        try {
            await pool.query(`SELECT public._execute_client_action_submission_core('${task2Id}', NULL, 'public_link', NULL, NULL, '{}'::jsonb, '[]'::jsonb)`);
        } catch(e) {
            rollbackSucceeded = true;
            assert(e.message.includes('Action is already completed'), "Core rejected execution on completed task");
        }
        assert(rollbackSucceeded, "Core thrown exception as expected");

        const subCount = await pool.query("SELECT COUNT(*) as c FROM public.task_submissions WHERE task_id = $1", [task2Id]);
        assert(parseInt(subCount.rows[0].c, 10) === 0, "0 rows created in task_submissions after rolled back transaction");

        console.log("PASS: Phase 6D.1 Tenant Invariant & Security Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Tenant Invariant Suite:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (createdTaskIds.length > 0) {
                await pool.query("DELETE FROM public.task_submissions WHERE task_id = ANY($1::uuid[])", [createdTaskIds]);
                await pool.query("DELETE FROM public.client_action_tokens WHERE task_id = ANY($1::uuid[])", [createdTaskIds]);
                await pool.query("DELETE FROM public.tasks WHERE id = ANY($1::uuid[])", [createdTaskIds]);
            }
            if (createdProjectIds.length > 0) {
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            if (createdOrgIds.length > 0) {
                await pool.query("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", [createdOrgIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error in tenant invariant suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
