const fs = require('fs');
let code = fs.readFileSync('js/portal/ui/portal-rule-builder-ui.js', 'utf8');

code = code.replace(
    'orgId = p.data?.organization_id || "mock-org";',
    'orgId = p.data?.organization_id;\n        }\n    }\n    if(!orgId) {\n        const orgReq = await supabase.from("organizations").select("id").limit(1).single();\n        if(orgReq.data) orgId = orgReq.data.id;\n        else orgId = "mock-org";'
);

fs.writeFileSync('js/portal/ui/portal-rule-builder-ui.js', code, 'utf8');
