const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
async function run() {
    await client.connect();
    
    await client.query(`
    CREATE OR REPLACE FUNCTION public.is_template_readable(p_org_id UUID) RETURNS BOOLEAN AS $$
    BEGIN
        IF p_org_id IS NULL THEN
            RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role IN ('owner', 'pm'));
        END IF;
        RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner') OR
               EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = auth.uid() AND organization_id = p_org_id AND org_role IN ('pm', 'admin'));
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    // Drop old policies
    await client.query(`DROP POLICY IF EXISTS "Owner Manage Templates" ON public.project_templates`);
    await client.query(`DROP POLICY IF EXISTS "PM Manage Tenant Templates" ON public.project_templates`);
    
    // Create new ones
    await client.query(`CREATE POLICY "Owner Manage Templates" ON public.project_templates FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner'));`);
    await client.query(`CREATE POLICY "PM Manage Tenant Templates" ON public.project_templates FOR ALL USING (
        organization_id IS NOT NULL AND 
        EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = auth.uid() AND organization_id = project_templates.organization_id AND org_role IN ('pm', 'admin'))
    );`);
    
    console.log('DB RLS Policies Updated');
    await client.end();
}
run();
