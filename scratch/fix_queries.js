const fs = require('fs');
let view = fs.readFileSync('js/portal/ui/portal-global-automation-view.js', 'utf8');
view = view.replace('templates(name)', 'project_templates(name)');
view = view.replace(
    'const p = await supabase.from("profiles").select("organization_id").eq("id", u.data.user.id).single();\\n                orgId = p.data?.organization_id;',
    ''
);
fs.writeFileSync('js/portal/ui/portal-global-automation-view.js', view, 'utf8');

let builder = fs.readFileSync('js/portal/ui/portal-rule-builder-ui.js', 'utf8');
builder = builder.replace(/supabase\\.from\\(\\'templates\\'\\)/g, "supabase.from('project_templates')");
builder = builder.replace(
    'const p = await supabase.from("profiles").select("organization_id").eq("id", u.data.user.id).single();\\n            orgId = p.data?.organization_id;',
    ''
);
fs.writeFileSync('js/portal/ui/portal-rule-builder-ui.js', builder, 'utf8');
