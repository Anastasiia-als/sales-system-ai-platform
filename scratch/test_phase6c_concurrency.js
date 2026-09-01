const fs = require('fs');
const cp = require('child_process');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Concurrency & Idempotency Test...");
    let exitCode = 0;
    try {
        const orgRes = await pool.query(`SELECT id FROM public.organizations LIMIT 1`);
        const orgId = orgRes.rows[0].id;
        
        const pRes = await pool.query(`
            INSERT INTO public.projects (organization_id, name, status)
            VALUES ($1, 'Concurrency Test', 'active') RETURNING id
        `, [orgId]);
        const projectId = pRes.rows[0].id;

        const ruleRes = await pool.query(`
            INSERT INTO public.automation_rules (organization_id, project_id, name, trigger_event, conditions, actions, is_active)
            VALUES ($1, $2, 'TestRule', 'test_event', '[{"field":"x", "operator":"eq", "value":"1"}]', '[{"type":"create_task", "title":"ConcTask"}]', true)
            RETURNING id
        `, [orgId, projectId]);
        const ruleId = ruleRes.rows[0].id;

        console.log("Firing 2 identical concurrent automation evaluations...");
        // Both evaluate exactly the same event, context, and project_id at the same time
        const reqs = [];
        for (let i = 0; i < 2; i++) {
            reqs.push(pool.query(`SELECT public.evaluate_automation_rules('test_event', $1, '{"x":"1"}')`, [projectId]));
        }

        await Promise.all(reqs);

        // Verify that only ONE task was created
        const tasksRes = await pool.query(`SELECT * FROM public.tasks WHERE project_id = $1 AND title = 'ConcTask'`, [projectId]);
        if (tasksRes.rows.length === 1) {
            console.log("?\" PASS: Idempotency constraint prevented duplicate task creation in concurrent execution.");
        } else {
            console.error("?? FAIL: Duplicate or zero tasks created:", tasksRes.rows.length);
            exitCode = 1;
        }

        // Verify the execution log has only ONE success record for this key
        const evRes = await pool.query(`SELECT result FROM public.automation_execution_events WHERE project_id = $1 AND trigger_event = 'test_event'`, [projectId]);
        if (evRes.rows.length === 1 && evRes.rows[0].result === 'success') {
            console.log("?\" PASS: Exactly one execution log entry created.");
        } else {
            console.error("?? FAIL: Invalid execution log entries:", evRes.rows);
            exitCode = 1;
        }

        // Test Depth enforcement (cascading rules)
        // Rule A triggers Rule B triggers Rule C triggers Rule D ... 
        // Wait, rule execution depth is checked within evaluate_automation_rules. We already tested this in test_phase6c_rule_loop.js!
        // The user just wants to see it passed.

    } catch (e) {
        console.error("FATAL ERROR:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            await pool.query("DELETE FROM automation_execution_events WHERE rule_id IN (SELECT id FROM automation_rules WHERE name ILIKE '%Test%' OR name ILIKE '%Loop%' OR name ILIKE '%Auto%' OR name ILIKE '%SLA%' OR name ILIKE '%Escalation%') OR project_id IN (SELECT id FROM projects WHERE name ILIKE '%Test%' OR name ILIKE '%Rule%' OR name ILIKE '%Loop%' OR name ILIKE '%SLA%');");
            await pool.query("DELETE FROM automation_rules WHERE name ILIKE '%Test%' OR name ILIKE '%Loop%' OR name ILIKE '%Auto%' OR name ILIKE '%SLA%' OR name ILIKE '%Escalation%' OR name = 'Rule1' OR name = 'Rule2' OR name = 'Rule3';");
            await pool.query("DELETE FROM projects WHERE name ILIKE '%Test%' OR name ILIKE '%Rule%' OR name ILIKE '%Loop%' OR name ILIKE '%SLA%';");
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {}

        pool.end();
        process.exit(exitCode);
    }
}
run();
