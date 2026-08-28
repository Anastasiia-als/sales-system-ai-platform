const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
async function run() {
    await client.connect();
    const tables = ['template_versions', 'template_stages', 'template_milestones', 'template_tasks', 'template_client_actions', 'template_documents', 'template_meetings'];
    for(const t of tables) {
        await client.query(`CREATE POLICY "Owner Manage All ${t}" ON public.${t} FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner'));`);
    }
    console.log('Fixed RLS');
    client.end();
}
run();
