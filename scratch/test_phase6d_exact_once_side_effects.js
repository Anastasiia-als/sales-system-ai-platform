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
    console.log("=== Starting Phase 6D.1.3 Exact-Once Side Effects & Notification Cardinality Suite ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];
    const createdRuleIds = [];
    const createdUserIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        // Setup Org & Project
        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Exact Once Cardinality', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pmUserRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'pm_exact_once_${Date.now()}@example.com') RETURNING id`);
        const pmUserId = pmUserRes.rows[0].id;
        createdUserIds.push(pmUserId);
        await pool.query("UPDATE public.profiles SET global_role = 'specialist' WHERE id = $1", [pmUserId]);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, title, responsible_pm_id) VALUES ($1, 'Exact Once Project', 'active', 'Exact Once Project', $2) RETURNING id",
            [orgId, pmUserId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'pm', true)", [orgId, pmUserId]);
        await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'pm')", [projectId, pmUserId]);

        // Setup Client User
        const userRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'client_exact_once_${Date.now()}@example.com') RETURNING id`);
        const clientUserId = userRes.rows[0].id;
        createdUserIds.push(clientUserId);
        await pool.query("UPDATE public.profiles SET global_role = 'client' WHERE id = $1", [clientUserId]);
        await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true)", [orgId, clientUserId]);
        await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'client_rep')", [projectId, clientUserId]);

        const contactRes = await pool.query("INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Dan', 'Exact', 'client_exact_once@example.com') RETURNING id", [orgId]);
        const contactId = contactRes.rows[0].id;
        await pool.query("INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active')", [orgId, contactId, clientUserId]);

        // Setup Phase 6C Automation Rule: Trigger client_action_completed -> Create Downstream Task
        const ruleRes = await pool.query(`
            INSERT INTO public.automation_rules (
                organization_id, project_id, name, trigger_event, conditions, actions, is_active
            ) VALUES (
                $1, $2, 'Auto Followup Task on Client Completion', 'client_action_completed',
                '[]'::jsonb,
                '[
                    {"type": "create_task", "title": "Verify Client Submission Assets", "responsibility_type": "internal"}
                ]'::jsonb,
                true
            ) RETURNING id;
        `, [orgId, projectId]);
        const ruleId = ruleRes.rows[0].id;
        createdRuleIds.push(ruleId);

        // ==========================================
        // Scenario A: Parallel Public Submissions Race
        // ==========================================
        console.log("\n==========================================");
        console.log("1. Executing Scenario A: Concurrent Public Link Submissions Race (Promise.all([public, public]))...");
        console.log("==========================================");
        const t1Res = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Scenario A Public Race Action', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const task1Id = t1Res.rows[0].id;
        createdTaskIds.push(task1Id);

        const g1Res = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${task1Id}') AS res;
        `);
        const token1 = g1Res[g1Res.length - 1].rows[0].res;

        const cA1 = new Pool({ connectionString: pool.options.connectionString });
        const cA2 = new Pool({ connectionString: pool.options.connectionString });

        const resultsA = await Promise.allSettled([
            cA1.query("SELECT public.submit_public_client_action($1, '{\"runner\":\"A1\"}'::jsonb) AS res", [token1.raw_token]),
            cA2.query("SELECT public.submit_public_client_action($1, '{\"runner\":\"A2\"}'::jsonb) AS res", [token1.raw_token])
        ]);

        await cA1.end();
        await cA2.end();

        const succA = resultsA.filter(r => r.status === 'fulfilled');
        const failA = resultsA.filter(r => r.status === 'rejected');

        assert(succA.length === 1, "Scenario A: successful submissions = 1");
        assert(failA.length === 1, "Scenario A: Exactly 1 public submission rejected");

        // Assert Database State & Exact-Once Side Effects for Scenario A
        const subsA = await pool.query("SELECT * FROM public.task_submissions WHERE task_id = $1", [task1Id]);
        assert(subsA.rows.length === 1, `Scenario A: task_submissions = 1 (Found: ${subsA.rows.length})`);

        const task1Check = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [task1Id]);
        assert(task1Check.rows[0].status === 'done', "Scenario A: task completion mutation = 1");
        assert(task1Check.rows[0].completed_at !== null, "Scenario A: Task completed_at set");

        const eventsA = await pool.query("SELECT * FROM public.automation_execution_events WHERE rule_id = $1 AND (matched_conditions->>'task_id') = $2", [ruleId, task1Id]);
        assert(eventsA.rows.length === 1, `Scenario A: evaluate_automation_rules executions = 1 (Found: ${eventsA.rows.length})`);

        const createdFollowupTasksA = await pool.query(
            "SELECT id FROM public.tasks WHERE project_id = $1 AND title = 'Verify Client Submission Assets' AND created_at >= $2",
            [projectId, eventsA.rows[0].evaluated_at]
        );
        assert(createdFollowupTasksA.rows.length === 1, `Scenario A: downstream automation-created tasks = exactly expected once (Found: ${createdFollowupTasksA.rows.length})`);
        assert(createdFollowupTasksA.rows.length - 1 === 0, `Scenario A: duplicate downstream tasks = 0`);
        createdFollowupTasksA.rows.forEach(r => createdTaskIds.push(r.id));

        // Persisted Notifications Breakdown for Scenario A
        const allNotifsA = await pool.query(
            "SELECT id, recipient_user_id, event_type, entity_id, project_id, created_at, dedupe_key FROM public.notifications WHERE project_id = $1 AND entity_id = $2 AND event_type = 'client_action_completed'",
            [projectId, task1Id]
        );
        console.log("Scenario A Persisted Notification Records:", allNotifsA.rows.map(r => ({
            id: r.id,
            event_type: r.event_type,
            recipient_role: r.recipient_user_id === ownerId ? 'Owner' : (r.recipient_user_id === pmUserId ? 'PM' : 'Unknown'),
            task_id: r.entity_id,
            project_id: r.project_id,
            created_at: r.created_at
        })));

        assert(allNotifsA.rows.length === 2, `Scenario A: persisted notification rows = 2 (Found: ${allNotifsA.rows.length})`);

        const ownerNotifsA = allNotifsA.rows.filter(r => r.recipient_user_id === ownerId);
        assert(ownerNotifsA.length === 1, `Scenario A: Owner recipient notifications = 1 (Found: ${ownerNotifsA.length})`);

        const pmNotifsA = allNotifsA.rows.filter(r => r.recipient_user_id === pmUserId);
        assert(pmNotifsA.length === 1, `Scenario A: PM recipient notifications = 1 (Found: ${pmNotifsA.length})`);

        assert(ownerNotifsA.length - 1 === 0, "Scenario A: duplicate Owner notifications = 0");
        assert(pmNotifsA.length - 1 === 0, "Scenario A: duplicate PM notifications = 0");

        const activeTokensA = await pool.query("SELECT COUNT(*) as c FROM public.client_action_tokens WHERE task_id = $1 AND status = 'active'", [task1Id]);
        assert(parseInt(activeTokensA.rows[0].c, 10) === 0, "Scenario A: active tokens after completion = 0");

        // ==========================================
        // Scenario B: Cross-Channel Concurrent Race (Public vs Authenticated)
        // ==========================================
        console.log("\n==========================================");
        console.log("2. Executing Scenario B: Cross-Channel Concurrent Race (Promise.all([public, auth]))...");
        console.log("==========================================");
        const t2Res = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible, client_contact_id) VALUES ($1, $2, 'Scenario B Cross-Channel Action', 'todo', 'client', true, $3) RETURNING id",
            [orgId, projectId, contactId]
        );
        const task2Id = t2Res.rows[0].id;
        createdTaskIds.push(task2Id);

        const g2Res = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${task2Id}') AS res;
        `);
        const token2 = g2Res[g2Res.length - 1].rows[0].res;

        const cB1 = new Pool({ connectionString: pool.options.connectionString });
        const cB2 = new Pool({ connectionString: pool.options.connectionString });

        const resultsB = await Promise.allSettled([
            cB1.query("SELECT public.submit_public_client_action($1, '{\"runner\":\"B_public\"}'::jsonb) AS res", [token2.raw_token]),
            cB2.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${clientUserId}"}';
                SELECT public.submit_authenticated_client_action('${task2Id}', '{\"runner\":\"B_auth\"}'::jsonb) AS res;
            `)
        ]);

        await cB1.end();
        await cB2.end();

        const succB = resultsB.filter(r => r.status === 'fulfilled');
        const failB = resultsB.filter(r => r.status === 'rejected');

        assert(succB.length === 1, "Scenario B: successful submissions = 1");
        assert(failB.length === 1, "Scenario B: Exactly 1 channel rejected");

        // Assert Database State & Exact-Once Side Effects for Scenario B
        const subsB = await pool.query("SELECT * FROM public.task_submissions WHERE task_id = $1", [task2Id]);
        assert(subsB.rows.length === 1, `Scenario B: task_submissions = 1 (Found: ${subsB.rows.length})`);

        const task2Check = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [task2Id]);
        assert(task2Check.rows[0].status === 'done', "Scenario B: task completion mutation = 1");

        const eventsB = await pool.query("SELECT * FROM public.automation_execution_events WHERE rule_id = $1 AND (matched_conditions->>'task_id') = $2", [ruleId, task2Id]);
        assert(eventsB.rows.length === 1, `Scenario B: evaluate_automation_rules executions = 1 (Found: ${eventsB.rows.length})`);

        const createdFollowupTasksB = await pool.query(
            "SELECT id FROM public.tasks WHERE project_id = $1 AND title = 'Verify Client Submission Assets' AND created_at >= $2",
            [projectId, eventsB.rows[0].evaluated_at]
        );
        assert(createdFollowupTasksB.rows.length === 1, `Scenario B: downstream automation-created tasks = exactly expected once (Found: ${createdFollowupTasksB.rows.length})`);
        assert(createdFollowupTasksB.rows.length - 1 === 0, `Scenario B: duplicate downstream tasks = 0`);
        createdFollowupTasksB.rows.forEach(r => createdTaskIds.push(r.id));

        // Persisted Notifications Breakdown for Scenario B
        const allNotifsB = await pool.query(
            "SELECT id, recipient_user_id, event_type, entity_id, project_id, created_at, dedupe_key FROM public.notifications WHERE project_id = $1 AND entity_id = $2 AND event_type = 'client_action_completed'",
            [projectId, task2Id]
        );
        console.log("Scenario B Persisted Notification Records:", allNotifsB.rows.map(r => ({
            id: r.id,
            event_type: r.event_type,
            recipient_role: r.recipient_user_id === ownerId ? 'Owner' : (r.recipient_user_id === pmUserId ? 'PM' : 'Unknown'),
            task_id: r.entity_id,
            project_id: r.project_id,
            created_at: r.created_at
        })));

        assert(allNotifsB.rows.length === 2, `Scenario B: persisted notification rows = 2 (Found: ${allNotifsB.rows.length})`);

        const ownerNotifsB = allNotifsB.rows.filter(r => r.recipient_user_id === ownerId);
        assert(ownerNotifsB.length === 1, `Scenario B: Owner recipient notifications = 1 (Found: ${ownerNotifsB.length})`);

        const pmNotifsB = allNotifsB.rows.filter(r => r.recipient_user_id === pmUserId);
        assert(pmNotifsB.length === 1, `Scenario B: PM recipient notifications = 1 (Found: ${pmNotifsB.length})`);

        assert(ownerNotifsB.length - 1 === 0, "Scenario B: duplicate Owner notifications = 0");
        assert(pmNotifsB.length - 1 === 0, "Scenario B: duplicate PM notifications = 0");

        const activeTokensB = await pool.query("SELECT COUNT(*) as c FROM public.client_action_tokens WHERE task_id = $1 AND status = 'active'", [task2Id]);
        assert(parseInt(activeTokensB.rows[0].c, 10) === 0, "Scenario B: active tokens after completion = 0");

        console.log("\nPASS: Phase 6D.1.3 Exact-Once Side Effects & Notification Cardinality Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Exact-Once Suite:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (createdProjectIds.length > 0) {
                await pool.query("DELETE FROM public.notifications WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
            }
            if (createdRuleIds.length > 0) {
                await pool.query("DELETE FROM public.automation_execution_events WHERE rule_id = ANY($1::uuid[])", [createdRuleIds]);
                await pool.query("DELETE FROM public.automation_rules WHERE id = ANY($1::uuid[])", [createdRuleIds]);
            }
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
            console.error("Cleanup error in exact-once suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
