// scratch/test_phase7a_lifecycle_and_integrity.js
// Tests Phase 7A: Destination Lifecycle, Hard-Delete Prevention & Referential Integrity

const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const createdIds = {
    organizations: [],
    projects: [],
    tasks: [],
    endpoints: [],
    events: [],
    outbox: [],
    vaultSecrets: []
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
        console.log('--- Suite 3: Phase 7A Lifecycle & Referential Integrity ---');

        // 1. Setup isolated test fixtures
        const orgRes = await client.query(
            "INSERT INTO public.organizations (name) VALUES ('Test Org 7A Lifecycle') RETURNING id"
        );
        const orgId = orgRes.rows[0].id;
        createdIds.organizations.push(orgId);

        const projRes = await client.query(
            "INSERT INTO public.projects (organization_id, name, title) VALUES ($1, 'Test Proj 7A Lifecycle', 'Test Proj 7A Lifecycle') RETURNING id",
            [orgId]
        );
        const projId = projRes.rows[0].id;
        createdIds.projects.push(projId);

        const taskRes = await client.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type) VALUES ($1, $2, 'Test Task 7A Lifecycle', 'todo', 'internal') RETURNING id",
            [orgId, projId]
        );
        const taskId = taskRes.rows[0].id;
        createdIds.tasks.push(taskId);

        // Test 3A: Endpoint with 0 history - Hard delete succeeds and cleans Vault secrets
        const epZeroRes = await client.query(`
            SELECT public.create_integration_endpoint(
                '${orgId}',
                'Zero History Endpoint',
                'Has no outbox rows',
                'https://api.example.com/webhook/zero-history',
                ARRAY['*']
            ) as res;
        `);
        const epZero = epZeroRes.rows[0].res;
        const epZeroId = epZero.id;

        // Fetch vault secret IDs
        const epZeroSecrets = await client.query(
            "SELECT url_secret_id, signing_secret_id FROM public.integration_endpoints WHERE id = $1",
            [epZeroId]
        );
        const zeroUrlSecId = epZeroSecrets.rows[0].url_secret_id;
        const zeroSigSecId = epZeroSecrets.rows[0].signing_secret_id;

        // Verify secrets exist before delete
        const secBeforeCheck = await client.query(
            "SELECT COUNT(*) FROM vault.secrets WHERE id IN ($1, $2)",
            [zeroUrlSecId, zeroSigSecId]
        );
        assert(parseInt(secBeforeCheck.rows[0].count, 10) === 2, 'Vault secrets exist before endpoint deletion');

        // Delete endpoint with 0 history
        await client.query("DELETE FROM public.integration_endpoints WHERE id = $1", [epZeroId]);

        const epZeroCheck = await client.query(
            "SELECT * FROM public.integration_endpoints WHERE id = $1",
            [epZeroId]
        );
        assert(epZeroCheck.rows.length === 0, 'Endpoint with zero history successfully deleted');

        // Verify Vault secrets were automatically cleaned up by BEFORE DELETE trigger
        const secAfterCheck = await client.query(
            "SELECT COUNT(*) FROM vault.secrets WHERE id IN ($1, $2)",
            [zeroUrlSecId, zeroSigSecId]
        );
        assert(parseInt(secAfterCheck.rows[0].count, 10) === 0, 'Vault secrets cleanly deleted when endpoint with 0 history is deleted');

        // Setup an event for history tests
        await client.query("BEGIN");
        await client.query("SET LOCAL \"request.jwt.claim.role\" = 'service_role'");
        const evRes = await client.query(
            "SELECT public._emit_integration_event('task', $1, 'task.completed') as event_id",
            [taskId]
        );
        const eventId = evRes.rows[0].event_id;
        await client.query("COMMIT");
        createdIds.events.push(eventId);

        // Test statuses matrix: Hard delete MUST fail for all historical statuses
        const testStatuses = [
            'pending',
            'processing',
            'retrying',
            'delivered',
            'failed',
            'dead_letter',
            'rejected_ssrf'
        ];

        for (const status of testStatuses) {
            // Create dedicated endpoint
            const epRes = await client.query(`
                SELECT public.create_integration_endpoint(
                    '${orgId}',
                    'Endpoint ${status}',
                    'Endpoint for testing status ${status}',
                    'https://api.example.com/webhook/${status}',
                    ARRAY['*']
                ) as res;
            `);
            const ep = epRes.rows[0].res;
            createdIds.endpoints.push(ep.id);

            // Fetch secrets for tracking
            const secRow = await client.query(
                "SELECT url_secret_id, signing_secret_id FROM public.integration_endpoints WHERE id = $1",
                [ep.id]
            );
            if (secRow.rows[0].url_secret_id) createdIds.vaultSecrets.push(secRow.rows[0].url_secret_id);
            if (secRow.rows[0].signing_secret_id) createdIds.vaultSecrets.push(secRow.rows[0].signing_secret_id);

            // Insert historical outbox delivery with this status
            const outboxRes = await client.query(`
                INSERT INTO public.integration_outbox (
                    organization_id,
                    event_id,
                    channel_type,
                    destination_id,
                    status,
                    attempts_count,
                    last_error
                ) VALUES (
                    $1, $2, 'webhook', $3, $4, 1, 'Historical record'
                ) RETURNING id
            `, [orgId, eventId, ep.id, status]);
            createdIds.outbox.push(outboxRes.rows[0].id);

            // Attempt hard deletion: MUST fail with code 23001 RESTRICT_VIOLATION
            let deleteFailed = false;
            let errorCode = null;
            try {
                await client.query("DELETE FROM public.integration_endpoints WHERE id = $1", [ep.id]);
            } catch (delErr) {
                deleteFailed = true;
                errorCode = delErr.code;
            }

            assert(deleteFailed, `Hard delete forbidden for endpoint with historical delivery status '${status}'`);
            assert(errorCode === '23001', `Hard delete raised 23001 RESTRICT_VIOLATION for status '${status}'`);

            // Verify endpoint row still exists in DB
            const epCheck = await client.query("SELECT id FROM public.integration_endpoints WHERE id = $1", [ep.id]);
            assert(epCheck.rows.length === 1, `Endpoint preserved after blocked delete for status '${status}'`);

            // Verify soft deactivation succeeds cleanly
            await client.query("UPDATE public.integration_endpoints SET is_active = false WHERE id = $1", [ep.id]);
            const deactCheck = await client.query("SELECT is_active FROM public.integration_endpoints WHERE id = $1", [ep.id]);
            assert(deactCheck.rows[0].is_active === false, `Soft deactivation succeeds for endpoint with status '${status}'`);
        }

        console.log(`\nSuite 3 Summary: Passed ${passed}, Failed ${failed}`);
    } catch (err) {
        console.error('Unexpected error in Suite 3:', err);
        failed++;
    } finally {
        try {
            await client.query("SET integration.allow_cleanup = 'on'");
            if (createdIds.tasks.length > 0) {
                await client.query("DELETE FROM public.tasks WHERE id = ANY($1)", [createdIds.tasks]);
            }
            if (createdIds.projects.length > 0) {
                await client.query("DELETE FROM public.projects WHERE id = ANY($1)", [createdIds.projects]);
            }
            if (createdIds.outbox.length > 0) {
                await client.query("DELETE FROM public.integration_outbox WHERE id = ANY($1)", [createdIds.outbox]);
            }
            if (createdIds.events.length > 0) {
                await client.query("DELETE FROM public.integration_events WHERE id = ANY($1)", [createdIds.events]);
            }
            if (createdIds.endpoints.length > 0) {
                await client.query("DELETE FROM public.integration_endpoints WHERE id = ANY($1)", [createdIds.endpoints]);
            }
            if (createdIds.vaultSecrets.length > 0) {
                await client.query("DELETE FROM vault.secrets WHERE id = ANY($1)", [createdIds.vaultSecrets]);
            }
            if (createdIds.organizations.length > 0) {
                await client.query("DELETE FROM public.organization_memberships WHERE organization_id = ANY($1)", [createdIds.organizations]);
                await client.query("DELETE FROM public.organizations WHERE id = ANY($1)", [createdIds.organizations]);
            }
        } catch (cleanErr) {
            console.error("Cleanup error in Suite 3:", cleanErr);
        }
        client.release();
        await pool.end();
        process.exit(failed > 0 ? 1 : 0);
    }
}

run();
