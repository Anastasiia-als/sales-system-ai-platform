const { Pool } = require('pg');
const crypto = require('crypto');
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
    console.log("=== Starting Phase 6D.1 Token Generation & Crypto Security Suite ===");
    let exitCode = 0;
    const createdProjectIds = [];
    const createdTaskIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;
        const orgRes = await pool.query("SELECT id FROM public.organizations LIMIT 1");
        const orgId = orgRes.rows[0].id;

        // 1. Setup Test Project & Client Action Task
        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status) VALUES ($1, 'Phase 6D Tokens Project', 'active') RETURNING id",
            [orgId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Provide Brief & Credentials', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        // 2. Execute Token Generation RPC as Owner
        console.log("Generating action token as Owner...");
        const genRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskId}') AS res;
        `);
        const res = genRes[genRes.length - 1].rows[0].res;

        assert(res.success === true, "Token generation RPC returned success = true");
        assert(typeof res.raw_token === 'string' && res.raw_token.startsWith('fwa_'), "Raw token has fwa_ prefix");
        assert(res.raw_token.length >= 32, "Raw token has adequate cryptographic entropy (>= 32 chars)");

        // 3. Verify Database Storage (Hash ONLY, Zero Plaintext)
        const computedHash = crypto.createHash('sha256').update(res.raw_token).digest('hex');
        const dbToken = await pool.query("SELECT * FROM public.client_action_tokens WHERE id = $1", [res.token_id]);
        
        assert(dbToken.rows.length === 1, "Token record found in public.client_action_tokens");
        const tokenRow = dbToken.rows[0];
        assert(tokenRow.token_hash === computedHash, "DB stores exact SHA-256 digest of raw token");
        assert(tokenRow.status === 'active', "Token status is active");
        assert(tokenRow.used_at === null, "Token used_at is null");
        assert(tokenRow.revoked_at === null, "Token revoked_at is null");
        assert(new Date(tokenRow.expires_at) > new Date(), "Token expires_at is in the future (~14 days)");

        // Assert that raw token string does NOT exist anywhere in database columns
        const rawLeakCheck = await pool.query(
            "SELECT id FROM public.client_action_tokens WHERE token_hash LIKE $1",
            ['%' + res.raw_token + '%']
        );
        assert(rawLeakCheck.rows.length === 0, "Raw bearer token is completely absent from database columns");

        // 4. Deny Token Generation for Team Task (Non-client action)
        const teamTaskRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type) VALUES ($1, $2, 'Internal Dev Task', 'todo', 'internal') RETURNING id",
            [orgId, projectId]
        );
        const teamTaskId = teamTaskRes.rows[0].id;
        createdTaskIds.push(teamTaskId);

        let teamTaskBlocked = false;
        try {
            await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
                SELECT public.generate_action_token('${teamTaskId}') AS res;
            `);
        } catch(e) {
            teamTaskBlocked = true;
            assert(e.message.includes('not a client action'), "Token generation blocked for internal team tasks");
        }
        assert(teamTaskBlocked, "Non-client task token generation threw expected exception");

        // 5. Deny Token Generation for Anonymous Caller
        let anonBlocked = false;
        try {
            await pool.query(`
                SET LOCAL role TO anon;
                SET LOCAL request.jwt.claims TO '{}';
                SELECT public.generate_action_token('${taskId}') AS res;
            `);
        } catch(e) {
            anonBlocked = true;
            assert(e.message.includes('Access denied') || e.message.includes('permission denied'), "Anonymous caller denied token generation");
        }
        assert(anonBlocked, "Anonymous token generation threw expected exception");

        console.log("PASS: Phase 6D.1 Token Generation Suite completed successfully!");
    } catch(e) {
        console.error("FATAL ERROR in Token Suite:", e);
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
            console.error("Cleanup error in tokens suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
