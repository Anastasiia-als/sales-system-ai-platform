const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');

code = code.replace("await page.goto('http://localhost:8002', { waitUntil: 'networkidle0' });", "");
code = code.replace("await page.setRequestInterception(true);", "await page.setRequestInterception(true);"); // no change here

// Move the goto AFTER the page.on
code = code.replace("        // Go to portal automation", "        await page.goto('http://localhost:8002', { waitUntil: 'networkidle0' });\n        // Inject auth token so the app thinks we are logged in!\n        await page.evaluate(() => {\n            window.localStorage.setItem('sb-aayqydcdfxhlwizhfjun-auth-token', JSON.stringify({\n                access_token: \"MOCK_TOKEN\",\n                user: { id: \"mock-user-id\", email: \"owner@firstwin.com\", user_metadata: { full_name: \"Owner\" } }\n            }));\n        });\n        // Go to portal automation");

fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
