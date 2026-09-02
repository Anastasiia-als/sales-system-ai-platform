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
    console.log("=== Starting Phase 6D.1 Token Lifecycle & Expiration Suite ===");
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
            "INSERT INTO public.projects (organization_id, name, status) VALUES ($1, 'Phase 6D Lifecycle Project', 'active') RETURNING id",
            [orgId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Fill Onboarding Form', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        // 2. Generate Token
        console.log("1. Generating token...");
        const genRes1 = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskId}') AS res;
        `);
        const token1 = genRes1[genRes1.length - 1].rows[0].res;

        // 3. Test Manual Revocation
        console.log("2. Revoking token...");
        const revRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.revoke_action_token('${taskId}', '${token1.token_id}') AS res;
        `);
        assert(revRes[revRes.length - 1].rows[0].res.success === true, "Token revocation RPC returned success");

        const checkRevoked = await pool.query("SELECT * FROM public.client_action_tokens WHERE id = $1", [token1.token_id]);
        assert(checkRevoked.rows[0].status === 'revoked', "Token status in DB updated to 'revoked'");
        assert(checkRevoked.rows[0].revoked_at !== null, "Token revoked_at timestamp set");

        // Public retrieval for revoked token returns status = 'revoked'
        const pubRevCheck = await pool.query("SELECT public.get_public_client_action($1) as res", [token1.raw_token]);
        assert(pubRevCheck.rows[0].res.status === 'revoked', "Public retrieval returns status = 'revoked'");

        // Submission on revoked token rejected
        let subRevRejected = false;
        try {
            await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Attempt\"}'::jsonb)", [token1.raw_token]);
        } catch(e) {
            subRevRejected = true;
            assert(e.message.includes('Invalid or revoked token'), "Submission on revoked token rejected");
        }
        assert(subRevRejected, "Revoked token submission blocked");

        // 4. Test Token Regeneration
        console.log("3. Regenerating token...");
        const regenRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.regenerate_action_token('${taskId}') AS res;
        `);
        const token2 = regenRes[regenRes.length - 1].rows[0].res;
        assert(token2.success === true, "Regenerate token returned success");
        assert(token2.token_id !== token1.token_id, "New token has distinct UUID");

        // 5. Test Derived Expiration Semantics
        console.log("4. Testing dynamic derived expiration...");
        // Set token2 expires_at to 5 minutes in the past
        await pool.query("UPDATE public.client_action_tokens SET expires_at = NOW() - INTERVAL '5 minutes' WHERE id = $1", [token2.token_id]);

        const pubExpCheck = await pool.query("SELECT public.get_public_client_action($1) as res", [token2.raw_token]);
        assert(pubExpCheck.rows[0].res.status === 'expired', "Public retrieval returns derived status = 'expired' when expires_at <= NOW()");

        let subExpRejected = false;
        try {
            await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Expired Attempt\"}'::jsonb)", [token2.raw_token]);
        } catch(e) {
            subExpRejected = true;
            assert(e.message.includes('Token has expired'), "Submission on expired token rejected");
        }
        assert(subExpRejected, "Expired token submission blocked");

        // 6. Test Valid Submission -> Used Lifecycle
        console.log("5. Testing valid submission -> used transition...");
        const genRes3 = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskId}') AS res;
        `);
        const token3 = genRes3[genRes3.length - 1].rows[0].res;

        const subRes = await pool.query("SELECT public.submit_public_client_action($1, '{\"notes\":\"All requirements met\"}'::jsonb) as res", [token3.raw_token]);
        assert(subRes.rows[0].res.success === true, "Public submission succeeded");

        const checkUsed = await pool.query("SELECT * FROM public.client_action_tokens WHERE id = $1", [token3.token_id]);
        assert(checkUsed.rows[0].status === 'used', "Consumed token status updated to 'used'");
        assert(checkUsed.rows[0].used_at !== null, "Consumed token used_at timestamp set");

        const checkTask = await pool.query("SELECT * FROM public.tasks WHERE id = $1", [taskId]);
        assert(checkTask.rows[0].status === 'done', "Parent task status updated to 'done'");
        assert(checkTask.rows[0].completed_at !== null, "Parent task completed_at timestamp set");

        // Public retrieval for used token returns status = 'already_used'
        const pubUsedCheck = await pool.query("SELECT public.get_public_client_action($1) as res", [token3.raw_token]);
        assert(pubUsedCheck.rows[0].res.status === 'already_used', "Public retrieval returns status = 'already_used'");

        // 7. Test Action Reopen Semantics (Does NOT resurrect old tokens)
        console.log("6. Testing Reopen Action...");
        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.reopen_client_action('${taskId}');
        `);

        const checkReopenedTask = await pool.query("SELECT * FROM public.tasks WHERE id = $1", [taskId]);
        assert(checkReopenedTask.rows[0].status === 'todo', "Task status reset to 'todo' upon reopen");
        assert(checkReopenedTask.rows[0].completed_at === null, "Task completed_at cleared upon reopen");

        // Verify that token3 remains 'used' (never resurrected)
        const checkTokenAfterReopen = await pool.query("SELECT * FROM public.client_action_tokens WHERE id = $1", [token3.token_id]);
        assert(checkTokenAfterReopen.rows[0].status === 'used', "Old token remains 'used' after reopen (Zero resurrection)");

        console.log("PASS: Phase 6D.1 Token Lifecycle & Expiration Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Lifecycle Suite:", e);
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
            console.error("Cleanup error in lifecycle suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
