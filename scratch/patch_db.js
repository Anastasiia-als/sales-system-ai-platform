const fs = require('fs');
const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
async function run() {
    await client.connect();
    await client.query(`
        CREATE TABLE IF NOT EXISTS public.template_audit_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_type TEXT NOT NULL,
            actor_id UUID REFERENCES auth.users(id),
            template_id UUID REFERENCES public.project_templates(id) ON DELETE SET NULL,
            template_version_id UUID REFERENCES public.template_versions(id) ON DELETE SET NULL,
            project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
            organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    `);
    const m2 = fs.readFileSync('scratch/draft_rpc_6a.sql', 'utf8');
    await client.query(m2);
    console.log('PATCH APPLIED');
    client.end();
}
run();
