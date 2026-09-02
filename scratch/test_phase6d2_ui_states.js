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
    console.log("=== Starting Phase 6D.2 Deterministic UI States & RPC Retrieval Suite ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        // Setup Org & Project
        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('UI States Org', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, title) VALUES ($1, 'UI States Project', 'active', 'UI States Project') RETURNING id",
            [orgId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        // 1. Setup Active Task & Token (State: ACTIVE)
        const tActiveRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, description, status, responsibility_type, is_client_visible, due_date) VALUES ($1, $2, 'Active Client Action', 'Please review the attached contract and submit sign-off.', 'todo', 'client', true, NOW() + INTERVAL '5 days') RETURNING id",
            [orgId, projectId]
        );
        const taskActiveId = tActiveRes.rows[0].id;
        createdTaskIds.push(taskActiveId);

        const gActiveRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskActiveId}') AS res;
        `);
        const activeToken = gActiveRes[gActiveRes.length - 1].rows[0].res;

        // Test State 1: Active Token Retrieval
        console.log("1. Testing State: ACTIVE...");
        const activeLookup = await pool.query("SELECT public.get_public_client_action($1) AS res", [activeToken.raw_token]);
        const actRes = activeLookup.rows[0].res;
        assert(actRes.status === 'active', "Active token returns status 'active'");
        assert(actRes.title === 'Active Client Action', "Active token returns task title");
        assert(actRes.project_name === 'UI States Project', "Active token returns project name");
        assert(actRes.organization_name === 'UI States Org', "Active token returns company name");
        assert(actRes.organization_id === undefined, "Data minimization: organization_id is not exposed");
        assert(actRes.raw_token === undefined, "Data minimization: raw_token is not exposed");

        // 2. Test State 2: Already Used Token (State: ALREADY_COMPLETED)
        console.log("2. Testing State: ALREADY_COMPLETED...");
        await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Done\"}'::jsonb)", [activeToken.raw_token]);
        const usedLookup = await pool.query("SELECT public.get_public_client_action($1) AS res", [activeToken.raw_token]);
        const usedRes = usedLookup.rows[0].res;
        assert(usedRes.status === 'already_used', "Used token returns status 'already_used'");
        assert(usedRes.is_completed === true, "Used token has is_completed = true");

        // 3. Test State 3: Expired Token (State: EXPIRED)
        console.log("3. Testing State: EXPIRED...");
        const tExpRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Expired Action', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskExpId = tExpRes.rows[0].id;
        createdTaskIds.push(taskExpId);

        const gExpRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskExpId}') AS res;
        `);
        const expToken = gExpRes[gExpRes.length - 1].rows[0].res;

        // Force expiration in DB
        await pool.query("UPDATE public.client_action_tokens SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [expToken.token_id]);
        const expLookup = await pool.query("SELECT public.get_public_client_action($1) AS res", [expToken.raw_token]);
        const expResult = expLookup.rows[0].res;
        assert(expResult.status === 'expired', "Expired token returns status 'expired'");

        // 4. Test State 4: Revoked Token (State: REVOKED)
        console.log("4. Testing State: REVOKED...");
        const tRevRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Revoked Action', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskRevId = tRevRes.rows[0].id;
        createdTaskIds.push(taskRevId);

        const gRevRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskRevId}') AS res;
        `);
        const revToken = gRevRes[gRevRes.length - 1].rows[0].res;

        // Revoke token via RPC
        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.revoke_action_token('${taskRevId}');
        `);
        const revLookup = await pool.query("SELECT public.get_public_client_action($1) AS res", [revToken.raw_token]);
        const revResult = revLookup.rows[0].res;
        assert(revResult.status === 'revoked', "Revoked token returns status 'revoked'");

        // 5. Test State 5: Invalid / Not Found (State: NOT_FOUND)
        console.log("5. Testing State: NOT_FOUND...");
        const invalidLookup = await pool.query("SELECT public.get_public_client_action('fwa_non_existent_token_0000000000000000000000000000000000000000000') AS res");
        const invResult = invalidLookup.rows[0].res;
        assert(invResult.status === 'not_found', "Non-existent token returns status 'not_found'");

        console.log("PASS: Phase 6D.2 Deterministic UI States & RPC Retrieval Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in UI States Suite:", e);
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
                await pool.query("DELETE FROM public.project_memberships WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            if (createdOrgIds.length > 0) {
                await pool.query("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", [createdOrgIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error in UI states suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
