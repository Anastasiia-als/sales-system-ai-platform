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
    const res = await c.query(`SELECT id, organization_id, first_name, last_name, email, position FROM public.contacts;`);
    console.log("Contacts:", res.rows);
    const profs = await c.query(`SELECT id, email, full_name, role FROM public.profiles;`);
    console.log("Profiles:", profs.rows);
    await c.end();
}

main().catch(console.error);
