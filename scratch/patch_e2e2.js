const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');
code = code.replace("await page.type('#auth-email'", "await page.type('#auth-email-pwd'");
fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
