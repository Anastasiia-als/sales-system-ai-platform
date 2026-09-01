const fs = require('fs');
let code = fs.readFileSync('js/portal/ui/portal-global-automation-view.js', 'utf8');

code = code.replace(
    'orgId = p.data?.organization_id;',
    'orgId = p.data?.organization_id;\n            }\n        }\n        if (!orgId) {\n            const orgReq = await supabase.from("organizations").select("id").limit(1).single();\n            if (orgReq.data) orgId = orgReq.data.id;'
);

fs.writeFileSync('js/portal/ui/portal-global-automation-view.js', code, 'utf8');
