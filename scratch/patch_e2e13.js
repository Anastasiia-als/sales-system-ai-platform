const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');

code = code.replace(
    '        console.log("Logged in!");',
    '        console.log("Logged in!");\n        await page.reload({ waitUntil: "networkidle0" });'
);
fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
