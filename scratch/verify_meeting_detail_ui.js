const puppeteer = require('puppeteer');

async function main() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.toString()));
    page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    console.log("=== 1. Login as Client Alpha ===");
    await page.goto('http://localhost:8002/#/client/login', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#client-login-email');
    await page.type('#client-login-email', 'client_alpha_4a@firstwin.io');
    await page.type('#client-login-password', process.env.TEST_CLIENT_PASSWORD || 'Password123!');
    await page.click('#btn-submit-password-login');
    await new Promise(r => setTimeout(r, 2500));

    console.log("\n=== 2. Load Meeting Detail (#/client/meetings/11111111-1111-4000-a000-000000000301) ===");
    await page.goto('http://localhost:8002/#/client/meetings/11111111-1111-4000-a000-000000000301', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2500));

    const meetingDetail = await page.evaluate(() => {
        const title = document.querySelector('.client-page-title')?.innerText?.trim();
        const agenda = document.querySelector('.client-meeting-detail-main .client-card')?.innerText?.trim();
        const decisions = Array.from(document.querySelectorAll('.client-decision-item')).map(d => d.innerText.trim());
        const notes = Array.from(document.querySelectorAll('.client-note-item')).map(n => n.innerText.trim());
        const actions = Array.from(document.querySelectorAll('.client-action-item')).map(a => a.innerText.trim());
        const participants = Array.from(document.querySelectorAll('.client-participant-item')).map(p => ({
            name: p.querySelector('.client-participant-name')?.innerText?.trim(),
            role: p.querySelector('.client-participant-role')?.innerText?.trim()
        }));
        const attachedDocs = Array.from(document.querySelectorAll('.client-attached-doc-item')).map(d => d.innerText.trim());
        const joinBtn = document.querySelector('a[href*="meet.google.com"]')?.getAttribute('href');
        const hasSpinner = Boolean(document.querySelector('.portal-spinner'));

        return {
            title,
            agenda,
            decisions,
            notes,
            actions,
            participants,
            attachedDocs,
            joinBtn,
            hasSpinner
        };
    });

    console.log("Extracted UI State:", JSON.stringify(meetingDetail, null, 2));

    // Assertions
    console.log("\n=== Assertions ===");
    console.log("1. Title matches:", meetingDetail.title === 'Презентація результатів аудиту');
    console.log("2. Agenda rendered (not placeholder):", meetingDetail.agenda.includes('Огляд ключових показників') && !meetingDetail.agenda.includes('Порядок денний узгоджується'));
    console.log("3. Participants count:", meetingDetail.participants.length, "(Expected: 2)");
    console.log("4. Visible Notes count:", meetingDetail.notes.length, "(Expected: 1)");
    console.log("5. Internal note hidden:", !JSON.stringify(meetingDetail.notes).includes('[Внутрішньо FIRSTWIN]'));
    console.log("6. Decisions count:", meetingDetail.decisions.length, "(Expected: 1)");
    console.log("7. Internal decision hidden:", !JSON.stringify(meetingDetail.decisions).includes('[Внутрішньо]'));
    console.log("8. Attached docs count:", meetingDetail.attachedDocs.length, "(Expected: 1)");
    console.log("9. Actions count:", meetingDetail.actions.length, "(Expected: 1)");
    console.log("10. Join link present:", Boolean(meetingDetail.joinBtn));
    console.log("11. Infinite spinner:", meetingDetail.hasSpinner ? "YES (FAIL)" : "NO (PASS)");
    console.log("12. Console runtime errors:", consoleErrors.length === 0 ? "0 (PASS)" : consoleErrors);

    await browser.close();
}

main().catch(console.error);
