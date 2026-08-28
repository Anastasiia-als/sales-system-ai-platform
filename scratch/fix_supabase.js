const fs = require('fs');
['js/portal/ui/portal-project-wizard.js', 'js/portal/ui/portal-templates-view.js', 'js/portal/ui/portal-template-builder-view.js'].forEach(f => {
    let t = fs.readFileSync(f, 'utf8');
    t = t.replace(/supabase\./g, '(await getSupabase()).');
    fs.writeFileSync(f, t);
});
