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
    
    // Check meeting_documents
    const res = await c.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'meeting_documents'
        ORDER BY ordinal_position;
    `);
    console.log("Table meeting_documents:", res.rows.map(r => `${r.column_name} (${r.data_type})`));

    // Check meeting_notes columns
    const notesCols = await c.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'meeting_notes';
    `);
    console.log("Table meeting_notes cols:", notesCols.rows.map(r => r.column_name));

    await c.end();
}

main().catch(console.error);
