
const fs = require('fs');
let content = fs.readFileSync('js/portal/ui/portal-automation-view.js', 'utf8');
content = content.replace('<!-- Modals -->\;', '<!-- Modals -->');

const lastHtmlIndex = content.lastIndexOf('</div>\n</div>');
if (lastHtmlIndex !== -1) {
    // we need to find where the async render method ends.
    // Let's just find the last </div> before loadData()
    const parts = content.split('async loadData');
    if (parts.length > 1) {
        let part1 = parts[0];
        const lastDiv = part1.lastIndexOf('</div>');
        part1 = part1.substring(0, lastDiv + 6) + '\n    \;\n    }\n\n    ' + part1.substring(lastDiv + 6);
        content = part1 + 'async loadData' + parts[1];
    }
}
fs.writeFileSync('js/portal/ui/portal-automation-view.js', content);

