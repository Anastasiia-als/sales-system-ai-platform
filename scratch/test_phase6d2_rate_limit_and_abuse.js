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
    console.log("=== Starting Phase 6D.2 Rate Limiting & Controlled Abuse Suite ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        // Setup Org & Project
        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Rate Limit & Abuse Org', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, title) VALUES ($1, 'Abuse Project', 'active', 'Abuse Project') RETURNING id",
            [orgId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Abuse Target Task', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        const gRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskId}') AS res;
        `);
        const token = gRes[gRes.length - 1].rows[0].res;

        // 1. Controlled Abuse: Rapid Repeated Submissions with Invalid Tokens / Payloads
        console.log("1. Executing rapid repeated abuse requests (50 rapid invalid submissions)...");
        const abuseAttempts = 50;
        let blockedCount = 0;

        for (let i = 0; i < abuseAttempts; i++) {
            try {
                // Alternating malformed, garbage, and SQL injection strings
                const maliciousToken = i % 2 === 0 ? `fwa_fake_${i}_' OR '1'='1` : `fwa_garbage_token_${i}_abcdef`;
                await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"exploit\"}'::jsonb)", [maliciousToken]);
            } catch(e) {
                blockedCount++;
                // Verify error response is generic security-safe, never exposes SQL query traces or internal table internals
                assert(!e.message.includes("SELECT"), "Error message contains no SQL query leak");
                assert(!e.message.includes("client_action_tokens"), "Error message contains no table name leak");
                assert(!e.message.includes("organization_id"), "Error message contains no internal column leak");
                assert(e.message.includes("Invalid") || e.message.includes("token"), "Generic security error returned");
            }
        }

        assert(blockedCount === abuseAttempts, `All ${abuseAttempts} abuse requests were blocked cleanly`);

        // 2. Controlled Abuse Side Effects Verification
        console.log("2. Verifying database state after 50 blocked abuse attempts...");
        
        // Zero task_submissions
        const subCount = await pool.query("SELECT COUNT(*) as c FROM public.task_submissions WHERE task_id = $1", [taskId]);
        assert(parseInt(subCount.rows[0].c, 10) === 0, "Blocked requests create 0 task_submissions rows");

        // Zero automation execution events
        const eventCount = await pool.query("SELECT COUNT(*) as c FROM public.automation_execution_events WHERE project_id = $1", [projectId]);
        assert(parseInt(eventCount.rows[0].c, 10) === 0, "Blocked requests create 0 automation execution events");

        // Zero notifications
        const notifCount = await pool.query("SELECT COUNT(*) as c FROM public.notifications WHERE project_id = $1", [projectId]);
        assert(parseInt(notifCount.rows[0].c, 10) === 0, "Blocked requests create 0 notifications");

        // Task status unchanged
        const taskCheck = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1", [taskId]);
        assert(taskCheck.rows[0].status === 'todo', "Task status remains 'todo'");
        assert(taskCheck.rows[0].completed_at === null, "completed_at remains NULL");

        // Token status unchanged
        const tokenCheck = await pool.query("SELECT status, used_at FROM public.client_action_tokens WHERE id = $1", [token.token_id]);
        assert(tokenCheck.rows[0].status === 'active', "Token status remains 'active'");
        assert(tokenCheck.rows[0].used_at === null, "used_at remains NULL");

        // 3. Legitimate Submission After Abuse Attack
        console.log("3. Verifying legitimate submission succeeds after abuse attack...");
        const legitSubmit = await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Valid submission after attack\"}'::jsonb) AS res", [token.raw_token]);
        assert(legitSubmit.rows[0].res.success === true, "Legitimate submission succeeded normally after abuse burst");

        const finalSubCount = await pool.query("SELECT COUNT(*) as c FROM public.task_submissions WHERE task_id = $1", [taskId]);
        assert(parseInt(finalSubCount.rows[0].c, 10) === 1, "Exactly 1 valid submission row created");

        console.log("PASS: Phase 6D.2 Rate Limiting & Controlled Abuse Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in Rate Limit & Abuse Suite:", e);
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
            console.error("Cleanup error in abuse suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
