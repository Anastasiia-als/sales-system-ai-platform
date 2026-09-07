const puppeteer = require('puppeteer');

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        throw new Error(message);
    }
    console.log("PASS: " + message);
}

async function run() {
    console.log("=== Starting Phase 7A Real Chromium E2E Integrations View Suite ===");

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', err => {
        console.error("PAGE ERROR:", err.message);
        pageErrors.push(err.message);
    });

    page.on('console', msg => {
        if (msg.type() === 'error') {
            const txt = msg.text();
            // Filter expected benign noise if any
            if (!txt.includes('favicon') && !txt.includes('404')) {
                consoleErrors.push(txt);
            }
        }
    });

    try {
        // -------------------------------------------------------------
        // 1. Owner Authentication
        // -------------------------------------------------------------
        console.log("\n--- 1. Authenticating as Owner ---");
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });

        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', process.env.OWNER_PASSWORD || 'Password123!');
        await page.click('#btn-submit-pwd');

        // Wait for portal shell to load
        await page.waitForSelector('.portal-sidebar', { timeout: 15000 });
        console.log("Owner authenticated successfully!");

        // -------------------------------------------------------------
        // 2. Navigation via Sidebar Menu «Інтеграції»
        // -------------------------------------------------------------
        console.log("\n--- 2. Navigation via Sidebar Menu ---");
        await page.waitForSelector('a[href="#/portal/integrations"]', { timeout: 10000 });
        await page.click('a[href="#/portal/integrations"]');

        // Wait for integrations view to mount
        await page.waitForSelector('#integrations-org-select', { timeout: 15000 });

        // Assert view header
        const pageTitle = await page.$eval('.portal-view-title', el => el.textContent.trim());
        assert(pageTitle.includes("Інтеграції"), `View title contains 'Інтеграції' (Got: '${pageTitle}')`);

        // Assert absence of crash screen
        const crashScreen = await page.$('.portal-empty-title');
        if (crashScreen) {
            const crashText = await page.$eval('.portal-empty-title', el => el.textContent.trim());
            assert(!crashText.includes("Помилка завантаження"), `No portal crash screen (Got: '${crashText}')`);
        } else {
            assert(true, "No portal crash screen rendered");
        }

        // -------------------------------------------------------------
        // 3. Organization Context Resolution
        // -------------------------------------------------------------
        console.log("\n--- 3. Organization Context Resolution ---");
        // Wait for select options to populate
        await page.waitForFunction(() => {
            const select = document.getElementById('integrations-org-select');
            return select && select.options.length > 0 && select.value !== "";
        }, { timeout: 10000 });

        const orgSelectData = await page.evaluate(() => {
            const select = document.getElementById('integrations-org-select');
            return {
                value: select.value,
                selectedText: select.options[select.selectedIndex]?.textContent?.trim(),
                optionsCount: select.options.length
            };
        });

        assert(Boolean(orgSelectData.value), `Organization selected has non-empty ID: ${orgSelectData.value}`);
        assert(orgSelectData.optionsCount > 0, `Organization select has ${orgSelectData.optionsCount} option(s)`);
        console.log(`Active Organization: "${orgSelectData.selectedText}" (${orgSelectData.value})`);

        // Wait for endpoints table to load
        await page.waitForFunction(() => {
            const tbody = document.getElementById('endpoints-table-body');
            const spinner = tbody?.querySelector('.portal-spinner');
            return tbody && !spinner;
        }, { timeout: 10000 });
        assert(true, "Endpoints table finished loading without spinner");

        // -------------------------------------------------------------
        // 4. Tab Switching (Endpoints vs Deliveries)
        // -------------------------------------------------------------
        console.log("\n--- 4. Tab Switching ---");
        await page.click('#tab-btn-deliveries');
        await page.waitForFunction(() => {
            const sec = document.getElementById('section-deliveries');
            return sec && sec.style.display !== 'none';
        }, { timeout: 5000 });
        assert(true, "Switched to 'Журнал доставок' tab successfully");

        await page.click('#tab-btn-endpoints');
        await page.waitForFunction(() => {
            const sec = document.getElementById('section-endpoints');
            return sec && sec.style.display !== 'none';
        }, { timeout: 5000 });
        assert(true, "Switched back to 'Кінцеві точки' tab successfully");

        // -------------------------------------------------------------
        // 5. Create Webhook Modal
        // -------------------------------------------------------------
        console.log("\n--- 5. Create Webhook Modal ---");
        await page.click('#btn-create-webhook');
        await page.waitForFunction(() => {
            const modal = document.getElementById('modal-create-webhook');
            return modal && modal.style.display === 'flex';
        }, { timeout: 5000 });
        assert(true, "Create Webhook modal opened");

        const modalOrgValue = await page.$eval('#wh-create-org', el => el.value);
        assert(modalOrgValue === orgSelectData.value, `Modal org select defaults to active org: ${modalOrgValue}`);

        await page.click('#btn-close-create-modal');
        await page.waitForFunction(() => {
            const modal = document.getElementById('modal-create-webhook');
            return modal && modal.style.display === 'none';
        }, { timeout: 5000 });
        assert(true, "Create Webhook modal closed cleanly");

        // -------------------------------------------------------------
        // 6. Direct Navigation (#/portal/integrations)
        // -------------------------------------------------------------
        console.log("\n--- 6. Direct URL Navigation ---");
        await page.goto('http://localhost:8002/#/portal/integrations', { waitUntil: 'networkidle0' });
        await page.waitForSelector('#integrations-org-select', { timeout: 10000 });
        await page.waitForFunction(() => {
            const select = document.getElementById('integrations-org-select');
            const tbody = document.getElementById('endpoints-table-body');
            const spinner = tbody?.querySelector('.portal-spinner');
            return select && select.value !== "" && !spinner;
        }, { timeout: 10000 });
        assert(true, "Direct navigation to #/portal/integrations loaded cleanly");

        // -------------------------------------------------------------
        // 7. Mobile Viewport (375x812)
        // -------------------------------------------------------------
        console.log("\n--- 7. Mobile Viewport (375x812) ---");
        await page.setViewport({ width: 375, height: 812 });
        await page.goto('http://localhost:8002/#/portal/integrations', { waitUntil: 'networkidle0' });
        await page.waitForSelector('#integrations-org-select', { timeout: 10000 });

        const overflow = await page.evaluate(() => {
            return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        assert(!overflow, "Mobile viewport has zero horizontal scroll overflow");
        assert(true, "Integrations view renders cleanly on Mobile 375x812");

        // -------------------------------------------------------------
        // 8. Regression Error Audit
        // -------------------------------------------------------------
        console.log("\n--- 8. Strict Regression Audit (No Page Errors) ---");
        const authFunctionErrors = pageErrors.filter(e => e.includes("getCurrentOrganizationId"));
        assert(authFunctionErrors.length === 0, "Zero PortalAuth.getCurrentOrganizationId errors occurred");
        assert(pageErrors.length === 0, `Zero uncaught page errors (Got: ${pageErrors.length})`);

        console.log("\n=== ALL REAL CHROMIUM E2E INTEGRATIONS TESTS PASSED! ===");
    } catch (err) {
        console.error("E2E Test Suite Failed:", err);
        throw err;
    } finally {
        await browser.close();
    }
}

run();
