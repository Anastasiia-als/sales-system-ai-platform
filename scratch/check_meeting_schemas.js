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
    
    // Check tables and columns for meeting details
    const tables = ['meetings', 'meeting_participants', 'meeting_notes', 'meeting_decisions', 'meeting_attachments', 'tasks'];
    for (const t of tables) {
        const res = await c.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY ordinal_position;
        `, [t]);
        console.log(`\nTable ${t}:`, res.rows.map(r => `${r.column_name} (${r.data_type})`));
    }

    await c.end();
}

main().catch(console.error);
