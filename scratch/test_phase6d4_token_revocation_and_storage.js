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
    console.log("=== Phase 6D.4 Suite 2: Cross-Channel Token Revocation & Authoritative Storage ===");

    const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org 6D4 Revocation', 'active') RETURNING id;");
    const orgId = orgRes.rows[0].id;

    const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1;");
    const ownerId = ownerRes.rows[0].id;

    const ts = Date.now();
    const emailA = `client_rev_${ts}@test.com`;

    const userARes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id;", [emailA]);
    const userAId = userARes.rows[0].id;
    await pool.query("UPDATE public.profiles SET global_role = 'client', full_name = 'Client Revocation Test' WHERE id = $1;", [userAId]);

    const contactARes = await pool.query("INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Contact', 'Rev', $2) RETURNING id;", [orgId, emailA]);
    const contactAId = contactARes.rows[0].id;

    await pool.query("INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active');", [orgId, contactAId, userAId]);
    await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true);", [orgId, userAId]);

    const projRes = await pool.query("INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Proj 6D4 Revoke', 'active', $2) RETURNING id;", [orgId, ownerId]);
    const projId = projRes.rows[0].id;
    await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'client_rep');", [projId, userAId]);

    const taskRes = await pool.query(`
        INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible, client_contact_id)
        VALUES ($1, $2, 'Task For Token Revocation Check', 'todo', 'client', true, $3)
        RETURNING id;
    `, [orgId, projId, contactAId]);
    const taskId = taskRes.rows[0].id;

    // --- TEST 4: Cross-Channel Token Revocation ---
    console.log("\n--- Test 4: Authenticated Completion Must Revoke Outstanding Magic Link Tokens ---");
    // Generate active magic link token
    const genRes = await pool.query(`
        SET LOCAL role TO authenticated;
        SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
        SELECT public.generate_action_token('${taskId}') AS res;
    `);
    const rawToken = genRes[genRes.length - 1].rows[0].res.raw_token;
    assert(typeof rawToken === 'string' && rawToken.startsWith('fwa_'), "Generated active magic link token");

    // Authenticated Client completes the action via Portal
    const submitRes = await pool.query(`
        SET LOCAL role TO authenticated;
        SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
        SELECT public.submit_authenticated_client_action('${taskId}', '{"text":"Completed via Authenticated Portal"}'::jsonb) AS res;
    `);
    assert(submitRes[submitRes.length - 1].rows[0].res.success === true, "Authenticated portal submission succeeded");

    // Inspect token in DB
    const tokenDbRes = await pool.query("SELECT * FROM public.client_action_tokens WHERE task_id = $1;", [taskId]);
    assert(tokenDbRes.rows.length === 1, "Magic link token row exists in DB");
    const tokenRow = tokenDbRes.rows[0];
    assert(tokenRow.status === 'revoked', "Token status is strictly 'revoked'");
    assert(tokenRow.revoked_at !== null, "Token revoked_at is populated");
    assert(tokenRow.used_at === null, "Token used_at is strictly NULL (never marked used on authenticated submission)");

    // Test get_public_client_action RPC with raw token
    const pubActionRes = await pool.query("SELECT public.get_public_client_action($1) AS res;", [rawToken]);
    const pubData = pubActionRes.rows[0].res;
    assert(pubData.status === 'revoked', "Public action resolution returns status 'revoked'");
    assert(pubData.is_completed !== true, "Public action resolution is_completed is not true (minimal revoked projection)");

    // --- TEST 5: Authoritative Storage Path & Validation ---
    console.log("\n--- Test 5: Server-Derived Storage Path Authority & Filename Sanitization ---");
    // Create a new task for storage tests
    const task2Res = await pool.query(`
        INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible, client_contact_id)
        VALUES ($1, $2, 'Task For Storage Path Check', 'todo', 'client', true, $3)
        RETURNING id;
    `, [orgId, projId, contactAId]);
    const task2Id = task2Res.rows[0].id;

    // Call generate_client_action_storage_path as Client A
    const pathGenRes = await pool.query(`
        SET LOCAL role TO authenticated;
        SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
        SELECT public.generate_client_action_storage_path('${task2Id}', 'test presentation final.pptx.pdf') AS res;
    `);
    const pathData = pathGenRes[pathGenRes.length - 1].rows[0].res;
    assert(pathData.extension === 'pdf', "Extracted canonical extension: 'pdf'");
    assert(pathData.storage_path.startsWith(`client-actions/${orgId}/${projId}/${task2Id}/`), "Storage path strictly follows authoritative org/proj/task hierarchy");
    assert(pathData.storage_path.endsWith('_test_presentation_final.pptx.pdf'), "Filename sanitized (spaces replaced with underscores)");

    // Negative File Validation: Attempting forbidden .exe
    let exeBlocked = false;
    try {
        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
            SELECT public.generate_client_action_storage_path('${task2Id}', 'malicious_script.exe');
        `);
    } catch (e) {
        exeBlocked = true;
        assert(e.message.includes("File format of malicious_script.exe is not allowed"), "Blocked forbidden extension .exe");
    }
    assert(exeBlocked, "Server strictly blocked .exe extension");

    // Negative File Validation: Attempting forbidden .txt
    let txtBlocked = false;
    try {
        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
            SELECT public.generate_client_action_storage_path('${task2Id}', 'notes.txt');
        `);
    } catch (e) {
        txtBlocked = true;
        assert(e.message.includes("File format of notes.txt is not allowed"), "Blocked forbidden extension .txt");
    }
    assert(txtBlocked, "Server strictly blocked .txt extension");

    // Negative Storage Policy: Verify RLS rejects insert with spoofed org or task ID in path
    console.log("\n--- Test 5B: Storage Policy Rejects Spoofed Task Namespace ---");
    const fakeTaskId = '00000000-0000-0000-0000-000000000001';
    const fakePath = `client-actions/${orgId}/${projId}/${fakeTaskId}/fake_file.pdf`;
    let storageSpoofBlocked = false;
    try {
        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${userAId}"}';
            INSERT INTO storage.objects (bucket_id, name, owner)
            VALUES ('project-documents', '${fakePath}', '${userAId}');
        `);
    } catch (e) {
        storageSpoofBlocked = true;
        assert(e.message.includes("row-level security") || e.message.includes("policy"), `Storage insert blocked by RLS: ${e.message}`);
    }
    assert(storageSpoofBlocked, "Storage RLS strictly blocked insertion into unauthorized task namespace");

    // Cleanup exact test fixtures
    await pool.query("DELETE FROM public.task_submissions WHERE task_id IN ($1, $2);", [taskId, task2Id]);
    await pool.query("DELETE FROM public.client_action_tokens WHERE task_id IN ($1, $2);", [taskId, task2Id]);
    await pool.query("DELETE FROM public.tasks WHERE id IN ($1, $2);", [taskId, task2Id]);
    await pool.query("DELETE FROM public.project_memberships WHERE project_id = $1;", [projId]);
    await pool.query("DELETE FROM public.projects WHERE id = $1;", [projId]);
    await pool.query("DELETE FROM public.organization_memberships WHERE organization_id = $1;", [orgId]);
    await pool.query("DELETE FROM public.client_portal_access WHERE organization_id = $1;", [orgId]);
    await pool.query("DELETE FROM public.contacts WHERE organization_id = $1;", [orgId]);
    await pool.query("DELETE FROM public.profiles WHERE id = $1;", [userAId]);
    await pool.query("DELETE FROM auth.users WHERE id = $1;", [userAId]);
    await pool.query("DELETE FROM public.organizations WHERE id = $1;", [orgId]);

    console.log("\n=== SUITE 2 PASSED: TOKEN REVOCATION & AUTHORITATIVE STORAGE 100% VERIFIED ===");
    await pool.end();
}

run().catch((err) => {
    console.error("FATAL ERROR IN SUITE 2:", err);
    process.exit(1);
});
