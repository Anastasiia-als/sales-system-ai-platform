const puppeteer = require('puppeteer');
(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        
        await page.goto('http://localhost:8002/#/portal/auth', { waitUntil: 'networkidle0' });
        
        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', process.env.OWNER_PASSWORD || 'Password123!');
        await page.click('#btn-submit-pwd');
        
        await new Promise(r => setTimeout(r, 2000));
        
        const html = await page.evaluate(() => document.body.innerHTML);
        require('fs').writeFileSync('scratch/login_dump.html', html);
        
        console.log("Dumped login result");
    } catch(e) {
        console.log(e);
    } finally {
        if(browser) await browser.close();
        process.exit(0);
    }
})();
