const { Pool } = require('pg');
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
        const orgRes = await pool.query(`SELECT id FROM public.organizations LIMIT 1`);
        const orgId = orgRes.rows[0].id;
        testOrgId = orgId;
        
        await pool.query(`INSERT INTO public.business_holidays (organization_id, holiday_date, description) VALUES ($1, '2026-08-31', 'End of Summer')`, [orgId]);
        holidayCreated = true;
        
        const res = await pool.query(`SELECT public.add_business_days('2026-08-28 10:00:00+00'::timestamptz, 1, 'UTC', $1) as result`, [orgId]);
        const dt = new Date(res.rows[0].result);
        
        if (dt.getUTCDay() === 2 && dt.getUTCDate() === 1 && dt.getUTCMonth() === 8) {
            console.log("PASS: Skipped holiday and weekend correctly.");
        } else {
            console.error("FAIL: Did not skip holiday. Got:", dt.toISOString());
            exitCode = 1;
        }

        const pRes = await pool.query(`
            INSERT INTO public.projects (organization_id, name, status, created_at)
            VALUES ($1, 'SLA Breach Test', 'active', NOW() - INTERVAL '10 days') RETURNING id
        `, [orgId]);
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const uRes = await pool.query(`SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1`);
        const uId = uRes.rows[0].id;

        await pool.query(`
            INSERT INTO public.project_memberships (project_id, user_id, project_role)
            VALUES ($1, $2, 'pm')
        `, [projectId, uId]);

        await pool.query(`
            INSERT INTO public.sla_policies (organization_id, project_id, target_type, sla_duration_hours, is_business_time, warning_threshold_percent)
            VALUES ($1, $2, 'project', 24, false, 80)
        `, [orgId, projectId]);

        await pool.query(`SELECT public.evaluate_sla_breaches()`);

        const notifRes = await pool.query(`SELECT title, message FROM public.notifications WHERE project_id = $1`, [projectId]);
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
