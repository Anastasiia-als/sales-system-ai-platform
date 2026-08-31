const fs = require('fs');
const cp = require('child_process');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Client Action Automation Test...");
    let exitCode = 0;
    try {
        const orgRes = await pool.query(`SELECT id FROM public.organizations LIMIT 1`);
        const orgId = orgRes.rows[0].id;
        
        const pRes = await pool.query(`
            INSERT INTO public.projects (organization_id, name, status)
            VALUES ($1, 'Client Action Test', 'active') RETURNING id
        `, [orgId]);
        const projectId = pRes.rows[0].id;

        const ruleRes = await pool.query(`
            INSERT INTO public.automation_rules (organization_id, project_id, name, trigger_event, conditions, actions, is_active)
            VALUES ($1, $2, 'RuleCA', 'test_event', '[]', '[{"type":"create_client_action", "title":"Upload Docs"}]', true)
            RETURNING id
        `, [orgId, projectId]);
        const ruleId = ruleRes.rows[0].id;

        await pool.query(`SELECT public.evaluate_automation_rules('test_event', $1, '{}')`, [projectId]);

        const actionRes = await pool.query(`SELECT * FROM public.tasks WHERE project_id = $1 AND responsibility_type = 'client'`, [projectId]);
        if (actionRes.rows.length === 1 && actionRes.rows[0].title === 'Upload Docs') {
            console.log("?\" PASS: Client Action successfully created via automation.");
        } else {
            console.error("?? FAIL: Client Action not created:", actionRes.rows);
            exitCode = 1;
        }

    } catch (e) {
        console.error("FATAL ERROR:", e);
        exitCode = 1;
    } finally {
        pool.end();
        process.exit(exitCode);
    }
}
run();
