const fs = require('fs');
let code = fs.readFileSync('js/portal/ui/portal-global-automation-view.js', 'utf8');
code = code.replace(
    'console.error("Failed to load global automation:", JSON.stringify(error));',
    'console.error("GLOBAL AUTOMATION ERR:", error.message, error.details, error.hint, error.code);'
);
fs.writeFileSync('js/portal/ui/portal-global-automation-view.js', code, 'utf8');
