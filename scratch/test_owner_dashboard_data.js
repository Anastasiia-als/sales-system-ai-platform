const { Client } = require('pg');

async function main() {
    const c = new Client({
        host: 'aws-0-eu-central-1.pooler.supabase.com',
        port: 5432,
        user: 'postgres.aayqydcdfxhlwizhfjun',
        password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
    });

    await c.connect();

    console.log("=== Querying live data for Owner Dashboard ===");

    const orgs = await c.query(`SELECT id, name, slug, status, industry, country, responsible_pm_id, created_at FROM public.organizations ORDER BY name ASC;`);
    console.log(`Orgs (${orgs.rows.length}):`, orgs.rows);

    const projs = await c.query(`
        SELECT p.id, p.organization_id, p.title, p.name, p.project_type, p.status, p.health, 
               p.progress_percent, p.target_date, p.responsible_pm_id, p.created_at, p.updated_at,
               o.name as org_name, pr.full_name as pm_name
        FROM public.projects p
        LEFT JOIN public.organizations o ON o.id = p.organization_id
        LEFT JOIN public.profiles pr ON pr.id = p.responsible_pm_id
        ORDER BY p.created_at DESC;
    `);
    console.log(`Projects (${projs.rows.length}):`, projs.rows);

    const tasks = await c.query(`
        SELECT id, project_id, title, status, priority, due_date, responsibility_type, is_client_visible, assignee_user_id
        FROM public.tasks
        ORDER BY due_date ASC NULLS LAST;
    `);
    console.log(`Tasks (${tasks.rows.length}):`, tasks.rows);

    const docs = await c.query(`
        SELECT d.id, d.title, d.status, d.category, d.is_client_visible,
               COUNT(dv.id) as versions_count
        FROM public.documents d
        LEFT JOIN public.document_versions dv ON dv.document_id = d.id
        GROUP BY d.id;
    `);
    console.log(`Documents (${docs.rows.length}):`, docs.rows);

    const meets = await c.query(`
        SELECT id, project_id, title, meeting_type, status, start_at, end_at, is_client_visible, organizer_user_id
        FROM public.meetings
        ORDER BY start_at ASC;
    `);
    console.log(`Meetings (${meets.rows.length}):`, meets.rows);

    await c.end();
}

main().catch(console.error);
