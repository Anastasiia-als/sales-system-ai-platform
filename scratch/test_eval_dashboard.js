const puppeteer = require('puppeteer');

async function main() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err));

    await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#auth-email-pwd');
    await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
    await page.type('#auth-password', process.env.TEST_OWNER_PASSWORD || 'Password123!');
    await page.click('#btn-submit-pwd');
    await new Promise(r => setTimeout(r, 3000));

    const result = await page.evaluate(async () => {
        const { PortalAuth } = await import('./js/portal/auth/auth-service.js');
        const { DataClient } = await import('./js/portal/api/data-client.js');
        console.log("Auth user:", PortalAuth.getUser()?.email, "Role:", PortalAuth.getGlobalRole());
        const dashData = await DataClient.getOwnerDashboardData();
        console.log("getOwnerDashboardData result error:", dashData.error);
        console.log("getOwnerDashboardData KPIs:", dashData.data?.kpis);
        return {
            user: PortalAuth.getUser()?.email,
            role: PortalAuth.getGlobalRole(),
            error: dashData.error ? dashData.error.message : null,
            kpis: dashData.data?.kpis,
            projectsCount: dashData.data?.portfolioProjects?.length
        };
    });

    console.log("EVAL RESULT:", result);
    await browser.close();
}

main().catch(console.error);
