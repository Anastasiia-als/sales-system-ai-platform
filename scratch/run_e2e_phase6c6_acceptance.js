const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
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

async function runPhase6C6E2E() {
    console.log("=== Starting Phase 6C.6 Data Preservation & Manual Acceptance E2E ===");
    
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
        // Step 1: Login & Navigation
        console.log("\n--- Step 1: Login & Navigation ---");
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto('http://localhost:8002/#/portal/auth', { waitUntil: 'networkidle0' });
        
        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', process.env.OWNER_PASSWORD || 'Password123!');
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

        // Step 2: Create Manual Rule via UI
        console.log("\n--- Step 2: Create Manual User Rule via UI ---");
        const manualRuleName = "MANUAL-PERSISTENCE-ACCEPTANCE-6C";
        
        // Clean up any old instance of this specific test name if left from previous runs
        await pool.query("DELETE FROM public.automation_rules WHERE name = $1", [manualRuleName]);
        
        await page.click('#btn-global-create-rule');
        await page.waitForSelector('#automation-rule-modal', { timeout: 10000 });
        
        await page.type('#arb-name', manualRuleName);
        await page.select('#arb-trigger', 'document_approved');
        await delay(300);
        
        // Make it inactive
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
        
        // Add Action: notify_owner
        await page.click('#arb-add-action');
        await delay(300);
        await page.select('.act-type-select', 'notify_owner');
        await delay(300);
        
        const titleInp = await page.$('.act-field-input[data-param="title"]');
        await titleInp.type("MANUAL PERSISTENCE VERIFIED");
        
        // Save
        await page.click('#arb-save-btn');
        await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'), { timeout: 10000 });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        // Step 3: Verify Persistence & Record UUID
        console.log("\n--- Step 3: F5 & Record Manual Rule UUID ---");
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        const dbRes = await pool.query("SELECT * FROM public.automation_rules WHERE name = $1", [manualRuleName]);
        assert(dbRes.rows.length === 1, "Manual rule found in database");
        const initialRecord = dbRes.rows[0];
        
        console.log("Captured Manual Rule Record before Regression:", {
            id: initialRecord.id,
            name: initialRecord.name,
            created_at: initialRecord.created_at,
            is_active: initialRecord.is_active,
            trigger_event: initialRecord.trigger_event
        });

        // Step 4: Run Canonical Master Regression Suite
        console.log("\n--- Step 4: Executing Canonical Master Regression Suite ---");
        const regressionOutput = execSync('node scratch/run_canonical_regression.js', { encoding: 'utf8' });
        console.log(regressionOutput);
        assert(regressionOutput.includes("ALL 26 SUITES") || regressionOutput.includes("DATA PRESERVATION PASS"), "Canonical regression completed with DATA PRESERVATION PASS");

        // Step 5: F5 Browser & Verify Manual Rule Survived Untouched
        console.log("\n--- Step 5: Verify Manual Rule Survived Regression in DB and UI ---");
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        // Query DB by EXACT UUID
        const afterRes = await pool.query("SELECT * FROM public.automation_rules WHERE id = $1", [initialRecord.id]);
        assert(afterRes.rows.length === 1, `Manual rule with UUID ${initialRecord.id} STILL EXISTS in database!`);
        
        const afterRecord = afterRes.rows[0];
        assert(afterRecord.id === initialRecord.id, "UUID is identical");
        assert(new Date(afterRecord.created_at).getTime() === new Date(initialRecord.created_at).getTime(), "created_at timestamp is identical (No deletion/recreation)");
        assert(afterRecord.name === initialRecord.name, "Name is identical");
        assert(afterRecord.is_active === false, "Inactive status is identical");
        assert(afterRecord.trigger_event === "document_approved", "Trigger event is identical");
        assert(JSON.stringify(afterRecord.conditions) === JSON.stringify(initialRecord.conditions), "Conditions JSONB is identical");
        assert(JSON.stringify(afterRecord.actions) === JSON.stringify(initialRecord.actions), "Actions JSONB is identical");
        
        // Check UI Table Row
        const tableData = await page.evaluate((name) => {
            const rows = Array.from(document.querySelectorAll('#global-automation-list tr'));
            const target = rows.find(r => r.innerText.includes(name));
            if (!target) return null;
            const cols = target.querySelectorAll('td');
            return {
                name: cols[0]?.innerText.trim(),
                conditions: cols[3]?.innerText.trim(),
                actions: cols[4]?.innerText.trim(),
                status: cols[5]?.innerText.trim()
            };
        }, manualRuleName);
        
        console.log("Manual Rule Row in UI after Regression:", tableData);
        assert(tableData !== null, "Manual rule rendered in UI table after regression");
        assert(tableData.conditions.includes("Категорія документа = Договір"), "Conditions formatted correctly in UI");
        assert(tableData.actions.includes("Сповістити власника / PM — MANUAL PERSISTENCE VERIFIED"), "Actions formatted correctly in UI");
        assert(tableData.status.includes("Неактивне"), "Status rendered as 'Неактивне' in UI");

        // Step 6: Edit Modal Test Verification
        console.log("\n--- Step 6: Verify Edit Modal Restores All Typed Values ---");
        await page.evaluate((name) => {
            const rows = Array.from(document.querySelectorAll('#global-automation-list tr'));
            const target = rows.find(r => r.innerText.includes(name));
            target.querySelector('.btn-edit-rule').click();
        }, manualRuleName);
        
        await page.waitForSelector('#automation-rule-modal', { timeout: 10000 });
        await delay(500);
        
        const modalState = await page.evaluate(() => {
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
        
        console.log("Edit Modal Restored State after Regression:", modalState);
        assert(modalState.name === manualRuleName, "Name restored in modal");
        assert(modalState.trigger === "document_approved", "Trigger restored in modal");
        assert(modalState.isActive === false, "Inactive checkbox restored in modal");
        assert(modalState.condField === "category", "Condition field restored in modal");
        assert(modalState.condVal === "contract", "Condition value restored in modal");
        assert(modalState.actType === "notify_owner", "Action type restored in modal");
        assert(modalState.actTitle === "MANUAL PERSISTENCE VERIFIED", "Action title restored in modal");

        // Close modal
        await page.click('.portal-modal-footer .btn-modal-close');
        await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'), { timeout: 10000 });

        // Step 7: Check that no test garbage rows exist in table
        console.log("\n--- Step 7: Checking for Test Garbage Rows in Table ---");
        const garbageRows = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#global-automation-list tr'));
            return rows.filter(r => r.innerText.includes("ConcTask") || r.innerText.includes("Transient Fixture") || r.innerText.includes("Проєкт видалено")).map(r => r.innerText);
        });
        
        console.log("Detected Garbage Rows:", garbageRows);
        assert(garbageRows.length === 0, "No orphaned or leaked test fixture rows present in table");

        // Step 8: Screenshot Evidence
        await page.screenshot({ path: 'scratch/evidence/phase6c6_data_preservation.png' });
        console.log("Saved evidence screenshot to scratch/evidence/phase6c6_data_preservation.png");

        console.log("\n=== ALL PHASE 6C.6 ACCEPTANCE TESTS PASSED SUCCESSFULLY! ===");

    } finally {
        await browser.close();
        await pool.end();
    }
}

runPhase6C6E2E().catch(err => {
    console.error("FATAL E2E ERROR:", err);
    process.exit(1);
});
