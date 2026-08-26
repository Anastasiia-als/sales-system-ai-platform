const puppeteer = require('puppeteer');

async function main() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('response', async resp => {
        if (resp.status() >= 400) {
            let body = "";
            try { body = await resp.text(); } catch (e) {}
            console.log(`HTTP ${resp.status()} on ${resp.url()}:`, body);
        }
    });

    await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#auth-email-pwd');
    await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
    await page.type('#auth-password', process.env.TEST_OWNER_PASSWORD || 'Password123!');
    await page.click('#btn-submit-pwd');
    await new Promise(r => setTimeout(r, 3000));

    await browser.close();
}

main().catch(console.error);
