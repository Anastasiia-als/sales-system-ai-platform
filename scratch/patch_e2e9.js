const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');
code = code.replace("await page.goto('http://localhost:8002', { waitUntil: 'networkidle0' });", "");
code = code.replace("await page.setRequestInterception(true);", "await page.setRequestInterception(true);\nawait page.goto('http://localhost:8002', { waitUntil: 'networkidle0' });");
fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
