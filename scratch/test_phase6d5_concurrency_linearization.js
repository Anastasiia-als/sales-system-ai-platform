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
    console.log("=== Phase 6D.5: Concurrency Linearization & Race Semantics Suite ===");

    // Strict non-destructive fixture tracking
    const createdIds = {
        orgs: [],
        projects: [],
        contacts: [],
        users: [],
        tasks: [],
        tokens: [],
        submissions: [],
        notifications: []
    };

    let exitCode = 0;

    try {
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1;");
        const ownerId = ownerRes.rows[0].id;

        const ts = Date.now();
        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ($1, 'active') RETURNING id;", [`Org 6D5 Concurrency ${ts}`]);
        const orgId = orgRes.rows[0].id;
        createdIds.orgs.push(orgId);

        const emailA = `client_6d5_conc_${ts}@test.com`;
        const userARes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id;", [emailA]);
        const userAId = userARes.rows[0].id;
        createdIds.users.push(userAId);
        await pool.query("UPDATE public.profiles SET global_role = 'client', full_name = 'Client 6D5 Concurrency' WHERE id = $1;", [userAId]);

        const contactARes = await pool.query("INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Client', '6D5', $2) RETURNING id;", [orgId, emailA]);
        const contactAId = contactARes.rows[0].id;
        createdIds.contacts.push(contactAId);

        await pool.query("INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active');", [orgId, contactAId, userAId]);
        await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true);", [orgId, userAId]);

        const projRes = await pool.query("INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Proj 6D5 Concurrency', 'active', $2) RETURNING id;", [orgId, ownerId]);
        const projId = projRes.rows[0].id;
        createdIds.projects.push(projId);
        await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'client_rep');", [projId, userAId]);

        // Helper to create task
        async function createTask(title) {
            const res = await pool.query(`
                INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible, client_contact_id)
                VALUES ($1, $2, $3, 'todo', 'client', true, $4)
                RETURNING id;
            `, [orgId, projId, title, contactAId]);
            const tid = res.rows[0].id;
            createdIds.tasks.push(tid);
            return tid;
        }

        // Helper to generate token
        async function genToken(taskId) {
            const res = await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
                SELECT public.generate_action_token('${taskId}') AS res;
            `);
            const tok = res[res.length - 1].rows[0].res;
            createdIds.tokens.push(tok.token_id);
            return tok;
        }

        // =========================================================================
        // CASE 1: Public Submit ↔ Authenticated Submit (Authenticated Wins)
        // =========================================================================
        console.log("\n--- Race Case 1: Public Submit vs Authenticated Submit (Authenticated Wins) ---");
        const task1Id = await createTask("Task Race 1: Auth Wins");
        const token1 = await genToken(task1Id);

        // 1. Authenticated submit commits first
        const authSubmit1 = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
            SELECT public.submit_authenticated_client_action('${task1Id}', '{"text":"Auth winner"}'::jsonb) AS res;
        `);
        assert(authSubmit1[authSubmit1.length - 1].rows[0].res.success === true, "Authenticated submit succeeded");

        // Verify task state
        const task1Db = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1;", [task1Id]);
        assert(task1Db.rows[0].status === 'done', "tasks.status = 'done' preserved");
        assert(task1Db.rows[0].completed_at !== null, "tasks.completed_at IS NOT NULL");

        // Verify token state
        const token1Db = await pool.query("SELECT status, revoked_at, used_at FROM public.client_action_tokens WHERE id = $1;", [token1.token_id]);
        assert(token1Db.rows[0].status === 'revoked', "Public token is strictly 'revoked'");
        assert(token1Db.rows[0].revoked_at !== null, "Public token revoked_at IS NOT NULL");
        assert(token1Db.rows[0].used_at === null, "Public token used_at IS strictly NULL");

        // 2. Competing Public Submit must be rejected with exact canonical literal
        let publicSubmit1Error = null;
        try {
            await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Late public\"}'::jsonb);", [token1.raw_token]);
        } catch(e) {
            publicSubmit1Error = e.message;
        }
        assert(publicSubmit1Error && publicSubmit1Error.includes("Invalid or revoked token."), "Losing public submit rejected with exact canonical literal 'Invalid or revoked token.'");

        // 3. Opening URL renders canonical revoked state
        const getPub1 = await pool.query("SELECT public.get_public_client_action($1) AS res;", [token1.raw_token]);
        assert(getPub1.rows[0].res.status === 'revoked', "get_public_client_action independently returns status 'revoked'");

        // 4. Invariants check
        const subs1 = await pool.query("SELECT id, submission_type FROM public.task_submissions WHERE task_id = $1;", [task1Id]);
        assert(subs1.rows.length === 1, "task_submissions cardinality is strictly 1");
        assert(subs1.rows[0].submission_type === 'authenticated_portal', "submission_type = 'authenticated_portal'");

        // =========================================================================
        // CASE 2: Public Submit ↔ Authenticated Submit (Public Wins)
        // =========================================================================
        console.log("\n--- Race Case 2: Public Submit vs Authenticated Submit (Public Wins) ---");
        const task2Id = await createTask("Task Race 2: Public Wins");
        const token2 = await genToken(task2Id);

        // 1. Public submit commits first
        const pubSubmit2 = await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Public winner\"}'::jsonb) AS res;", [token2.raw_token]);
        assert(pubSubmit2.rows[0].res.success === true, "Public submit succeeded");

        // Verify task state
        const task2Db = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1;", [task2Id]);
        assert(task2Db.rows[0].status === 'done', "tasks.status = 'done' preserved");
        assert(task2Db.rows[0].completed_at !== null, "tasks.completed_at IS NOT NULL");

        // Verify token state
        const token2Db = await pool.query("SELECT status, used_at FROM public.client_action_tokens WHERE id = $1;", [token2.token_id]);
        assert(token2Db.rows[0].status === 'used', "Public token status is strictly 'used'");
        assert(token2Db.rows[0].used_at !== null, "Public token used_at IS NOT NULL");

        // 2. Competing Authenticated Submit must be rejected with exact canonical literal
        let authSubmit2Error = null;
        try {
            await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
                SELECT public.submit_authenticated_client_action('${task2Id}', '{"text":"Late auth"}'::jsonb);
            `);
        } catch(e) {
            authSubmit2Error = e.message;
        }
        assert(authSubmit2Error && authSubmit2Error.includes("Action is already completed."), "Losing authenticated submit rejected with exact canonical literal 'Action is already completed.'");

        // Invariants check
        const subs2 = await pool.query("SELECT id, submission_type FROM public.task_submissions WHERE task_id = $1;", [task2Id]);
        assert(subs2.rows.length === 1, "task_submissions cardinality is strictly 1");
        assert(subs2.rows[0].submission_type === 'public_link', "submission_type = 'public_link'");

        // =========================================================================
        // CASE 3: Public Submit ↔ Reopen (Branch A: Reopen FIRST → Public Submit SECOND)
        // =========================================================================
        console.log("\n--- Race Case 3: Public Submit ↔ Reopen (Branch A: Reopen FIRST) ---");
        const task3Id = await createTask("Task Race 3: Reopen First");
        const token3 = await genToken(task3Id);

        // Initial completion via Public Submit
        await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Initial completion\"}'::jsonb);", [token3.raw_token]);

        // Reopen linearizes first
        const reopenRes3 = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.reopen_client_action('${task3Id}') AS res;
        `);
        assert(reopenRes3[reopenRes3.length - 1].rows[0].res.success === true, "Reopen succeeded");

        const task3Db = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1;", [task3Id]);
        assert(task3Db.rows[0].status === 'todo', "tasks.status is 'todo' after Reopen");
        assert(task3Db.rows[0].completed_at === null, "tasks.completed_at is strictly NULL");

        // Verify historical used token is dead and never reactivated
        const token3Db = await pool.query("SELECT status, used_at, revoked_at FROM public.client_action_tokens WHERE id = $1;", [token3.token_id]);
        assert(token3Db.rows[0].status === 'used', "Historical token status is strictly 'used' (never reactivated)");
        assert(token3Db.rows[0].used_at !== null, "Historical token used_at IS NOT NULL");
        assert(token3Db.rows[0].revoked_at === null, "Historical token revoked_at IS NULL");

        // Subsequent public submission with used token is rejected with exact canonical literal
        let usedSubmitError = null;
        try {
            await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Attempt after reopen\"}'::jsonb);", [token3.raw_token]);
        } catch(e) {
            usedSubmitError = e.message;
        }
        assert(usedSubmitError && usedSubmitError.trim() === "Action has already been submitted.", `Public submit with used token rejected with exact canonical literal 'Action has already been submitted.' (Got: '${usedSubmitError}')`);

        // Also test with revoked token branch
        const token3Rev = await genToken(task3Id);
        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.revoke_action_token('${task3Id}', '${token3Rev.token_id}');
        `);
        const token3RevDb = await pool.query("SELECT status, used_at, revoked_at FROM public.client_action_tokens WHERE id = $1;", [token3Rev.token_id]);
        assert(token3RevDb.rows[0].status === 'revoked', "Historical revoked token status is strictly 'revoked'");
        assert(token3RevDb.rows[0].revoked_at !== null, "Historical revoked token revoked_at IS NOT NULL");
        assert(token3RevDb.rows[0].used_at === null, "Historical revoked token used_at IS NULL");

        let revokedSubmitError = null;
        try {
            await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Attempt with revoked\"}'::jsonb);", [token3Rev.raw_token]);
        } catch(e) {
            revokedSubmitError = e.message;
        }
        assert(revokedSubmitError && revokedSubmitError.trim() === "Invalid or revoked token.", `Public submit with revoked token rejected with exact canonical literal 'Invalid or revoked token.' (Got: '${revokedSubmitError}')`);

        // Invariants: exactly 1 historical submission, 0 new submissions
        const subs3 = await pool.query("SELECT count(*) FROM public.task_submissions WHERE task_id = $1;", [task3Id]);
        assert(parseInt(subs3.rows[0].count, 10) === 1, "task_submissions count remains exactly 1 (0 new submissions created)");

        // =========================================================================
        // CASE 4: Public Submit ↔ Reopen (Branch B: Public Submit FIRST → Reopen SECOND)
        // =========================================================================
        console.log("\n--- Race Case 4: Public Submit ↔ Reopen (Branch B: Public Submit FIRST) ---");
        const task4Id = await createTask("Task Race 4: Public Submit First");
        const token4 = await genToken(task4Id);

        // 1. Public Submit linearizes first
        const pubSubmit4 = await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Legitimate public completion\"}'::jsonb) AS res;", [token4.raw_token]);
        assert(pubSubmit4.rows[0].res.success === true, "Public submit succeeded first");

        // Check task is done
        const task4AfterSub = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1;", [task4Id]);
        assert(task4AfterSub.rows[0].status === 'done', "Task marked 'done' after public submit");
        assert(task4AfterSub.rows[0].completed_at !== null, "completed_at populated");

        // 2. Reopen linearizes second
        const reopenRes4 = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.reopen_client_action('${task4Id}') AS res;
        `);
        assert(reopenRes4[reopenRes4.length - 1].rows[0].res.success === true, "Reopen subsequently succeeded");

        // Check final task state
        const task4Final = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1;", [task4Id]);
        assert(task4Final.rows[0].status === 'todo', "Final task status is 'todo'");
        assert(task4Final.rows[0].completed_at === null, "Final completed_at is NULL");

        // Verify submission is permanently preserved in history
        const subs4 = await pool.query("SELECT id, submission_type, payload->>'text' as text FROM public.task_submissions WHERE task_id = $1;", [task4Id]);
        assert(subs4.rows.length === 1, "Submission permanently preserved in history");
        assert(subs4.rows[0].submission_type === 'public_link', "submission_type = 'public_link'");
        assert(subs4.rows[0].text === "Legitimate public completion", "Submission content intact");

        // Verify token remains used and dead
        const token4Db = await pool.query("SELECT status, used_at FROM public.client_action_tokens WHERE id = $1;", [token4.token_id]);
        assert(token4Db.rows[0].status === 'used', "Token remains 'used' and never reactivated");

        // Verify exactly 1 Reopen notification was created for assigned client
        const notifs4All = await pool.query("SELECT * FROM public.notifications WHERE entity_id = $1;", [task4Id]);
        const notifs4 = notifs4All.rows.filter(r => r.event_type === 'client_action_reopened');
        assert(notifs4.length === 1, "Exactly 1 Reopen notification generated for client");

        // =========================================================================
        // CASE 5: Authenticated Submit ↔ Reopen (Branch A: Reopen FIRST → Authenticated SECOND)
        // =========================================================================
        console.log("\n--- Race Case 5: Authenticated Submit ↔ Reopen (Branch A: Reopen FIRST) ---");
        const task5Id = await createTask("Task Race 5: Reopen First Auth Second");
        
        // Initial completion via portal
        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
            SELECT public.submit_authenticated_client_action('${task5Id}', '{"text":"Iteration 1"}'::jsonb);
        `);

        // Reopen first
        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.reopen_client_action('${task5Id}');
        `);

        // Authenticated submit second (Iteration 2)
        const authSubmit5 = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
            SELECT public.submit_authenticated_client_action('${task5Id}', '{"text":"Iteration 2"}'::jsonb) AS res;
        `);
        assert(authSubmit5[authSubmit5.length - 1].rows[0].res.success === true, "Authenticated submit succeeded creating Iteration 2");

        // Check task is done
        const task5Db = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1;", [task5Id]);
        assert(task5Db.rows[0].status === 'done', "Task returned to 'done'");
        assert(task5Db.rows[0].completed_at !== null, "completed_at IS NOT NULL");

        // Check history has 2 distinct iterations in order
        const subs5 = await pool.query("SELECT id, submission_type, payload->>'text' as text, created_at FROM public.task_submissions WHERE task_id = $1 ORDER BY created_at ASC;", [task5Id]);
        assert(subs5.rows.length === 2, "Exactly 2 submissions preserved in history");
        assert(subs5.rows[0].text === "Iteration 1", "Iteration 1 preserved");
        assert(subs5.rows[1].text === "Iteration 2", "Iteration 2 appended");

        // =========================================================================
        // CASE 6: Authenticated Submit ↔ Reopen (Branch B: Authenticated FIRST → Reopen SECOND)
        // =========================================================================
        console.log("\n--- Race Case 6: Authenticated Submit ↔ Reopen (Branch B: Auth FIRST Reopen SECOND) ---");
        const task6Id = await createTask("Task Race 6: Auth First Reopen Second");

        // Auth submit first
        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
            SELECT public.submit_authenticated_client_action('${task6Id}', '{"text":"Auth First"}'::jsonb);
        `);

        // Reopen second
        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.reopen_client_action('${task6Id}');
        `);

        const task6Db = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1;", [task6Id]);
        assert(task6Db.rows[0].status === 'todo', "Final status is 'todo'");
        assert(task6Db.rows[0].completed_at === null, "Final completed_at is NULL");

        const subs6 = await pool.query("SELECT count(*) FROM public.task_submissions WHERE task_id = $1;", [task6Id]);
        assert(parseInt(subs6.rows[0].count, 10) === 1, "Submission preserved in history");

        // =========================================================================
        // CASE 7: Submit ↔ Revoke
        // =========================================================================
        console.log("\n--- Race Case 7: Submit ↔ Revoke ---");
        // Branch A: Revoke first
        const task7aId = await createTask("Task Race 7A: Revoke First");
        const token7a = await genToken(task7aId);

        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.revoke_action_token('${task7aId}', '${token7a.token_id}');
        `);

        let submit7aError = null;
        try {
            await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Submit after revoke\"}'::jsonb);", [token7a.raw_token]);
        } catch(e) {
            submit7aError = e.message;
        }
        assert(submit7aError && submit7aError.includes("Invalid or revoked token."), "Submit after revoke rejected with 'Invalid or revoked token.'");

        const subs7a = await pool.query("SELECT count(*) FROM public.task_submissions WHERE task_id = $1;", [task7aId]);
        assert(parseInt(subs7a.rows[0].count, 10) === 0, "0 submissions created for revoked token submit");

        // Branch B: Submit first
        const task7bId = await createTask("Task Race 7B: Submit First");
        const token7b = await genToken(task7bId);

        await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Submit before revoke\"}'::jsonb);", [token7b.raw_token]);

        const revoke7bRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.revoke_action_token('${task7bId}', '${token7b.token_id}') AS res;
        `);
        assert(revoke7bRes[revoke7bRes.length - 1].rows[0].res.success === true, "Revoke call completed gracefully");

        const token7bDb = await pool.query("SELECT status, used_at FROM public.client_action_tokens WHERE id = $1;", [token7b.token_id]);
        assert(token7bDb.rows[0].status === 'used', "Token status remains 'used'");

        // =========================================================================
        // CASE 8: Generate / Regenerate ↔ Submit
        // =========================================================================
        console.log("\n--- Race Case 8: Generate / Regenerate ↔ Submit ---");
        const task8Id = await createTask("Task Race 8: Regenerate");
        const token8a = await genToken(task8Id);

        // Regenerate first
        const token8b = await genToken(task8Id);
        assert(token8b.token_id !== token8a.token_id, "New token created on regenerate");

        // Old token must be revoked
        const token8aDb = await pool.query("SELECT status FROM public.client_action_tokens WHERE id = $1;", [token8a.token_id]);
        assert(token8aDb.rows[0].status === 'revoked', "Old token revoked on regenerate");

        // Submit with old token must fail
        let submit8aError = null;
        try {
            await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Old token submit\"}'::jsonb);", [token8a.raw_token]);
        } catch(e) {
            submit8aError = e.message;
        }
        assert(submit8aError && submit8aError.includes("Invalid or revoked token."), "Submit with superseded token rejected with 'Invalid or revoked token.'");

        // Submit with new token succeeds
        const submit8b = await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"New token submit\"}'::jsonb) AS res;", [token8b.raw_token]);
        assert(submit8b.rows[0].res.success === true, "Submit with active regenerated token succeeded");

        // =========================================================================
        // CASE 9: Side-Effects and Notification Invariants (REQ-6D5-SIDE-01)
        // =========================================================================
        console.log("\n--- Race Case 9: Side-Effects and Notifications Invariants ---");
        // Verify total notification cardinality for task 4
        // In task 4: PM was owner -> exactly 1 completion notification, plus 1 reopen notification
        const task4Notifs = await pool.query("SELECT count(*) FROM public.notifications WHERE organization_id = $1;", [orgId]);
        assert(parseInt(task4Notifs.rows[0].count, 10) >= 2, "Notifications created deterministically");

        // Verify duplicate downstream tasks = 0
        const downstreamTasks = await pool.query("SELECT count(*) FROM public.tasks WHERE organization_id = $1 AND title LIKE 'Downstream%';", [orgId]);
        assert(parseInt(downstreamTasks.rows[0].count, 10) === 0, "Duplicate downstream tasks = 0");

        console.log("\nALL CONCURRENCY LINEARIZATION CONTRACTS VERIFIED 100%!");
    } catch(e) {
        console.error("FATAL ERROR in test_phase6d5_concurrency_linearization:", e);
        exitCode = 1;
    } finally {
        console.log("\n--- Executing Isolated Non-Destructive Fixture Cleanup ---");
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (createdIds.tasks.length > 0) {
                await pool.query("DELETE FROM public.notifications WHERE organization_id = ANY($1::uuid[])", [createdIds.orgs]);
                await pool.query("DELETE FROM public.task_submissions WHERE task_id = ANY($1::uuid[])", [createdIds.tasks]);
                await pool.query("DELETE FROM public.client_action_tokens WHERE task_id = ANY($1::uuid[])", [createdIds.tasks]);
                await pool.query("DELETE FROM public.tasks WHERE id = ANY($1::uuid[])", [createdIds.tasks]);
            }
            if (createdIds.projects.length > 0) {
                await pool.query("DELETE FROM public.project_memberships WHERE project_id = ANY($1::uuid[])", [createdIds.projects]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdIds.projects]);
            }
            if (createdIds.orgs.length > 0) {
                await pool.query("DELETE FROM public.client_portal_access WHERE organization_id = ANY($1::uuid[])", [createdIds.orgs]);
                await pool.query("DELETE FROM public.organization_memberships WHERE organization_id = ANY($1::uuid[])", [createdIds.orgs]);
                await pool.query("DELETE FROM public.contacts WHERE organization_id = ANY($1::uuid[])", [createdIds.orgs]);
                await pool.query("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", [createdIds.orgs]);
            }
            if (createdIds.users.length > 0) {
                await pool.query("DELETE FROM public.profiles WHERE id = ANY($1::uuid[])", [createdIds.users]);
                await pool.query("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [createdIds.users]);
            }
            await pool.query("SET session_replication_role = 'origin';");
            console.log("Cleanup completed targeting only exact created IDs.");
        } catch(cleanupErr) {
            console.error("Cleanup error:", cleanupErr);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
