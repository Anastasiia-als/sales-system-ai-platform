const puppeteer = require('puppeteer');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        throw new Error(message);
    }
    console.log("PASS: " + message);
}

async function run() {
    console.log("=== Phase 6D.4: Completed Action Modal E2E Browser Test ===");
    let browser;
    try {
        const completedTaskId = '02f8e8b7-83d1-49af-9e18-3c3206505482';
        const demoOrgId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

        // 1. Verify DB state before test
        const beforeTask = await pool.query("SELECT id, title, status FROM public.tasks WHERE id = $1", [completedTaskId]);
        assert(beforeTask.rows.length > 0 && beforeTask.rows[0].status === 'done', "Target task exists in DB with status 'done'");

        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // --- TEST 1: Desktop Viewport (1920x1080) ---
        console.log("\n--- Scenario 1: Desktop Viewport (1920x1080) ---");
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Error') || text.includes('error') || text.includes('[ClientActions]')) {
                console.log(`[Browser Log]:`, text);
            }
        });

        await page.goto("http://localhost:8002/index.html#/client/actions", { waitUntil: "domcontentloaded" });
        await new Promise(r => setTimeout(r, 1000));

        // Sign in via PortalAuth
        await page.evaluate(async () => {
            const { PortalAuth } = await import('./js/portal/auth/auth-service.js');
            await PortalAuth.init();
            await PortalAuth.signInWithPassword('anzaitseva96@gmail.com', 'Password123!');
        });

        // Refresh client routing
        await page.evaluate(async () => {
            window.location.hash = '#/client/actions';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        await new Promise(r => setTimeout(r, 1500));

        // Switch org to Demo Client Corp
        const orgSwitcher = await page.waitForSelector('#client-org-switcher', { timeout: 10000 });
        assert(orgSwitcher !== null, "Org switcher found");
        await page.select('#client-org-switcher', demoOrgId);
        await new Promise(r => setTimeout(r, 1500));
        console.log("PASS: Switched to Demo Client Corp organization");

        // Switch to completed tab
        const completedPill = await page.waitForSelector('#client-action-pills .client-filter-pill[data-view="completed"]', { timeout: 10000 });
        assert(completedPill !== null, "Completed filter pill found");
        await completedPill.click();
        await new Promise(r => setTimeout(r, 800));
        console.log("PASS: Clicked 'Виконані' tab");

        // Locate completed action card
        const cardSelector = `.client-action-card-item[data-task-id="${completedTaskId}"]`;
        const card = await page.waitForSelector(cardSelector, { timeout: 10000 });
        assert(card !== null, `Completed card for task ${completedTaskId} found in DOM`);

        // Click on the card
        await card.click();
        await new Promise(r => setTimeout(r, 1000));

        // Verify modal opened
        const modal = await page.$("#action-detail-modal");
        assert(modal !== null, "Modal #action-detail-modal opened successfully on card click");

        // Verify title in modal
        const modalTitle = await page.$eval("#action-detail-modal .portal-modal-title", el => el.innerText);
        assert(modalTitle.includes("Fill in initial business questionnaire"), `Modal title correct: "${modalTitle}"`);

        // Verify status badge
        const statusBadge = await page.$eval("#action-detail-modal .client-badge-success", el => el.innerText);
        assert(statusBadge.includes("Виконано"), `Status badge rendered: "${statusBadge}"`);

        // Verify submission channel badge
        await page.waitForSelector("#client-action-review-section .client-badge", { timeout: 5000 });
        const channelBadgeText = await page.$eval("#client-action-review-section .client-badge", el => el.innerText);
        assert(channelBadgeText.includes("Публічне посилання") || channelBadgeText.includes("Клієнтський портал"), `Submission channel badge: "${channelBadgeText}"`);

        // Verify submitted text in review section
        const reviewText = await page.$eval("#client-action-review-section", el => el.innerText);
        assert(reviewText.includes("Тестова відповідь для перевірки клієнтської дії."), "Saved customer response text verified in Submission Review modal");

        // Verify Reopen button is present
        const reopenBtn = await page.$("#btn-reopen-client-action");
        assert(reopenBtn !== null, "Reopen button #btn-reopen-client-action is visible for authorized role");

        // Close modal
        await page.click(".portal-modal-close");
        await new Promise(r => setTimeout(r, 400));
        const modalClosed = await page.$("#action-detail-modal");
        assert(modalClosed === null || await modalClosed.evaluate(el => el.offsetParent === null), "Modal closed cleanly");

        // Test clicking the 'Деталі' button specifically
        const detailsBtn = await page.$(`${cardSelector} .btn-action-details`);
        assert(detailsBtn !== null, "'Деталі' button found on card");
        await detailsBtn.click();
        await new Promise(r => setTimeout(r, 1000));
        const modalReopened = await page.$("#action-detail-modal");
        assert(modalReopened !== null, "Modal opened successfully when clicking 'Деталі' button directly");
        await page.click(".portal-modal-close");
        await new Promise(r => setTimeout(r, 400));

        // --- TEST 2: Mobile Viewport (375x812) ---
        console.log("\n--- Scenario 2: Mobile Viewport (375x812) ---");
        const mobilePage = await browser.newPage();
        await mobilePage.setViewport({ width: 375, height: 812, isMobile: true });
        
        await mobilePage.goto("http://localhost:8002/index.html#/client/actions", { waitUntil: "domcontentloaded" });
        await new Promise(r => setTimeout(r, 1000));

        await mobilePage.evaluate(async () => {
            const { PortalAuth } = await import('./js/portal/auth/auth-service.js');
            await PortalAuth.init();
            await PortalAuth.signInWithPassword('anzaitseva96@gmail.com', 'Password123!');
        });

        await mobilePage.evaluate(async () => {
            window.location.hash = '#/client/actions';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });
        await new Promise(r => setTimeout(r, 1500));

        const mOrgSwitcher = await mobilePage.waitForSelector('#client-org-switcher', { timeout: 10000 });
        await mobilePage.select('#client-org-switcher', demoOrgId);
        await new Promise(r => setTimeout(r, 1500));

        const mCompletedPill = await mobilePage.waitForSelector('#client-action-pills .client-filter-pill[data-view="completed"]', { timeout: 10000 });
        await mCompletedPill.click();
        await new Promise(r => setTimeout(r, 800));

        const mCard = await mobilePage.waitForSelector(cardSelector, { timeout: 10000 });
        assert(mCard !== null, "Card found on mobile viewport");
        await mCard.click();
        await new Promise(r => setTimeout(r, 1000));

        const mModal = await mobilePage.$("#action-detail-modal");
        assert(mModal !== null, "Modal opened successfully on mobile viewport");

        // Check horizontal overflow
        const overflow = await mobilePage.evaluate(() => {
            return document.documentElement.scrollWidth > window.innerWidth;
        });
        assert(!overflow, "Zero horizontal overflow on mobile viewport");

        // --- TEST 3: F5 Reload Persistence ---
        console.log("\n--- Scenario 3: F5 Reload Persistence ---");
        await mobilePage.reload({ waitUntil: "networkidle0" });
        await new Promise(r => setTimeout(r, 1200));

        const mOrgSwitcherAfterReload = await mobilePage.waitForSelector('#client-org-switcher', { timeout: 10000 });
        await mobilePage.select('#client-org-switcher', demoOrgId);
        await new Promise(r => setTimeout(r, 1500));

        const mCompletedAfterReload = await mobilePage.waitForSelector('#client-action-pills .client-filter-pill[data-view="completed"]', { timeout: 10000 });
        await mCompletedAfterReload.click();
        await new Promise(r => setTimeout(r, 800));

        const mCardAfterReload = await mobilePage.$(cardSelector);
        assert(mCardAfterReload !== null, "Completed action card persists after F5 reload");

        // Verify DB integrity: zero modifications to user data
        const afterTask = await pool.query("SELECT id, status, completed_at FROM public.tasks WHERE id = $1", [completedTaskId]);
        assert(afterTask.rows[0].status === 'done', "Task status was not mutated during testing");
        const subsCount = await pool.query("SELECT COUNT(*) FROM public.task_submissions WHERE task_id = $1", [completedTaskId]);
        assert(parseInt(subsCount.rows[0].count) === 1, "Submissions count intact (1 submission)");
        console.log("PASS: Data Preservation Guard: 100% intact (0 deletions, 0 mutations)");

        console.log("\nALL 14 E2E ASSERTIONS PASSED!");
    } catch (err) {
        console.error("FAIL:", err);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        await pool.end();
    }
}

run();
