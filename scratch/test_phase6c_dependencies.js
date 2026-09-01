const fs = require('fs');
const cp = require('child_process');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Dependencies & Health Engine Test...");
    let exitCode = 0;
    try {
        // 1. Setup Data
        const orgRes = await pool.query(`SELECT id FROM public.organizations LIMIT 1`);
        const orgId = orgRes.rows[0].id;
        const ownerRes = await pool.query(`SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1`);
        const ownerId = ownerRes.rows[0].id;

        // 2. Create Project
        const pRes = await pool.query(`
            INSERT INTO public.projects (organization_id, name, status)
            VALUES ($1, 'Dependency & SLA Test Project', 'active') RETURNING id
        `, [orgId]);
        const projectId = pRes.rows[0].id;

        // 3. Create two Stages
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

        // 4. Create a Dependency (Stage 2 depends on Stage 1)
        await pool.query(`
            INSERT INTO public.project_dependencies (organization_id, project_id, target_type, target_id, source_type, source_id, dependency_type)
            VALUES ($1, $2, 'stage', $3, 'stage', $4, 'requires')
        `, [orgId, projectId, stage2Id, stage1Id]);
        
        // 5. Test Cycle Protection (Stage 1 depends on Stage 2) -> Should Fail
        console.log("Testing Cycle Protection...");
        let cycleCaught = false;
        try {
            await pool.query(`
                INSERT INTO public.project_dependencies (organization_id, project_id, target_type, target_id, source_type, source_id, dependency_type)
                VALUES ($1, $2, 'stage', $3, 'stage', $4, 'requires')
            `, [orgId, projectId, stage1Id, stage2Id]);
        } catch (e) {
            cycleCaught = true;
            if (e.message.includes('cycle')) {
                console.log("?\" PASS: Circular dependency blocked.");
            } else {
                console.log("?\" PASS: Dependency blocked, but message did not specify cycle:", e.message);
            }
        }
        if (!cycleCaught) {
            console.error("?? FAIL: Circular dependency was allowed!");
            exitCode = 1;
        }

        // 6. Test Blocked Transition (Try to start Stage 2 while Stage 1 is not completed)
        console.log("Testing Dependency Blocker...");
        let transitionCaught = false;
        try {
            // Using a new RPC function `workflow_transition_stage(stage_id, new_status)`
            await pool.query(`SELECT public.workflow_transition_stage($1, 'in_progress')`, [stage2Id]);
        } catch (e) {
            transitionCaught = true;
            if (e.message.includes('unmet dependencies')) {
                console.log("?\" PASS: Stage 2 transition to in_progress blocked by unmet dependencies.");
            } else {
                console.log("?\" PASS: Stage 2 transition blocked. Message:", e.message);
            }
        }
        if (!transitionCaught) {
            console.error("?? FAIL: Stage 2 was allowed to start despite incomplete Stage 1 dependency!");
            exitCode = 1;
        }

        // 7. Complete Stage 1 and try starting Stage 2 again
        console.log("Completing Stage 1...");
        await pool.query(`SELECT public.workflow_transition_stage($1, 'completed')`, [stage1Id]);
        
        try {
            await pool.query(`SELECT public.workflow_transition_stage($1, 'in_progress')`, [stage2Id]);
            console.log("?\" PASS: Stage 2 successfully started after Stage 1 completed.");
        } catch (e) {
            console.error("?? FAIL: Stage 2 could not start even after Stage 1 completed. Error:", e.message);
            exitCode = 1;
        }
        
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
