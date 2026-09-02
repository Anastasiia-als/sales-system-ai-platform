const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Exit Conditions Test...");
    let exitCode = 0;
    const createdProjectIds = [];
    try {
        const orgRes = await pool.query(`SELECT id FROM public.organizations LIMIT 1`);
        const orgId = orgRes.rows[0].id;
        
        const pRes = await pool.query(`
            INSERT INTO public.projects (organization_id, name, status)
            VALUES ($1, 'Exit Condition Test Project', 'active') RETURNING id
        `, [orgId]);
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const st1Res = await pool.query(`
            INSERT INTO public.project_stages (project_id, organization_id, name, sort_order, status)
            VALUES ($1, $2, 'Stage 1', 1, 'in_progress') RETURNING id
        `, [projectId, orgId]);
        const stage1Id = st1Res.rows[0].id;

        await pool.query(`
            INSERT INTO public.tasks (organization_id, project_id, stage_id, title, status, is_client_visible, responsibility_type)
            VALUES ($1, $2, $3, 'Required Task', 'todo', true, 'internal')
        `, [orgId, projectId, stage1Id]);

        console.log("Testing strict exit condition (incomplete tasks)...");
        let caught = false;
        try {
            await pool.query(`SELECT public.workflow_transition_stage($1, 'completed')`, [stage1Id]);
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

        await pool.query(`UPDATE public.tasks SET status = 'done' WHERE stage_id = $1`, [stage1Id]);

        await pool.query(`SELECT public.workflow_transition_stage($1, 'completed')`, [stage1Id]);
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
