
const fs = require('fs');
let text = fs.readFileSync('patch_automation_ui3.js', 'utf8');
text = text.replace('<!-- Modals -->\' + ';', '<!-- Modals -->');
fs.writeFileSync('patch_automation_ui3.js', text);

