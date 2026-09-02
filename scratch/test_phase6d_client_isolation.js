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
    console.log("=== Starting Phase 6D.1.1 Client-to-Client Same-Org & Cross-Org Isolation Suite ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];
    const createdUserIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        // 1. Setup Organization Alpha & Organization Gamma (Foreign)
        const orgAlphaRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Alpha Client Isolation', 'active') RETURNING id");
        const orgAlphaId = orgAlphaRes.rows[0].id;
        createdOrgIds.push(orgAlphaId);

        const orgGammaRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Gamma Foreign', 'active') RETURNING id");
        const orgGammaId = orgGammaRes.rows[0].id;
        createdOrgIds.push(orgGammaId);

        // Project Alpha in Org Alpha
        const pAlphaRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, title) VALUES ($1, 'Alpha Project Isolation', 'active', 'Alpha Project Isolation') RETURNING id",
            [orgAlphaId]
        );
        const projectAlphaId = pAlphaRes.rows[0].id;
        createdProjectIds.push(projectAlphaId);

        // 2. Setup Client User A and Client User B (BOTH IN ORG ALPHA)
        const userARes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'client_a@alpha.com') RETURNING id");
        const userAId = userARes.rows[0].id;
        createdUserIds.push(userAId);
        await pool.query("UPDATE public.profiles SET global_role = 'client' WHERE id = $1", [userAId]);
        await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true)", [orgAlphaId, userAId]);
        await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'client_rep')", [projectAlphaId, userAId]);

        const contactARes = await pool.query(
            "INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Alice', 'Alpha', 'client_a@alpha.com') RETURNING id",
            [orgAlphaId]
        );
        const contactAId = contactARes.rows[0].id;
        await pool.query(
            "INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active')",
            [orgAlphaId, contactAId, userAId]
        );

        const userBRes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'client_b@alpha.com') RETURNING id");
        const userBId = userBRes.rows[0].id;
        createdUserIds.push(userBId);
        await pool.query("UPDATE public.profiles SET global_role = 'client' WHERE id = $1", [userBId]);
        await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true)", [orgAlphaId, userBId]);
        await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'client_rep')", [projectAlphaId, userBId]);

        const contactBRes = await pool.query(
            "INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Bob', 'Alpha', 'client_b@alpha.com') RETURNING id",
            [orgAlphaId]
        );
        const contactBId = contactBRes.rows[0].id;
        await pool.query(
            "INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active')",
            [orgAlphaId, contactBId, userBId]
        );

        // 3. Setup Foreign Client User C (IN ORG GAMMA)
        const userCRes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'client_c@gamma.com') RETURNING id");
        const userCId = userCRes.rows[0].id;
        createdUserIds.push(userCId);
        await pool.query("UPDATE public.profiles SET global_role = 'client' WHERE id = $1", [userCId]);
        await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true)", [orgGammaId, userCId]);

        const contactCRes = await pool.query(
            "INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Charlie', 'Gamma', 'client_c@gamma.com') RETURNING id",
            [orgGammaId]
        );
        const contactCId = contactCRes.rows[0].id;
        await pool.query(
            "INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active')",
            [orgGammaId, contactCId, userCId]
        );

        // 4. Create Task A (Assigned to Contact A) & Task B (Assigned to Contact B)
        const tARes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible, client_contact_id) VALUES ($1, $2, 'Task For Alice Only', 'todo', 'client', true, $3) RETURNING id",
            [orgAlphaId, projectAlphaId, contactAId]
        );
        const taskAId = tARes.rows[0].id;
        createdTaskIds.push(taskAId);

        const tBRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible, client_contact_id) VALUES ($1, $2, 'Task For Bob Only', 'todo', 'client', true, $3) RETURNING id",
            [orgAlphaId, projectAlphaId, contactBId]
        );
        const taskBId = tBRes.rows[0].id;
        createdTaskIds.push(taskBId);

        // 5. Submit Task A as Client A
        console.log("1. Submitting Task A as Client A...");
        const subARes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
            SELECT public.submit_authenticated_client_action('${taskAId}', '{"secret_data_a":"Alice Confidential Notes"}'::jsonb) AS res;
        `);
        assert(subARes[subARes.length - 1].rows[0].res.success === true, "Client A submitted Task A");

        // 6. Submit Task B as Client B
        console.log("2. Submitting Task B as Client B...");
        const subBRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userBId}"}';
            SELECT public.submit_authenticated_client_action('${taskBId}', '{"secret_data_b":"Bob Confidential Notes"}'::jsonb) AS res;
        `);
        assert(subBRes[subBRes.length - 1].rows[0].res.success === true, "Client B submitted Task B");

        // ==========================================
        // 7. Test Client A Isolation (Can read Task A, CANNOT read Task B)
        // ==========================================
        console.log("3. Verifying Client A query visibility...");
        const selectAsA = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
            SELECT id, task_id, payload FROM public.task_submissions WHERE organization_id = '${orgAlphaId}';
        `);
        const rowsA = selectAsA[selectAsA.length - 1].rows;
        
        assert(rowsA.length === 1, `Client A sees exactly 1 submission in Org Alpha (Found: ${rowsA.length})`);
        assert(rowsA[0].task_id === taskAId, "Client A sees ONLY Task A submission");
        assert(rowsA[0].payload.secret_data_a === 'Alice Confidential Notes', "Client A reads own payload");

        const selectTaskBAsA = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
            SELECT * FROM public.task_submissions WHERE task_id = '${taskBId}';
        `);
        assert(selectTaskBAsA[selectTaskBAsA.length - 1].rows.length === 0, "Client A direct query on Task B submission returned 0 rows (BLOCKED)");

        // ==========================================
        // 8. Test Client B Isolation (Can read Task B, CANNOT read Task A)
        // ==========================================
        console.log("4. Verifying Client B query visibility...");
        const selectAsB = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userBId}"}';
            SELECT id, task_id, payload FROM public.task_submissions WHERE organization_id = '${orgAlphaId}';
        `);
        const rowsB = selectAsB[selectAsB.length - 1].rows;

        assert(rowsB.length === 1, `Client B sees exactly 1 submission in Org Alpha (Found: ${rowsB.length})`);
        assert(rowsB[0].task_id === taskBId, "Client B sees ONLY Task B submission");
        assert(rowsB[0].payload.secret_data_b === 'Bob Confidential Notes', "Client B reads own payload");

        const selectTaskAAsB = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userBId}"}';
            SELECT * FROM public.task_submissions WHERE task_id = '${taskAId}';
        `);
        assert(selectTaskAAsB[selectTaskAAsB.length - 1].rows.length === 0, "Client B direct query on Task A submission returned 0 rows (BLOCKED)");

        // ==========================================
        // 9. Test Foreign Tenant Isolation (Client C in Org Gamma sees ZERO rows)
        // ==========================================
        console.log("5. Verifying Foreign Client C query visibility...");
        const selectAsC = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userCId}"}';
            SELECT * FROM public.task_submissions;
        `);
        assert(selectAsC[selectAsC.length - 1].rows.length === 0, "Foreign Client C in Org Gamma returned 0 rows across all task_submissions (BLOCKED)");

        console.log("PASS: Phase 6D.1.1 Client-to-Client Same-Org & Cross-Org Isolation Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Client Isolation Suite:", e);
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
                await pool.query("DELETE FROM public.client_portal_access WHERE organization_id = ANY($1::uuid[])", [createdOrgIds]);
                await pool.query("DELETE FROM public.contacts WHERE organization_id = ANY($1::uuid[])", [createdOrgIds]);
                await pool.query("DELETE FROM public.organization_memberships WHERE organization_id = ANY($1::uuid[])", [createdOrgIds]);
                await pool.query("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", [createdOrgIds]);
            }
            if (createdUserIds.length > 0) {
                await pool.query("DELETE FROM public.profiles WHERE id = ANY($1::uuid[])", [createdUserIds]);
                await pool.query("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [createdUserIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error in client isolation suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
