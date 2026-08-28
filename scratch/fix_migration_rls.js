const fs = require('fs');
let sql = fs.readFileSync('supabase/migrations/20260828000016_project_templates_phase6a.sql', 'utf8');

sql = sql.replace(
    /CREATE OR REPLACE FUNCTION public.is_template_readable\([\s\S]*?LANGUAGE plpgsql SECURITY DEFINER;/m,
    `CREATE OR REPLACE FUNCTION public.is_template_readable(p_org_id UUID) RETURNS BOOLEAN AS $$
BEGIN
    IF p_org_id IS NULL THEN
        RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role IN ('owner', 'pm'));
    END IF;
    RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner') OR
           EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = auth.uid() AND organization_id = p_org_id AND org_role IN ('pm', 'admin'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`
);

sql = sql.replace(
    /CREATE POLICY "Owner Manage Templates" ON public.project_templates FOR ALL USING \(EXISTS \(SELECT 1 FROM user_roles WHERE user_id = auth.uid\(\) AND role = 'owner'\)\);/g,
    `CREATE POLICY "Owner Manage Templates" ON public.project_templates FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner'));`
);

sql = sql.replace(
    /CREATE POLICY "PM Manage Tenant Templates" ON public.project_templates FOR ALL USING \([\s\S]*?role = 'pm'\)\n\);/m,
    `CREATE POLICY "PM Manage Tenant Templates" ON public.project_templates FOR ALL USING (
    organization_id IS NOT NULL AND 
    EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = auth.uid() AND organization_id = project_templates.organization_id AND org_role IN ('pm', 'admin'))
);`
);

fs.writeFileSync('supabase/migrations/20260828000016_project_templates_phase6a.sql', sql);
console.log('Migration file updated');
