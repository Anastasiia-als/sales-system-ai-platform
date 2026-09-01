
const fs = require('fs');
let content = fs.readFileSync('js/portal/ui/portal-automation-view.js', 'utf8');

// just find '<!-- Modals -->' and 'async loadData()'
const p1 = content.indexOf('<!-- Modals -->');
const p2 = content.indexOf('async loadData');

let chunk = content.substring(p1, p2);

chunk = chunk.replace('<!-- Modals -->' + String.fromCharCode(96) + ';', '<!-- Modals -->');

// now find the LAST </div> inside this chunk
const lastDiv = chunk.lastIndexOf('</div>');
if (lastDiv !== -1) {
    chunk = chunk.substring(0, lastDiv + 6) + '\n    ' + String.fromCharCode(96) + ';\n    }\n\n    ' + chunk.substring(lastDiv + 6);
}

content = content.substring(0, p1) + chunk + content.substring(p2);
fs.writeFileSync('js/portal/ui/portal-automation-view.js', content);

