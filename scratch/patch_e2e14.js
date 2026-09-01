const fs = require('fs');
let code = fs.readFileSync('scratch/run_e2e_real.js', 'utf8');

code = code.replace(
    '        // 3. Go to Automation Command Center',
    `        const profile = await page.evaluate(() => window.PortalAuth ? window.PortalAuth.getProfile() : 'NO_PORTAL_AUTH');
        console.log("Profile after reload:", profile);
        // 3. Go to Automation Command Center`
);
fs.writeFileSync('scratch/run_e2e_real.js', code, 'utf8');
