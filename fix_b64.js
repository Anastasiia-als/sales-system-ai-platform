const fs = require('fs');
let c = fs.readFileSync('patch_automation_ui3.js', 'utf8');
c = c.replace('<!-- Modals -->`;', '<!-- Modals -->');
fs.writeFileSync('patch_automation_ui3.js', c, 'utf8');