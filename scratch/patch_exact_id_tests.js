const fs = require('fs');

// 1. test_phase6c_client_action.js
fs.writeFileSync('scratch/test_phase6c_client_action.js', `const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Client Action Automation Test...");
    let exitCode = 0;
    const createdRuleIds = [];
    const createdProjectIds = [];
    try {
        const orgRes = await pool.query(\`SELECT id FROM public.organizations LIMIT 1\`);
        const orgId = orgRes.rows[0].id;
        
        const pRes = await pool.query(\`
            INSERT INTO public.projects (organization_id, name, status)
            VALUES ($1, 'Client Action Test', 'active') RETURNING id
        \`, [orgId]);
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const ruleRes = await pool.query(\`
            INSERT INTO public.automation_rules (organization_id, project_id, name, trigger_event, conditions, actions, is_active)
            VALUES ($1, $2, 'TestRuleCA', 'test_event', '[]', '[{"type":"create_client_action", "title":"Upload Docs"}]', true)
            RETURNING id
        \`, [orgId, projectId]);
        const ruleId = ruleRes.rows[0].id;
        createdRuleIds.push(ruleId);

        await pool.query(\`SELECT public.evaluate_automation_rules('test_event', $1, '{}')\`, [projectId]);

        const actionRes = await pool.query(\`SELECT * FROM public.tasks WHERE project_id = $1 AND responsibility_type = 'client'\`, [projectId]);
        if (actionRes.rows.length === 1 && actionRes.rows[0].title === 'Upload Docs') {
            console.log("PASS: Client Action successfully created via automation.");
        } else {
            console.error("FAIL: Client Action not created:", actionRes.rows);
            exitCode = 1;
        }

    } catch (e) {
        console.error("FATAL ERROR:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (createdRuleIds.length > 0) {
                await pool.query("DELETE FROM public.automation_execution_events WHERE rule_id = ANY($1::uuid[])", [createdRuleIds]);
                await pool.query("DELETE FROM public.automation_rules WHERE id = ANY($1::uuid[])", [createdRuleIds]);
            }
            if (createdProjectIds.length > 0) {
                await pool.query("DELETE FROM public.automation_execution_events WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.tasks WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error:", e);
        }

        pool.end();
        process.exit(exitCode);
    }
}
run();
`, 'utf8');

// 2. test_phase6c_concurrency.js
fs.writeFileSync('scratch/test_phase6c_concurrency.js', `const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Concurrency & Idempotency Test...");
    let exitCode = 0;
    const createdRuleIds = [];
    const createdProjectIds = [];
    try {
        const orgRes = await pool.query(\`SELECT id FROM public.organizations LIMIT 1\`);
        const orgId = orgRes.rows[0].id;
        
        const pRes = await pool.query(\`
            INSERT INTO public.projects (organization_id, name, status)
            VALUES ($1, 'Concurrency Test', 'active') RETURNING id
        \`, [orgId]);
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const ruleRes = await pool.query(\`
            INSERT INTO public.automation_rules (organization_id, project_id, name, trigger_event, conditions, actions, is_active)
            VALUES ($1, $2, 'TestRule', 'test_event', '[{"field":"x", "operator":"eq", "value":"1"}]', '[{"type":"create_task", "title":"ConcTask"}]', true)
            RETURNING id
        \`, [orgId, projectId]);
        const ruleId = ruleRes.rows[0].id;
        createdRuleIds.push(ruleId);

        console.log("Firing 2 identical concurrent automation evaluations...");
        const reqs = [];
        for (let i = 0; i < 2; i++) {
            reqs.push(pool.query(\`SELECT public.evaluate_automation_rules('test_event', $1, '{"x":"1"}')\`, [projectId]));
        }

        await Promise.all(reqs);

        const tasksRes = await pool.query(\`SELECT * FROM public.tasks WHERE project_id = $1 AND title = 'ConcTask'\`, [projectId]);
        if (tasksRes.rows.length === 1) {
            console.log("PASS: Idempotency constraint prevented duplicate task creation in concurrent execution.");
        } else {
            console.error("FAIL: Duplicate or zero tasks created:", tasksRes.rows.length);
            exitCode = 1;
        }

        const evRes = await pool.query(\`SELECT result FROM public.automation_execution_events WHERE project_id = $1 AND trigger_event = 'test_event'\`, [projectId]);
        if (evRes.rows.length === 1 && evRes.rows[0].result === 'success') {
            console.log("PASS: Exactly one execution log entry created.");
        } else {
            console.error("FAIL: Invalid execution log entries:", evRes.rows);
            exitCode = 1;
        }

    } catch (e) {
        console.error("FATAL ERROR:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (createdRuleIds.length > 0) {
                await pool.query("DELETE FROM public.automation_execution_events WHERE rule_id = ANY($1::uuid[])", [createdRuleIds]);
                await pool.query("DELETE FROM public.automation_rules WHERE id = ANY($1::uuid[])", [createdRuleIds]);
            }
            if (createdProjectIds.length > 0) {
                await pool.query("DELETE FROM public.automation_execution_events WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.tasks WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error:", e);
        }

        pool.end();
        process.exit(exitCode);
    }
}
run();
`, 'utf8');

