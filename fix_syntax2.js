
const fs = require('fs');
let content = fs.readFileSync('js/portal/ui/portal-automation-view.js', 'utf8');
content = content.replace('<!-- Modals -->' + ';', '<!-- Modals -->');
fs.writeFileSync('js/portal/ui/portal-automation-view.js', content);

