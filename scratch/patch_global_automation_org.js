const fs = require('fs');
let code = fs.readFileSync('js/portal/ui/portal-global-automation-view.js', 'utf8');

code = code.replace(
    'const orgId = PortalAuth.getProfile()?.organization_id;',
    'let orgId = PortalAuth.getProfile()?.organization_id;\n        if (!orgId) {\n            const u = await supabase.auth.getUser();\n            if (u.data?.user?.id) {\n                const p = await supabase.from("profiles").select("organization_id").eq("id", u.data.user.id).single();\n                orgId = p.data?.organization_id;\n            }\n        }'
);

fs.writeFileSync('js/portal/ui/portal-global-automation-view.js', code, 'utf8');
