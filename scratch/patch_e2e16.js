const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');

code = code.replace(
    '        assert(tableHtmlModified.includes(ruleName + "_MODIFIED"), "Rule modification persisted after F5");',
    '        if(!tableHtmlModified.includes(ruleName + "_MODIFIED")) console.log("TABLE HTML WAS:", tableHtmlModified);\n        assert(tableHtmlModified.includes(ruleName + "_MODIFIED"), "Rule modification persisted after F5");'
);

fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
