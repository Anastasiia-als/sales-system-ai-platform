const fs = require('fs');
const cp = require('child_process');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("Starting Phase 6C Health Engine Test...");
    let exitCode = 0;
    try {
        const orgRes = await pool.query(`SELECT id FROM public.organizations LIMIT 1`);
        const orgId = orgRes.rows[0].id;
        
        const ownerRes = await pool.query(`SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1`);
        const ownerId = ownerRes.rows[0].id;

        const pRes = await pool.query(`
            INSERT INTO public.projects (organization_id, name, status, derived_health_status)
            VALUES ($1, 'Health Engine Test Project', 'active', 'on_track') RETURNING id
        `, [orgId]);
        const projectId = pRes.rows[0].id;

        // 1. Initial State
        let healthRes = await pool.query(`SELECT derived_health_status, derived_health_reasons FROM public.projects WHERE id = $1`, [projectId]);
        if (healthRes.rows[0].derived_health_status === 'on_track') {
            console.log("?\" PASS: Initial health is on_track.");
        } else {
            console.error("?? FAIL: Initial health is not on_track:", healthRes.rows[0]);
            exitCode = 1;
        }

        // 2. Add an overdue task
        await pool.query(`
            INSERT INTO public.tasks (organization_id, project_id, title, status, due_date, is_client_visible, responsibility_type)
            VALUES ($1, $2, 'Late Task', 'todo', NOW() - INTERVAL '2 days', true, 'internal')
        `, [orgId, projectId]);

        await pool.query(`SELECT public.update_project_health($1)`, [projectId]);

        healthRes = await pool.query(`SELECT derived_health_status, derived_health_reasons FROM public.projects WHERE id = $1`, [projectId]);
        if (healthRes.rows[0].derived_health_status === 'delayed' && healthRes.rows[0].derived_health_reasons.length === 1) {
            console.log("?\" PASS: Health updated to delayed due to overdue task.");
        } else {
            console.error("?? FAIL: Health did not update to delayed:", healthRes.rows[0]);
            exitCode = 1;
        }

        // 3. Add an open blocker
        await pool.query(`
            INSERT INTO public.project_blockers (organization_id, project_id, title, status, severity, source_type)
            VALUES ($1, $2, 'Critical Blocker', 'open', 'critical', 'manual')
        `, [orgId, projectId]);

        await pool.query(`SELECT public.update_project_health($1)`, [projectId]);

        healthRes = await pool.query(`SELECT derived_health_status, derived_health_reasons FROM public.projects WHERE id = $1`, [projectId]);
        if (healthRes.rows[0].derived_health_status === 'blocked' && healthRes.rows[0].derived_health_reasons.length === 2) {
            console.log("?\" PASS: Health updated to blocked and reasons appended.");
        } else {
            console.error("?? FAIL: Health did not update to blocked:", healthRes.rows[0]);
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
