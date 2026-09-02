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
    console.log("=== Starting Phase 6D.2 Submission Integration Suite ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];
    const createdRuleIds = [];
    const createdUserIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        // Setup Org, PM, Project
        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Submission Integration Org', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pmUserRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'pm_sub_test_${Date.now()}@example.com') RETURNING id`);
        const pmUserId = pmUserRes.rows[0].id;
        createdUserIds.push(pmUserId);
        await pool.query("UPDATE public.profiles SET global_role = 'specialist' WHERE id = $1", [pmUserId]);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, title, responsible_pm_id) VALUES ($1, 'Submission Project', 'active', 'Submission Project', $2) RETURNING id",
            [orgId, pmUserId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'pm', true)", [orgId, pmUserId]);
        await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'pm')", [projectId, pmUserId]);

        // Setup Automation Rule for client action completion
        const ruleRes = await pool.query(`
            INSERT INTO public.automation_rules (
                organization_id, project_id, name, trigger_event, conditions, actions, is_active
            ) VALUES (
                $1, $2, 'Followup on Client Action', 'client_action_completed',
                '[]'::jsonb,
                '[{"type": "create_task", "title": "PM Followup on Client Submission", "responsibility_type": "internal"}]'::jsonb,
                true
            ) RETURNING id;
        `, [orgId, projectId]);
        const ruleId = ruleRes.rows[0].id;
        createdRuleIds.push(ruleId);

        // 1. Test Text & Attachment Submission
        console.log("1. Testing Public Text & Attachment Submission...");
        const t1Res = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Contract Review Action', 'todo', 'client', true) RETURNING id",
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

        const payload1 = {
            text: "All contractual terms approved without amendments.",
            attachments: [
                { name: "signed_agreement.pdf", size: 1048576, type: "application/pdf" },
                { name: "company_details.xlsx", size: 204800, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
            ],
            submitted_at: new Date().toISOString()
        };

        const submitRes = await pool.query("SELECT public.submit_public_client_action($1, $2) AS res", [token1.raw_token, JSON.stringify(payload1)]);
        const sRes = submitRes.rows[0].res;
        assert(sRes.success === true, "submit_public_client_action returned success = true");
        assert(sRes.task_id === task1Id, "submit_public_client_action returned correct task_id");

        // Verify task state
        const taskCheck = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [task1Id]);
        assert(taskCheck.rows[0].status === 'done', "Task marked 'done'");
        assert(taskCheck.rows[0].completed_at !== null, "Task completed_at is set");

        // Verify submission record
        const subCheck = await pool.query("SELECT payload, attachments, organization_id, submission_type FROM public.task_submissions WHERE task_id = $1", [task1Id]);
        assert(subCheck.rows.length === 1, "task_submissions record created");
        assert(subCheck.rows[0].organization_id === orgId, "Submission tenant bound correctly");
        assert(subCheck.rows[0].submission_type === 'public_link', "Submission type marked 'public_link'");
        assert(subCheck.rows[0].attachments.length === 2, "2 attachments stored in metadata");

        // Verify token marked 'used'
        const tokenCheck = await pool.query("SELECT status, used_at FROM public.client_action_tokens WHERE id = $1", [token1.token_id]);
        assert(tokenCheck.rows[0].status === 'used', "Token status marked 'used'");
        assert(tokenCheck.rows[0].used_at !== null, "Token used_at is set");

        // 2. Test F5 Reload Idempotency (Already Completed state)
        console.log("2. Testing F5 Reload behavior after submission...");
        const reloadLookup = await pool.query("SELECT public.get_public_client_action($1) AS res", [token1.raw_token]);
        const rRes = reloadLookup.rows[0].res;
        assert(rRes.status === 'already_used', "Reloading after submission returns status 'already_used'");
        assert(rRes.is_completed === true, "Reloading after submission confirms is_completed = true");

        // 3. Test Automation & Notifications exact once
        console.log("3. Testing Automation & Notifications triggered by submission...");
        const autoTasks = await pool.query("SELECT id FROM public.tasks WHERE project_id = $1 AND title = 'PM Followup on Client Submission'", [projectId]);
        assert(autoTasks.rows.length === 1, "Downstream followup task created exactly once");
        autoTasks.rows.forEach(r => createdTaskIds.push(r.id));

        const notifs = await pool.query("SELECT recipient_user_id, event_type FROM public.notifications WHERE project_id = $1 AND entity_id = $2", [projectId, task1Id]);
        assert(notifs.rows.length === 2, "Exactly 2 notifications created (1 PM, 1 Owner)");

        console.log("PASS: Phase 6D.2 Submission Integration Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Submission Integration Suite:", e);
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
                await pool.query("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", [createdOrgIds]);
            }
            if (createdUserIds.length > 0) {
                await pool.query("DELETE FROM public.profiles WHERE id = ANY($1::uuid[])", [createdUserIds]);
                await pool.query("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [createdUserIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error in submission suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
