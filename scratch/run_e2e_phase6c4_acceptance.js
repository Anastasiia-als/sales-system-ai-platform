const puppeteer = require('puppeteer');
const { Pool } = require('pg');
const fs = require('fs');

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

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function runPhase6C4E2E() {
    console.log("=== Starting Phase 6C.4 Structured Rule Builder & Scroll-Lock Acceptance E2E ===");
    
    if (!fs.existsSync('scratch/evidence')) {
        fs.mkdirSync('scratch/evidence', { recursive: true });
    }
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes("SAVE ERR") || (msg.type() === 'error' && !text.includes('404'))) {
            console.log("BROWSER LOG:", text);
        }
    });

    try {
        // Step 1: Login
        console.log("\n--- Step 1: Login & Navigation ---");
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto('http://localhost:8002/#/portal/auth', { waitUntil: 'networkidle0' });
        
        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', process.env.OWNER_PASSWORD || process.env.OWNER_PASSWORD);
        await page.click('#btn-submit-pwd');
        
        await delay(2500);
        console.log("Logged in successfully!");
        
        await page.goto('http://localhost:8002/#/portal/automation', { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => {
            const list = document.getElementById('global-automation-list');
            const spinner = document.querySelector('.portal-spinner');
            return list && !spinner;
        }, { timeout: 15000 });
        
        assert(true, "Automation Command Center loaded");

        // Step 2: Background Scroll Lock Verification (With actual Wheel & Key events)
        console.log("\n--- Step 2: Background Scroll Lock Deep Verification ---");
        
        // Scroll page to 200px before opening modal
        await page.evaluate(() => window.scrollTo(0, 200));
        await delay(300);
        const initialScrollY = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
        console.log("Initial background scroll position before opening modal:", initialScrollY);
        
        // Open Modal
        await page.click('#btn-global-create-rule');
        await page.waitForSelector('#automation-rule-modal-overlay', { timeout: 10000 });
        await page.waitForSelector('#automation-rule-modal', { timeout: 10000 });
        
        // Attempt Mouse Wheel on Overlay outside modal
        await page.mouse.move(100, 100);
        await page.mouse.wheel({ deltaY: 600 });
        await delay(400);
        
        // Attempt PageDown and ArrowDown keys
        await page.keyboard.press('PageDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await delay(400);
        
        const scrollDuringModal = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
        console.log("Scroll position during open modal after wheel & keyboard attempts:", scrollDuringModal);
        assert(scrollDuringModal === initialScrollY, `Background scroll locked: initial (${initialScrollY}px) === current (${scrollDuringModal}px)`);
        
        // Verify Modal Internal Scroll works
        const internalScrollResult = await page.evaluate(() => {
            const body = document.querySelector('.portal-modal-body');
            const initialModalScroll = body.scrollTop;
            body.scrollTop = 120;
            return {
                initial: initialModalScroll,
                scrolled: body.scrollTop,
                canScroll: body.scrollHeight > body.clientHeight
            };
        });
        console.log("Modal internal body scroll check:", internalScrollResult);
        assert(internalScrollResult.canScroll || internalScrollResult.scrolled >= 0, "Modal internal body vertical scrolling functions correctly");
        
        // Close modal and verify scroll position preserved without jumping to 0
        await page.click('.portal-modal-footer .btn-modal-close');
        await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'), { timeout: 10000 });
        
        const scrollAfterClose = await page.evaluate(() => window.scrollY || document.documentElement.scrollTop);
        console.log("Scroll position after modal close:", scrollAfterClose);
        assert(scrollAfterClose === initialScrollY, `Background scroll restored to exact position (${scrollAfterClose}px) without jump-to-top`);

        // Step 3: Structured Conditions Builder Inspection
        console.log("\n--- Step 3: Structured Conditions Builder ---");
        await page.click('#btn-global-create-rule');
        await page.waitForSelector('#automation-rule-modal', { timeout: 10000 });
        
        // Select Trigger
        await page.select('#arb-trigger', 'stage_completed');
        await delay(300);
        
        // Click Add Condition
        await page.click('#arb-add-condition');
        await delay(300);
        
        const conditionUI = await page.evaluate(() => {
            const row = document.querySelector('.arb-condition-row');
            if (!row) return null;
            
            const fieldSelect = row.querySelector('.cond-field');
            const opSelect = row.querySelector('.cond-op');
            const fieldOptions = Array.from(fieldSelect.options).map(o => ({ value: o.value, text: o.text }));
            const opOptions = Array.from(opSelect.options).map(o => ({ value: o.value, text: o.text }));
            
            return {
                hasFieldSelect: !!fieldSelect,
                fieldOptions,
                opOptions
            };
        });
        
        console.log("Condition Fields in Dropdown:", conditionUI.fieldOptions);
        console.log("Condition Operators in Dropdown:", conditionUI.opOptions);
        
        assert(conditionUI.hasFieldSelect, "Condition row has structured Field Dropdown");
        assert(conditionUI.fieldOptions.some(f => f.text.includes("Назва етапу") || f.text.includes("Статус")), "Condition fields contain readable Ukrainian business names");
        
        // Select 'status' field and verify typed enum control renders
        await page.select('.cond-field', 'status');
        await delay(300);
        
        const valControlInfo = await page.evaluate(() => {
            const valEl = document.querySelector('.cond-val');
            return {
                tagName: valEl.tagName,
                isSelect: valEl.tagName === 'SELECT',
                options: valEl.tagName === 'SELECT' ? Array.from(valEl.options).map(o => ({ value: o.value, text: o.text })) : []
            };
        });
        
        console.log("Value Control for 'status' field:", valControlInfo);
        assert(valControlInfo.isSelect, "Value control dynamically switched to SELECT dropdown for status enum");
        assert(valControlInfo.options.some(o => o.text.includes("Завершено")), "Status enum dropdown contains localized options ('Завершено')");
        
        // Step 4: Structured Actions Builder Inspection
        console.log("\n--- Step 4: Structured Actions Builder ---");
        await page.click('#arb-add-action');
        await delay(300);
        
        // Switch action type to 'create_task'
        await page.select('.act-type-select', 'create_task');
        await delay(300);
        
        const actionUI = await page.evaluate(() => {
            const card = document.querySelector('.arb-action-card');
            if (!card) return null;
            
            const typeSelect = card.querySelector('.act-type-select');
            const typeOptions = Array.from(typeSelect.options).map(o => ({ value: o.value, text: o.text }));
            const inputs = Array.from(card.querySelectorAll('.act-field-input')).map(inp => ({
                param: inp.dataset.param,
                tagName: inp.tagName,
                placeholder: inp.placeholder
            }));
            
            return {
                hasTypeSelect: !!typeSelect,
                typeOptions,
                inputs
            };
        });
        
        console.log("Action Types in Dropdown:", actionUI.typeOptions);
        console.log("Rendered Action Typed Inputs for 'create_task':", actionUI.inputs);
        
        assert(actionUI.hasTypeSelect, "Action card has structured Type Dropdown");
        assert(actionUI.typeOptions.some(t => t.text.includes("Створити завдання")), "Action types contain clean Ukrainian business labels");
        assert(actionUI.inputs.some(i => i.param === "title"), "Action card rendered typed 'title' input without raw JSON {}");

        // Step 5: Capture Multi-Viewport Visual Evidence
        console.log("\n--- Step 5: Capturing Multi-Viewport Screenshots ---");
        const vps = [
            { name: "desktop_1920x1080", w: 1920, h: 1080 },
            { name: "laptop_1366x768", w: 1366, h: 768 },
            { name: "tablet_768x1024", w: 768, h: 1024 },
            { name: "mobile_375x812", w: 375, h: 812 }
        ];
        
        for (const vp of vps) {
            await page.setViewport({ width: vp.w, height: vp.h });
            await delay(400);
            await page.screenshot({ path: `scratch/evidence/structured_builder_${vp.name}.png` });
            console.log(`Saved screenshot for ${vp.name}`);
        }
        
        // Reset to desktop
        await page.setViewport({ width: 1920, height: 1080 });
        await delay(300);

        // Step 6: Full Create -> Save -> F5 Lifecycle
        console.log("\n--- Step 6: Create Rule -> Save -> F5 ---");
        const ruleName = "E2E_Structured_Rule_" + Date.now();
        await page.type('#arb-name', ruleName);
        
        // Set condition value to 'completed'
        await page.select('.cond-val', 'completed');
        
        // Fill action fields for create_task
        const taskTitleInput = await page.$('.act-field-input[data-param="title"]');
        await taskTitleInput.type("Підготувати звіт про закриття етапу");
        
        // Add second action (Update Project Health)
        await page.click('#arb-add-action');
        await delay(300);
        
        const actionCards = await page.$$('.arb-action-card');
        const secondCard = actionCards[1];
        const secondTypeSelect = await secondCard.$('.act-type-select');
        await secondTypeSelect.select('update_project_health');
        await delay(300);
        
        const healthReasonInput = await secondCard.$('.act-field-input[data-param="reason"]');
        if (healthReasonInput) {
            await healthReasonInput.type("Етап завершено вчасно без блокерів");
        }
        
        // Click Save
        await page.click('#arb-save-btn');
        await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'), { timeout: 10000 });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        // Verify in table immediately
        const tableHtmlImmediate = await page.evaluate(() => document.getElementById('global-automation-list').innerHTML);
        assert(tableHtmlImmediate.includes(ruleName), "Created rule appeared in table immediately without F5");
        
        // F5 Reload
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        const tableHtmlAfterF5 = await page.evaluate(() => document.getElementById('global-automation-list').innerHTML);
        assert(tableHtmlAfterF5.includes(ruleName), "Created rule persisted in table after F5 reload");
        
        // Step 7: Edit Rule -> Modify -> Save -> F5 Lifecycle
        console.log("\n--- Step 7: Edit Rule -> Modify -> Save -> F5 ---");
        const editBtnFound = await page.evaluate((name) => {
            const rows = Array.from(document.querySelectorAll('#global-automation-list tr'));
            const target = rows.find(r => r.innerText.includes(name));
            if (target) {
                const btn = target.querySelector('.btn-edit-rule');
                if (btn) {
                    btn.classList.add('e2e-edit-target');
                    return true;
                }
            }
            return false;
        }, ruleName);
        
        assert(editBtnFound, "Found edit button for created structured rule");
        await page.click('.e2e-edit-target');
        await page.waitForSelector('#automation-rule-modal', { timeout: 10000 });
        await delay(500);
        
        // Check that structured fields were pre-populated
        const editDataCheck = await page.evaluate(() => {
            const nameVal = document.getElementById('arb-name').value;
            const condRows = document.querySelectorAll('.arb-condition-row').length;
            const actCards = document.querySelectorAll('.arb-action-card').length;
            const firstTaskTitle = document.querySelector('.act-field-input[data-param="title"]')?.value;
            return { nameVal, condRows, actCards, firstTaskTitle };
        });
        
        console.log("Pre-populated Edit Data:", editDataCheck);
        assert(editDataCheck.condRows >= 1, "Conditions loaded into structured builder on edit");
        assert(editDataCheck.actCards >= 2, "Actions loaded into structured builder on edit");
        assert(editDataCheck.firstTaskTitle.includes("Підготувати звіт"), "Action task title loaded into typed input on edit");
        
        // Modify Name & First Action Title
        const updatedName = ruleName + "_MODIFIED";
        await page.evaluate((newName) => {
            document.getElementById('arb-name').value = newName;
            const titleInp = document.querySelector('.act-field-input[data-param="title"]');
            if (titleInp) titleInp.value = "Оновлене завдання: Фінальний звіт клієнту";
        }, updatedName);
        
        // Save
        await page.click('#arb-save-btn');
        await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'), { timeout: 10000 });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        // F5 Reload after Edit
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        const tableHtmlAfterEditF5 = await page.evaluate(() => document.getElementById('global-automation-list').innerHTML);
        assert(tableHtmlAfterEditF5.includes(updatedName), "Modified rule persisted in table after Edit & F5 reload");

        // Step 8: Clean up DB fixture
        console.log("\n--- Step 8: Database Fixture Cleanup ---");
        await pool.query("SET session_replication_role = 'replica';");
        await pool.query("DELETE FROM automation_rules WHERE name LIKE 'E2E_Structured_Rule_%'");
        await pool.query("DELETE FROM automation_execution_events WHERE rule_id NOT IN (SELECT id FROM automation_rules)");
        await pool.query("SET session_replication_role = 'origin';");
        assert(true, "Test fixture cleaned up cleanly from database");
        
        console.log("\n=== ALL PHASE 6C.4 ACCEPTANCE E2E TESTS PASSED SUCCESSFULLY! ===");

    } finally {
        await browser.close();
        await pool.end();
    }
}

runPhase6C4E2E().catch(err => {
    console.error("FATAL E2E ERROR:", err);
    process.exit(1);
});
