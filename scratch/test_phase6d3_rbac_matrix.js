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
    console.log("=== Starting Phase 6D.3 RBAC & Authorization Matrix Suite (Tests A-H) ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];
    const createdUserIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        // 1. Setup Organizations
        const orgRes1 = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Phase 6D3 RBAC', 'active') RETURNING id");
        const orgId1 = orgRes1.rows[0].id;
        createdOrgIds.push(orgId1);

        const orgRes2 = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Foreign 6D3', 'active') RETURNING id");
        const orgId2 = orgRes2.rows[0].id;
        createdOrgIds.push(orgId2);

        // 2. Setup Users
        // User 1: Org Admin
        const adminRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'org_admin_6d3@example.com') RETURNING id;`);
        const orgAdminId = adminRes.rows[0].id;
        createdUserIds.push(orgAdminId);
        await pool.query("UPDATE public.profiles SET global_role = 'pm' WHERE id = $1", [orgAdminId]);
        await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'admin', true)", [orgId1, orgAdminId]);

        // User 2: Responsible PM
        const respPmRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'resp_pm_6d3@example.com') RETURNING id;`);
        const respPmId = respPmRes.rows[0].id;
        createdUserIds.push(respPmId);
        await pool.query("UPDATE public.profiles SET global_role = 'pm' WHERE id = $1", [respPmId]);

        // User 3: Project PM Member
        const projPmRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'proj_pm_6d3@example.com') RETURNING id;`);
        const projPmId = projPmRes.rows[0].id;
        createdUserIds.push(projPmId);
        await pool.query("UPDATE public.profiles SET global_role = 'pm' WHERE id = $1", [projPmId]);

        // User 4: Unrelated PM in same org
        const unrelatedPmRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'unrelated_pm_6d3@example.com') RETURNING id;`);
        const unrelatedPmId = unrelatedPmRes.rows[0].id;
        createdUserIds.push(unrelatedPmId);
        await pool.query("UPDATE public.profiles SET global_role = 'pm' WHERE id = $1", [unrelatedPmId]);

        // User 5: Ordinary Project Member
        const ordMemberRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'ord_member_6d3@example.com') RETURNING id;`);
        const ordMemberId = ordMemberRes.rows[0].id;
        createdUserIds.push(ordMemberId);
        await pool.query("UPDATE public.profiles SET global_role = 'specialist' WHERE id = $1", [ordMemberId]);

        // User 6: Specialist without PM role
        const specialistRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'specialist_6d3@example.com') RETURNING id;`);
        const specialistId = specialistRes.rows[0].id;
        createdUserIds.push(specialistId);
        await pool.query("UPDATE public.profiles SET global_role = 'specialist' WHERE id = $1", [specialistId]);

        // User 7: Client User
        const clientRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'client_6d3@example.com') RETURNING id;`);
        const clientUserId = clientRes.rows[0].id;
        createdUserIds.push(clientUserId);
        await pool.query("UPDATE public.profiles SET global_role = 'client' WHERE id = $1", [clientUserId]);

        // User 8: Foreign Tenant User
        const foreignRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'foreign_6d3@example.com') RETURNING id;`);
        const foreignUserId = foreignRes.rows[0].id;
        createdUserIds.push(foreignUserId);
        await pool.query("UPDATE public.profiles SET global_role = 'pm' WHERE id = $1", [foreignUserId]);
        await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'admin', true)", [orgId2, foreignUserId]);

        // 3. Setup Project with responsible_pm_id = respPmId
        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Project 6D3 RBAC', 'active', $2) RETURNING id",
            [orgId1, respPmId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        // Add memberships
        await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'pm')", [projectId, projPmId]);
        await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'member')", [projectId, ordMemberId]);
        await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'specialist')", [projectId, specialistId]);

        // 4. Setup Client Action Task
        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Client Action RBAC Task', 'todo', 'client', true) RETURNING id",
            [orgId1, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        // Helper to run query as a specific user
        async function runAsUser(userId, sql) {
            const res = await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${userId}"}';
                ${sql}
            `);
            return res[res.length - 1];
        }

        // ====================================================================
        // Test A: Global Owner (ALLOW across all operations)
        // ====================================================================
        console.log("\n--- Test A: Global Owner RBAC ---");
        const ownerGen = await runAsUser(ownerId, `SELECT public.generate_action_token('${taskId}') AS res;`);
        const ownerTokenData = ownerGen.rows[0].res;
        assert(ownerTokenData.success === true, "Owner generate_action_token succeeded");
        assert(ownerTokenData.raw_token && ownerTokenData.raw_token.startsWith('fwa_'), "Owner received 256-bit raw token");

        const ownerRegen = await runAsUser(ownerId, `SELECT public.regenerate_action_token('${taskId}') AS res;`);
        assert(ownerRegen.rows[0].res.success === true, "Owner regenerate_action_token succeeded");

        const ownerRevoke = await runAsUser(ownerId, `SELECT public.revoke_action_token('${taskId}') AS res;`);
        assert(ownerRevoke.rows[0].res.success === true, "Owner revoke_action_token succeeded");

        const ownerReopen = await runAsUser(ownerId, `SELECT public.reopen_client_action('${taskId}') AS res;`);
        assert(ownerReopen.rows[0].res.success === true, "Owner reopen_client_action succeeded");

        const ownerSubs = await runAsUser(ownerId, `SELECT public.get_task_submissions('${taskId}') AS res;`);
        assert(Array.isArray(ownerSubs.rows[0].res), "Owner get_task_submissions returned array");

        // ====================================================================
        // Test B: Org Admin (ALLOW across all operations)
        // ====================================================================
        console.log("\n--- Test B: Org Admin RBAC ---");
        const adminGen = await runAsUser(orgAdminId, `SELECT public.generate_action_token('${taskId}') AS res;`);
        assert(adminGen.rows[0].res.success === true, "Org Admin generate_action_token succeeded");

        const adminRegen = await runAsUser(orgAdminId, `SELECT public.regenerate_action_token('${taskId}') AS res;`);
        assert(adminRegen.rows[0].res.success === true, "Org Admin regenerate_action_token succeeded");

        const adminRevoke = await runAsUser(orgAdminId, `SELECT public.revoke_action_token('${taskId}') AS res;`);
        assert(adminRevoke.rows[0].res.success === true, "Org Admin revoke_action_token succeeded");

        const adminReopen = await runAsUser(orgAdminId, `SELECT public.reopen_client_action('${taskId}') AS res;`);
        assert(adminReopen.rows[0].res.success === true, "Org Admin reopen_client_action succeeded");

        const adminSubs = await runAsUser(orgAdminId, `SELECT public.get_task_submissions('${taskId}') AS res;`);
        assert(Array.isArray(adminSubs.rows[0].res), "Org Admin get_task_submissions returned array");

        // ====================================================================
        // Test C: Responsible PM (ALLOW across all operations)
        // ====================================================================
        console.log("\n--- Test C: Responsible PM RBAC ---");
        const pmGen = await runAsUser(respPmId, `SELECT public.generate_action_token('${taskId}') AS res;`);
        assert(pmGen.rows[0].res.success === true, "Responsible PM generate_action_token succeeded");

        const pmRegen = await runAsUser(respPmId, `SELECT public.regenerate_action_token('${taskId}') AS res;`);
        assert(pmRegen.rows[0].res.success === true, "Responsible PM regenerate_action_token succeeded");

        const pmRevoke = await runAsUser(respPmId, `SELECT public.revoke_action_token('${taskId}') AS res;`);
        assert(pmRevoke.rows[0].res.success === true, "Responsible PM revoke_action_token succeeded");

        const pmReopen = await runAsUser(respPmId, `SELECT public.reopen_client_action('${taskId}') AS res;`);
        assert(pmReopen.rows[0].res.success === true, "Responsible PM reopen_client_action succeeded");

        const pmSubs = await runAsUser(respPmId, `SELECT public.get_task_submissions('${taskId}') AS res;`);
        assert(Array.isArray(pmSubs.rows[0].res), "Responsible PM get_task_submissions returned array");

        // ====================================================================
        // Test D: Project PM Member (ALLOW across all operations)
        // ====================================================================
        console.log("\n--- Test D: Project PM Member RBAC ---");
        const projPmGen = await runAsUser(projPmId, `SELECT public.generate_action_token('${taskId}') AS res;`);
        assert(projPmGen.rows[0].res.success === true, "Project PM Member generate_action_token succeeded");

        const projPmRegen = await runAsUser(projPmId, `SELECT public.regenerate_action_token('${taskId}') AS res;`);
        assert(projPmRegen.rows[0].res.success === true, "Project PM Member regenerate_action_token succeeded");

        const projPmRevoke = await runAsUser(projPmId, `SELECT public.revoke_action_token('${taskId}') AS res;`);
        assert(projPmRevoke.rows[0].res.success === true, "Project PM Member revoke_action_token succeeded");

        const projPmReopen = await runAsUser(projPmId, `SELECT public.reopen_client_action('${taskId}') AS res;`);
        assert(projPmReopen.rows[0].res.success === true, "Project PM Member reopen_client_action succeeded");

        const projPmSubs = await runAsUser(projPmId, `SELECT public.get_task_submissions('${taskId}') AS res;`);
        assert(Array.isArray(projPmSubs.rows[0].res), "Project PM Member get_task_submissions returned array");

        // ====================================================================
        // Test E: Unrelated PM in same org (DENIED across operations)
        // ====================================================================
        console.log("\n--- Test E: Unrelated PM in Same Org (DENY) ---");
        let blocked = false;
        try {
            await runAsUser(unrelatedPmId, `SELECT public.generate_action_token('${taskId}');`);
        } catch (e) {
            blocked = true;
            assert(e.message.includes("Access denied"), "Unrelated PM generate_action_token threw Access denied");
        }
        assert(blocked, "Unrelated PM blocked from generate_action_token");

        blocked = false;
        try {
            await runAsUser(unrelatedPmId, `SELECT public.revoke_action_token('${taskId}');`);
        } catch (e) {
            blocked = true;
            assert(e.message.includes("Access denied"), "Unrelated PM revoke_action_token threw Access denied");
        }
        assert(blocked, "Unrelated PM blocked from revoke_action_token");

        blocked = false;
        try {
            await runAsUser(unrelatedPmId, `SELECT public.reopen_client_action('${taskId}');`);
        } catch (e) {
            blocked = true;
            assert(e.message.includes("Access denied"), "Unrelated PM reopen_client_action threw Access denied");
        }
        assert(blocked, "Unrelated PM blocked from reopen_client_action");

        // ====================================================================
        // Test F: Ordinary Same-Project Member (DENIED across operations)
        // ====================================================================
        console.log("\n--- Test F: Ordinary Project Member (DENY) ---");
        blocked = false;
        try {
            await runAsUser(ordMemberId, `SELECT public.generate_action_token('${taskId}');`);
        } catch (e) {
            blocked = true;
            assert(e.message.includes("Access denied"), "Ordinary member generate_action_token threw Access denied");
        }
        assert(blocked, "Ordinary member blocked from generate_action_token");

        blocked = false;
        try {
            await runAsUser(ordMemberId, `SELECT public.revoke_action_token('${taskId}');`);
        } catch (e) {
            blocked = true;
            assert(e.message.includes("Access denied"), "Ordinary member revoke_action_token threw Access denied");
        }
        assert(blocked, "Ordinary member blocked from revoke_action_token");

        blocked = false;
        try {
            await runAsUser(ordMemberId, `SELECT public.reopen_client_action('${taskId}');`);
        } catch (e) {
            blocked = true;
            assert(e.message.includes("Access denied"), "Ordinary member reopen_client_action threw Access denied");
        }
        assert(blocked, "Ordinary member blocked from reopen_client_action");

        // ====================================================================
        // Test G: Specialist without PM role (DENIED across operations)
        // ====================================================================
        console.log("\n--- Test G: Specialist without PM role (DENY) ---");
        blocked = false;
        try {
            await runAsUser(specialistId, `SELECT public.generate_action_token('${taskId}');`);
        } catch (e) {
            blocked = true;
            assert(e.message.includes("Access denied"), "Specialist generate_action_token threw Access denied");
        }
        assert(blocked, "Specialist blocked from generate_action_token");

        blocked = false;
        try {
            await runAsUser(specialistId, `SELECT public.revoke_action_token('${taskId}');`);
        } catch (e) {
            blocked = true;
            assert(e.message.includes("Access denied"), "Specialist revoke_action_token threw Access denied");
        }
        assert(blocked, "Specialist blocked from revoke_action_token");

        // ====================================================================
        // Test H: Client User & Foreign Tenant (DENIED across operations)
        // ====================================================================
        console.log("\n--- Test H: Client User & Foreign Tenant (DENY) ---");
        blocked = false;
        try {
            await runAsUser(clientUserId, `SELECT public.generate_action_token('${taskId}');`);
        } catch (e) {
            blocked = true;
            assert(e.message.includes("Access denied"), "Client user generate_action_token threw Access denied");
        }
        assert(blocked, "Client user blocked from generate_action_token");

        blocked = false;
        try {
            await runAsUser(clientUserId, `SELECT public.reopen_client_action('${taskId}');`);
        } catch (e) {
            blocked = true;
            assert(e.message.includes("Access denied"), "Client user reopen_client_action threw Access denied");
        }
        assert(blocked, "Client user blocked from reopen_client_action");

        blocked = false;
        try {
            await runAsUser(foreignUserId, `SELECT public.generate_action_token('${taskId}');`);
        } catch (e) {
            blocked = true;
            assert(e.message.includes("Access denied"), "Foreign tenant user generate_action_token threw Access denied");
        }
        assert(blocked, "Foreign tenant user blocked from generate_action_token");

        console.log("\n=== ALL RBAC & AUTHORIZATION MATRIX TESTS (A-H) PASSED! ===");
    } catch (err) {
        console.error("Test Suite Failed:", err);
        exitCode = 1;
    } finally {
        // Clean up created fixtures
        for (const tid of createdTaskIds) {
            await pool.query("DELETE FROM public.client_action_tokens WHERE task_id = $1", [tid]);
            await pool.query("DELETE FROM public.tasks WHERE id = $1", [tid]);
        }
        for (const pid of createdProjectIds) {
            await pool.query("DELETE FROM public.project_memberships WHERE project_id = $1", [pid]);
            await pool.query("DELETE FROM public.projects WHERE id = $1", [pid]);
        }
        for (const uid of createdUserIds) {
            await pool.query("DELETE FROM public.organization_memberships WHERE user_id = $1", [uid]);
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
