const puppeteer = require('puppeteer');

async function testBrowserMeetings() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err));
    page.on('response', async res => {
        const url = res.url();
        if (url.includes('supabase.co')) {
            try {
                const text = await res.text();
                console.log(`SUPABASE RESPONSE [${res.status()}] ${url} =>`, text.slice(0, 300));
            } catch (e) {
                console.log(`SUPABASE RESPONSE [${res.status()}] ${url} (error reading body)`);
            }
        }
    });

    console.log("Navigating to http://localhost:8002/#/client/login ...");
    await page.goto('http://localhost:8002/#/client/login', { waitUntil: 'networkidle0', timeout: 30000 });

    console.log("Clicking 'Увійти як Test Client Alpha' button...");
    await page.waitForSelector('#btn-quick-login-client-alpha');
    await page.click('#btn-quick-login-client-alpha');
    await new Promise(r => setTimeout(r, 2000));

    console.log("\nNavigating to http://localhost:8002/#/client/meetings via hash change...");
    await page.evaluate(() => { window.location.hash = '#/client/meetings'; });
    await new Promise(r => setTimeout(r, 3000));

    const evalResult = await page.evaluate(async () => {
        // Let's inspect window.FIRSTWIN_ENV, PortalAuth, DataClient
        const { PortalAuth } = await import('./js/portal/auth/auth-service.js');
        const { DataClient } = await import('./js/portal/api/data-client.js');
        const { getSupabase } = await import('./js/portal/api/supabase-client.js');

        const orgs = await DataClient.getClientOrganizations();
        const activeOrg = orgs.data?.[0];

        const sb = await getSupabase();
        const session = (await sb?.auth?.getSession())?.data?.session;

        let meets = null;
        let meetsErr = null;
        if (activeOrg) {
            const res = await DataClient.getClientMeetings(activeOrg.id);
            meets = res.data;
            meetsErr = res.error ? res.error.message : null;
        }

        return {
            user: PortalAuth.getUser(),
            activeOrg,
            hasSession: Boolean(session),
            meets,
            meetsErr
        };
    });

    console.log("\n=== IN-BROWSER EVALUATION RESULT ===");
    console.log(JSON.stringify(evalResult, null, 2));

    await browser.close();
}

testBrowserMeetings().catch(console.error);
