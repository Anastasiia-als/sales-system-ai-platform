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
    console.log("=== Starting Phase 6D.1 Data Minimization & Privacy Suite ===");
    let exitCode = 0;
    const createdProjectIds = [];
    const createdTaskIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;
        const orgRes = await pool.query("SELECT id FROM public.organizations LIMIT 1");
        const orgId = orgRes.rows[0].id;

        // 1. Setup Test Project with Sensitive Metadata & Client Action Task
        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status) VALUES ($1, 'Confidential Enterprise Strategy', 'active') RETURNING id",
            [orgId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, description, due_date, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Upload Financial Statements', 'Please provide certified Q2 statements', '2026-09-30', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        // 2. Generate Magic Link
        const genRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskId}') AS res;
        `);
        const tokenInfo = genRes[genRes.length - 1].rows[0].res;

        // 3. Test Public Retrieval (Allowlist Verification)
        console.log("1. Testing get_public_client_action allowlist...");
        const pubRes = await pool.query("SELECT public.get_public_client_action($1) AS res", [tokenInfo.raw_token]);
        const data = pubRes.rows[0].res;

        console.log("Public Data Returned:", data);
        assert(data.status === 'active', "Status is 'active'");
        assert(data.title === 'Upload Financial Statements', "Title matches");
        assert(data.description === 'Please provide certified Q2 statements', "Description matches");
        assert(data.due_date === '2026-09-30', "Due date matches");
        assert(data.project_name === 'Confidential Enterprise Strategy', "Project display name present");
        assert(typeof data.organization_name === 'string', "Organization display name present");
        assert(data.is_completed === false, "is_completed is false");

        // 4. Negative Assertions: Prohibited Internal Fields
        console.log("2. Verifying strict zero-leakage of internal fields...");
        const prohibitedKeys = [
            'organization_id', 'project_id', 'created_by', 'assigned_to', 
            'budget', 'amount_minor', 'costs', 'margin', 'internal_notes', 
            'blockers', 'health_status', 'email', 'emails', 'user_id', 
            'responsible_pm_id', 'auth_users', 'token_hash'
        ];

        prohibitedKeys.forEach(key => {
            assert(data[key] === undefined, `Prohibited internal key '${key}' is completely absent from public projection`);
        });

        // 5. Test Differentiated Privacy Responses
        console.log("3. Testing Differentiated Privacy Responses...");
        
        // Nonexistent / Random token
        const notFoundRes = await pool.query("SELECT public.get_public_client_action('fwa_random_nonexistent_token_123456789') AS res");
        assert(notFoundRes.rows[0].res.status === 'not_found', "Nonexistent token returns status = 'not_found'");
        assert(Object.keys(notFoundRes.rows[0].res).length === 1, "Not found response contains ZERO metadata");

        // Expired token
        await pool.query("UPDATE public.client_action_tokens SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [tokenInfo.token_id]);
        const expRes = await pool.query("SELECT public.get_public_client_action($1) AS res", [tokenInfo.raw_token]);
        assert(expRes.rows[0].res.status === 'expired', "Expired token returns status = 'expired'");
        assert(Object.keys(expRes.rows[0].res).length === 1, "Expired response contains ZERO metadata");

        // Revoked token
        await pool.query("UPDATE public.client_action_tokens SET status = 'revoked', revoked_at = NOW() WHERE id = $1", [tokenInfo.token_id]);
        const revRes = await pool.query("SELECT public.get_public_client_action($1) AS res", [tokenInfo.raw_token]);
        assert(revRes.rows[0].res.status === 'revoked', "Revoked token returns status = 'revoked'");
        assert(Object.keys(revRes.rows[0].res).length === 1, "Revoked response contains ZERO metadata");

        // Used token
        await pool.query("UPDATE public.client_action_tokens SET status = 'used', used_at = NOW(), revoked_at = NULL WHERE id = $1", [tokenInfo.token_id]);
        const usedRes = await pool.query("SELECT public.get_public_client_action($1) AS res", [tokenInfo.raw_token]);
        assert(usedRes.rows[0].res.status === 'already_used', "Used token returns status = 'already_used'");
        assert(usedRes.rows[0].res.title === 'Upload Financial Statements', "Used response returns safe title");
        assert(usedRes.rows[0].res.is_completed === true, "Used response marks is_completed = true");

        console.log("PASS: Phase 6D.1 Data Minimization & Privacy Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Data Minimization Suite:", e);
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
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error in data minimization suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
