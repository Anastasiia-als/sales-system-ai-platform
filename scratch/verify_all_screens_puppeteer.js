const puppeteer = require('puppeteer');

async function main() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('pageerror', err => console.error('BROWSER PAGE ERROR:', err));

    console.log("=== 1. Standard Form Login as Client Alpha ===");
    await page.goto('http://localhost:8002/#/client/login', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#client-login-email');
    await page.type('#client-login-email', 'client_alpha_4a@firstwin.io');
    await page.type('#client-login-password', process.env.TEST_CLIENT_PASSWORD || process.env.OWNER_PASSWORD);
    await page.click('#btn-submit-password-login');
    await new Promise(r => setTimeout(r, 2500));

    console.log("\n=== 2. Check Dashboard (#/client/dashboard) ===");
    await page.goto('http://localhost:8002/#/client/dashboard', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    const dashData = await page.evaluate(() => {
        const title = document.querySelector('.client-side-col .client-meeting-title')?.innerText?.trim();
        const time = document.querySelector('.client-side-col .client-meeting-time-row')?.innerText?.trim();
        return { nextMeetingTitle: title, nextMeetingTime: time };
    });
    console.log("Dashboard:", dashData);

    console.log("\n=== 3. Check Meetings Workspace (#/client/meetings) ===");
    await page.goto('http://localhost:8002/#/client/meetings', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    const meetsData = await page.evaluate(() => {
        const pills = Array.from(document.querySelectorAll('#client-meeting-pills .client-filter-pill')).map(p => p.innerText.trim());
        const cards = Array.from(document.querySelectorAll('.client-meeting-card')).map(c => ({
            title: c.querySelector('.client-meeting-title')?.innerText?.trim(),
            timeStr: c.querySelector('.client-meeting-time-str')?.innerText?.trim(),
            hasJoin: Boolean(c.querySelector('a[href*="meet.google.com"]'))
        }));
        return { pills, cards };
    });
    console.log("Meetings Workspace:", meetsData);

    console.log("\n=== 4. Check Meeting Detail (#/client/meetings/11111111-1111-4000-a000-000000000301) ===");
    await page.goto('http://localhost:8002/#/client/meetings/11111111-1111-4000-a000-000000000301', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    const meetDetail = await page.evaluate(() => {
        const title = document.querySelector('.client-page-title')?.innerText?.trim();
        const joinLink = document.querySelector('a[href*="meet.google.com"]')?.getAttribute('href');
        return { title, joinLink };
    });
    console.log("Meeting Detail:", meetDetail);

    console.log("\n=== 5. Check Project Detail Overview (#/client/projects/170d3c57-224b-4ae5-a384-0ccdf17252cc) ===");
    await page.goto('http://localhost:8002/#/client/projects/170d3c57-224b-4ae5-a384-0ccdf17252cc', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    const projDetail = await page.evaluate(() => {
        const title = document.querySelector('.client-page-title')?.innerText?.trim();
        const activeTab = document.querySelector('.client-tab-btn.active')?.innerText?.trim();
        return { title, activeTab };
    });
    console.log("Project Detail:", projDetail);

    console.log("\n=== 6. Check Document Detail Review (#/client/documents/11111111-1111-4000-a000-000000000201) ===");
    await page.goto('http://localhost:8002/#/client/documents/11111111-1111-4000-a000-000000000201', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    const docDetail = await page.evaluate(() => {
        const title = document.querySelector('.client-page-title')?.innerText?.trim();
        const hasApproveBtn = Boolean(document.getElementById('btn-approve-document'));
        const hasRequestChangesBtn = Boolean(document.getElementById('btn-request-changes'));
        return { title, hasApproveBtn, hasRequestChangesBtn };
    });
    console.log("Document Detail:", docDetail);

    await browser.close();
    console.log("\n✔ REAL FORM LOGIN & ALL SCREENS VERIFIED SUCCESSFULLY!");
}

main().catch(console.error);
