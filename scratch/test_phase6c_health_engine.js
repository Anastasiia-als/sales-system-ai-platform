const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Health Engine Test...");
    let exitCode = 0;
    const createdProjectIds = [];
    try {
        const orgRes = await pool.query(`SELECT id FROM public.organizations LIMIT 1`);
        const orgId = orgRes.rows[0].id;

        const pRes = await pool.query(`
            INSERT INTO public.projects (organization_id, name, status, derived_health_status)
            VALUES ($1, 'Health Engine Test Project', 'active', 'on_track') RETURNING id
        `, [orgId]);
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        let healthRes = await pool.query(`SELECT derived_health_status, derived_health_reasons FROM public.projects WHERE id = $1`, [projectId]);
        if (healthRes.rows[0].derived_health_status === 'on_track') {
            console.log("PASS: Initial health is on_track.");
        } else {
            console.error("FAIL: Initial health is not on_track:", healthRes.rows[0]);
            exitCode = 1;
        }

        await pool.query(`
            INSERT INTO public.tasks (organization_id, project_id, title, status, due_date, is_client_visible, responsibility_type)
            VALUES ($1, $2, 'Late Task', 'todo', NOW() - INTERVAL '2 days', true, 'internal')
        `, [orgId, projectId]);

        await pool.query(`SELECT public.update_project_health($1)`, [projectId]);

        healthRes = await pool.query(`SELECT derived_health_status, derived_health_reasons FROM public.projects WHERE id = $1`, [projectId]);
        if (healthRes.rows[0].derived_health_status === 'delayed' && healthRes.rows[0].derived_health_reasons.length === 1) {
            console.log("PASS: Health updated to delayed due to overdue task.");
        } else {
            console.error("FAIL: Health did not update to delayed:", healthRes.rows[0]);
            exitCode = 1;
        }

        await pool.query(`
            INSERT INTO public.project_blockers (organization_id, project_id, title, status, severity, source_type)
            VALUES ($1, $2, 'Critical Blocker', 'open', 'critical', 'manual')
        `, [orgId, projectId]);

        await pool.query(`SELECT public.update_project_health($1)`, [projectId]);

        healthRes = await pool.query(`SELECT derived_health_status, derived_health_reasons FROM public.projects WHERE id = $1`, [projectId]);
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
