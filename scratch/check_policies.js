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
    const res = await c.query(`
        SELECT tablename, policyname, roles, cmd, qual 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('profiles', 'organization_memberships', 'client_portal_access', 'projects', 'meetings');
    `);
    console.log("Policies:", res.rows);
    await c.end();
}

main().catch(console.error);
