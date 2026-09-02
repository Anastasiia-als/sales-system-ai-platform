const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Stage Dependencies Test...");
    let exitCode = 0;
    const createdProjectIds = [];
    try {
        const orgRes = await pool.query(`SELECT id FROM public.organizations LIMIT 1`);
        const orgId = orgRes.rows[0].id;
        
        const pRes = await pool.query(`
            INSERT INTO public.projects (organization_id, name, status)
            VALUES ($1, 'Dependencies Test Project', 'active') RETURNING id
        `, [orgId]);
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const st1Res = await pool.query(`
            INSERT INTO public.project_stages (project_id, organization_id, name, sort_order, status)
            VALUES ($1, $2, 'Stage 1', 1, 'not_started') RETURNING id
        `, [projectId, orgId]);
        const stage1Id = st1Res.rows[0].id;

        const st2Res = await pool.query(`
            INSERT INTO public.project_stages (project_id, organization_id, name, sort_order, status)
            VALUES ($1, $2, 'Stage 2', 2, 'not_started') RETURNING id
        `, [projectId, orgId]);
        const stage2Id = st2Res.rows[0].id;

        // Stage 2 depends on Stage 1 (target = Stage 2, source = Stage 1)
        await pool.query(`
            INSERT INTO public.project_dependencies (organization_id, project_id, target_type, target_id, source_type, source_id, dependency_type)
            VALUES ($1, $2, 'stage', $3, 'stage', $4, 'requires')
        `, [orgId, projectId, stage2Id, stage1Id]);

        // Circular Dependency Test (Stage 1 depends on Stage 2)
        console.log("Testing circular dependency detection...");
        let circularCaught = false;
        try {
            await pool.query(`
                INSERT INTO public.project_dependencies (organization_id, project_id, target_type, target_id, source_type, source_id, dependency_type)
                VALUES ($1, $2, 'stage', $3, 'stage', $4, 'requires')
            `, [orgId, projectId, stage1Id, stage2Id]);
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

        // Self dependency test (Stage 1 depends on Stage 1)
        console.log("Testing self dependency detection...");
        let selfCaught = false;
        try {
            await pool.query(`
                INSERT INTO public.project_dependencies (organization_id, project_id, target_type, target_id, source_type, source_id, dependency_type)
                VALUES ($1, $2, 'stage', $3, 'stage', $4, 'requires')
            `, [orgId, projectId, stage1Id, stage1Id]);
        } catch (e) {
            selfCaught = true;
            if (e.message.includes('Circular dependency') || e.message.includes('Self dependency') || e.message.includes('cycle')) {
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

        // Transition Enforcement Test: Stage 2 cannot start while Stage 1 is not_started
        console.log("Testing workflow transition dependency check...");
        let transitionCaught = false;
        try {
            await pool.query(`SELECT public.workflow_transition_stage($1, 'in_progress')`, [stage2Id]);
        } catch (e) {
            transitionCaught = true;
            if (e.message.includes('unmet dependencies exist')) {
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
        await pool.query(`SELECT public.workflow_transition_stage($1, 'completed')`, [stage1Id]);
        
        try {
            await pool.query(`SELECT public.workflow_transition_stage($1, 'in_progress')`, [stage2Id]);
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
                await pool.query("DELETE FROM public.project_dependencies WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
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
