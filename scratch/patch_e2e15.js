const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');

code = code.replace(
    '        page.on(\'console\', msg => {',
    '        page.on("response", async res => {\n            if(res.status() === 400) {\n                try { console.log("400 RESPONSE:", await res.text()); } catch(e) {}\n            }\n        });\n        page.on(\'console\', msg => {'
);

fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
