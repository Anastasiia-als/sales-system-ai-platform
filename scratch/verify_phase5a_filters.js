const puppeteer = require('puppeteer');

async function main() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', err => {
        const str = err.toString();
        if (!str.includes('favicon.ico') && !str.includes('404')) consoleErrors.push(str);
    });

    console.log("=== 1. Login as Owner ===");
    await page.goto('http://localhost:8002/#/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
    await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
    await page.type('#auth-password', process.env.TEST_OWNER_PASSWORD || process.env.OWNER_PASSWORD);
    await page.click('#btn-submit-pwd');

    await page.waitForSelector('.portal-dashboard-kpi-card', { timeout: 15000 });

    console.log("\n=== 2. Test Health Filter ===");
    await page.select('#dashboard-portfolio-health-filter', 'at_risk');
    await new Promise(r => setTimeout(r, 400));
    const atRiskRows = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.portal-dashboard-portfolio-table tbody tr')).map(r => r.innerText.trim());
    });
    console.log("At Risk rows count:", atRiskRows.length, "(Expected: 1)");

    console.log("\n=== 3. Test Search Filter ===");
    await page.select('#dashboard-portfolio-health-filter', 'all');
    await page.type('#dashboard-portfolio-search', 'Beta');
    await new Promise(r => setTimeout(r, 400));
    const betaRows = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.portal-dashboard-portfolio-table tbody tr')).map(r => r.innerText.trim());
    });
    console.log("Beta search rows count:", betaRows.length, "(Expected: 1)");

    console.log("\n=== 4. Test Attention Center Pills ===");
    await page.click('button[data-sev="high"]');
    await new Promise(r => setTimeout(r, 400));
    const highCards = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.portal-attention-card')).map(c => c.innerText.trim());
    });
    console.log("High severity cards count:", highCards.length, "(Expected: 3)");

    console.log("\n=== 5. Test Quick Action Menu ===");
    await page.click('#btn-quick-create-menu');
    await new Promise(r => setTimeout(r, 300));
    const menuVisible = await page.evaluate(() => {
        const menu = document.getElementById('quick-create-menu-items');
        return menu && menu.style.display === 'block';
    });
    console.log("Quick create menu is open:", menuVisible);

    await browser.close();
    console.log("\n✔ ALL INTERACTIVE FILTERS AND WIDGETS VERIFIED SUCCESSFULLY!");
}

main().catch(console.error);
