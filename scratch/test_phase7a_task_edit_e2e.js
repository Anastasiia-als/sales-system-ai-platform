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
    console.log("=== Starting Phase 7A Task Edit & Dependencies E2E Regression Suite ===");

    // 1. Locate "Idempotency Test" project and "Draft Recommendations" task in DB
    const projRes = await pool.query("SELECT id, name, organization_id FROM public.projects WHERE name ILIKE '%Idempotency Test%' LIMIT 1");
    assert(projRes.rows.length > 0, "Found 'Idempotency Test' project in DB");
    const project = projRes.rows[0];

    const taskRes = await pool.query("SELECT id, title, status FROM public.tasks WHERE project_id = $1 AND title ILIKE '%Draft Recommendations%' LIMIT 1", [project.id]);
    assert(taskRes.rows.length > 0, "Found 'Draft Recommendations' task in DB");
    const targetTask = taskRes.rows[0];
    
    // Ensure clean initial state before test
    await pool.query("DELETE FROM public.task_dependencies WHERE task_id = $1", [targetTask.id]);
    await pool.query("UPDATE public.tasks SET status = 'todo' WHERE id = $1", [targetTask.id]);
    console.log(`Clean initial state set: task '${targetTask.title}' (${targetTask.id}) -> status 'todo', 0 dependencies.`);

    // Find another task in same project to use as a test dependency
    const otherTaskRes = await pool.query("SELECT id, title FROM public.tasks WHERE project_id = $1 AND id != $2 AND status != 'done' LIMIT 1", [project.id, targetTask.id]);
    assert(otherTaskRes.rows.length > 0, "Found another task in project to use as dependency");
    const depCandidate = otherTaskRes.rows[0];
    console.log(`Dependency Candidate Task: "${depCandidate.title}" (${depCandidate.id})`);

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

    try {
        await page.setViewport({ width: 1920, height: 1080 });

        // -------------------------------------------------------------
        // Step 1: Owner Authentication
        // -------------------------------------------------------------
        console.log("\n--- 1. Authenticating as Owner ---");
        await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });
        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', process.env.OWNER_PASSWORD || 'Password123!');
        await page.click('#btn-submit-pwd');
        await page.waitForSelector('.portal-sidebar', { timeout: 15000 });
        console.log("Authenticated as Owner successfully!");

        // -------------------------------------------------------------
        // Step 2: Exact User Flow Navigation (Clients -> Demo Client Corp -> Projects -> Idempotency Test -> Tasks)
        // -------------------------------------------------------------
        console.log("\n--- 2. Exact User Flow Navigation ---");
        await page.goto('http://localhost:8002/#/portal/clients', { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.body.innerText.includes("Demo Client Corp"), { timeout: 10000 });

        const clientLink = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(a => a.textContent.includes("Demo Client Corp"));
            return target ? target.getAttribute('href') : null;
        });
        assert(Boolean(clientLink), "Found link to 'Demo Client Corp'");
        await page.goto(`http://localhost:8002/${clientLink}`, { waitUntil: 'networkidle0' });

        // Switch to Projects tab on Client card
        await page.waitForSelector('.portal-tab-btn[data-tab="projects"]', { timeout: 10000 });
        await page.click('.portal-tab-btn[data-tab="projects"]');

        await page.waitForFunction(() => document.body.innerText.includes("Idempotency Test"), { timeout: 10000 });
        const projectLink = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(a => a.textContent.includes("Idempotency Test"));
            return target ? target.getAttribute('href') : null;
        });
        assert(Boolean(projectLink), "Found link to 'Idempotency Test'");
        await page.goto(`http://localhost:8002/${projectLink}`, { waitUntil: 'networkidle0' });

        // Wait for tabs to render & switch to Tasks tab
        await page.waitForSelector('.portal-tab-btn[data-tab="tasks"]', { timeout: 10000 });
        await page.click('.portal-tab-btn[data-tab="tasks"]');
        console.log("Switched to Tasks tab via user navigation path!");

        // Wait for tasks to load
        await page.waitForSelector(`[data-task-id="${targetTask.id}"]`, { timeout: 10000 });
        assert(true, `Found task card for '${targetTask.title}' in the UI`);

        // Helper function for checking explicit UI error
        async function assertNoSelectedDepIdsError(stepName) {
            const uiText = await page.evaluate(() => document.body.innerText);
            assert(!uiText.includes("selectedDepIds is not defined"), `[${stepName}] UI body does NOT contain 'selectedDepIds is not defined'`);
            
            const errBox = await page.evaluate(() => {
                const el = document.getElementById("task-modal-error");
                return el ? { text: el.innerText, display: el.style.display } : null;
            });
            if (errBox && errBox.display !== 'none') {
                assert(!errBox.text.includes("selectedDepIds is not defined"), `[${stepName}] Modal error box does NOT contain 'selectedDepIds is not defined'`);
            }
        }

        // -------------------------------------------------------------
        // Step 3: Scenario A — Edit Task WITHOUT Dependencies (todo -> done)
        // -------------------------------------------------------------
        console.log("\n--- 3. Scenario A: Edit Task Without Dependencies (todo -> done) ---");
        const editBtn = await page.$(`button.btn-open-task-detail[data-task-id="${targetTask.id}"]`);
        assert(Boolean(editBtn), "Found edit button for target task");
        await editBtn.click();

        // Wait for modal to open
        await page.waitForSelector('#form-task-modal', { timeout: 5000 });
        assert(true, "Task edit modal opened");

        // Change Status to 'done'
        await page.select('#task-status', 'done');

        // Scroll to bottom (as user did)
        await page.evaluate(() => {
            const modal = document.querySelector('.portal-modal');
            if (modal) modal.scrollTop = modal.scrollHeight;
        });

        // Click Save changes
        await page.click('#btn-submit-task-modal');

        // Assert explicit UI check
        await assertNoSelectedDepIdsError("Scenario A Post-Submit");

        // Wait for modal to close
        await page.waitForFunction(() => {
            const modal = document.getElementById("form-task-modal");
            return !modal;
        }, { timeout: 10000 });
        assert(true, "Modal closed cleanly on save without runtime errors");

        // Wait for UI to update row status to 'done'
        await page.waitForFunction((taskId) => {
            const sel = document.querySelector(`.portal-task-row[data-task-id="${taskId}"] .task-status-select`);
            return sel && sel.value === 'done';
        }, { timeout: 10000 }, targetTask.id);
        assert(true, "UI task row reloaded and displays status 'done'");

        // Verify task status updated in DB
        const statusCheck1 = await pool.query("SELECT status FROM public.tasks WHERE id = $1", [targetTask.id]);
        assert(statusCheck1.rows[0].status === 'done', `Task status in DB successfully updated to 'done' (Got: ${statusCheck1.rows[0].status})`);

        // -------------------------------------------------------------
        // Step 4: Scenario B — Reopen and Edit Same Task (done -> in_progress)
        // -------------------------------------------------------------
        console.log("\n--- 4. Scenario B: Reopen and Edit Same Task ---");
        await page.waitForSelector(`button.btn-open-task-detail[data-task-id="${targetTask.id}"]`, { timeout: 5000 });
        const editBtn2 = await page.$(`button.btn-open-task-detail[data-task-id="${targetTask.id}"]`);
        await editBtn2.click();

        await page.waitForSelector('#form-task-modal', { timeout: 5000 });
        const currentModalStatus = await page.$eval('#task-status', el => el.value);
        assert(currentModalStatus === 'done', `Modal reflects updated status 'done' (Got: ${currentModalStatus})`);

        // Change status to 'in_progress'
        await page.select('#task-status', 'in_progress');
        await page.click('#btn-submit-task-modal');

        await assertNoSelectedDepIdsError("Scenario B Post-Submit");

        await page.waitForFunction(() => {
            const modal = document.getElementById("form-task-modal");
            return !modal;
        }, { timeout: 10000 });
        assert(true, "Reopened task saved and modal closed cleanly");

        await page.waitForFunction((taskId) => {
            const sel = document.querySelector(`.portal-task-row[data-task-id="${taskId}"] .task-status-select`);
            return sel && sel.value === 'in_progress';
        }, { timeout: 10000 }, targetTask.id);
        assert(true, "UI task row reloaded and displays status 'in_progress'");

        const statusCheck2 = await pool.query("SELECT status FROM public.tasks WHERE id = $1", [targetTask.id]);
        assert(statusCheck2.rows[0].status === 'in_progress', `Task status updated to 'in_progress' (Got: ${statusCheck2.rows[0].status})`);

        // -------------------------------------------------------------
        // Step 5: Scenario C — Edit Task WITH Dependencies
        // -------------------------------------------------------------
        console.log("\n--- 5. Scenario C: Edit Task WITH Dependencies ---");
        await page.waitForSelector(`button.btn-open-task-detail[data-task-id="${targetTask.id}"]`, { timeout: 5000 });
        const editBtn3 = await page.$(`button.btn-open-task-detail[data-task-id="${targetTask.id}"]`);
        await editBtn3.click();
        await page.waitForSelector('#form-task-modal', { timeout: 5000 });

        // Select dependency in #task-dependencies-select
        await page.select('#task-dependencies-select', depCandidate.id);

        // Submit
        await page.click('#btn-submit-task-modal');

        await assertNoSelectedDepIdsError("Scenario C Post-Submit");

        await page.waitForFunction(() => {
            const modal = document.getElementById("form-task-modal");
            return !modal;
        }, { timeout: 10000 });
        assert(true, "Task with added dependency saved and modal closed cleanly");

        // Wait for UI to reload with the blocked badge indicator
        await page.waitForFunction((taskId) => {
            const row = document.querySelector(`.portal-task-row[data-task-id="${taskId}"]`);
            return row && row.querySelector('.portal-badge-blocked');
        }, { timeout: 10000 }, targetTask.id);
        assert(true, "UI task row reloaded with dependency indicators");

        // Verify dependency row exists in DB
        const depCheck = await pool.query("SELECT id FROM public.task_dependencies WHERE task_id = $1 AND depends_on_task_id = $2", [targetTask.id, depCandidate.id]);
        assert(depCheck.rows.length === 1, "Task dependency record successfully created in DB");

        // -------------------------------------------------------------
        // Step 6: Scenario D — Reopen Task WITH Dependencies and Remove Dependency
        // -------------------------------------------------------------
        console.log("\n--- 6. Scenario D: Reopen Task and Remove Dependency ---");
        await page.waitForSelector(`button.btn-open-task-detail[data-task-id="${targetTask.id}"]`, { timeout: 5000 });
        const editBtn4 = await page.$(`button.btn-open-task-detail[data-task-id="${targetTask.id}"]`);
        await editBtn4.click();
        await page.waitForSelector('#form-task-modal', { timeout: 5000 });

        // Verify dependency was pre-selected in modal
        const selectedDepsInModal = await page.$$eval('#task-dependencies-select option:checked', opts => opts.map(o => o.value));
        assert(selectedDepsInModal.includes(depCandidate.id), "Previously added dependency is selected in reopened modal");

        // Deselect dependency (empty selection) and restore initial status 'todo'
        await page.select('#task-dependencies-select');
        await page.select('#task-status', 'todo');

        await page.click('#btn-submit-task-modal');

        await assertNoSelectedDepIdsError("Scenario D Post-Submit");
        await page.waitForFunction(() => {
            const modal = document.getElementById("form-task-modal");
            return !modal;
        }, { timeout: 10000 });
        assert(true, "Task with removed dependency saved and modal closed cleanly");

        // Wait for blocked badge to disappear
        await page.waitForFunction((taskId) => {
            const row = document.querySelector(`.portal-task-row[data-task-id="${taskId}"]`);
            return row && !row.querySelector('.portal-badge-blocked') && row.querySelector('.task-status-select')?.value === 'todo';
        }, { timeout: 10000 }, targetTask.id);
        assert(true, "UI task row reloaded with clean state (status 'todo', zero dependencies)");

        // Verify dependency row removed in DB
        const depCheck2 = await pool.query("SELECT id FROM public.task_dependencies WHERE task_id = $1 AND depends_on_task_id = $2", [targetTask.id, depCandidate.id]);
        assert(depCheck2.rows.length === 0, "Task dependency record successfully removed from DB (clean state restored)");

        // -------------------------------------------------------------
        // Step 7: Strict Regression Error Audit
        // -------------------------------------------------------------
        console.log("\n--- 7. Strict Regression Error Audit ---");
        const depErrors = pageErrors.filter(e => e.includes("selectedDepIds"));
        assert(depErrors.length === 0, "Zero 'selectedDepIds' reference errors occurred");
        assert(pageErrors.length === 0, `Zero uncaught page errors (Got: ${pageErrors.length})`);

        console.log("\n=== ALL REAL CHROMIUM TASK EDIT & DEPENDENCY TESTS PASSED! ===");
    } catch (err) {
        console.error("Test Suite Failed:", err);
        throw err;
    } finally {
        await browser.close();
        await pool.end();
    }
}

run();
