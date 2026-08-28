const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    await client.connect();
    
    try {
        await client.query("BEGIN");
        await client.query("SET LOCAL role TO authenticated");
        await client.query("SET LOCAL request.jwt.claims TO '{\"sub\":\"27852879-0d5f-4c72-889d-69a0989302d2\"}'");

        // Get template and version
        const vRes = await client.query(`SELECT v.id, t.id as t_id FROM public.template_versions v JOIN public.project_templates t ON v.template_id = t.id WHERE t.name = 'Sales Department Audit' LIMIT 1`);
        const vId = vRes.rows[0].id;

        // Get an org
        const orgRes = await client.query(`SELECT id FROM public.organizations WHERE name LIKE '%Test Org Alpha%' LIMIT 1`);
        const orgId = orgRes.rows[0].id;

        // Get PM
        const pmRes = await client.query(`SELECT user_id FROM public.organization_memberships WHERE organization_id = $1 AND org_role = 'pm' LIMIT 1`, [orgId]);
        const pmId = pmRes.rows[0].user_id;

        const payload = {
            p_template_version_id: vId,
            p_organization_id: orgId,
            p_name: "Audit Generated Project " + Date.now(),
            p_project_type: 'consulting',
            p_start_date: '2026-09-01',
            p_target_date: '2026-09-30',
            p_team_assignments: { "pm": pmId },
            p_commercials: { "currency": "UAH", "contract_value": 5000000 },
            p_idempotency_key: "idem-" + Date.now()
        };

        const res = await client.query(`
            SELECT create_project_from_template($1, $2, $3, $4, $5, $6, $7, $8, $9) AS result
        `, [
            payload.p_template_version_id, payload.p_organization_id, payload.p_name, payload.p_project_type, 
            payload.p_start_date, payload.p_target_date, payload.p_team_assignments, payload.p_commercials, payload.p_idempotency_key
        ]);

        console.log("Materialization Output:", JSON.stringify(res.rows[0].result, null, 2));

        const projId = res.rows[0].result.project_id;
        
        const counts = await Promise.all([
            client.query('SELECT count(*) FROM public.project_stages WHERE project_id = $1', [projId]),
            client.query('SELECT count(*) FROM public.milestones WHERE project_id = $1', [projId]),
            client.query('SELECT count(*) FROM public.tasks WHERE project_id = $1', [projId]),
            client.query('SELECT count(*) FROM public.documents WHERE project_id = $1', [projId]),
            client.query('SELECT count(*) FROM public.meetings WHERE project_id = $1', [projId])
        ]);

        console.log("Created Stages:", counts[0].rows[0].count);
        console.log("Created Milestones:", counts[1].rows[0].count);
        console.log("Created Tasks (incl Client Actions):", counts[2].rows[0].count);
        console.log("Created Documents:", counts[3].rows[0].count);
        console.log("Created Meetings:", counts[4].rows[0].count);

        await client.query("ROLLBACK");
    } catch (e) {
        console.error("Failed:", e);
    } finally {
        await client.end();
    }
}

run();
