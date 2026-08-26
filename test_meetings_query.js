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
    const alphaUserId = '44444444-4444-4444-4444-444444444444';
    await c.query('BEGIN;');
    await c.query("SET LOCAL role = 'authenticated';");
    await c.query("SELECT set_config('request.jwt.claims', $1, true);", [
        JSON.stringify({ sub: alphaUserId, role: 'authenticated' })
    ]);

    const orgs = await c.query("SELECT id, name FROM public.organizations;");
    console.log("Client Alpha Orgs:", orgs.rows);

    const projs = await c.query("SELECT id, name, title, organization_id FROM public.projects;");
    console.log("Client Alpha Projects:", projs.rows);

    const meets = await c.query("SELECT id, title, project_id, organization_id, status, start_at, is_client_visible FROM public.meetings;");
    console.log("Client Alpha Meetings:", meets.rows);

    await c.query('ROLLBACK;');
    await c.end();
}

main().catch(console.error);
