const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        process.exit(1);
    }
    console.log("PASS: " + message);
}

async function run() {
    console.log("=== Phase 8B: RLS, RBAC & Multi-Tenant Isolation Test ===");

    const orgA = 'f1111111-1111-1111-1111-111111111111';
    const orgB = 'f2222222-2222-2222-2222-222222222222';

    const projA = 'f3333333-3333-3333-3333-333333333333';
    const projB = 'f4444444-4444-4444-4444-444444444444';

    const meetingA = 'f5555555-5555-5555-5555-555555555555';
    const meetingB = 'f6666666-6666-6666-6666-666666666666';

    const artifactA = 'f7777777-7777-7777-7777-777777777777';
    const artifactB = 'f8888888-8888-8888-8888-888888888888';

    // Users:
    // userA: admin in Org A
    // userB: admin in Org B
    // clientUser: client in Org A
    const userA = 'faaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const userB = 'fbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const clientUser = 'fccccccc-cccc-cccc-cccc-cccccccccccc';

    // Clean up
    try {
        await pool.query("SET session_replication_role = 'replica';");
        await pool.query("DELETE FROM public.meeting_ai_artifacts WHERE id IN ($1, $2)", [artifactA, artifactB]);
        await pool.query("DELETE FROM public.tasks WHERE source_meeting_id IN ($1, $2)", [meetingA, meetingB]);
        await pool.query("DELETE FROM public.meetings WHERE id IN ($1, $2)", [meetingA, meetingB]);
        await pool.query("DELETE FROM public.projects WHERE id IN ($1, $2)", [projA, projB]);
        await pool.query("DELETE FROM public.organization_memberships WHERE organization_id IN ($1, $2)", [orgA, orgB]);
        await pool.query("DELETE FROM public.organizations WHERE id IN ($1, $2)", [orgA, orgB]);
        await pool.query("DELETE FROM public.profiles WHERE id IN ($1, $2, $3)", [userA, userB, clientUser]);
        await pool.query("DELETE FROM auth.users WHERE id IN ($1, $2, $3)", [userA, userB, clientUser]);
        await pool.query("SET session_replication_role = 'origin';");
    } catch (_) {}

    // 1. Create auth users, profiles & organizations
    await pool.query("INSERT INTO auth.users (id, email) VALUES ($1, 'user.a@example.com'), ($2, 'user.b@example.com'), ($3, 'client@example.com')", [userA, userB, clientUser]);
    await pool.query("INSERT INTO public.profiles (id, full_name, email, global_role) VALUES ($1, 'User Org A', 'user.a@example.com', 'pm') ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, global_role = EXCLUDED.global_role", [userA]);
    await pool.query("INSERT INTO public.profiles (id, full_name, email, global_role) VALUES ($1, 'User Org B', 'user.b@example.com', 'pm') ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, global_role = EXCLUDED.global_role", [userB]);
    await pool.query("INSERT INTO public.profiles (id, full_name, email, global_role) VALUES ($1, 'Client User', 'client@example.com', 'client') ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, global_role = EXCLUDED.global_role", [clientUser]);

    await pool.query("INSERT INTO public.organizations (id, name) VALUES ($1, 'Org Alpha')", [orgA]);
    await pool.query("INSERT INTO public.organizations (id, name) VALUES ($1, 'Org Beta')", [orgB]);

    // Memberships: userA in Org A (admin), userB in Org B (admin), clientUser in Org A (client)
    await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'admin', true)", [orgA, userA]);
    await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'admin', true)", [orgB, userB]);
    await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true)", [orgA, clientUser]);

    // Projects & Meetings
    await pool.query("INSERT INTO public.projects (id, organization_id, name) VALUES ($1, $2, 'Alpha Project')", [projA, orgA]);
    await pool.query("INSERT INTO public.projects (id, organization_id, name) VALUES ($1, $2, 'Beta Project')", [projB, orgB]);

    await pool.query("INSERT INTO public.meetings (id, organization_id, project_id, title, meeting_type, status, start_at, end_at) VALUES ($1, $2, $3, 'Alpha Sync', 'review', 'completed', NOW(), NOW() + interval '1 hour')", [meetingA, orgA, projA]);
    await pool.query("INSERT INTO public.meetings (id, organization_id, project_id, title, meeting_type, status, start_at, end_at) VALUES ($1, $2, $3, 'Beta Sync', 'review', 'completed', NOW(), NOW() + interval '1 hour')", [meetingB, orgB, projB]);

    // Artifacts
    await pool.query(`
        INSERT INTO public.meeting_ai_artifacts (id, organization_id, project_id, meeting_id, status, raw_input_hash, summary, decisions, candidate_actions)
        VALUES ($1, $2, $3, $4, 'draft', 'hash_a', 'Summary Alpha', '[]'::jsonb, '[{"title":"Alpha Task","responsibility":"internal","priority":"medium"}]'::jsonb)
    `, [artifactA, orgA, projA, meetingA]);

    await pool.query(`
        INSERT INTO public.meeting_ai_artifacts (id, organization_id, project_id, meeting_id, status, raw_input_hash, summary, decisions, candidate_actions)
        VALUES ($1, $2, $3, $4, 'draft', 'hash_b', 'Summary Beta', '[]'::jsonb, '[{"title":"Beta Task","responsibility":"internal","priority":"medium"}]'::jsonb)
    `, [artifactB, orgB, projB, meetingB]);

    // 2. Test RLS Isolation: User A queries meeting_ai_artifacts
    const client = await pool.connect();
    try {
        await client.query("BEGIN;");
        await client.query(`SET LOCAL request.jwt.claim.sub = '${userA}';`);
        await client.query("SET LOCAL role = 'authenticated';");

        const visibleArtifacts = await client.query("SELECT id, organization_id FROM public.meeting_ai_artifacts");
        const visibleIds = visibleArtifacts.rows.map(r => r.id);

        assert(visibleIds.includes(artifactA), "User A can view their organization's artifact (Alpha)");
        assert(!visibleIds.includes(artifactB), "ISOLATION: User A CANNOT view Org B's artifact (Beta)");
        await client.query("ROLLBACK;");
    } finally {
        client.release();
    }

    // 3. Test RLS Denial: Client role in Org A querying meeting_ai_artifacts
    const clientRoleClient = await pool.connect();
    try {
        await clientRoleClient.query("BEGIN;");
        await clientRoleClient.query(`SET LOCAL request.jwt.claim.sub = '${clientUser}';`);
        await clientRoleClient.query("SET LOCAL role = 'authenticated';");

        const clientVisible = await clientRoleClient.query("SELECT id FROM public.meeting_ai_artifacts WHERE organization_id = $1", [orgA]);
        assert(clientVisible.rows.length === 0, "RBAC: Client role cannot view meeting_ai_artifacts (0 rows returned by RLS)");
        await clientRoleClient.query("ROLLBACK;");
    } finally {
        clientRoleClient.release();
    }

    // 4. Test Cross-Tenant Apply RPC Rejection: User A tries to apply Org B's artifact
    const crossApplyClient = await pool.connect();
    try {
        await crossApplyClient.query("BEGIN;");
        await crossApplyClient.query(`SET LOCAL request.jwt.claim.sub = '${userA}';`);
        await crossApplyClient.query("SET LOCAL role = 'authenticated';");

        let threwForbidden = false;
        try {
            await crossApplyClient.query(
                "SELECT public.apply_meeting_intelligence_items($1, true, 'Summary', '[]'::jsonb, '[]'::jsonb)",
                [artifactB]
            );
        } catch (e) {
            threwForbidden = e.message.includes('403') || e.message.includes('Forbidden') || e.message.includes('insufficient privileges');
        }
        await crossApplyClient.query("ROLLBACK;");
        assert(threwForbidden, "CROSS-TENANT: User A cannot apply Org B's artifact (403 Forbidden)");
    } finally {
        crossApplyClient.release();
    }

    // 5. Test Client Role Apply RPC Rejection: Client user tries to apply Org A's artifact
    const clientApplyClient = await pool.connect();
    try {
        await clientApplyClient.query("BEGIN;");
        await clientApplyClient.query(`SET LOCAL request.jwt.claim.sub = '${clientUser}';`);
        await clientApplyClient.query("SET LOCAL role = 'authenticated';");

        let threwClientForbidden = false;
        try {
            await clientApplyClient.query(
                "SELECT public.apply_meeting_intelligence_items($1, true, 'Summary', '[]'::jsonb, '[]'::jsonb)",
                [artifactA]
            );
        } catch (e) {
            threwClientForbidden = e.message.includes('403') || e.message.includes('Forbidden') || e.message.includes('insufficient privileges');
        }
        await clientApplyClient.query("ROLLBACK;");
        assert(threwClientForbidden, "RBAC: Client user cannot apply artifact (403 Forbidden)");
    } finally {
        clientApplyClient.release();
    }

    // 6. Test Authorized Apply by User A on Org A
    const validApplyClient = await pool.connect();
    try {
        await validApplyClient.query("BEGIN;");
        await validApplyClient.query(`SET LOCAL request.jwt.claim.sub = '${userA}';`);
        await validApplyClient.query("SET LOCAL role = 'authenticated';");

        const applyRes = await validApplyClient.query(
            "SELECT public.apply_meeting_intelligence_items($1, true, 'Valid Summary', '[]'::jsonb, '[{\"title\":\"Valid Task\",\"responsibility_type\":\"internal\",\"priority\":\"high\"}]'::jsonb) as res",
            [artifactA]
        );
        assert(applyRes.rows[0].res.ok === true, "Admin of Org A can apply artifact A successfully");
        await validApplyClient.query("COMMIT;");
    } finally {
        validApplyClient.release();
    }

    // Clean up
    try {
        await pool.query("SET session_replication_role = 'replica';");
        await pool.query("DELETE FROM public.meeting_ai_artifacts WHERE id IN ($1, $2)", [artifactA, artifactB]);
        await pool.query("DELETE FROM public.tasks WHERE source_meeting_id IN ($1, $2)", [meetingA, meetingB]);
        await pool.query("DELETE FROM public.meeting_notes WHERE meeting_id IN ($1, $2)", [meetingA, meetingB]);
        await pool.query("DELETE FROM public.meetings WHERE id IN ($1, $2)", [meetingA, meetingB]);
        await pool.query("DELETE FROM public.projects WHERE id IN ($1, $2)", [projA, projB]);
        await pool.query("DELETE FROM public.organization_memberships WHERE organization_id IN ($1, $2)", [orgA, orgB]);
        await pool.query("DELETE FROM public.organizations WHERE id IN ($1, $2)", [orgA, orgB]);
        await pool.query("DELETE FROM public.profiles WHERE id IN ($1, $2, $3)", [userA, userB, clientUser]);
        await pool.query("DELETE FROM auth.users WHERE id IN ($1, $2, $3)", [userA, userB, clientUser]);
        await pool.query("SET session_replication_role = 'origin';");
    } catch (_) {}

    await pool.end();
    console.log("=== Phase 8B RLS & Isolation Suite 100% Passed ===");
}

run().catch(err => {
    console.error("FAIL with exception:", err);
    process.exit(1);
});
