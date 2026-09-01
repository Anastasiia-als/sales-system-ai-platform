const puppeteer = require('puppeteer');

(async () => {
    console.log("Starting Puppeteer UI Gap Acceptance Test with Network Interception...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = request.url();
        if (url.includes('/auth/v1/user')) {
            request.respond({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: "mock-owner-id",
                    aud: "authenticated",
                    role: "authenticated",
                    email: "owner@firstwin.local"
                })
            });
        } else if (url.includes('/rest/v1/profiles')) {
            request.respond({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{
                    id: "mock-owner-id",
                    global_role: "owner"
                }])
            });
        } else if (url.includes('/rest/v1/automation_rules')) {
            request.respond({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        } else if (url.includes('/rest/v1/automation_execution_events')) {
            request.respond({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        } else {
            request.continue();
        }
    });

    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('auth_token', 'mock_owner_token');
        localStorage.setItem('user_session', JSON.stringify({
            id: 'mock-owner-id',
            global_role: 'owner',
            organizations: []
        }));
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
