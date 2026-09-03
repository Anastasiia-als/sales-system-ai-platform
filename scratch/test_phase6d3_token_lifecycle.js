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
    console.log("=== Starting Phase 6D.3 Token Lifecycle & Precedence Suite (Tests I-M) ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];
    const createdUserIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        // 1. Setup Organization & Project & Task
        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Lifecycle 6D3', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pmRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'pm_lifecycle_6d3@example.com') RETURNING id;`);
        const pmId = pmRes.rows[0].id;
        createdUserIds.push(pmId);
        await pool.query("UPDATE public.profiles SET global_role = 'pm' WHERE id = $1", [pmId]);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Project Lifecycle 6D3', 'active', $2) RETURNING id",
            [orgId, pmId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Task Lifecycle 6D3', 'todo', 'client', true) RETURNING id",
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
        // Test I: Initial State -> status = 'none' («Не згенеровано»)
        // ====================================================================
        console.log("\n--- Test I: Initial State ---");
        const initStatusRes = await runAsPM(`SELECT public.get_client_action_token_status('${taskId}') AS res;`);
        const initStatus = initStatusRes.rows[0].res;
        assert(initStatus.status === 'none', "Initial state status is 'none' («Не згенеровано»)");
        assert(initStatus.is_completed === false, "Initial state is_completed is false");

        // ====================================================================
        // Test J: Generate & Concurrency Lock
        // ====================================================================
        console.log("\n--- Test J: Token Generation & Concurrency ---");
        const genRes1 = await runAsPM(`SELECT public.generate_action_token('${taskId}') AS res;`);
        const token1 = genRes1.rows[0].res;
        assert(token1.success === true, "Token 1 generated successfully");
        assert(typeof token1.raw_token === 'string' && token1.raw_token.startsWith('fwa_'), "Token 1 has fwa_ prefix");
        const hexPart1 = token1.raw_token.replace('fwa_', '');
        assert(hexPart1.length === 64, "Raw token has exactly 64 hex characters (256 bits of CSPRNG randomness)");

        // Verify status becomes 'active'
        const statusAfterGen1 = await runAsPM(`SELECT public.get_client_action_token_status('${taskId}') AS res;`);
        assert(statusAfterGen1.rows[0].res.status === 'active', "Status after generation is 'active'");
        assert(statusAfterGen1.rows[0].res.token_id === token1.token_id, "Status references newly generated token");

        // Concurrency / Second generation on same task
        const genRes2 = await runAsPM(`SELECT public.generate_action_token('${taskId}') AS res;`);
        const token2 = genRes2.rows[0].res;
        assert(token2.success === true, "Token 2 generated successfully");
        assert(token2.token_id !== token1.token_id, "Token 2 has a distinct ID");

        // Verify token 1 was automatically revoked
        const dbTokens = await pool.query(
            "SELECT id, status FROM public.client_action_tokens WHERE task_id = $1 ORDER BY created_at ASC",
            [taskId]
        );
        assert(dbTokens.rows.length === 2, "Database contains exactly 2 tokens for task");
        assert(dbTokens.rows[0].status === 'revoked', "Token 1 was revoked automatically");
        assert(dbTokens.rows[1].status === 'active', "Token 2 is active");

        const activeCount = await pool.query(
            "SELECT COUNT(*) AS cnt FROM public.client_action_tokens WHERE task_id = $1 AND status = 'active'",
            [taskId]
        );
        assert(parseInt(activeCount.rows[0].cnt, 10) === 1, "Exactly 1 active token exists in DB");

        // ====================================================================
        // Test K: Explicit Revoke
        // ====================================================================
        console.log("\n--- Test K: Revocation Lifecycle ---");
        const revokeRes = await runAsPM(`SELECT public.revoke_action_token('${taskId}') AS res;`);
        assert(revokeRes.rows[0].res.success === true, "Revocation succeeded");

        const statusAfterRevoke = await runAsPM(`SELECT public.get_client_action_token_status('${taskId}') AS res;`);
        assert(statusAfterRevoke.rows[0].res.status === 'revoked', "Status after explicit revocation is 'revoked'");
        assert(statusAfterRevoke.rows[0].res.token_id === token2.token_id, "Revoked status references latest token");

        // ====================================================================
        // Test L: Expiration Lifecycle
        // ====================================================================
        console.log("\n--- Test L: Expiration Lifecycle ---");
        // Create an active token and force its expires_at into the past
        const genRes3 = await runAsPM(`SELECT public.generate_action_token('${taskId}') AS res;`);
        const token3 = genRes3.rows[0].res;
        await pool.query(
            "UPDATE public.client_action_tokens SET expires_at = NOW() - interval '2 hours' WHERE id = $1",
            [token3.token_id]
        );

        const statusExpired = await runAsPM(`SELECT public.get_client_action_token_status('${taskId}') AS res;`);
        assert(statusExpired.rows[0].res.status === 'expired', "Expired token evaluated as 'expired' status");
        assert(statusExpired.rows[0].res.token_id === token3.token_id, "Expired status references expired token");

        // ====================================================================
        // Test M: Regenerate from Expired/Revoked
        // ====================================================================
        console.log("\n--- Test M: Regenerate from Expired ---");
        const regenRes = await runAsPM(`SELECT public.regenerate_action_token('${taskId}') AS res;`);
        const token4 = regenRes.rows[0].res;
        assert(token4.success === true, "Regeneration succeeded");
        assert(token4.token_id !== token3.token_id, "New token created with unique ID");

        const statusAfterRegen = await runAsPM(`SELECT public.get_client_action_token_status('${taskId}') AS res;`);
        assert(statusAfterRegen.rows[0].res.status === 'active', "Status after regeneration is 'active'");
        assert(statusAfterRegen.rows[0].res.token_id === token4.token_id, "Active status references regenerated token");

        console.log("\n=== ALL TOKEN LIFECYCLE & PRECEDENCE TESTS (I-M) PASSED! ===");
    } catch (err) {
        console.error("Test Suite Failed:", err);
        exitCode = 1;
    } finally {
        for (const tid of createdTaskIds) {
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
