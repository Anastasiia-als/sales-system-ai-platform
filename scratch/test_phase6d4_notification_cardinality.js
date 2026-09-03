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
    console.log("=== Phase 6D.4 Suite 3: Notification Cardinality Matrix ===");

    const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org 6D4 Notifs', 'active') RETURNING id;");
    const orgId = orgRes.rows[0].id;

    const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1;");
    const ownerId = ownerRes.rows[0].id;

    const ts = Date.now();
    // Distinct PM user
    const pmRes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id;", [`pm_${ts}@test.com`]);
    const pmId = pmRes.rows[0].id;
    await pool.query("UPDATE public.profiles SET global_role = 'pm', full_name = 'Dedicated PM' WHERE id = $1;", [pmId]);
    await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'pm', true);", [orgId, pmId]);

    // Client User
    const clientRes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id;", [`client_notif_${ts}@test.com`]);
    const clientId = clientRes.rows[0].id;
    await pool.query("UPDATE public.profiles SET global_role = 'client', full_name = 'Client Notif' WHERE id = $1;", [clientId]);
    await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true);", [orgId, clientId]);

    const contactRes = await pool.query("INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Client', 'Notif', $2) RETURNING id;", [orgId, `client_notif_${ts}@test.com`]);
    const contactId = contactRes.rows[0].id;
    await pool.query("INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active');", [orgId, contactId, clientId]);

    // -----------------------------------------------------------------
    // Scenario 1: Responsible PM != Global Owner -> Exactly 2 rows
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 1: Responsible PM != Global Owner ---");
    const proj1Res = await pool.query("INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Proj Distinct PM', 'active', $2) RETURNING id;", [orgId, pmId]);
    const proj1Id = proj1Res.rows[0].id;
    await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'client_rep');", [proj1Id, clientId]);

    const task1Res = await pool.query(`
        INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible, client_contact_id)
        VALUES ($1, $2, 'Task For Distinct PM Check', 'todo', 'client', true, $3)
        RETURNING id;
    `, [orgId, proj1Id, contactId]);
    const task1Id = task1Res.rows[0].id;

    // Submit as authenticated client
    await pool.query(`
        SET LOCAL role TO authenticated;
        SET LOCAL request.jwt.claims TO '{"sub":"${clientId}"}';
        SELECT public.submit_authenticated_client_action('${task1Id}', '{"text":"Submission for distinct PM"}'::jsonb);
    `);

    // Verify notifications
    const notifs1 = await pool.query("SELECT id, recipient_user_id, event_type, title FROM public.notifications WHERE entity_id = $1;", [task1Id]);
    assert(notifs1.rows.length === 2, `Exactly 2 notification rows persisted for PM != Owner (Got: ${notifs1.rows.length})`);
    const recipients1 = notifs1.rows.map(r => r.recipient_user_id);
    assert(recipients1.includes(pmId), "Notification persisted for Responsible PM");
    assert(recipients1.includes(ownerId), "Notification persisted for Global Owner");

    // Double submit attempt: must fail and produce 0 extra notifications
    let doubleSubmitBlocked = false;
    try {
        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${clientId}"}';
            SELECT public.submit_authenticated_client_action('${task1Id}', '{"text":"Second submission attempt"}'::jsonb);
        `);
    } catch (e) {
        doubleSubmitBlocked = true;
        assert(e.message.includes("Action is already completed"), "Double submit rejected by core");
    }
    assert(doubleSubmitBlocked, "Double submit blocked");
    const notifs1After = await pool.query("SELECT COUNT(*) AS cnt FROM public.notifications WHERE entity_id = $1;", [task1Id]);
    assert(parseInt(notifs1After.rows[0].cnt, 10) === 2, "Zero duplicate notifications generated on retry (count strictly 2)");

    // -----------------------------------------------------------------
    // Scenario 2: Responsible PM == Global Owner -> Exactly 1 row
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 2: Responsible PM == Global Owner ---");
    const proj2Res = await pool.query("INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Proj Owner As PM', 'active', $2) RETURNING id;", [orgId, ownerId]);
    const proj2Id = proj2Res.rows[0].id;
    await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'client_rep');", [proj2Id, clientId]);

    const task2Res = await pool.query(`
        INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible, client_contact_id)
        VALUES ($1, $2, 'Task For Owner as PM Check', 'todo', 'client', true, $3)
        RETURNING id;
    `, [orgId, proj2Id, contactId]);
    const task2Id = task2Res.rows[0].id;

    await pool.query(`
        SET LOCAL role TO authenticated;
        SET LOCAL request.jwt.claims TO '{"sub":"${clientId}"}';
        SELECT public.submit_authenticated_client_action('${task2Id}', '{"text":"Submission for owner as PM"}'::jsonb);
    `);

    const notifs2 = await pool.query("SELECT id, recipient_user_id, event_type FROM public.notifications WHERE entity_id = $1;", [task2Id]);
    assert(notifs2.rows.length === 1, `Exactly 1 notification row persisted for PM == Owner (Got: ${notifs2.rows.length})`);
    assert(notifs2.rows[0].recipient_user_id === ownerId, "Notification recipient is strictly the unique Owner/PM user");

    // -----------------------------------------------------------------
    // Scenario 3: Responsible PM IS NULL -> Exactly 1 row (Owner)
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 3: Responsible PM IS NULL ---");
    const proj3Res = await pool.query("INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Proj Null PM', 'active', NULL) RETURNING id;", [orgId]);
    const proj3Id = proj3Res.rows[0].id;
    await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'client_rep');", [proj3Id, clientId]);

    const task3Res = await pool.query(`
        INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible, client_contact_id)
        VALUES ($1, $2, 'Task For Null PM Check', 'todo', 'client', true, $3)
        RETURNING id;
    `, [orgId, proj3Id, contactId]);
    const task3Id = task3Res.rows[0].id;

    await pool.query(`
        SET LOCAL role TO authenticated;
        SET LOCAL request.jwt.claims TO '{"sub":"${clientId}"}';
        SELECT public.submit_authenticated_client_action('${task3Id}', '{"text":"Submission for null PM"}'::jsonb);
    `);

    const notifs3 = await pool.query("SELECT id, recipient_user_id, event_type FROM public.notifications WHERE entity_id = $1;", [task3Id]);
    assert(notifs3.rows.length === 1, `Exactly 1 notification row persisted for PM IS NULL (Got: ${notifs3.rows.length})`);
    assert(notifs3.rows[0].recipient_user_id === ownerId, "Notification recipient is strictly the Owner");

    // -----------------------------------------------------------------
    // Scenario 4: PM Reopen -> Exactly 1 Notification to Assigned Client
    // -----------------------------------------------------------------
    console.log("\n--- Scenario 4: PM Reopen -> Client Notification ---");
    const reopenRes = await pool.query(`
        SET LOCAL role TO authenticated;
        SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
        SELECT public.reopen_client_action('${task1Id}') AS res;
    `);
    assert(reopenRes[reopenRes.length - 1].rows[0].res.success === true, "PM reopen succeeded");

    const clientNotifs = await pool.query("SELECT id, recipient_user_id, event_type, title FROM public.notifications WHERE entity_id = $1;", [task1Id]);
    console.log("All notifs for task1Id:", clientNotifs.rows);
    const reopenNotifs = clientNotifs.rows.filter(r => r.event_type === 'client_action_reopened');
    assert(reopenNotifs.length === 1, "Exactly 1 'client_action_reopened' notification created");
    assert(reopenNotifs[0].recipient_user_id === clientId, "Assigned client user received the reopen notification");

    // Cleanup fixtures
    await pool.query("DELETE FROM public.notifications WHERE entity_id IN ($1, $2, $3);", [task1Id, task2Id, task3Id]);
    await pool.query("DELETE FROM public.task_submissions WHERE task_id IN ($1, $2, $3);", [task1Id, task2Id, task3Id]);
    await pool.query("DELETE FROM public.tasks WHERE id IN ($1, $2, $3);", [task1Id, task2Id, task3Id]);
    await pool.query("DELETE FROM public.project_memberships WHERE project_id IN ($1, $2, $3);", [proj1Id, proj2Id, proj3Id]);
    await pool.query("DELETE FROM public.projects WHERE id IN ($1, $2, $3);", [proj1Id, proj2Id, proj3Id]);
    await pool.query("DELETE FROM public.organization_memberships WHERE organization_id = $1;", [orgId]);
    await pool.query("DELETE FROM public.client_portal_access WHERE organization_id = $1;", [orgId]);
    await pool.query("DELETE FROM public.contacts WHERE organization_id = $1;", [orgId]);
    await pool.query("DELETE FROM public.profiles WHERE id IN ($1, $2);", [pmId, clientId]);
    await pool.query("DELETE FROM auth.users WHERE id IN ($1, $2);", [pmId, clientId]);
    await pool.query("DELETE FROM public.organizations WHERE id = $1;", [orgId]);

    console.log("\n=== SUITE 3 PASSED: NOTIFICATION CARDINALITY MATRIX 100% VERIFIED ===");
    await pool.end();
}

run().catch((err) => {
    console.error("FATAL ERROR IN SUITE 3:", err);
    process.exit(1);
});
