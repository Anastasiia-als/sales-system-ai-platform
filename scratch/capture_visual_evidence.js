const puppeteer = require('puppeteer');
const fs = require('fs');

async function captureEvidence() {
    if (!fs.existsSync('scratch/evidence')) {
        fs.mkdirSync('scratch/evidence', { recursive: true });
    }
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Login
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('http://localhost:8002/#/portal/auth', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#auth-email-pwd');
    await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
    await page.type('#auth-password', process.env.OWNER_PASSWORD || process.env.OWNER_PASSWORD);
    await page.click('#btn-submit-pwd');
    await new Promise(r => setTimeout(r, 2500));
    
    // Go to automation
    await page.goto('http://localhost:8002/#/portal/automation', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => !document.querySelector('.portal-spinner'));
    
    // 1. Desktop Screenshot
    await page.setViewport({ width: 1920, height: 1080 });
    await page.click('#btn-global-create-rule');
    await page.waitForSelector('#automation-rule-modal');
    await page.screenshot({ path: 'scratch/evidence/modal_desktop_1920x1080.png' });
    await page.click('.portal-modal-footer .btn-modal-close');
    await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'));
    
    // 2. Laptop Screenshot
    await page.setViewport({ width: 1366, height: 768 });
    await page.click('#btn-global-create-rule');
    await page.waitForSelector('#automation-rule-modal');
    await page.screenshot({ path: 'scratch/evidence/modal_laptop_1366x768.png' });
    await page.click('.portal-modal-footer .btn-modal-close');
    await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'));

    // 3. Tablet Screenshot
    await page.setViewport({ width: 768, height: 1024 });
    await page.click('#btn-global-create-rule');
    await page.waitForSelector('#automation-rule-modal');
    await page.screenshot({ path: 'scratch/evidence/modal_tablet_768x1024.png' });
    await page.click('.portal-modal-footer .btn-modal-close');
    await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'));

    // 4. Mobile Screenshot
    await page.setViewport({ width: 375, height: 812 });
    await page.click('#btn-global-create-rule');
    await page.waitForSelector('#automation-rule-modal');
    await page.screenshot({ path: 'scratch/evidence/modal_mobile_375x812.png' });
    await page.click('.portal-modal-footer .btn-modal-close');
    await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'));
    
    await browser.close();
    console.log("All visual evidence screenshots saved to scratch/evidence/");
}

captureEvidence().catch(console.error);