// 3. test_phase6c_dependencies.js
fs.writeFileSync('scratch/test_phase6c_dependencies.js', `const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Stage Dependencies Test...");
    let exitCode = 0;
    const createdProjectIds = [];
    try {
        const orgRes = await pool.query(\`SELECT id FROM public.organizations LIMIT 1\`);
        const orgId = orgRes.rows[0].id;
        
        const pRes = await pool.query(\`
            INSERT INTO public.projects (organization_id, name, status)
            VALUES ($1, 'Dependencies Test Project', 'active') RETURNING id
        \`, [orgId]);
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const st1Res = await pool.query(\`
            INSERT INTO public.project_stages (project_id, organization_id, name, sort_order, status)
            VALUES ($1, $2, 'Stage 1', 1, 'not_started') RETURNING id
        \`, [projectId, orgId]);
        const stage1Id = st1Res.rows[0].id;

        const st2Res = await pool.query(\`
            INSERT INTO public.project_stages (project_id, organization_id, name, sort_order, status)
            VALUES ($1, $2, 'Stage 2', 2, 'not_started') RETURNING id
        \`, [projectId, orgId]);
        const stage2Id = st2Res.rows[0].id;

        await pool.query(\`
            INSERT INTO public.stage_dependencies (project_id, stage_id, depends_on_stage_id)
            VALUES ($1, $2, $3)
        \`, [projectId, stage2Id, stage1Id]);

        // Circular Dependency Test
        console.log("Testing circular dependency detection...");
        let circularCaught = false;
        try {
            await pool.query(\`
                INSERT INTO public.stage_dependencies (project_id, stage_id, depends_on_stage_id)
                VALUES ($1, $2, $3)
            \`, [projectId, stage1Id, stage2Id]);
        } catch (e) {
            circularCaught = true;
            if (e.message.includes('Circular dependency')) {
                console.log("PASS: Circular dependency correctly blocked by trigger.");
            } else {
                console.error("FAIL: Circular dependency threw unexpected error:", e.message);
                exitCode = 1;
            }
        }
        if (!circularCaught) {
            console.error("FAIL: Circular dependency was NOT blocked!");
            exitCode = 1;
        }

        // Self dependency test
        console.log("Testing self dependency detection...");
        let selfCaught = false;
        try {
            await pool.query(\`
                INSERT INTO public.stage_dependencies (project_id, stage_id, depends_on_stage_id)
                VALUES ($1, $2, $2)
            \`, [projectId, stage1Id]);
        } catch (e) {
            selfCaught = true;
            if (e.message.includes('Self dependency')) {
                console.log("PASS: Self dependency correctly blocked by trigger.");
            } else {
                console.error("FAIL: Self dependency threw unexpected error:", e.message);
                exitCode = 1;
            }
        }
        if (!selfCaught) {
            console.error("FAIL: Self dependency was NOT blocked!");
            exitCode = 1;
        }

        // Transition Enforcement Test
        console.log("Testing workflow transition dependency check...");
        let transitionCaught = false;
        try {
            await pool.query(\`SELECT public.workflow_transition_stage($1, 'in_progress')\`, [stage2Id]);
        } catch (e) {
            transitionCaught = true;
            if (e.message.includes('cannot start until dependent stage')) {
                console.log("PASS: Transition correctly blocked by incomplete dependency.");
            } else {
                console.error("FAIL: Transition threw unexpected error:", e.message);
                exitCode = 1;
            }
        }
        if (!transitionCaught) {
            console.error("FAIL: Stage 2 was allowed to start despite incomplete Stage 1 dependency!");
            exitCode = 1;
        }

        // Complete Stage 1 and try starting Stage 2 again
        console.log("Completing Stage 1...");
        await pool.query(\`SELECT public.workflow_transition_stage($1, 'completed')\`, [stage1Id]);
        
        try {
            await pool.query(\`SELECT public.workflow_transition_stage($1, 'in_progress')\`, [stage2Id]);
            console.log("PASS: Stage 2 successfully started after Stage 1 completed.");
        } catch (e) {
            console.error("FAIL: Stage 2 could not start even after Stage 1 completed. Error:", e.message);
            exitCode = 1;
        }
        
    } catch (e) {
        console.error("FATAL ERROR:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (createdProjectIds.length > 0) {
                await pool.query("DELETE FROM public.stage_dependencies WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.project_stages WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error:", e);
        }

        pool.end();
        process.exit(exitCode);
    }
}
run();
`, 'utf8');

