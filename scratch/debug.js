const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
async function run() {
    await client.connect();
    try {
        const t = await client.query("SELECT id FROM public.project_templates LIMIT 1");
        console.log("Template ID:", t.rows[0].id);
        const res = await client.query(`SELECT public.create_template_draft('${t.rows[0].id}', 't2')`);
        console.log(res.rows);
    } catch(e) {
        console.error(e);
    }
    await client.end();
}
run();
