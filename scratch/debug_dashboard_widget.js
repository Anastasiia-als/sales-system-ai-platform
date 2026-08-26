const puppeteer = require('puppeteer');

async function main() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err));

    await page.goto('http://localhost:8002/#/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#auth-email-pwd');
    await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
    await page.type('#auth-password', process.env.TEST_OWNER_PASSWORD || 'Password123!');
    await page.click('#btn-submit-pwd');
    await new Promise(r => setTimeout(r, 2000));

    await page.goto('http://localhost:8002/#/portal/dashboard', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 3000));

    const html = await page.evaluate(() => document.body.innerHTML);
    console.log("DASHBOARD HTML INCLUDED WIDGET?:", html.includes("portal-recent-notifications-list"));
    if (!html.includes("portal-recent-notifications-list")) {
        console.log("HTML SAMPLE:\n", html.substring(0, 1500));
    }

    await browser.close();
}

main().catch(console.error);
