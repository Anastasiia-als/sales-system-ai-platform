// scratch/test_phase7a_security_and_emission.js
// Tests Phase 7A: Integration Event Emission, Immutability, RLS, and RPC Security

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const createdIds = {
    organizations: [],
    projects: [],
    tasks: [],
    events: [],
    users: []
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`PASS: ${message}`);
    } else {
        failed++;
        console.error(`FAIL: ${message}`);
    }
}

async function run() {
    const client = await pool.connect();
    try {
        console.log('--- Suite 1: Phase 7A Security and Event Emission ---');

        // 1. Setup isolated test fixtures
        const orgARes = await client.query(
            "INSERT INTO public.organizations (name) VALUES ('Test Org 7A A') RETURNING id"
        );
        const orgAId = orgARes.rows[0].id;
        createdIds.organizations.push(orgAId);

        const orgBRes = await client.query(
            "INSERT INTO public.organizations (name) VALUES ('Test Org 7A B') RETURNING id"
        );
        const orgBId = orgBRes.rows[0].id;
        createdIds.organizations.push(orgBId);

        const projARes = await client.query(
            "INSERT INTO public.projects (organization_id, name, title) VALUES ($1, 'Test Proj 7A', 'Test Proj 7A') RETURNING id",
            [orgAId]
        );
        const projAId = projARes.rows[0].id;
        createdIds.projects.push(projAId);

        const taskARes = await client.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type) VALUES ($1, $2, 'Test Task 7A', 'todo', 'internal') RETURNING id",
            [orgAId, projAId]
        );
        const taskAId = taskARes.rows[0].id;
        createdIds.tasks.push(taskAId);

        // Test 1A: Direct anon RPC denial on _emit_integration_event
        let anonDenied = false;
        try {
            await client.query("BEGIN");
            await client.query("SET LOCAL \"request.jwt.claim.role\" = 'anon'");
            await client.query("SELECT public._emit_integration_event('task', $1, 'task.completed')", [taskAId]);
            await client.query("COMMIT");
        } catch (e) {
            await client.query("ROLLBACK");
            anonDenied = e.code === '42501' || /permission denied/i.test(e.message);
        }
        assert(anonDenied, 'Direct anon invocation of _emit_integration_event is denied with 42501');

        // Test 1B: Direct authenticated client RPC denial on _emit_integration_event
        let authDenied = false;
        try {
            await client.query("BEGIN");
            await client.query("SET LOCAL \"request.jwt.claim.role\" = 'authenticated'");
            await client.query("SELECT public._emit_integration_event('task', $1, 'task.completed')", [taskAId]);
            await client.query("COMMIT");
        } catch (e) {
            await client.query("ROLLBACK");
            authDenied = e.code === '42501' || /permission denied/i.test(e.message);
        }
        assert(authDenied, 'Direct authenticated invocation of _emit_integration_event is denied with 42501');

        // Test 1C: Internal service_role successfully emits event with server-derived context
        await client.query("BEGIN");
        await client.query("SET LOCAL \"request.jwt.claim.role\" = 'service_role'");
        const emitRes = await client.query(
            "SELECT public._emit_integration_event('task', $1, 'task.completed') as event_id",
            [taskAId]
        );
        const eventId = emitRes.rows[0].event_id;
        await client.query("COMMIT");

        createdIds.events.push(eventId);
        assert(Boolean(eventId), 'Service role successfully emits integration event and receives event_id');

        // Verify context was derived from authoritative task row
        const evRow = await client.query(
            "SELECT * FROM public.integration_events WHERE id = $1",
            [eventId]
        );
        assert(evRow.rows.length === 1, 'Event row successfully created in integration_events');
        assert(evRow.rows[0].organization_id === orgAId, 'Tenant context organization_id derived authoritatively from DB row');
        assert(evRow.rows[0].project_id === projAId, 'Project context project_id derived authoritatively from DB row');
        assert(evRow.rows[0].event_type === 'task.completed', 'Event type correctly stored');
        assert(evRow.rows[0].payload_json.task_id === taskAId, 'Payload task_id matches authoritative task');
        assert(evRow.rows[0].payload_json.title === 'Test Task 7A', 'Payload title matches authoritative task');

        // Test 1D: Immutability guard - UPDATE fails with 23514
        let updateFailed = false;
        try {
            await client.query(
                "UPDATE public.integration_events SET event_type = 'tampered' WHERE id = $1",
                [eventId]
            );
        } catch (e) {
            updateFailed = e.code === '23514' || /immutable/i.test(e.message);
        }
        assert(updateFailed, 'Immutability guard: UPDATE on integration_events rejected with 23514');

        // Test 1E: Immutability guard - DELETE fails with 23514
        let deleteFailed = false;
        try {
            await client.query(
                "DELETE FROM public.integration_events WHERE id = $1",
                [eventId]
            );
        } catch (e) {
            deleteFailed = e.code === '23514' || /immutable/i.test(e.message);
        }
        assert(deleteFailed, 'Immutability guard: DELETE on integration_events rejected with 23514');

        // Test 1F: Cross-tenant event isolation via RLS
        const userEmail = `orgb_admin_7a_${Date.now()}@test.local`;
        const fakeAuthRes = await client.query(
            "INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id",
            [userEmail]
        );
        const fakeUserId = fakeAuthRes.rows[0].id;
        createdIds.users.push(fakeUserId);

        await client.query(
            "INSERT INTO public.profiles (id, email, global_role) VALUES ($1, $2, 'pm') ON CONFLICT (id) DO NOTHING",
            [fakeUserId, userEmail]
        );

        await client.query(
            "INSERT INTO public.organization_memberships (organization_id, user_id, org_role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING",
            [orgBId, fakeUserId]
        );

        // Query as Org B admin under RLS
        await client.query("BEGIN");
        await client.query("SET LOCAL role TO authenticated");
        await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [fakeUserId]);
        await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: fakeUserId })]);
        const crossTenantRes = await client.query(
            "SELECT * FROM public.integration_events WHERE organization_id = $1",
            [orgAId]
        );
        await client.query("COMMIT");
        assert(crossTenantRes.rows.length === 0, 'Cross-tenant event visibility under RLS returns exactly 0 rows');

        console.log(`\nSuite 1 Summary: Passed ${passed}, Failed ${failed}`);
    } catch (err) {
        console.error('Unexpected error in Suite 1:', err);
        failed++;
    } finally {
        // Cleanup strictly by exact created IDs with allow_cleanup enabled
        try {
            await client.query("SET integration.allow_cleanup = 'on'");
            if (createdIds.tasks.length > 0) {
                await client.query("DELETE FROM public.tasks WHERE id = ANY($1)", [createdIds.tasks]);
            }
            if (createdIds.projects.length > 0) {
                await client.query("DELETE FROM public.projects WHERE id = ANY($1)", [createdIds.projects]);
            }
            if (createdIds.events.length > 0) {
                await client.query("DELETE FROM public.integration_events WHERE id = ANY($1)", [createdIds.events]);
            }
            if (createdIds.organizations.length > 0) {
                await client.query("DELETE FROM public.organization_memberships WHERE organization_id = ANY($1)", [createdIds.organizations]);
                await client.query("DELETE FROM public.organizations WHERE id = ANY($1)", [createdIds.organizations]);
            }
            if (createdIds.users.length > 0) {
                await client.query("DELETE FROM public.profiles WHERE id = ANY($1)", [createdIds.users]);
                await client.query("DELETE FROM auth.users WHERE id = ANY($1)", [createdIds.users]);
            }
        } catch (cleanErr) {
            console.error("Cleanup error in Suite 1:", cleanErr);
        }
        client.release();
        await pool.end();
        process.exit(failed > 0 ? 1 : 0);
    }
}

run();
