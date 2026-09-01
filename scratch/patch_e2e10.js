const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');

// Put it back
code = code.replace("await page.setRequestInterception(true);\nawait page.goto('http://localhost:8002', { waitUntil: 'networkidle0' });", "await page.setRequestInterception(true);");

code = code.replace("await page.setRequestInterception(true);", "await page.setRequestInterception(true);\n        await page.goto('http://localhost:8002', { waitUntil: 'networkidle0' });");

fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
