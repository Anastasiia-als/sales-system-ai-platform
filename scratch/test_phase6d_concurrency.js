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
    console.log("=== Starting Phase 6D.1 Concurrency & Race Condition Suite ===");
    let exitCode = 0;
    const createdProjectIds = [];
    const createdTaskIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;
        const orgRes = await pool.query("SELECT id FROM public.organizations LIMIT 1");
        const orgId = orgRes.rows[0].id;

        // Setup Test Project & Client Action Task
        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status) VALUES ($1, 'Phase 6D Concurrency Project', 'active') RETURNING id",
            [orgId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Submit Assets', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        // 1. Concurrent Token Generation Race: Promise.all([generate, generate])
        console.log("1. Executing Concurrent Token Generation Race (Promise.all)...");
        const genClient1 = new Pool({ connectionString: pool.options.connectionString });
        const genClient2 = new Pool({ connectionString: pool.options.connectionString });

        const [g1, g2] = await Promise.allSettled([
            genClient1.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
                SELECT public.generate_action_token('${taskId}') AS res;
            `),
            genClient2.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
                SELECT public.generate_action_token('${taskId}') AS res;
            `)
        ]);

        await genClient1.end();
        await genClient2.end();

        // Check active tokens in DB (Must be EXACTLY 1 active token)
        const activeTokens = await pool.query(
            "SELECT * FROM public.client_action_tokens WHERE task_id = $1 AND status = 'active' AND used_at IS NULL",
            [taskId]
        );
        assert(activeTokens.rows.length === 1, `Single-Active-Token invariant holds: Exactly 1 active token in DB (Found ${activeTokens.rows.length})`);

        const activeToken = activeTokens.rows[0];

        // 2. Concurrent Public Submission Race: Promise.all([submitA, submitB])
        console.log("2. Executing Concurrent Public Submission Race on same token (Promise.all)...");
        
        // Find which raw_token matches active token
        let activeRawToken = null;
        if (g1.status === 'fulfilled') {
            const r1 = g1.value[g1.value.length - 1].rows[0].res;
            if (r1.token_id === activeToken.id) activeRawToken = r1.raw_token;
        }
        if (!activeRawToken && g2.status === 'fulfilled') {
            const r2 = g2.value[g2.value.length - 1].rows[0].res;
            if (r2.token_id === activeToken.id) activeRawToken = r2.raw_token;
        }
        assert(activeRawToken !== null, "Resolved valid raw token for active token row");

        const subClient1 = new Pool({ connectionString: pool.options.connectionString });
        const subClient2 = new Pool({ connectionString: pool.options.connectionString });

        const subResults = await Promise.allSettled([
            subClient1.query("SELECT public.submit_public_client_action($1, '{\"agent\":\"Runner A\"}'::jsonb) AS res", [activeRawToken]),
            subClient2.query("SELECT public.submit_public_client_action($1, '{\"agent\":\"Runner B\"}'::jsonb) AS res", [activeRawToken])
        ]);

        await subClient1.end();
        await subClient2.end();

        const fulfilled = subResults.filter(r => r.status === 'fulfilled');
        const rejected = subResults.filter(r => r.status === 'rejected');

        console.log("Submission Race Results: Fulfilled =", fulfilled.length, ", Rejected =", rejected.length);
        assert(fulfilled.length === 1, "Exactly ONE submission succeeded");
        assert(rejected.length === 1, "Exactly ONE submission rejected due to concurrent race");
        assert(
            rejected[0].reason.message.includes('already been submitted') || 
            rejected[0].reason.message.includes('already marked as done') ||
            rejected[0].reason.message.includes('already completed'),
            "Rejected error indicates already submitted/completed"
        );

        // Verify Database State
        const submissions = await pool.query("SELECT * FROM public.task_submissions WHERE task_id = $1", [taskId]);
        assert(submissions.rows.length === 1, "Exactly ONE row created in task_submissions");

        const taskFinal = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [taskId]);
        assert(taskFinal.rows[0].status === 'done', "Task marked as done");

        console.log("PASS: Phase 6D.1 Concurrency Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Concurrency Suite:", e);
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
            console.error("Cleanup error in concurrency suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
