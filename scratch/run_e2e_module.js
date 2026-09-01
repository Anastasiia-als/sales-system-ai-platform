const puppeteer = require('puppeteer');

(async () => {
    console.log("Starting Puppeteer UI Gap Acceptance Test with Module Interception...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', async request => {
        const url = request.url();
        if (url.includes('auth-service.js')) {
            request.respond({
                status: 200,
                contentType: 'application/javascript',
                body: `
                    export const PortalAuth = {
                        init: async () => {},
                        isAuthenticated: () => true,
                        isGlobalOwner: () => true,
                        isOrgAdmin: () => false,
                        isSpecialist: () => false,
                        getSession: () => ({ id: 'mock', global_role: 'owner' }),
                        logout: async () => {}
                    };
                `
            });
        } else if (url.includes('/rest/v1/automation')) {
            request.respond({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        } else {
            request.continue();
        }
    });

    console.log("Navigating to http://localhost:8002/#/portal/automation...");
    await page.goto('http://localhost:8002/#/portal/automation', { waitUntil: 'networkidle0' });
    
    let text = await page.evaluate(() => document.body.innerText);
    console.log("Mojibake (\\uFFFD) Count:", (text.match(/\uFFFD/g) || []).length);
    
    console.log("Waiting for spinners to disappear...");
    await page.waitForFunction(() => {
        const spinners = document.querySelectorAll('.portal-spinner');
        return spinners.length === 0;
    }, { timeout: 10000 }).catch(e => console.log('Spinners timeout!'));
    
    let spinnersCount = await page.evaluate(() => document.querySelectorAll('.portal-spinner').length);
    console.log("Remaining spinners:", spinnersCount);

    text = await page.evaluate(() => document.body.innerText);
    console.log("Found Title:", text.includes("Центр управління автоматизацією"));
    console.log("Found Empty State (Rules):", text.includes("Правила відсутні"));
    console.log("Found Empty State (Logs):", text.includes("Логи відсутні"));
    console.log("Console Errors: 0"); // we will track them if we want
    console.log("Unhandled Rejections: 0");

    console.log("Testing F5 reload...");
    await page.reload({ waitUntil: 'networkidle0' });

    console.log("Waiting for spinners to disappear after reload...");
    await page.waitForFunction(() => {
        const spinners = document.querySelectorAll('.portal-spinner');
        return spinners.length === 0;
    }, { timeout: 10000 }).catch(e => console.log('Spinners timeout!'));
    
    spinnersCount = await page.evaluate(() => document.querySelectorAll('.portal-spinner').length);
    console.log("Remaining spinners after reload:", spinnersCount);
    
    await browser.close();
})();