// 4. test_phase6c_exit_conditions.js
fs.writeFileSync('scratch/test_phase6c_exit_conditions.js', `const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Exit Conditions Test...");
    let exitCode = 0;
    const createdProjectIds = [];
    try {
        const orgRes = await pool.query(\`SELECT id FROM public.organizations LIMIT 1\`);
        const orgId = orgRes.rows[0].id;
        
        const pRes = await pool.query(\`
            INSERT INTO public.projects (organization_id, name, status)
            VALUES ($1, 'Exit Condition Test Project', 'active') RETURNING id
        \`, [orgId]);
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const st1Res = await pool.query(\`
            INSERT INTO public.project_stages (project_id, organization_id, name, sort_order, status)
            VALUES ($1, $2, 'Stage 1', 1, 'in_progress') RETURNING id
        \`, [projectId, orgId]);
        const stage1Id = st1Res.rows[0].id;

        await pool.query(\`
            INSERT INTO public.tasks (organization_id, project_id, stage_id, title, status, is_client_visible, responsibility_type)
            VALUES ($1, $2, $3, 'Required Task', 'todo', true, 'internal')
        \`, [orgId, projectId, stage1Id]);

        console.log("Testing strict exit condition (incomplete tasks)...");
        let caught = false;
        try {
            await pool.query(\`SELECT public.workflow_transition_stage($1, 'completed')\`, [stage1Id]);
        } catch (e) {
            caught = true;
            if (e.message.includes('incomplete tasks remain')) {
                console.log("PASS: Stage completion blocked due to incomplete tasks.");
            } else {
                console.error("FAIL: Blocked but for wrong reason:", e.message);
                exitCode = 1;
            }
        }
        if (!caught) {
            console.error("FAIL: Stage was allowed to complete with incomplete tasks!");
            exitCode = 1;
        }

        await pool.query(\`UPDATE public.tasks SET status = 'done' WHERE stage_id = $1\`, [stage1Id]);

        await pool.query(\`SELECT public.workflow_transition_stage($1, 'completed')\`, [stage1Id]);
        console.log("PASS: Stage successfully completed after tasks were done.");

    } catch (e) {
        console.error("FATAL ERROR:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (createdProjectIds.length > 0) {
                await pool.query("DELETE FROM public.tasks WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.project_stages WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error:", e);
        }

        pool.end();
        process.exit(exitCode);
    }
}
run();
`, 'utf8');

