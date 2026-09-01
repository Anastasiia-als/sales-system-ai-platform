const fs = require('fs');
let code = fs.readFileSync('js/portal/ui/portal-global-automation-view.js', 'utf8');
let lines = code.split('\n');
let i = lines.findIndex(l => l.includes('<td style="font-weight: 500;">'));
console.log(lines.slice(i-2, i+5).join('\n'));
