
const fs = require('fs');
let c = fs.readFileSync('js/portal/ui/portal-automation-view.js', 'utf8');
c = c.replace('<!-- Modals -->' + String.fromCharCode(96) + ';', '<!-- Modals -->');
fs.writeFileSync('js/portal/ui/portal-automation-view.js', c);

