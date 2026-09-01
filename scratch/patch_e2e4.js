const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');
code = code.replace("await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 });", "await page.waitForFunction(() => location.hash !== '#/portal/auth', { timeout: 10000 });");
fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
