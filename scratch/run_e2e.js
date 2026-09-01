const puppeteer = require('puppeteer');

(async () => {
    console.log("Starting Puppeteer UI Gap Acceptance Test...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Inject auth to mock Owner Session
    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('auth_token', 'mock_owner_token');
        localStorage.setItem('user_session', JSON.stringify({
            id: 'owner-id',
            role: 'owner',
            organizations: []
        }));
    });

    console.log("Navigating to http://localhost:8002/#/portal/automation...");
    await page.goto('http://localhost:8002/#/portal/automation', { waitUntil: 'networkidle0' });
    
    // Check for mojibake
    let text = await page.evaluate(() => document.body.innerText);
    console.log("Mojibake (\\uFFFD) Count:", (text.match(/\uFFFD/g) || []).length);
    
    // Wait for spinners to disappear
    console.log("Waiting for spinners to disappear...");
    await page.waitForFunction(() => {
        const spinners = document.querySelectorAll('.portal-spinner');
        return spinners.length === 0;
    }, { timeout: 10000 }).catch(e => console.log('Spinners timeout!'));
    
    let spinnersCount = await page.evaluate(() => document.querySelectorAll('.portal-spinner').length);
    console.log("Remaining spinners:", spinnersCount);

    text = await page.evaluate(() => document.body.innerText);
    console.log("Found Title:", text.includes("Центр управління автоматизацією"));
    console.log("Found Empty State:", text.includes("Правила відсутні") || text.includes("У вас немає доступу"));

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
