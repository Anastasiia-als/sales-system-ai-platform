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
    console.log("=== Phase 6D.4 Suite 1: Isolation & Server-Derived Identity RBAC ===");

    const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org 6D4 RBAC', 'active') RETURNING id;");
    const orgId = orgRes.rows[0].id;

    const foreignOrgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Foreign Org 6D4', 'active') RETURNING id;");
    const foreignOrgId = foreignOrgRes.rows[0].id;

    const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1;");
    const ownerId = ownerRes.rows[0].id;
    const ts = Date.now();
    const emailA = `clientA_${ts}@test.com`;
    const emailB = `clientB_${ts}@test.com`;
    const emailC = `clientC_${ts}@test.com`;

    // Create 2 Client Users in same org (Client A, Client B)
    const userARes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id;", [emailA]);
    const userAId = userARes.rows[0].id;
    await pool.query("UPDATE public.profiles SET global_role = 'client', full_name = 'Client A 6D4' WHERE id = $1;", [userAId]);

    const userBRes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id;", [emailB]);
    const userBId = userBRes.rows[0].id;
    await pool.query("UPDATE public.profiles SET global_role = 'client', full_name = 'Client B 6D4' WHERE id = $1;", [userBId]);

    // Create Foreign Client User
    const userCRes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id;", [emailC]);
    const userCId = userCRes.rows[0].id;
    await pool.query("UPDATE public.profiles SET global_role = 'client', full_name = 'Client C Foreign' WHERE id = $1;", [userCId]);

    // Contact records
    const contactARes = await pool.query("INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Contact', 'A', $2) RETURNING id;", [orgId, emailA]);
    const contactAId = contactARes.rows[0].id;

    const contactBRes = await pool.query("INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Contact', 'B', $2) RETURNING id;", [orgId, emailB]);
    const contactBId = contactBRes.rows[0].id;

    const contactCRes = await pool.query("INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Contact', 'C', $2) RETURNING id;", [foreignOrgId, emailC]);
    const contactCId = contactCRes.rows[0].id;

    // Client Portal Access
    await pool.query("INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active');", [orgId, contactAId, userAId]);
    await pool.query("INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active');", [orgId, contactBId, userBId]);
    await pool.query("INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active');", [foreignOrgId, contactCId, userCId]);

    // Memberships
    await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true);", [orgId, userAId]);
    await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true);", [orgId, userBId]);
    await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true);", [foreignOrgId, userCId]);

    // Project
    const projRes = await pool.query("INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Proj 6D4 Isolation', 'active', $2) RETURNING id;", [orgId, ownerId]);
    const projId = projRes.rows[0].id;

    // Project memberships for Client A and Client B
    await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'client_rep');", [projId, userAId]);
    await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'client_rep');", [projId, userBId]);

    // Task 1: Assigned specifically to Client Contact A
    const task1Res = await pool.query(`
        INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible, client_contact_id)
        VALUES ($1, $2, 'Action For Contact A Only', 'todo', 'client', true, $3)
        RETURNING id;
    `, [orgId, projId, contactAId]);
    const task1Id = task1Res.rows[0].id;

    // --- TEST 1: Same-Org Client A vs Client B Isolation (RLS SELECT) ---
    console.log("\n--- Test 1A: RLS SELECT Isolation for Same-Org Clients ---");
    // Client A SELECT
    const selectARes = await pool.query(`
        SET LOCAL role TO authenticated;
        SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
        SELECT id, title FROM public.tasks WHERE id = '${task1Id}';
    `);
    const tasksForA = selectARes[selectARes.length - 1].rows;
    assert(tasksForA.length === 1, "Client A can SELECT their assigned client action");

    // Client B SELECT (Negative test: must return 0 rows)
    const selectBRes = await pool.query(`
        SET LOCAL role TO authenticated;
        SET LOCAL request.jwt.claims TO '{"sub":"${userBId}"}';
        SELECT id, title FROM public.tasks WHERE id = '${task1Id}';
    `);
    const tasksForB = selectBRes[selectBRes.length - 1].rows;
    assert(tasksForB.length === 0, "Client B CANNOT SELECT action assigned to Client A (0 rows returned)");

    // --- TEST 1B: Same-Org Client B cannot submit Client A's action (RPC Negative Test) ---
    console.log("\n--- Test 1B: RPC Submission Block for Same-Org Non-Assigned Client ---");
    let clientBBlocked = false;
    try {
        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userBId}"}';
            SELECT public.submit_authenticated_client_action('${task1Id}', '{"text":"Client B trying to submit"}'::jsonb);
        `);
    } catch (e) {
        clientBBlocked = true;
        assert(e.message.includes("Client action is assigned to another contact"), `Client B submit blocked with: ${e.message}`);
    }
    assert(clientBBlocked, "Server strictly blocked Client B from submitting Client A's action");

    // --- TEST 2: Foreign Tenant Client C Isolation ---
    console.log("\n--- Test 2: Foreign Tenant Access Denied ---");
    let clientCBlocked = false;
    try {
        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userCId}"}';
            SELECT public.submit_authenticated_client_action('${task1Id}', '{"text":"Foreign client trying"}'::jsonb);
        `);
    } catch (e) {
        clientCBlocked = true;
        assert(e.message.includes("Access denied to this project"), `Foreign client blocked with: ${e.message}`);
    }
    assert(clientCBlocked, "Foreign tenant client C strictly denied access to project");

    // --- TEST 3: Client A Successful Authenticated Submission & Server-Derived Identity ---
    console.log("\n--- Test 3: Client A Authenticated Submission & Server-Derived Authority ---");
    const submitARes = await pool.query(`
        SET LOCAL role TO authenticated;
        SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
        SELECT public.submit_authenticated_client_action('${task1Id}', '{"text":"Client A valid response", "spoofed_org_id":"${foreignOrgId}"}'::jsonb) AS res;
    `);
    const subResData = submitARes[submitARes.length - 1].rows[0].res;
    assert(subResData.success === true, "Client A authenticated submission succeeded");
    assert(subResData.status === 'done', "Task marked 'done'");

    // Verify task_submissions record in DB
    const subDbRes = await pool.query("SELECT * FROM public.task_submissions WHERE id = $1;", [subResData.submission_id]);
    assert(subDbRes.rows.length === 1, "task_submissions row exists");
    const subRow = subDbRes.rows[0];
    assert(subRow.submission_type === 'authenticated_portal', "submission_type is strictly 'authenticated_portal'");
    assert(subRow.submitted_by_user_id === userAId, "submitted_by_user_id authoritatively derived from auth.uid()");
    assert(subRow.submitted_by_contact_id === contactAId, "submitted_by_contact_id authoritatively derived from contact mapping");
    assert(subRow.organization_id === orgId, "organization_id matches task's authoritative org (spoofed_org_id ignored)");

    // Cleanup exact test fixtures
    await pool.query("DELETE FROM public.task_submissions WHERE task_id = $1;", [task1Id]);
    await pool.query("DELETE FROM public.tasks WHERE id = $1;", [task1Id]);
    await pool.query("DELETE FROM public.project_memberships WHERE project_id = $1;", [projId]);
    await pool.query("DELETE FROM public.projects WHERE id = $1;", [projId]);
    await pool.query("DELETE FROM public.organization_memberships WHERE organization_id IN ($1, $2);", [orgId, foreignOrgId]);
    await pool.query("DELETE FROM public.client_portal_access WHERE organization_id IN ($1, $2);", [orgId, foreignOrgId]);
    await pool.query("DELETE FROM public.contacts WHERE organization_id IN ($1, $2);", [orgId, foreignOrgId]);
    await pool.query("DELETE FROM public.profiles WHERE id IN ($1, $2, $3);", [userAId, userBId, userCId]);
    await pool.query("DELETE FROM auth.users WHERE id IN ($1, $2, $3);", [userAId, userBId, userCId]);
    await pool.query("DELETE FROM public.organizations WHERE id IN ($1, $2);", [orgId, foreignOrgId]);

    console.log("\n=== SUITE 1 PASSED: CLIENT A VS CLIENT B ISOLATION & SERVER-DERIVED RBAC 100% VERIFIED ===");
    await pool.end();
}

run().catch((err) => {
    console.error("FATAL ERROR IN SUITE 1:", err);
    process.exit(1);
});