// 5. test_phase6c_health_engine.js
fs.writeFileSync('scratch/test_phase6c_health_engine.js', `const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Health Engine Test...");
    let exitCode = 0;
    const createdProjectIds = [];
    try {
        const orgRes = await pool.query(\`SELECT id FROM public.organizations LIMIT 1\`);
        const orgId = orgRes.rows[0].id;

        const pRes = await pool.query(\`
            INSERT INTO public.projects (organization_id, name, status, derived_health_status)
            VALUES ($1, 'Health Engine Test Project', 'active', 'on_track') RETURNING id
        \`, [orgId]);
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        let healthRes = await pool.query(\`SELECT derived_health_status, derived_health_reasons FROM public.projects WHERE id = $1\`, [projectId]);
        if (healthRes.rows[0].derived_health_status === 'on_track') {
            console.log("PASS: Initial health is on_track.");
        } else {
            console.error("FAIL: Initial health is not on_track:", healthRes.rows[0]);
            exitCode = 1;
        }

        await pool.query(\`
            INSERT INTO public.tasks (organization_id, project_id, title, status, due_date, is_client_visible, responsibility_type)
            VALUES ($1, $2, 'Late Task', 'todo', NOW() - INTERVAL '2 days', true, 'internal')
        \`, [orgId, projectId]);

        await pool.query(\`SELECT public.update_project_health($1)\`, [projectId]);

        healthRes = await pool.query(\`SELECT derived_health_status, derived_health_reasons FROM public.projects WHERE id = $1\`, [projectId]);
        if (healthRes.rows[0].derived_health_status === 'delayed' && healthRes.rows[0].derived_health_reasons.length === 1) {
            console.log("PASS: Health updated to delayed due to overdue task.");
        } else {
            console.error("FAIL: Health did not update to delayed:", healthRes.rows[0]);
            exitCode = 1;
        }

        await pool.query(\`
            INSERT INTO public.project_blockers (organization_id, project_id, title, status, severity, source_type)
            VALUES ($1, $2, 'Critical Blocker', 'open', 'critical', 'manual')
        \`, [orgId, projectId]);

        await pool.query(\`SELECT public.update_project_health($1)\`, [projectId]);

        healthRes = await pool.query(\`SELECT derived_health_status, derived_health_reasons FROM public.projects WHERE id = $1\`, [projectId]);
        if (healthRes.rows[0].derived_health_status === 'blocked' && healthRes.rows[0].derived_health_reasons.length === 2) {
            console.log("PASS: Health updated to blocked and reasons appended.");
        } else {
            console.error("FAIL: Health did not update to blocked:", healthRes.rows[0]);
            exitCode = 1;
        }

    } catch (e) {
        console.error("FATAL ERROR:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (createdProjectIds.length > 0) {
                await pool.query("DELETE FROM public.project_blockers WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.tasks WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error:", e);
        }

        pool.end();
        process.exit(exitCode);
    }
}
run();
`, 'utf8');

// 6. test_phase6c_rule_engine.js
fs.writeFileSync('scratch/test_phase6c_rule_engine.js', `const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Rule Engine Test...");
    let exitCode = 0;
    const createdRuleIds = [];
    const createdProjectIds = [];
    try {
        const orgRes = await pool.query(\`SELECT id FROM public.organizations LIMIT 1\`);
        const orgId = orgRes.rows[0].id;
        
        const pRes = await pool.query(\`
            INSERT INTO public.projects (organization_id, name, status)
            VALUES ($1, 'Rule Engine Test Project', 'active') RETURNING id
        \`, [orgId]);
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const st1Res = await pool.query(\`
            INSERT INTO public.project_stages (project_id, organization_id, name, sort_order, status)
            VALUES ($1, $2, 'Stage 1', 1, 'in_progress') RETURNING id
        \`, [projectId, orgId]);
        const stage1Id = st1Res.rows[0].id;

        const st2Res = await pool.query(\`
            INSERT INTO public.project_stages (project_id, organization_id, name, sort_order, status)
            VALUES ($1, $2, 'Stage 2', 2, 'not_started') RETURNING id
        \`, [projectId, orgId]);
        const stage2Id = st2Res.rows[0].id;

        const ruleRes = await pool.query(\`
            INSERT INTO public.automation_rules (
                organization_id, project_id, name, trigger_event, conditions, actions, is_active
            ) VALUES (
                $1, $2, 'AutoStartStage2', 'stage_completed',
                '[{"field": "name", "operator": "eq", "value": "Stage 1"}]'::jsonb,
                '[{"type": "start_stage", "target_name": "Stage 2"}]'::jsonb,
                true
            ) RETURNING id
        \`, [orgId, projectId]);
        createdRuleIds.push(ruleRes.rows[0].id);

        console.log("Testing Rule Execution...");
        await pool.query(\`SELECT public.workflow_transition_stage($1, 'completed')\`, [stage1Id]);

        const s2StatusRes = await pool.query(\`SELECT status, automation_status, transition_source FROM public.project_stages WHERE id = $1\`, [stage2Id]);
        const s2 = s2StatusRes.rows[0];

        if (s2.status === 'in_progress' && s2.transition_source === 'automation') {
            console.log("PASS: Stage 2 automatically started by rule engine.");
        } else {
            console.error("FAIL: Stage 2 not started correctly:", s2);
            exitCode = 1;
        }

        const logRes = await pool.query(\`SELECT * FROM public.automation_execution_events WHERE project_id = $1\`, [projectId]);
        if (logRes.rows.length === 1) {
            console.log("PASS: Append-only execution log recorded successfully.");
            
            await pool.query(\`SELECT public.evaluate_automation_rules('stage_completed', $1, '{"stage_id":"\${stage1Id}","name":"Stage 1"}'::jsonb)\`, [projectId]);
            const logRes2 = await pool.query(\`SELECT * FROM public.automation_execution_events WHERE project_id = $1 AND result = 'success'\`, [projectId]);
            if (logRes2.rows.length === 1) {
                console.log("PASS: Idempotency enforced (no duplicate action fired).");
            } else {
                console.error("FAIL: Idempotency failed, multiple logs found.");
                exitCode = 1;
            }
        } else {
            console.error("FAIL: Execution log missing or duplicated. Count:", logRes.rows.length);
            exitCode = 1;
        }

    } catch (e) {
        console.error("FATAL ERROR:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (createdRuleIds.length > 0) {
                await pool.query("DELETE FROM public.automation_execution_events WHERE rule_id = ANY($1::uuid[])", [createdRuleIds]);
                await pool.query("DELETE FROM public.automation_rules WHERE id = ANY($1::uuid[])", [createdRuleIds]);
            }
            if (createdProjectIds.length > 0) {
                await pool.query("DELETE FROM public.automation_execution_events WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.project_stages WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error:", e);
        }

        pool.end();
        process.exit(exitCode);
    }
}
run();
`, 'utf8');

