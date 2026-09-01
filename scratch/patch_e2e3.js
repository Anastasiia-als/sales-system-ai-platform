const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');
code = code.replace("await page.click('#auth-submit'", "await page.click('#btn-submit-pwd'");
fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
