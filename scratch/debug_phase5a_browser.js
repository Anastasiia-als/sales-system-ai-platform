const puppeteer = require('puppeteer');

async function main() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err));

    console.log("=== 1. Login as Owner via Standard Portal Auth ===");
    await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const emailInput = await page.$('#auth-email');
    console.log("Is auth-email input found?", Boolean(emailInput));
    if (emailInput) {
        await page.type('#auth-email', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', process.env.TEST_OWNER_PASSWORD || 'Password123!');
        await page.click('#btn-portal-submit-login');
        await new Promise(r => setTimeout(r, 2500));
    }

    console.log("\n=== 2. Navigate to Dashboard (#/portal/dashboard) ===");
    await page.goto('http://localhost:8002/#/portal/dashboard', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2500));

    const html = await page.evaluate(() => document.body.innerHTML);
    console.log("PAGE HTML SAMPLE:\n", html.substring(0, 800));

    await browser.close();
}

main().catch(console.error);
