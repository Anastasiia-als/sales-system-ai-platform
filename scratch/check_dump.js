const fs = require('fs');
const html = fs.readFileSync('scratch/dump.html', 'utf8');
console.log('Includes btn-global-create-rule:', html.includes('btn-global-create-rule'));
console.log('Includes portal-view-title:', html.includes('portal-view-title'));
const start = html.indexOf('id="portal-container"');
console.log(html.substring(start, start + 500));