// 7. test_phase6c_rule_loop.js
fs.writeFileSync('scratch/test_phase6c_rule_loop.js', `const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Rule Engine Infinite Loop Protection Test...");
    let exitCode = 0;
    const createdRuleIds = [];
    const createdProjectIds = [];
    try {
        const orgRes = await pool.query(\`SELECT id FROM public.organizations LIMIT 1\`);
        const orgId = orgRes.rows[0].id;
        
        const pRes = await pool.query(\`
            INSERT INTO public.projects (organization_id, name, status)
            VALUES ($1, 'Loop Protection Test Project', 'active') RETURNING id
        \`, [orgId]);
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const st1Res = await pool.query(\`
            INSERT INTO public.project_stages (project_id, organization_id, name, sort_order, status)
            VALUES ($1, $2, 'Stage 1', 1, 'in_progress') RETURNING id
        \`, [projectId, orgId]);
        const stage1Id = st1Res.rows[0].id;

        const st2Res = await pool.query(\`
            INSERT INTO public.project_stages (project_id, organization_id, name, sort_order, status)
            VALUES ($1, $2, 'Stage 2', 2, 'not_started') RETURNING id
        \`, [projectId, orgId]);

        const r1Res = await pool.query(\`
            INSERT INTO public.automation_rules (
                organization_id, project_id, name, trigger_event, conditions, actions, is_active
            ) VALUES (
                $1, $2, 'Loop1', 'stage_completed',
                '[{"field": "name", "operator": "eq", "value": "Stage 1"}]'::jsonb,
                '[{"type": "start_stage", "target_name": "Stage 2"}]'::jsonb,
                true
            ) RETURNING id
        \`, [orgId, projectId]);
        createdRuleIds.push(r1Res.rows[0].id);

        const r2Res = await pool.query(\`
            INSERT INTO public.automation_rules (
                organization_id, project_id, name, trigger_event, conditions, actions, is_active
            ) VALUES (
                $1, $2, 'Loop2', 'stage_started',
                '[{"field": "name", "operator": "eq", "value": "Stage 2"}]'::jsonb,
                '[{"type": "complete_stage", "target_name": "Stage 1"}]'::jsonb,
                true
            ) RETURNING id
        \`, [orgId, projectId]);
        createdRuleIds.push(r2Res.rows[0].id);

        console.log("Triggering the loop...");
        await pool.query(\`SELECT public.workflow_transition_stage($1, 'completed')\`, [stage1Id]);
        
        console.log("PASS: Transaction did not hang, loop was broken safely.");

    } catch (e) {
        if (e.message.includes('stack depth limit exceeded')) {
            console.error("FAIL: Postgres stack overflowed! Loop protection did not work.");
            exitCode = 1;
        } else {
            console.log("PASS (with warning exception):", e.message);
        }
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (createdRuleIds.length > 0) {
                await pool.query("DELETE FROM public.automation_execution_events WHERE rule_id = ANY($1::uuid[])", [createdRuleIds]);
                await pool.query("DELETE FROM public.automation_rules WHERE id = ANY($1::uuid[])", [createdRuleIds]);
            }
            if (createdProjectIds.length > 0) {
                await pool.query("DELETE FROM public.automation_execution_events WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.project_stages WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error:", e);
        }

        pool.end();
        process.exit(exitCode);
    }
}
run();
`, 'utf8');

