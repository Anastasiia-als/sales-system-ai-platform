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
    console.log("=== Phase 6D.4: Reopened Action Modal & Submission History E2E Test ===");
    let browser;
    try {
        const reopenedTaskId = '02f8e8b7-83d1-49af-9e18-3c3206505482';
        const demoOrgId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

        // 1. Verify DB state before test (must be 'todo' with 1 submission)
        const beforeTask = await pool.query("SELECT id, title, status, completed_at FROM public.tasks WHERE id = $1", [reopenedTaskId]);
        assert(beforeTask.rows.length > 0 && beforeTask.rows[0].status === 'todo', "Target task exists in DB with status 'todo'");
        assert(beforeTask.rows[0].completed_at === null, "completed_at is null for reopened task");

        const beforeSubs = await pool.query("SELECT id, task_id, submission_type, payload, created_at FROM public.task_submissions WHERE task_id = $1", [reopenedTaskId]);
        assert(beforeSubs.rows.length === 1, "Exactly 1 prior submission exists in DB");
        assert(beforeSubs.rows[0].payload?.text === "Тестова відповідь для перевірки клієнтської дії.", "Prior submission text matches user acceptance text");

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

        // Active filter pill should be selected by default (or click 'Активні')
        const activePill = await page.waitForSelector('#client-action-pills .client-filter-pill[data-view="active"]', { timeout: 10000 });
        assert(activePill !== null, "Active filter pill found");
        await activePill.click();
        await new Promise(r => setTimeout(r, 800));

        // Locate reopened action card
        const cardSelector = `.client-action-card-item[data-task-id="${reopenedTaskId}"]`;
        const card = await page.waitForSelector(cardSelector, { timeout: 10000 });
        assert(card !== null, `Reopened card for task ${reopenedTaskId} found in DOM under 'todo'`);

        // Click on the card to open modal
        await card.click();
        await new Promise(r => setTimeout(r, 1200));

        // Verify modal opened
        const modal = await page.$("#action-detail-modal");
        assert(modal !== null, "Modal #action-detail-modal opened successfully on card click");

        // Verify title in modal
        const modalTitle = await page.$eval("#action-detail-modal .portal-modal-title", el => el.innerText);
        assert(modalTitle.includes("Fill in initial business questionnaire"), `Modal title correct: "${modalTitle}"`);

        // Verify status badge is 'До виконання' (NOT 'Виконано')
        const statusBadge = await page.$eval("#action-detail-modal .client-badge-warning", el => el.innerText);
        assert(statusBadge.includes("До виконання"), `Status badge rendered: "${statusBadge}"`);

        // Verify active submission form elements are present and active
        const textarea = await page.$("#client-action-text-input");
        assert(textarea !== null, "Textarea #client-action-text-input is present for new submission");

        const dropzone = await page.$("#client-action-dropzone");
        assert(dropzone !== null, "File dropzone #client-action-dropzone is present");

        const submitBtn = await page.$("#btn-submit-client-action");
        assert(submitBtn !== null, "Submit button #btn-submit-client-action is present");
        const submitBtnText = await page.$eval("#btn-submit-client-action", el => el.innerText);
        assert(submitBtnText.includes("Надіслати відповідь"), `Submit button text: "${submitBtnText}"`);

        // Verify Previous Submissions History Section is present and populated
        await page.waitForSelector("#client-action-review-section", { timeout: 5000 });
        const reviewDisplay = await page.$eval("#client-action-review-section", el => window.getComputedStyle(el).display);
        assert(reviewDisplay !== "none", "Previous submissions section is visible (display != 'none')");

        const reviewHtml = await page.$eval("#client-action-review-section", el => el.innerHTML);
        assert(reviewHtml.includes("Історія попередніх відповідей (1)"), "Header contains 'Історія попередніх відповідей (1)'");
        assert(reviewHtml.includes("Ітерація 1"), "History card displays 'Ітерація 1'");
        assert(reviewHtml.includes("Публічне посилання"), "Channel badge displays 'Публічне посилання'");
        assert(reviewHtml.includes("Автор:"), "Author label is rendered");
        assert(reviewHtml.includes("Тестова відповідь для перевірки клієнтської дії."), "Prior submission text 'Тестова відповідь для перевірки клієнтської дії.' is rendered");

        // Close modal
        await page.click(".portal-modal-close");
        await new Promise(r => setTimeout(r, 400));

        // Test clicking 'Деталі' button directly
        const detailsBtn = await page.$(`${cardSelector} .btn-action-details`);
        assert(detailsBtn !== null, "'Деталі' button found on reopened card");
        await detailsBtn.click();
        await new Promise(r => setTimeout(r, 1200));

        const reopenedModal = await page.$("#action-detail-modal");
        assert(reopenedModal !== null, "Modal opened successfully when clicking 'Деталі' button directly");
        const recheckReview = await page.$eval("#client-action-review-section", el => el.innerText);
        assert(recheckReview.includes("Тестова відповідь для перевірки клієнтської дії."), "Review section populated via 'Деталі' click");

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

        const mCard = await mobilePage.waitForSelector(cardSelector, { timeout: 10000 });
        assert(mCard !== null, "Card found on mobile viewport");
        await mCard.click();
        await new Promise(r => setTimeout(r, 1200));

        const mModal = await mobilePage.$("#action-detail-modal");
        assert(mModal !== null, "Modal opened successfully on mobile viewport");

        const mForm = await mobilePage.$("#client-action-text-input");
        assert(mForm !== null, "Submission form present on mobile");

        const mReviewText = await mobilePage.$eval("#client-action-review-section", el => el.innerText);
        assert(mReviewText.includes("Ітерація 1") && mReviewText.includes("Тестова відповідь для перевірки клієнтської дії."), "Previous submission history rendered on mobile");

        // Zero horizontal overflow check
        const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        assert(!overflow, "Zero horizontal overflow on mobile viewport");

        // --- TEST 3: F5 Reload Persistence ---
        console.log("\n--- Scenario 3: F5 Reload Persistence ---");
        await mobilePage.reload({ waitUntil: "networkidle0" });
        await new Promise(r => setTimeout(r, 1200));

        const mOrgSwitcherAfterReload = await mobilePage.waitForSelector('#client-org-switcher', { timeout: 10000 });
        await mobilePage.select('#client-org-switcher', demoOrgId);
        await new Promise(r => setTimeout(r, 1500));

        const mCardAfterReload = await mobilePage.$(cardSelector);
        assert(mCardAfterReload !== null, "Reopened action card persists after F5 reload");

        // --- Verify DB Integrity / Data Preservation Guard ---
        console.log("\n--- Data Preservation Guard Verification ---");
        const afterTask = await pool.query("SELECT id, status, completed_at FROM public.tasks WHERE id = $1", [reopenedTaskId]);
        assert(afterTask.rows[0].status === 'todo', "Task status was NOT mutated during testing ('todo')");
        assert(afterTask.rows[0].completed_at === null, "completed_at was NOT mutated during testing (null)");

        const afterSubs = await pool.query("SELECT id, task_id, payload FROM public.task_submissions WHERE task_id = $1", [reopenedTaskId]);
        assert(afterSubs.rows.length === 1, "Submissions count intact (exactly 1 submission)");
        assert(afterSubs.rows[0].id === beforeSubs.rows[0].id, "Submission ID is identical (no replacement)");
        assert(afterSubs.rows[0].payload?.text === "Тестова відповідь для перевірки клієнтської дії.", "Submission text is 100% intact");

        console.log("PASS: Data Preservation Guard: 100% intact (0 deletions, 0 mutations, 0 replacements)");
        console.log("\nALL 20 E2E ASSERTIONS PASSED!");
    } catch (err) {
        console.error("FAIL:", err);
        process.exit(1);
        throw err;
    } finally {
        if (browser) await browser.close();
        await pool.end();
    }
}

run();
