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

    const stages = await c.query(`
        SELECT s.id, s.project_id, s.name, s.status, s.sort_order, s.target_date, p.name as project_name
        FROM public.project_stages s
        LEFT JOIN public.projects p ON p.id = s.project_id
        ORDER BY s.sort_order ASC;
    `);
    console.log(`Stages (${stages.rows.length}):`, stages.rows);

    const miles = await c.query(`
        SELECT m.id, m.project_id, m.name, m.status, m.sort_order, m.target_date, p.name as project_name
        FROM public.milestones m
        LEFT JOIN public.projects p ON p.id = m.project_id
        ORDER BY m.sort_order ASC;
    `);
    console.log(`Milestones (${miles.rows.length}):`, miles.rows);

    await c.end();
}

main().catch(console.error);
