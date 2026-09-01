const fs = require('fs');
let code = fs.readFileSync('js/portal/ui/portal-rule-builder-ui.js', 'utf8');
code = code.replace(
    'errMsg.innerText = "Помилка при збереженні: " + (err.message || JSON.stringify(err));',
    'errMsg.innerText = "Помилка при збереженні: " + (err.message || JSON.stringify(err)); console.error("SAVE ERR:", JSON.stringify(err));'
);
fs.writeFileSync('js/portal/ui/portal-rule-builder-ui.js', code, 'utf8');
