const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');
code = code.replace("const page = await browser.newPage();", "page = await browser.newPage();");
code = code.replace("let browser;", "let browser; let page;");
fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
