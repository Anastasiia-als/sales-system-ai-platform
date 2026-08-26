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

    const events = await c.query(`
        SELECT dre.id, dre.document_id, dre.event_type, dre.comment, dre.created_at, d.title as doc_title
        FROM public.document_review_events dre
        LEFT JOIN public.documents d ON d.id = dre.document_id
        ORDER BY dre.created_at DESC;
    `);
    console.log(`Document Review Events (${events.rows.length}):`, events.rows);

    await c.end();
}

main().catch(console.error);
