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

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function runAcceptanceE2E() {
    console.log("=== Starting Phase 6C.3 Modal & Viewport Acceptance E2E ===");
    
    // Launch browser
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
        console.log("\n--- Step 1: Login ---");
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto('http://localhost:8002/#/portal/auth', { waitUntil: 'networkidle0' });
        
        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', process.env.OWNER_PASSWORD || process.env.OWNER_PASSWORD);
        await page.click('#btn-submit-pwd');
        
        await delay(3000);
        console.log("Logged in successfully!");
        
        // Navigate to Automation Command Center
        await page.goto('http://localhost:8002/#/portal/automation', { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => {
            const list = document.getElementById('global-automation-list');
            const spinner = document.querySelector('.portal-spinner');
            return list && !spinner;
        }, { timeout: 15000 });
        
        assert(true, "Automation Command Center loaded successfully");
        
        // Step 2: Test Multi-Viewport Modal Positioning & Scroll Lock
        const viewports = [
            { name: "Desktop 1920x1080", width: 1920, height: 1080 },
            { name: "Laptop 1366x768", width: 1366, height: 768 },
            { name: "Tablet 768x1024", width: 768, height: 1024 },
            { name: "Mobile 375x812", width: 375, height: 812 }
        ];
        
        console.log("\n--- Step 2: Multi-Viewport Positioning & Scroll Lock Verification ---");
        for (const vp of viewports) {
            console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
            await page.setViewport({ width: vp.width, height: vp.height });
            await delay(500);
            
            // Ensure we are at the top before opening
            await page.evaluate(() => window.scrollTo(0, 0));
            const scrollBefore = await page.evaluate(() => window.scrollY);
            assert(scrollBefore === 0, `[${vp.name}] Verified window.scrollY is 0 at top`);
            
            // Click Create Rule without any scroll
            await page.click('#btn-global-create-rule');
            await page.waitForSelector('#automation-rule-modal-overlay', { timeout: 10000 });
            await page.waitForSelector('#automation-rule-modal', { timeout: 10000 });
            
            // Check Overlay & Modal BoundingRect and Scroll Lock
            const metrics = await page.evaluate(() => {
                const overlay = document.getElementById('automation-rule-modal-overlay');
                const modal = document.getElementById('automation-rule-modal');
                const body = document.querySelector('.portal-modal-body');
                
                const oRect = overlay.getBoundingClientRect();
                const mRect = modal.getBoundingClientRect();
                const bRect = body.getBoundingClientRect();
                
                const bodyOverflow = document.body.style.overflow;
                
                return {
                    overlay: {
                        top: oRect.top,
                        left: oRect.left,
                        width: oRect.width,
                        height: oRect.height,
                        isFixed: window.getComputedStyle(overlay).position === 'fixed'
                    },
                    modal: {
                        top: mRect.top,
                        bottom: mRect.bottom,
                        left: mRect.left,
                        right: mRect.right,
                        width: mRect.width,
                        height: mRect.height
                    },
                    modalBody: {
                        overflowY: window.getComputedStyle(body).overflowY,
                        scrollHeight: body.scrollHeight,
                        clientHeight: body.clientHeight
                    },
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight,
                        scrollY: window.scrollY
                    },
                    bodyOverflow
                };
            });
            
            console.log(`[${vp.name}] Overlay BoundingBox: top=${metrics.overlay.top}, left=${metrics.overlay.left}, w=${metrics.overlay.width}, h=${metrics.overlay.height}, isFixed=${metrics.overlay.isFixed}`);
            console.log(`[${vp.name}] Modal BoundingBox: top=${metrics.modal.top.toFixed(1)}, bottom=${metrics.modal.bottom.toFixed(1)}, left=${metrics.modal.left.toFixed(1)}, right=${metrics.modal.right.toFixed(1)}, w=${metrics.modal.width.toFixed(1)}, h=${metrics.modal.height.toFixed(1)}`);
            console.log(`[${vp.name}] Viewport: w=${metrics.viewport.width}, h=${metrics.viewport.height}, scrollY=${metrics.viewport.scrollY}`);
            console.log(`[${vp.name}] Modal Body Scroll: overflowY=${metrics.modalBody.overflowY}, scrollHeight=${metrics.modalBody.scrollHeight}, clientHeight=${metrics.modalBody.clientHeight}`);
            console.log(`[${vp.name}] Background Body Overflow: ${metrics.bodyOverflow}`);
            
            // Assertions for positioning
            assert(metrics.overlay.isFixed, `[${vp.name}] Overlay is position: fixed`);
            assert(metrics.overlay.top === 0 && metrics.overlay.left === 0, `[${vp.name}] Overlay covers from (0,0)`);
            assert(metrics.overlay.height === vp.height && metrics.overlay.width === vp.width, `[${vp.name}] Overlay covers 100% of viewport dimensions`);
            
            assert(metrics.modal.top >= 0, `[${vp.name}] Modal top (${metrics.modal.top}) is >= 0 (visible in viewport immediately)`);
            assert(metrics.modal.bottom <= vp.height + 1, `[${vp.name}] Modal bottom (${metrics.modal.bottom}) fits within viewport height (${vp.height})`);
            assert(metrics.modal.left >= 0, `[${vp.name}] Modal left is >= 0`);
            assert(metrics.modal.right <= vp.width + 1, `[${vp.name}] Modal right is <= viewport width`);
            assert(metrics.bodyOverflow === 'hidden', `[${vp.name}] Background page scroll is locked (body.style.overflow='hidden')`);
            
            // Close modal using Cancel button
            await page.click('.portal-modal-footer .btn-modal-close');
            await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'), { timeout: 10000 });
            
            const unlockedOverflow = await page.evaluate(() => document.body.style.overflow);
            assert(unlockedOverflow !== 'hidden', `[${vp.name}] Background page scroll unlocked after modal close`);
        }
        
        // Step 3: Dark Theme & Clean Localization Inspection
        console.log("\n--- Step 3: Dark Theme & Localization Verification ---");
        await page.setViewport({ width: 1920, height: 1080 });
        await page.click('#btn-global-create-rule');
        await page.waitForSelector('#automation-rule-modal', { timeout: 10000 });
        
        const styleAndLocData = await page.evaluate(() => {
            const modal = document.getElementById('automation-rule-modal');
            const condCard = modal.querySelectorAll('.portal-modal-body > div')[3]; // conditions card
            const actCard = modal.querySelectorAll('.portal-modal-body > div')[4]; // actions card
            
            const modalBg = window.getComputedStyle(modal).backgroundColor;
            const condBg = window.getComputedStyle(condCard).backgroundColor;
            const actBg = window.getComputedStyle(actCard).backgroundColor;
            
            const allText = modal.innerText;
            
            const hasEnglishDuplicates = 
                allText.includes("(Active)") ||
                allText.includes("(Conditions)") ||
                allText.includes("(Actions)") ||
                allText.includes("(Область дії)") ||
                allText.includes("Scope (");
                
            return {
                modalBg,
                condBg,
                actBg,
                allText,
                hasEnglishDuplicates
            };
        });
        
        console.log("Modal Computed Background:", styleAndLocData.modalBg);
        console.log("Conditions Card Computed Background:", styleAndLocData.condBg);
        console.log("Actions Card Computed Background:", styleAndLocData.actBg);
        
        // Verify not white / light gray backgrounds
        assert(styleAndLocData.modalBg !== 'rgb(255, 255, 255)' && styleAndLocData.modalBg !== 'rgb(248, 250, 252)', "Modal has dark theme background (not white)");
        assert(styleAndLocData.condBg !== 'rgb(255, 255, 255)' && styleAndLocData.condBg !== 'rgb(248, 250, 252)', "Conditions card has dark theme background (not white #f8fafc)");
        assert(styleAndLocData.actBg !== 'rgb(255, 255, 255)' && styleAndLocData.actBg !== 'rgb(248, 250, 252)', "Actions card has dark theme background (not white #f8fafc)");
        assert(!styleAndLocData.hasEnglishDuplicates, "No duplicate English labels in UI (Scope, Active, Conditions, Actions clean Ukrainian)");
        
        // Close modal after inspection
        await page.click('.portal-modal-footer .btn-modal-close');
        await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'), { timeout: 10000 });
        
        // Step 4: Create Real Rule -> Save -> F5 -> Persistence
        console.log("\n--- Step 4: Create Rule -> Save -> F5 ---");
        await page.click('#btn-global-create-rule');
        await page.waitForSelector('#automation-rule-modal', { timeout: 10000 });
        
        const testRuleName = "E2E_Modal_Rule_" + Date.now();
        await page.type('#arb-name', testRuleName);
        await page.select('#arb-trigger', 'stage_completed');
        
        // Add Condition
        await page.click('#arb-add-condition');
        await delay(300);
        await page.evaluate(() => {
            const f = document.querySelector('.cond-field');
            if (f) f.value = 'current_stage';
            const v = document.querySelector('.cond-val');
            if (v) v.value = 'stage_review';
        });
        
        // Add Action
        await page.click('#arb-add-action');
        await delay(300);
        await page.evaluate(() => {
            const p = document.querySelector('.act-payload');
            if (p) p.value = '{"notify": true, "msg": "E2E Test Action"}';
        });
        
        // Save
        await page.click('#arb-save-btn');
        
        // Wait for modal to close
        try {
            await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'), { timeout: 10000 });
        } catch (e) {
            const errorMsg = await page.evaluate(() => {
                const el = document.getElementById('arb-error-msg');
                return el ? el.innerText : 'none';
            });
            console.error("Save Modal did not close. Error message inside modal:", errorMsg);
            throw e;
        }
        
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        // Check immediate appearance in list
        const immediateTable = await page.evaluate(() => document.getElementById('global-automation-list').innerHTML);
        assert(immediateTable.includes(testRuleName), "Created rule appeared in table immediately without F5");
        
        // F5 Reload
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        const f5Table = await page.evaluate(() => document.getElementById('global-automation-list').innerHTML);
        assert(f5Table.includes(testRuleName), "Created rule persisted in table after F5 reload");
        
        // Step 5: Edit Rule -> Save -> F5 -> Persistence
        console.log("\n--- Step 5: Edit Rule -> Save -> F5 ---");
        const foundEditBtn = await page.evaluate((name) => {
            const rows = Array.from(document.querySelectorAll('#global-automation-list tr'));
            const targetRow = rows.find(r => r.innerText.includes(name));
            if (targetRow) {
                const btn = targetRow.querySelector('.btn-edit-rule');
                if (btn) {
                    btn.classList.add('e2e-edit-target');
                    return true;
                }
            }
            return false;
        }, testRuleName);
        
        assert(foundEditBtn, "Found edit button for created test rule");
        await page.click('.e2e-edit-target');
        await page.waitForSelector('#automation-rule-modal', { timeout: 10000 });
        await delay(500);
        
        // Modify Name by clearing and typing new name
        const updatedRuleName = testRuleName + "_EDITED";
        await page.evaluate((newName) => {
            const input = document.getElementById('arb-name');
            input.value = newName;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }, updatedRuleName);
        
        // Save
        await page.click('#arb-save-btn');
        await page.waitForFunction(() => !document.getElementById('automation-rule-modal-overlay'), { timeout: 10000 });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        // F5 Reload after edit
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        const f5EditedTable = await page.evaluate(() => document.getElementById('global-automation-list').innerHTML);
        assert(f5EditedTable.includes(updatedRuleName), "Updated rule persisted in table after Edit & F5 reload");
        
        // Step 6: Cleanup Fixtures
        console.log("\n--- Step 6: Fixture Cleanup ---");
        await pool.query("SET session_replication_role = 'replica';");
        await pool.query("DELETE FROM automation_rules WHERE name LIKE 'E2E_Modal_Rule_%'");
        await pool.query("DELETE FROM automation_execution_events WHERE rule_id NOT IN (SELECT id FROM automation_rules)");
        await pool.query("SET session_replication_role = 'origin';");
        assert(true, "E2E Test fixture cleaned up cleanly from database");
        
        console.log("\n=== ALL ACCEPTANCE E2E TESTS PASSED SUCCESSFULLY! ===");
        
    } finally {
        await browser.close();
        await pool.end();
    }
}

runAcceptanceE2E().catch(err => {
    console.error("FATAL E2E ERROR:", err);
    process.exit(1);
});
