const fs = require('fs');
const cp = require('child_process');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Rule Engine Test...");
    let exitCode = 0;
    try {
        const orgRes = await pool.query(`SELECT id FROM public.organizations LIMIT 1`);
        const orgId = orgRes.rows[0].id;
        
        const pRes = await pool.query(`
            INSERT INTO public.projects (organization_id, name, status)
            VALUES ($1, 'Rule Engine Test Project', 'active') RETURNING id
        `, [orgId]);
        const projectId = pRes.rows[0].id;

        const st1Res = await pool.query(`
            INSERT INTO public.project_stages (project_id, organization_id, name, sort_order, status)
            VALUES ($1, $2, 'Stage 1', 1, 'in_progress') RETURNING id
        `, [projectId, orgId]);
        const stage1Id = st1Res.rows[0].id;

        const st2Res = await pool.query(`
            INSERT INTO public.project_stages (project_id, organization_id, name, sort_order, status)
            VALUES ($1, $2, 'Stage 2', 2, 'not_started') RETURNING id
        `, [projectId, orgId]);
        const stage2Id = st2Res.rows[0].id;

        // Create automation rule: On Stage 1 completion, start Stage 2
        await pool.query(`
            INSERT INTO public.automation_rules (
                organization_id, project_id, name, trigger_event, conditions, actions, is_active
            ) VALUES (
                $1, $2, 'AutoStartStage2', 'stage_completed',
                '[{"field": "name", "operator": "eq", "value": "Stage 1"}]'::jsonb,
                '[{"type": "start_stage", "target_name": "Stage 2"}]'::jsonb,
                true
            )
        `, [orgId, projectId]);

        console.log("Testing Rule Execution...");
        // This should fire the trigger -> evaluate_automation_rules -> start Stage 2
        await pool.query(`SELECT public.workflow_transition_stage($1, 'completed')`, [stage1Id]);

        // Check Stage 2 status
        const s2StatusRes = await pool.query(`SELECT status, automation_status, transition_source FROM public.project_stages WHERE id = $1`, [stage2Id]);
        const s2 = s2StatusRes.rows[0];
        
        const dbRules = await pool.query(`SELECT * FROM public.automation_rules WHERE project_id = $1`, [projectId]);
        console.log("DB Rules:", dbRules.rows);

        if (s2.status === 'in_progress' && s2.transition_source === 'automation') {
            console.log("?\" PASS: Stage 2 automatically started by rule engine.");
        } else {
            console.error("?? FAIL: Stage 2 not started correctly:", s2);
            exitCode = 1;
        }

        // Check automation execution event log
        const logRes = await pool.query(`SELECT * FROM public.automation_execution_events WHERE project_id = $1`, [projectId]);
        console.log("DB Logs:", JSON.stringify(logRes.rows, null, 2));
        if (logRes.rows.length === 1) {
            console.log("?\" PASS: Append-only execution log recorded successfully.");
            
            // Test Idempotency
            await pool.query(`SELECT public.evaluate_automation_rules('stage_completed', $1, '{"stage_id":"${stage1Id}","name":"Stage 1"}'::jsonb)`, [projectId]);
            const logRes2 = await pool.query(`SELECT * FROM public.automation_execution_events WHERE project_id = $1 AND result = 'success'`, [projectId]);
            if (logRes2.rows.length === 1) {
                console.log("?\" PASS: Idempotency enforced (no duplicate action fired).");
            } else {
                console.error("?? FAIL: Idempotency failed, multiple logs found.");
                exitCode = 1;
            }
        } else {
            console.error("?? FAIL: Execution log missing or duplicated. Count:", logRes.rows.length);
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
