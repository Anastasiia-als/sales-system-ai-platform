const puppeteer = require('puppeteer');
(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        page.on('response', res => {
            if(res.status() === 404) console.log('404 URL:', res.url());
        });
        
        await page.goto('http://localhost:8002/#/portal/auth', { waitUntil: 'networkidle0' });
        await page.waitForTimeout(2000);
    } catch(e) {
    } finally {
        if(browser) await browser.close();
        process.exit(0);
    }
})();
