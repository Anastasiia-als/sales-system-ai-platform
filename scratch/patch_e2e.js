const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');
code = code.replace("await page.click('#btn-global-create-rule');", "const html = await page.evaluate(() => document.body.innerHTML); fs.writeFileSync('scratch/dump.html', html, 'utf8'); console.log('Dumped HTML!'); await page.click('#btn-global-create-rule');");
fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
