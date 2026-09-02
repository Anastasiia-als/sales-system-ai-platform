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
    console.log("=== Starting Phase 6D.1 Cross-Channel Submission & Race Suite ===");
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
            "INSERT INTO public.projects (organization_id, name, status) VALUES ($1, 'Phase 6D Cross-Channel Project', 'active') RETURNING id",
            [orgId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Provide Contract Sign-off', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        // 2. PM Generates Magic Link
        console.log("1. PM generates Magic Link...");
        const genRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskId}') AS res;
        `);
        const tokenInfo = genRes[genRes.length - 1].rows[0].res;
        assert(tokenInfo.success === true, "Magic Link generated");

        const checkActive = await pool.query("SELECT status FROM public.client_action_tokens WHERE id = $1", [tokenInfo.token_id]);
        assert(checkActive.rows[0].status === 'active', "Token is currently active");

        // 3. Client Completes Task via Authenticated Portal
        console.log("2. Client completes task via authenticated portal...");
        const authSubRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.submit_authenticated_client_action('${taskId}', '{\"signed\":true,\"method\":\"portal\"}'::jsonb) AS res;
        `);
        const authRes = authSubRes[authSubRes.length - 1].rows[0].res;
        assert(authRes.success === true, "Authenticated submission succeeded");

        // 4. Assert that Active Token was Automatically REVOKED
        const checkAutoRevoked = await pool.query("SELECT status, revoked_at FROM public.client_action_tokens WHERE id = $1", [tokenInfo.token_id]);
        assert(checkAutoRevoked.rows[0].status === 'revoked', "Active Magic Link token was automatically REVOKED upon authenticated submission");
        assert(checkAutoRevoked.rows[0].revoked_at !== null, "Token revoked_at timestamp set");

        // 5. Attempting to use the old Magic Link must FAIL deterministically
        let linkSubmitBlocked = false;
        try {
            await pool.query("SELECT public.submit_public_client_action($1, '{\"late_attempt\":true}'::jsonb)", [tokenInfo.raw_token]);
        } catch(e) {
            linkSubmitBlocked = true;
            assert(e.message.includes('Invalid or revoked token'), "Old Magic Link rejected with 'Invalid or revoked token'");
        }
        assert(linkSubmitBlocked, "Magic Link submission after authenticated completion was blocked");

        // 6. Cross-Channel Race Test: Promise.all([publicSubmit, authenticatedSubmit])
        console.log("3. Executing Parallel Cross-Channel Race: Promise.all([publicSubmit, authSubmit])...");
        const t2Res = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Concurrent Race Action', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const task2Id = t2Res.rows[0].id;
        createdTaskIds.push(task2Id);

        const genRes2 = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${task2Id}') AS res;
        `);
        const token2 = genRes2[genRes2.length - 1].rows[0].res;

        const raceClient1 = new Pool({ connectionString: pool.options.connectionString });
        const raceClient2 = new Pool({ connectionString: pool.options.connectionString });

        const raceResults = await Promise.allSettled([
            raceClient1.query("SELECT public.submit_public_client_action($1, '{\"channel\":\"public\"}'::jsonb) as res", [token2.raw_token]),
            raceClient2.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
                SELECT public.submit_authenticated_client_action('${task2Id}', '{\"channel\":\"authenticated\"}'::jsonb) as res;
            `)
        ]);

        await raceClient1.end();
        await raceClient2.end();

        const raceFulfilled = raceResults.filter(r => r.status === 'fulfilled');
        const raceRejected = raceResults.filter(r => r.status === 'rejected');

        console.log("Cross-Channel Race: Fulfilled =", raceFulfilled.length, ", Rejected =", raceRejected.length);
        assert(raceFulfilled.length === 1, "Exactly ONE channel won the race");
        assert(raceRejected.length === 1, "Exactly ONE channel was rejected (double submit prevented)");

        const raceSubmissions = await pool.query("SELECT * FROM public.task_submissions WHERE task_id = $1", [task2Id]);
        assert(raceSubmissions.rows.length === 1, "Exactly ONE submission created in task_submissions");

        const checkTask2 = await pool.query("SELECT status FROM public.tasks WHERE id = $1", [task2Id]);
        assert(checkTask2.rows[0].status === 'done', "Task status marked done");

        console.log("PASS: Phase 6D.1 Cross-Channel Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Cross-Channel Suite:", e);
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
            console.error("Cleanup error in cross-channel suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
