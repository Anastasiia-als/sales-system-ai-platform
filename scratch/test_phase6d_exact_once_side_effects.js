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
    console.log("=== Starting Phase 6D.1.1 Exact-Once Side Effects & Automation Execution Suite ===");
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
        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Exact Once Side Effects', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, title) VALUES ($1, 'Exact Once Project', 'active', 'Exact Once Project') RETURNING id",
            [orgId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        // Setup Client User
        const userRes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'client_exact_once@example.com') RETURNING id");
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
        console.log("1. Executing Scenario A: Concurrent Public Link Submissions Race...");
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

        assert(succA.length === 1, "Scenario A: Exactly 1 public submission succeeded");
        assert(failA.length === 1, "Scenario A: Exactly 1 public submission rejected");

        // Assert Database State & Exact-Once Side Effects for Scenario A
        const subsA = await pool.query("SELECT * FROM public.task_submissions WHERE task_id = $1", [task1Id]);
        assert(subsA.rows.length === 1, `Scenario A: Exactly 1 task_submissions row created (Found: ${subsA.rows.length})`);

        const task1Check = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [task1Id]);
        assert(task1Check.rows[0].status === 'done', "Scenario A: Task marked done");
        assert(task1Check.rows[0].completed_at !== null, "Scenario A: Task completed_at set");

        const eventsA = await pool.query("SELECT * FROM public.automation_execution_events WHERE rule_id = $1 AND (matched_conditions->>'task_id') = $2", [ruleId, task1Id]);
        assert(eventsA.rows.length === 1, `Scenario A: evaluate_automation_rules executed EXACTLY ONCE (Found: ${eventsA.rows.length})`);

        const createdFollowupTasksA = await pool.query(
            "SELECT id FROM public.tasks WHERE project_id = $1 AND title = 'Verify Client Submission Assets' AND created_at >= $2",
            [projectId, eventsA.rows[0].evaluated_at]
        );
        assert(createdFollowupTasksA.rows.length === 1, `Scenario A: Exactly 1 downstream task created by automation rule (Duplicate tasks = 0)`);
        createdFollowupTasksA.rows.forEach(r => createdTaskIds.push(r.id));

        const activeTokensA = await pool.query("SELECT COUNT(*) as c FROM public.client_action_tokens WHERE task_id = $1 AND status = 'active'", [task1Id]);
        assert(parseInt(activeTokensA.rows[0].c, 10) === 0, "Scenario A: Active tokens after completion = 0");

        // ==========================================
        // Scenario B: Cross-Channel Concurrent Race (Public vs Authenticated)
        // ==========================================
        console.log("2. Executing Scenario B: Cross-Channel Concurrent Race (Public vs Auth)...");
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

        assert(succB.length === 1, "Scenario B: Exactly 1 channel succeeded");
        assert(failB.length === 1, "Scenario B: Exactly 1 channel rejected");

        // Assert Database State & Exact-Once Side Effects for Scenario B
        const subsB = await pool.query("SELECT * FROM public.task_submissions WHERE task_id = $1", [task2Id]);
        assert(subsB.rows.length === 1, `Scenario B: Exactly 1 task_submissions row created (Found: ${subsB.rows.length})`);

        const task2Check = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [task2Id]);
        assert(task2Check.rows[0].status === 'done', "Scenario B: Task marked done");

        const eventsB = await pool.query("SELECT * FROM public.automation_execution_events WHERE rule_id = $1 AND (matched_conditions->>'task_id') = $2", [ruleId, task2Id]);
        assert(eventsB.rows.length === 1, `Scenario B: evaluate_automation_rules executed EXACTLY ONCE (Found: ${eventsB.rows.length})`);

        const createdFollowupTasksB = await pool.query(
            "SELECT id FROM public.tasks WHERE project_id = $1 AND title = 'Verify Client Submission Assets' AND created_at >= $2",
            [projectId, eventsB.rows[0].evaluated_at]
        );
        assert(createdFollowupTasksB.rows.length === 1, `Scenario B: Exactly 1 downstream task created by automation rule (Duplicate tasks = 0)`);
        createdFollowupTasksB.rows.forEach(r => createdTaskIds.push(r.id));

        const activeTokensB = await pool.query("SELECT COUNT(*) as c FROM public.client_action_tokens WHERE task_id = $1 AND status = 'active'", [task2Id]);
        assert(parseInt(activeTokensB.rows[0].c, 10) === 0, "Scenario B: Active tokens after completion = 0");

        console.log("PASS: Phase 6D.1.1 Exact-Once Side Effects & Automation Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Exact-Once Suite:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
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
