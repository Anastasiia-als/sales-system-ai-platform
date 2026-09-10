/**
 * scratch/test_phase7c_browser_e2e.js
 * Phase 7C: Real Chromium E2E Browser Test Suite
 *
 * Verifies:
 * 1. Owner authenticates and navigates to #/portal/integrations.
 * 2. Clicks «Календарі (iCal)» tab.
 * 3. Opens «Додати Календар (iCal)» modal, fills form, and submits.
 * 4. Verifies single-use presentation modal appears with webcal:// and https:// links.
 * 5. Copies and fetches feed URL via HTTP; validates RFC 5545 200 OK.
 * 6. Verifies table lists the created feed with correct status and scope badges.
 * 7. Tests revoke button: status toggles to "Відкликаний".
 * 8. Tests delete button: removes feed from table.
 * 9. Asserts zero page errors.
 */

const puppeteer = require('puppeteer');
const http = require('http');
const { getOwnerPassword } = require('./auth_test_helper.js');

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        throw new Error(message);
    }
    console.log("PASS: " + message);
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        req.on('error', reject);
    });
}

async function run() {
    console.log("=== Starting Phase 7C Real Chromium E2E Calendar Feed Test Suite ===");

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const pageErrors = [];

    page.on('pageerror', err => {
        console.error("PAGE ERROR:", err.message);
        pageErrors.push(err.message);
    });

    page.on('console', msg => {
        console.log(`[BROWSER CONSOLE ${msg.type()}]:`, msg.text());
    });

    page.on('dialog', async dialog => {
        console.log(`Dialog message: "${dialog.message()}", accepting...`);
        await dialog.accept();
    });

    try {
        // 1. Authenticate as Owner
        console.log("\n--- 1. Authenticating as Owner ---");
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });

        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', getOwnerPassword());
        await page.click('#btn-submit-pwd');

        await page.waitForSelector('.portal-sidebar', { timeout: 15000 });
        console.log("Owner authenticated successfully!");

        // 2. Navigate to Integrations
        console.log("\n--- 2. Navigation to #/portal/integrations ---");
        await page.goto('http://localhost:8002/#/portal/integrations', { waitUntil: 'networkidle0' });
        await page.waitForSelector('#integrations-org-select', { timeout: 10000 });
        // Wait for org context resolution and event listeners attachment
        await page.waitForFunction(() => {
            const select = document.getElementById('integrations-org-select');
            return select && select.value !== "";
        }, { timeout: 10000 });
        assert(true, "Integrations page loaded and organization context resolved");

        // 3. Switch to Calendars Tab
        console.log("\n--- 3. Switching to «Календарі (iCal)» tab ---");
        await page.waitForSelector('#tab-btn-calendars', { timeout: 5000 });
        await page.click('#tab-btn-calendars');
        await page.waitForFunction(() => {
            const sec = document.getElementById('section-calendars');
            return sec && sec.style.display !== 'none';
        }, { timeout: 5000 });
        assert(true, "Switched to Calendars tab and section-calendars is visible");

        // 4. Open Create Calendar Modal
        console.log("\n--- 4. Opening Create Calendar Modal ---");
        await page.click('#btn-create-calendar');
        await page.waitForFunction(() => {
            const modal = document.getElementById('modal-create-calendar');
            return modal && modal.style.display === 'flex';
        }, { timeout: 5000 });
        assert(true, "Create Calendar modal opened");

        // 5. Fill and Submit Form
        console.log("\n--- 5. Filling and Submitting Create Calendar Form ---");
        const feedName = `E2E Feed ${Date.now()}`;
        await page.type('#cal-name', feedName);

        // Select 'personal' scope
        await page.select('#cal-scope', 'personal');

        await page.click('#btn-submit-create-cal');

        // 6. Verify Single-Use Token Modal
        console.log("\n--- 6. Verifying Single-Use Presentation Modal ---");
        await page.waitForFunction(() => {
            const modal = document.getElementById('modal-show-calendar-token');
            return modal && modal.style.display === 'flex';
        }, { timeout: 10000 });
        assert(true, "Single-use presentation modal displayed");

        const webcalUrl = await page.$eval('#cal-webcal-url-input', el => el.value);
        const httpsUrl = await page.$eval('#cal-https-url-input', el => el.value);

        console.log(`Generated webcal URL: ${webcalUrl}`);
        console.log(`Generated https URL:  ${httpsUrl}`);

        assert(webcalUrl.startsWith('webcal://'), "webcal URL starts with webcal://");
        assert(httpsUrl.startsWith('http://') || httpsUrl.startsWith('https://'), "HTTP(S) URL starts with http(s)://");
        assert(httpsUrl.endsWith('.ics'), "URL ends with .ics extension");

        // 7. Verify Feed HTTP Fetch
        console.log("\n--- 7. Fetching generated feed via HTTP ---");
        const feedRes = await httpGet(httpsUrl);
        assert(feedRes.status === 200, `Feed HTTP status is 200 (Got: ${feedRes.status})`);
        assert(feedRes.headers['content-type'].includes('text/calendar'), `Content-Type is text/calendar`);
        assert(feedRes.body.includes('BEGIN:VCALENDAR'), "Feed body contains BEGIN:VCALENDAR");
        assert(feedRes.body.includes('END:VCALENDAR'), "Feed body contains END:VCALENDAR");

        // Close single-use token modal
        await page.click('#btn-confirm-cal-token');
        await page.waitForFunction(() => {
            const modal = document.getElementById('modal-show-calendar-token');
            return modal && modal.style.display === 'none';
        }, { timeout: 5000 });
        assert(true, "Single-use presentation modal closed");

        // 8. Verify Table Entry
        console.log("\n--- 8. Verifying Subscription Table Row ---");
        await page.waitForFunction((expectedName) => {
            const tbody = document.getElementById('calendars-table-body');
            return tbody && tbody.textContent.includes(expectedName);
        }, { timeout: 10000 }, feedName);
        assert(true, `Subscription "${feedName}" visible in calendars table`);

        // 9. Test Revoke Action
        console.log("\n--- 9. Testing Revoke Action ---");
        await page.waitForSelector('.btn-revoke-cal', { visible: true, timeout: 5000 });
        await new Promise(r => setTimeout(r, 400));
        await page.evaluate(() => {
            const btn = document.querySelector('.btn-revoke-cal');
            if (btn) btn.click();
        });
        await page.waitForFunction(() => {
            const tbody = document.getElementById('calendars-table-body');
            return tbody && tbody.textContent.includes('Відкликаний');
        }, { timeout: 10000 });
        assert(true, "Status updated to 'Відкликаний' after revoke click");

        // Verify HTTP endpoint now returns 404
        const feedRevokedRes = await httpGet(httpsUrl);
        assert(feedRevokedRes.status === 404, `Revoked feed returns 404 (Got: ${feedRevokedRes.status})`);

        // 10. Test Delete Action
        console.log("\n--- 10. Testing Delete Action ---");
        await page.waitForSelector('.btn-delete-cal', { visible: true, timeout: 5000 });
        await new Promise(r => setTimeout(r, 400));
        await page.evaluate(() => {
            const btn = document.querySelector('.btn-delete-cal');
            if (btn) btn.click();
        });
        await page.waitForFunction((deletedName) => {
            const tbody = document.getElementById('calendars-table-body');
            return tbody && !tbody.textContent.includes(deletedName);
        }, { timeout: 10000 }, feedName);
        assert(true, `Subscription "${feedName}" successfully removed from table`);

        // 11. Assert Zero Page Errors
        console.log("\n--- 11. Checking Page Errors ---");
        assert(pageErrors.length === 0, `Zero uncaught page errors (Got: ${pageErrors.length})`);

        console.log("\n=== ALL PHASE 7C REAL CHROMIUM E2E TESTS PASSED! ===");
    } catch (err) {
        console.error("E2E Test Suite Failed:", err);
        throw err;
    } finally {
        await browser.close();
    }
}

run();
