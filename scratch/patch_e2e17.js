const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');

code = code.replace(
    'await delay(500); // Wait for modal',
    'await page.waitForSelector("#automation-rule-modal", { timeout: 10000 });'
);
code = code.replace(
    'await delay(500);\n        \n        // Modify rule',
    'await page.waitForSelector("#automation-rule-modal", { timeout: 10000 });\n        await delay(1000); // let UI settle for type\n        // Modify rule'
);
fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
