
const fs = require('fs');
const files = [
    'js/portal/ui/portal-global-automation-view.js',
    'js/portal/ui/portal-automation-view.js',
    'js/portal/ui/portal-rule-builder-ui.js',
    'js/pages/portal-page.js'
];
files.forEach(f => {
    try {
        const text = fs.readFileSync(f, 'utf8');
        const count = (text.match(/\uFFFD/g) || []).length;
        console.log(f, 'U+FFFD count:', count);
    } catch(e) {}
});

