const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');
code = code.replace("console.error(\"E2E Test Failed:\", e);", "const html = await page.evaluate(() => document.body.innerHTML); fs.writeFileSync('scratch/dump2.html', html); console.error(\"E2E Test Failed:\", e);");
fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
