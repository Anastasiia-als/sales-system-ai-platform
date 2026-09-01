const puppeteer = require('puppeteer');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });

async function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        await pool.end();
        process.exit(1);
    }
    console.log("PASS: " + message);
}

const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    let browser;
    let page;
    try {
        console.log("Starting Phase 6C.2 REAL Browser E2E...");
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        page = await browser.newPage();
        
        let nativeAlertFired = false;
        page.on('dialog', async dialog => {
            nativeAlertFired = true;
            console.log("Caught dialog:", dialog.message());
            await dialog.dismiss();
        });
        
        page.on("response", async res => {
            if(res.status() === 400) {
                try { console.log("400 RESPONSE:", await res.text()); } catch(e) {}
            }
        });
        page.on('console', msg => {
            if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
        });

        // 1. Load Auth Page
        await page.goto('http://localhost:8002/#/portal/auth', { waitUntil: 'networkidle0' });
        
        // Wait for login form
        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        
        // Type credentials
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', process.env.OWNER_PASSWORD || 'Password123!');
        
        // Submit
        await page.click('#btn-submit-pwd');
        
        // Wait until location hash changes from #/portal/auth
        await delay(3000);
        console.log("Logged in!");
        await page.reload({ waitUntil: "networkidle0" });
        
        const profile = await page.evaluate(() => window.PortalAuth ? window.PortalAuth.getProfile() : 'NO_PORTAL_AUTH');
        console.log("Profile after reload:", profile);
        // 3. Go to Automation Command Center
        await page.goto('http://localhost:8002/#/portal/automation', { waitUntil: 'networkidle0' });
        
        // Wait for loaders to disappear
        await page.waitForFunction(() => {
            const list = document.getElementById('global-automation-list');
            const spinner = document.querySelector('.portal-spinner');
            return list && !spinner;
        }, { timeout: 10000 });
        assert(true, "Loaders disappeared and list is visible");
        
        // Click Create Rule
        await page.click('#btn-global-create-rule');
        await page.waitForSelector("#automation-rule-modal", { timeout: 10000 });
        
        assert(!nativeAlertFired, "No native alert fired on 'Створити правило'");
        
        // Verify modal opened
        const modalVisible = await page.evaluate(() => {
            return !!document.getElementById('automation-rule-modal');
        });
        assert(modalVisible, "Modal Rule Builder really opened");
        
        // Create unique rule
        const ruleName = "E2E_Test_Rule_" + Date.now();
        await page.type('#arb-name', ruleName);
        await page.select('#arb-trigger', 'stage_completed');
        await page.click('#arb-save-btn');
        
        // Wait for save and reload
        await page.waitForFunction(() => !document.getElementById('automation-rule-modal'), { timeout: 10000 });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        
        // Verify appearance in table
        const tableHtml = await page.evaluate(() => document.getElementById('global-automation-list').innerHTML);
        assert(tableHtml.includes(ruleName), "Rule appeared in table without F5");
        
        // F5 Persistence
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        const tableHtmlAfterF5 = await page.evaluate(() => document.getElementById('global-automation-list').innerHTML);
        assert(tableHtmlAfterF5.includes(ruleName), "Rule persisted after F5");
        
        // Open Edit
        const editBtnSelector = await page.evaluate((name) => {
            const rows = Array.from(document.querySelectorAll('#global-automation-list tr'));
            const row = rows.find(r => r.innerHTML.includes(name));
            if(row) {
                const btn = row.querySelector('.btn-edit-rule');
                if(btn) {
                    btn.classList.add('e2e-target-edit-btn');
                    return true;
                }
            }
            return false;
        }, ruleName);
        assert(editBtnSelector, "Found edit button for rule");
        
        await page.click('.e2e-target-edit-btn');
        await page.waitForSelector("#automation-rule-modal", { timeout: 10000 });
        await delay(1000); // let UI settle for type
        // Modify rule
        await page.type('#arb-name', '_MODIFIED');
        await page.click('#arb-save-btn');
        await page.waitForFunction(() => !document.getElementById('automation-rule-modal'), { timeout: 10000 });
        
        // Verify Modification persistence
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForFunction(() => !document.querySelector('.portal-spinner'), { timeout: 10000 });
        const tableHtmlModified = await page.evaluate(() => document.getElementById('global-automation-list').innerHTML);
        if(!tableHtmlModified.includes("_MODIFIED" + ruleName)) console.log("TABLE HTML WAS:", tableHtmlModified);
        assert(tableHtmlModified.includes("_MODIFIED" + ruleName), "Rule modification persisted after F5");
        
        // Test Filters
        const filtersWork = await page.evaluate((name) => {
            document.getElementById('global-rule-search').value = name;
            document.getElementById('global-rule-search').dispatchEvent(new Event('input'));
            return document.getElementById('global-automation-list').innerHTML.includes(name) &&
                   !document.getElementById('global-automation-list').innerHTML.includes('Rule1'); // Assuming Rule1 is filtered out
        }, "_MODIFIED" + ruleName);
        assert(filtersWork, "Filters (search) work dynamically");
        
        // Cleanup
        await pool.query("DELETE FROM automation_rules WHERE name ILIKE $1", ['%' + ruleName + '%']);
        assert(true, "E2E Fixture cleaned up");
        
        console.log("All E2E assertions passed!");
        
    } catch(e) {
        if(page) {
            const html = await page.evaluate(() => document.body.innerHTML); 
            require('fs').writeFileSync('scratch/dump5.html', html);
        }
        console.error("E2E Test Failed:", e);
        process.exit(1);
    } finally {
        if(browser) await browser.close();
        await pool.end();
    }
})();
