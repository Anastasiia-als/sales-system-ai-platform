const fs = require('fs');
let code = fs.readFileSync('js/portal/ui/portal-rule-builder-ui.js', 'utf8');
code = code.replace(
    'console.error("SAVE ERR:", JSON.stringify(err));',
    'console.error("SAVE ERR:", err.message, err.details, err.hint, err.code);'
);
fs.writeFileSync('js/portal/ui/portal-rule-builder-ui.js', code, 'utf8');