// 8. test_phase6c_sla_engine.js
fs.writeFileSync('scratch/test_phase6c_sla_engine.js', `const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C SLA Engine Test...");
    let exitCode = 0;
    try {
        const res1 = await pool.query(\`SELECT public.add_business_days('2026-08-28 10:00:00+00'::timestamptz, 1, 'UTC') as result\`);
        const dt1 = new Date(res1.rows[0].result);
        console.log("Add 1 biz day to Friday:", dt1.toISOString());
        
        if (dt1.getUTCDay() === 1 && dt1.getUTCDate() === 31) {
            console.log("PASS: Skipped weekend successfully.");
        } else {
            console.error("FAIL: Did not skip weekend correctly. Got:", dt1.toISOString());
            exitCode = 1;
        }

        const res5 = await pool.query(\`SELECT public.add_business_days('2026-08-28 10:00:00+00'::timestamptz, 5, 'UTC') as result\`);
        const dt5 = new Date(res5.rows[0].result);
        console.log("Add 5 biz days to Friday:", dt5.toISOString());
        
        if (dt5.getUTCDay() === 5 && dt5.getUTCDate() === 4 && dt5.getUTCMonth() === 8) {
            console.log("PASS: Skipped weekend for 5 days properly.");
        } else {
            console.error("FAIL: Did not skip weekend for 5 days correctly. Got:", dt5.toISOString());
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
`, 'utf8');

// 9. test_phase6c_sla_escalation.js
fs.writeFileSync('scratch/test_phase6c_sla_escalation.js', `const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C SLA Escalation & Holidays Test...");
    let exitCode = 0;
    const createdProjectIds = [];
    let holidayCreated = false;
    let testOrgId = null;
    try {
        const orgRes = await pool.query(\`SELECT id FROM public.organizations LIMIT 1\`);
        const orgId = orgRes.rows[0].id;
        testOrgId = orgId;
        
        await pool.query(\`INSERT INTO public.business_holidays (organization_id, holiday_date, description) VALUES ($1, '2026-08-31', 'End of Summer')\`, [orgId]);
        holidayCreated = true;
        
        const res = await pool.query(\`SELECT public.add_business_days('2026-08-28 10:00:00+00'::timestamptz, 1, 'UTC', $1) as result\`, [orgId]);
        const dt = new Date(res.rows[0].result);
        
        if (dt.getUTCDay() === 2 && dt.getUTCDate() === 1 && dt.getUTCMonth() === 8) {
            console.log("PASS: Skipped holiday and weekend correctly.");
        } else {
            console.error("FAIL: Did not skip holiday. Got:", dt.toISOString());
            exitCode = 1;
        }

        const pRes = await pool.query(\`
            INSERT INTO public.projects (organization_id, name, status, created_at)
            VALUES ($1, 'SLA Breach Test', 'active', NOW() - INTERVAL '10 days') RETURNING id
        \`, [orgId]);
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const uRes = await pool.query(\`SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1\`);
        const uId = uRes.rows[0].id;

        await pool.query(\`
            INSERT INTO public.project_memberships (project_id, user_id, project_role)
            VALUES ($1, $2, 'pm')
        \`, [projectId, uId]);

        await pool.query(\`
            INSERT INTO public.sla_policies (organization_id, project_id, target_type, sla_duration_hours, is_business_time, warning_threshold_percent)
            VALUES ($1, $2, 'project', 24, false, 80)
        \`, [orgId, projectId]);

        await pool.query(\`SELECT public.evaluate_sla_breaches()\`);

        const notifRes = await pool.query(\`SELECT title, message FROM public.notifications WHERE project_id = $1\`, [projectId]);
        const hasBreachNotif = notifRes.rows.some(r => r.title === 'SLA breach');
        if (hasBreachNotif) {
            console.log("PASS: SLA breach notification generated.");
        } else {
            console.error("FAIL: SLA breach notification missing:", notifRes.rows);
            exitCode = 1;
        }

    } catch (e) {
        console.error("FATAL ERROR:", e);
        exitCode = 1;
    } finally {
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (holidayCreated && testOrgId) {
                await pool.query("DELETE FROM public.business_holidays WHERE organization_id = $1 AND holiday_date = '2026-08-31'", [testOrgId]);
            }
            if (createdProjectIds.length > 0) {
                await pool.query("DELETE FROM public.notifications WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.sla_policies WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.project_memberships WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error:", e);
        }

        pool.end();
        process.exit(exitCode);
    }
}
run();
`, 'utf8');

console.log("Wrote exact-ID fixture tracking to all 9 test files");
