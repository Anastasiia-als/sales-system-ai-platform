const fs = require('fs');
let code = fs.readFileSync('js/portal/ui/portal-rule-builder-ui.js', 'utf8');
code = code.replace(
    'orgId = p.data?.organization_id || "mock-org";',
    'orgId = p.data?.organization_id || "mock-org"; console.log("Fetched orgId builder:", orgId);'
);
fs.writeFileSync('js/portal/ui/portal-rule-builder-ui.js', code, 'utf8');
