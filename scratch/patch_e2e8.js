const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');
code = code.replace(/console\.log\(\\'MOCK \\'/g, "console.log('MOCK '");
code = code.replace(/console\.log\(\\'HTTP \\'/g, "console.log('HTTP '");
fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
