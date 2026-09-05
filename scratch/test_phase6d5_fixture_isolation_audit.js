const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aayqydcdfxhlwizhfjun.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFheXF5ZGNkZnhobHdpemhmanVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ1NjA5NSwiZXhwIjoyMDg4MDMyMDk1fQ.u1zpBHb9rPocBca_m_PW8b8UGb8sOCn4s2s84bA9x48';
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        throw new Error(message);
    }
    console.log("PASS: " + message);
}

async function run() {
    console.log("=== Starting Phase 6D.5 Fixture Isolation & Data Preservation Audit ===");
    let exitCode = 0;
    const trackedFixtureIds = [];

    try {
        console.log("\n--- Subtest 1: Checking for Leaked / Dangling Transient Fixtures ---");
        
        const orgLeak = await pool.query(`
            SELECT id, name FROM public.organizations 
            WHERE name ILIKE '%Phase 6D.5%' 
               OR name ILIKE '%TEST_CONCURRENCY_%' 
               OR name ILIKE '%Storage Security Audit%'
               OR name ILIKE '%Golden Path E2E%'
        `);
        assert(orgLeak.rows.length === 0, `No dangling test organizations found (count: ${orgLeak.rows.length})`);

        const projLeak = await pool.query(`
            SELECT id, name FROM public.projects 
            WHERE name ILIKE '%Phase 6D.5%' 
               OR name ILIKE '%TEST_CONCURRENCY_%' 
               OR name ILIKE '%Storage Security Audit%'
               OR name ILIKE '%Golden Path E2E%'
        `);
        assert(projLeak.rows.length === 0, `No dangling test projects found (count: ${projLeak.rows.length})`);

        const taskLeak = await pool.query(`
            SELECT id, title FROM public.tasks 
            WHERE title ILIKE '%Phase 6D.5%' 
               OR title ILIKE '%TEST_CONCURRENCY_%' 
               OR title ILIKE '%Storage Security Audit%'
               OR title ILIKE '%Golden Path E2E%'
        `);
        assert(taskLeak.rows.length === 0, `No dangling test tasks found (count: ${taskLeak.rows.length})`);

        const subLeak = await pool.query(`
            SELECT id, payload FROM public.task_submissions 
            WHERE payload::text ILIKE '%TEST_CONCURRENCY_%' 
               OR payload::text ILIKE '%Storage Security Audit%'
               OR payload::text ILIKE '%Golden Path E2E%'
        `);
        assert(subLeak.rows.length === 0, `No dangling test submissions found (count: ${subLeak.rows.length})`);

        const { data: storageObjects } = await supabaseAdmin.storage
            .from('project-documents')
            .list('phase6d5_concurrency');
        const concurrencyStorageCount = storageObjects ? storageObjects.length : 0;
        assert(concurrencyStorageCount === 0, `No dangling storage files in phase6d5_concurrency (count: ${concurrencyStorageCount})`);

        const { data: auditStorageObjects } = await supabaseAdmin.storage
            .from('project-documents')
            .list('phase6d5_audit');
        const auditStorageCount = auditStorageObjects ? auditStorageObjects.length : 0;
        assert(auditStorageCount === 0, `No dangling storage files in phase6d5_audit (count: ${auditStorageCount})`);

        const { data: e2eStorageObjects } = await supabaseAdmin.storage
            .from('project-documents')
            .list('phase6d5_golden_path');
        const e2eStorageCount = e2eStorageObjects ? e2eStorageObjects.length : 0;
        assert(e2eStorageCount === 0, `No dangling storage files in phase6d5_golden_path (count: ${e2eStorageCount})`);

        console.log("\n--- Subtest 2: Verifying Real User / Production Data Integrity ---");
        
        const demoOrg = await pool.query(`SELECT id, name FROM public.organizations WHERE name = 'Demo Client Corp'`);
        assert(demoOrg.rows.length >= 1, "Demo Client Corp organization exists and is intact");

        const idempProj = await pool.query(`
            SELECT id, name, organization_id, status FROM public.projects 
            WHERE organization_id = $1
        `, [demoOrg.rows[0].id]);
        const activeProj = idempProj.rows.find(p => p.name === 'Idempotency Test');
        assert(!!activeProj, "Idempotency Test project exists in Demo Client Corp");

        const idempTaskWithSubs = await pool.query(`
            SELECT t.id, t.title, t.status, t.project_id, COUNT(s.id) as sub_count
            FROM public.tasks t
            JOIN public.projects p ON t.project_id = p.id
            JOIN public.task_submissions s ON s.task_id = t.id
            WHERE p.organization_id = $1
            GROUP BY t.id, t.title, t.status, t.project_id
            HAVING COUNT(s.id) >= 2
            LIMIT 1;
        `, [demoOrg.rows[0].id]);
        assert(idempTaskWithSubs.rows.length >= 1, "Real task with multiple preserved iterations exists in Demo Client Corp");
        const realTask = idempTaskWithSubs.rows[0];

        const idempSubs = await pool.query(`
            SELECT id, submission_type, created_at FROM public.task_submissions 
            WHERE task_id = $1 ORDER BY created_at ASC
        `, [realTask.id]);
        assert(idempSubs.rows.length >= 2, `Real questionnaire task has preserved submissions (count: ${idempSubs.rows.length})`);
        assert(idempSubs.rows[0].submission_type === 'public_link', "Iteration 1 submission_type is 'public_link'");
        assert(idempSubs.rows[1].submission_type === 'authenticated_portal', "Iteration 2 submission_type is 'authenticated_portal'");

        console.log("\n--- Subtest 3: Sentinel Isolation & Exact-ID Deletion Verification ---");
        
        const orgId = demoOrg.rows[0].id;
        // Create Sentinel Task
        const sentinelTaskRes = await pool.query(`
            INSERT INTO public.tasks (
                organization_id, project_id, title, status
            ) VALUES (
                $1, $2, 'SENTINEL_ISOLATION_TASK_DO_NOT_DELETE', 'todo'
            ) RETURNING id, created_at, title, status;
        `, [orgId, activeProj.id]);
        const sentinelTask = sentinelTaskRes.rows[0];
        trackedFixtureIds.push(sentinelTask.id);

        // Create Transient Fixture Task
        const transientTaskRes = await pool.query(`
            INSERT INTO public.tasks (
                organization_id, project_id, title, status
            ) VALUES (
                $1, $2, 'TRANSIENT_FIXTURE_TASK_FOR_CLEANUP', 'todo'
            ) RETURNING id;
        `, [orgId, activeProj.id]);
        const transientTaskId = transientTaskRes.rows[0].id;
        trackedFixtureIds.push(transientTaskId);

        await pool.query("SET session_replication_role = 'replica';");
        await pool.query("DELETE FROM public.tasks WHERE id = $1", [transientTaskId]);
        await pool.query("SET session_replication_role = 'origin';");

        const checkSentinel = await pool.query("SELECT * FROM public.tasks WHERE id = $1", [sentinelTask.id]);
        assert(checkSentinel.rows.length === 1, "Sentinel task survived deletion of transient fixture");
        assert(checkSentinel.rows[0].id === sentinelTask.id, "Sentinel UUID unchanged");
        assert(checkSentinel.rows[0].title === sentinelTask.title, "Sentinel title unchanged");
        assert(checkSentinel.rows[0].status === sentinelTask.status, "Sentinel status unchanged");

        await pool.query("SET session_replication_role = 'replica';");
        await pool.query("DELETE FROM public.tasks WHERE id = $1", [sentinelTask.id]);
        await pool.query("SET session_replication_role = 'origin';");

        const checkSentinelAfter = await pool.query("SELECT * FROM public.tasks WHERE id = $1", [sentinelTask.id]);
        assert(checkSentinelAfter.rows.length === 0, "Sentinel task cleanly deleted by exact ID");

        console.log("\n=======================================================");
        console.log("PASS: Phase 6D.5 Fixture Isolation & Data Preservation Audit passed 100%!");
        console.log("=======================================================");

    } catch (e) {
        console.error("FATAL ERROR in Fixture Isolation Audit:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (trackedFixtureIds.length > 0) {
                await pool.query("DELETE FROM public.tasks WHERE id = ANY($1::uuid[])", [trackedFixtureIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch (cleanupErr) {
            console.error("Cleanup error in finally block:", cleanupErr);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
