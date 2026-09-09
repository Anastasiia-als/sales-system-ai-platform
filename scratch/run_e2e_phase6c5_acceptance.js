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

async function runPhase6C5E2E() {
    console.log("=== Starting Phase 6C.5 Automation Rules Table Human-Readable Summary Acceptance E2E ===");
    
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

        // Step 2: Create Single-Condition Inactive Test Rule
        console.log("\n--- Step 2: Create Single-Condition Inactive Test Rule ---");
        const singleRuleName = "E2E_Phase6C5_Contract_" + Date.now();
        
        await page.click('#btn-global-create-rule');
        await page.waitForSelector('#automation-rule-modal', { timeout: 10000 });
        
        // Fill Rule Name
        await page.type('#arb-name', singleRuleName);
        
        // Select Trigger: document_approved
        await page.select('#arb-trigger', 'document_approved');
        await delay(300);
        
        // Uncheck Active checkbox (make it Inactive)
        await page.evaluate(() => {
            const chk = document.getElementById('arb-active');
            if (chk && chk.checked) chk.click();
        });
        
        // Add Condition: category = contract
        await page.click('#arb-add-condition');
        await delay(300);
        await page.select('.cond-field', 'category');
        await delay(300);
        await page.select('.cond-val', 'contract');
        
        // Add Action: notify_owner, Title: TEST — Manual Acceptance Phase 6C
        await page.click('#arb-add-action');
        await delay(300);
        await page.select('.act-type-select', 'notify_owner');
        await delay(300);
        
        const titleInp = await page.$('.act-field-input[data-param="title"]');
        await titleInp.type("TEST — Manual Acceptance Phase 6C");
        
        // Save
        await page.click('#arb-save-btn');
        await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'), { timeout: 10000 });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        // Step 3: Verify Table Summary Formatting
        console.log("\n--- Step 3: Table Presentation Verification (Single Condition) ---");
        const singleRowData = await page.evaluate((name) => {
            const rows = Array.from(document.querySelectorAll('#global-automation-list tr'));
            const target = rows.find(r => r.innerText.includes(name));
            if (!target) return null;
            
            const cols = target.querySelectorAll('td');
            return {
                name: cols[0]?.innerText.trim(),
                scope: cols[1]?.innerText.trim(),
                trigger: cols[2]?.innerText.trim(),
                conditions: cols[3]?.innerText.trim(),
                conditionsHtml: cols[3]?.innerHTML,
                actions: cols[4]?.innerText.trim(),
                actionsHtml: cols[4]?.innerHTML,
                status: cols[5]?.innerText.trim()
            };
        }, singleRuleName);
        
        console.log("Single Rule Row Data in Table:", singleRowData);
        assert(singleRowData !== null, "Created single rule found in table");
        assert(singleRowData.conditions.includes("Категорія документа = Договір"), "Condition displays 'Категорія документа = Договір'");
        assert(!singleRowData.conditions.includes("contract"), "No raw enum 'contract' in conditions column");
        assert(!singleRowData.conditions.includes("=="), "Uses single '=' symbol without raw '=='");
        assert(singleRowData.actions.includes("Сповістити власника / PM — TEST — Manual Acceptance Phase 6C"), "Action displays human-readable summary");
        assert(!singleRowData.actions.includes("notify_owner"), "No raw enum 'notify_owner' in actions column");
        assert(!singleRowData.actions.includes("{"), "No raw JSON '{}' in actions column");
        assert(singleRowData.status.includes("Неактивне"), "Status badge displays 'Неактивне'");

        // Step 4: F5 Reload Persistence
        console.log("\n--- Step 4: F5 Reload Persistence ---");
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        const afterF5Data = await page.evaluate((name) => {
            const rows = Array.from(document.querySelectorAll('#global-automation-list tr'));
            const target = rows.find(r => r.innerText.includes(name));
            if (!target) return null;
            const cols = target.querySelectorAll('td');
            return {
                conditions: cols[3]?.innerText.trim(),
                actions: cols[4]?.innerText.trim(),
                status: cols[5]?.innerText.trim()
            };
        }, singleRuleName);
        
        assert(afterF5Data.conditions.includes("Категорія документа = Договір"), "Condition persisted correctly after F5");
        assert(afterF5Data.actions.includes("Сповістити власника / PM — TEST — Manual Acceptance Phase 6C"), "Action persisted correctly after F5");
        assert(afterF5Data.status.includes("Неактивне"), "Inactive status persisted after F5");

        // Step 5: Edit Modal Population & Modification
        console.log("\n--- Step 5: Edit Modal Population & Modification ---");
        await page.evaluate((name) => {
            const rows = Array.from(document.querySelectorAll('#global-automation-list tr'));
            const target = rows.find(r => r.innerText.includes(name));
            target.querySelector('.btn-edit-rule').click();
        }, singleRuleName);
        
        await page.waitForSelector('#automation-rule-modal', { timeout: 10000 });
        await delay(500);
        
        const modalEditState = await page.evaluate(() => {
            return {
                name: document.getElementById('arb-name')?.value,
                trigger: document.getElementById('arb-trigger')?.value,
                isActive: document.getElementById('arb-active')?.checked,
                condField: document.querySelector('.cond-field')?.value,
                condVal: document.querySelector('.cond-val')?.value,
                actType: document.querySelector('.act-type-select')?.value,
                actTitle: document.querySelector('.act-field-input[data-param="title"]')?.value
            };
        });
        
        console.log("Edit Modal Restored State:", modalEditState);
        assert(modalEditState.trigger === "document_approved", "Trigger restored to document_approved");
        assert(modalEditState.isActive === false, "Inactive checkbox state restored");
        assert(modalEditState.condField === "category", "Condition field restored to category");
        assert(modalEditState.condVal === "contract", "Condition value restored to contract");
        assert(modalEditState.actType === "notify_owner", "Action type restored to notify_owner");
        assert(modalEditState.actTitle === "TEST — Manual Acceptance Phase 6C", "Action title restored");
        
        // Modify Title
        const updatedTitle = "TEST — Manual Acceptance Phase 6C (ОНОВЛЕНО)";
        await page.evaluate((newTitle) => {
            document.querySelector('.act-field-input[data-param="title"]').value = newTitle;
        }, updatedTitle);
        
        // Save
        await page.click('#arb-save-btn');
        await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'), { timeout: 10000 });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        // F5 Reload
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        const afterEditF5Data = await page.evaluate((name) => {
            const rows = Array.from(document.querySelectorAll('#global-automation-list tr'));
            const target = rows.find(r => r.innerText.includes(name));
            return target?.querySelectorAll('td')[4]?.innerText.trim();
        }, singleRuleName);
        
        assert(afterEditF5Data.includes(updatedTitle), "Modified action title reflected in table summary after F5");

        // Step 6: Create Multi-Condition / Multi-Action Rule
        console.log("\n--- Step 6: Multi-Condition & Multi-Action Rule Verification ---");
        const multiRuleName = "E2E_Phase6C5_Multi_" + Date.now();
        
        await page.click('#btn-global-create-rule');
        await page.waitForSelector('#automation-rule-modal', { timeout: 10000 });
        
        await page.type('#arb-name', multiRuleName);
        await page.select('#arb-trigger', 'document_approved');
        await delay(300);
        
        // Condition 1: category = specification
        await page.click('#arb-add-condition');
        await delay(200);
        const condRows = await page.$$('.arb-condition-row');
        await condRows[0].$eval('.cond-field', el => el.value = 'category');
        await condRows[0].$eval('.cond-field', el => el.dispatchEvent(new Event('change')));
        await delay(200);
        await condRows[0].$eval('.cond-val', el => el.value = 'specification');
        
        // Condition 2: status = approved
        await page.click('#arb-add-condition');
        await delay(200);
        const condRows2 = await page.$$('.arb-condition-row');
        await condRows2[1].$eval('.cond-field', el => el.value = 'status');
        await condRows2[1].$eval('.cond-field', el => el.dispatchEvent(new Event('change')));
        await delay(200);
        await condRows2[1].$eval('.cond-val', el => el.value = 'approved');
        
        // Action 1: create_task, title: Підготувати рахунок-фактуру
        await page.click('#arb-add-action');
        await delay(200);
        let actCards = await page.$$('.arb-action-card');
        await actCards[0].$eval('.act-type-select', el => el.value = 'create_task');
        await actCards[0].$eval('.act-type-select', el => el.dispatchEvent(new Event('change')));
        await delay(200);
        await actCards[0].$eval('.act-field-input[data-param="title"]', el => el.value = "Підготувати рахунок-фактуру");
        
        // Action 2: update_project_health, health: green
        await page.click('#arb-add-action');
        await delay(200);
        actCards = await page.$$('.arb-action-card');
        await actCards[1].$eval('.act-type-select', el => el.value = 'update_project_health');
        await actCards[1].$eval('.act-type-select', el => el.dispatchEvent(new Event('change')));
        await delay(200);
        await actCards[1].$eval('.act-field-input[data-param="health"]', el => el.value = "green");
        
        // Save
        await page.click('#arb-save-btn');
        await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'), { timeout: 10000 });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        const multiRowData = await page.evaluate((name) => {
            const rows = Array.from(document.querySelectorAll('#global-automation-list tr'));
            const target = rows.find(r => r.innerText.includes(name));
            if (!target) return null;
            
            const condChip = target.querySelectorAll('td')[3]?.querySelector('.portal-table-chip');
            const actChip = target.querySelectorAll('td')[4]?.querySelector('.portal-table-chip');
            
            return {
                condText: condChip?.innerText.trim(),
                condTitle: condChip?.getAttribute('title'),
                actText: actChip?.innerText.trim(),
                actTitle: actChip?.getAttribute('title')
            };
        }, multiRuleName);
        
        console.log("Multi-rule Summary & Tooltips:", multiRowData);
        assert(multiRowData.condText.includes("2 умови"), "Multi-condition displays '2 умови' badge");
        assert(multiRowData.condTitle.includes("Категорія документа = Технічне завдання / Специфікація"), "Multi-condition tooltip contains 'Категорія документа = Технічне завдання / Специфікація'");
        assert(multiRowData.condTitle.includes("Погоджено"), "Multi-condition tooltip contains 'Погоджено'");
        assert(multiRowData.actText.includes("2 дії"), "Multi-action displays '2 дії' badge");
        assert(multiRowData.actTitle.includes("Створити завдання: \"Підготувати рахунок-фактуру\""), "Multi-action tooltip contains task title");
        assert(multiRowData.actTitle.includes("Оновити стан проєкту: 🟢 Здоровий"), "Multi-action tooltip contains health status");

        // Screenshot
        await page.screenshot({ path: 'scratch/evidence/phase6c5_table_summary.png' });
        console.log("Saved screenshot to scratch/evidence/phase6c5_table_summary.png");

        // Step 7: Clean up DB fixtures
        console.log("\n--- Step 7: Database Fixture Cleanup ---");
        await pool.query("SET session_replication_role = 'replica';");
        await pool.query("DELETE FROM automation_rules WHERE name LIKE 'E2E_Phase6C5_%'");
        await pool.query("DELETE FROM automation_execution_events WHERE rule_id NOT IN (SELECT id FROM automation_rules)");
        await pool.query("SET session_replication_role = 'origin';");
        assert(true, "Test fixtures cleaned up cleanly from database");
        
        console.log("\n=== ALL PHASE 6C.5 ACCEPTANCE E2E TESTS PASSED SUCCESSFULLY! ===");

    } finally {
        await browser.close();
        await pool.end();
    }
}

runPhase6C5E2E().catch(err => {
    console.error("FATAL E2E ERROR:", err);
    process.exit(1);
});
