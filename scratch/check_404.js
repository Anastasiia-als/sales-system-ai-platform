const puppeteer = require('puppeteer');

async function main() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('response', resp => {
        if (resp.status() >= 400) {
            console.log(`HTTP ${resp.status()} on URL: ${resp.url()}`);
        }
    });

    await page.goto('http://localhost:8002/#/client/meetings/11111111-1111-4000-a000-000000000301', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    await browser.close();
}

main().catch(console.error);
