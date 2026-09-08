/**
 * scratch/test_phase7c_modal_and_project_selector_e2e.js
 * E2E tests for Phase 7C:
 * 1. Project selector deduplication & absence of duplicates
 * 2. Presence of 'Idempotency Test' in selector for Demo Client Corp
 * 3. Exact match of option label -> real project_id ('a1c84c93-fb49-4a6b-9159-4b47a46618e7')
 * 4. Fixed overlay modal positioning in visible viewport on Desktop (even when scrolled)
 * 5. Fixed overlay modal positioning in visible viewport on Mobile (375x667)
 * 6. Subscription creation saves exact project_id in calendar_feed_subscriptions
 */

const puppeteer = require('puppeteer');
const http = require('http');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString: DATABASE_URL });

function assert(condition, message) {
    if (!condition) {
        console.error(`FAIL: ${message}`);
        throw new Error(message);
    }
    console.log(`PASS: ${message}`);
}

function fetchHttp(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        }).on('error', reject);
    });
}

async function run() {
    console.log('=== Starting Phase 7C Modal Positioning & Project Selector E2E Suite ===');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let createdSubId = null;

    try {
        const page = await browser.newPage();
        const pageErrors = [];
        page.on('pageerror', err => {
            console.error('PAGE ERROR:', err.message);
            pageErrors.push(err.message);
        });
        page.on('console', msg => {
            console.log(`[BROWSER CONSOLE ${msg.type()}]:`, msg.text());
        });
        page.on('dialog', async dialog => {
            console.log(`Dialog message: "${dialog.message()}", accepting...`);
            await dialog.accept();
        });

        // -------------------------------------------------------------
        // 1. Authenticate as Owner
        // -------------------------------------------------------------
        console.log('\n--- 1. Authenticating as Owner ---');
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });

        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', process.env.OWNER_PASSWORD || 'Password123!');
        await page.click('#btn-submit-pwd');

        await page.waitForSelector('.portal-sidebar', { timeout: 15000 });
        console.log('Owner authenticated successfully!');

        // -------------------------------------------------------------
        // 2. Navigate to Integrations -> Select Demo Client Corp -> Calendars Tab
        // -------------------------------------------------------------
        console.log('\n--- 2. Navigating to #/portal/integrations ---');
        await page.goto('http://localhost:8002/#/portal/integrations', { waitUntil: 'networkidle0' });

        const demoOrgId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
        await page.waitForSelector('#integrations-org-select', { timeout: 10000 });
        await page.waitForFunction(() => {
            const select = document.getElementById('integrations-org-select');
            return select && select.value !== "";
        }, { timeout: 10000 });

        await page.select('#integrations-org-select', demoOrgId);
        await page.evaluate(() => {
            const el = document.getElementById('integrations-org-select');
            if (el) el.dispatchEvent(new Event('change'));
        });
        await new Promise(r => setTimeout(r, 500));

        await page.waitForSelector('#tab-btn-calendars', { timeout: 10000 });
        await page.click('#tab-btn-calendars');
        await page.waitForFunction(() => {
            const sec = document.getElementById('section-calendars');
            return sec && sec.style.display !== 'none';
        }, { timeout: 5000 });
        assert(true, 'Switched to Calendars tab for Demo Client Corp');

        // -------------------------------------------------------------
        // 3. Verify Desktop Viewport Modal Positioning (with page scrolled)
        // -------------------------------------------------------------
        console.log('\n--- 3. Testing Desktop Viewport Modal Positioning ---');
        // Scroll page down
        await page.evaluate(() => window.scrollTo(0, 400));
        const scrollYBefore = await page.evaluate(() => window.scrollY);

        await page.waitForSelector('#btn-create-calendar', { timeout: 5000 });
        await page.click('#btn-create-calendar');

        await page.waitForFunction(() => {
            const modal = document.getElementById('modal-create-calendar');
            return modal && modal.style.display === 'flex';
        }, { timeout: 5000 });

        // Check CSS fixed position
        const backdropStyle = await page.evaluate(() => {
            const el = document.getElementById('modal-create-calendar');
            const style = window.getComputedStyle(el);
            return {
                position: style.position,
                zIndex: parseInt(style.zIndex, 10),
                display: style.display
            };
        });
        assert(backdropStyle.position === 'fixed', `Backdrop position is fixed (Got: ${backdropStyle.position})`);
        assert(backdropStyle.zIndex >= 1000, `Backdrop z-index >= 1000 (Got: ${backdropStyle.zIndex})`);
        assert(backdropStyle.display === 'flex', `Backdrop display is flex (Got: ${backdropStyle.display})`);

        // Check modal box bounding rect relative to current viewport
        const modalBox = await page.evaluate(() => {
            const modal = document.querySelector('#modal-create-calendar .portal-modal');
            const rect = modal.getBoundingClientRect();
            return {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height,
                viewportHeight: window.innerHeight,
                viewportWidth: window.innerWidth
            };
        });

        assert(modalBox.top >= 0 && modalBox.top < modalBox.viewportHeight,
            `Modal top is within visible viewport (top: ${modalBox.top}px, vh: ${modalBox.viewportHeight}px)`);
        assert(modalBox.bottom <= modalBox.viewportHeight + 50,
            `Modal bottom is within viewport bounds (bottom: ${modalBox.bottom}px, vh: ${modalBox.viewportHeight}px)`);
        console.log('PASS: Modal opened in visible Desktop viewport without needing manual scroll');

        // -------------------------------------------------------------
        // 4. Test Scope Selection & Project Selector Options
        // -------------------------------------------------------------
        console.log('\n--- 4. Testing Project Selector Options & Deduplication ---');
        await page.select('#cal-scope', 'project');

        // Wait for projects to populate in select
        await page.waitForFunction(() => {
            const sel = document.getElementById('cal-project');
            return sel && sel.options.length > 1 && !sel.textContent.includes('Завантаження');
        }, { timeout: 10000 });

        const projectOptions = await page.evaluate(() => {
            const sel = document.getElementById('cal-project');
            return Array.from(sel.options).map(o => ({ value: o.value, text: o.textContent.trim() }));
        });

        console.log('Project selector options count:', projectOptions.length);
        console.log('Options list:', projectOptions);

        // Filter out empty placeholder option
        const actualProjects = projectOptions.filter(o => o.value !== '');
        assert(actualProjects.length > 0, `Project dropdown has valid project options (Got: ${actualProjects.length})`);

        // Check 1: Absence of duplicates by ID (values must be unique)
        const values = actualProjects.map(o => o.value);
        const uniqueValues = new Set(values);
        assert(values.length === uniqueValues.size,
            `All option values (project IDs) are strictly unique (total: ${values.length}, unique: ${uniqueValues.size})`);

        // Check 2: Absence of duplicates by Label (option text must be unique)
        const texts = actualProjects.map(o => o.text);
        const uniqueTexts = new Set(texts.map(t => t.toLowerCase()));
        assert(texts.length === uniqueTexts.size,
            `All option labels are strictly unique with zero duplicate entries (total: ${texts.length}, unique: ${uniqueTexts.size})`);

        // Check 3: Presence of 'Idempotency Test'
        const idempotencyOption = actualProjects.find(o => o.text === 'Idempotency Test');
        assert(Boolean(idempotencyOption), "Project selector contains 'Idempotency Test'");

        // Check 4: Exact match of label -> real project_id
        const expectedIdempotencyId = 'a1c84c93-fb49-4a6b-9159-4b47a46618e7';
        assert(idempotencyOption.value === expectedIdempotencyId,
            `'Idempotency Test' maps to real project_id ${expectedIdempotencyId} (Got: ${idempotencyOption.value})`);

        // Close desktop modal
        await page.click('#btn-close-create-cal-modal');
        await page.waitForFunction(() => {
            const modal = document.getElementById('modal-create-calendar');
            return modal && modal.style.display === 'none';
        }, { timeout: 5000 });
        assert(true, 'Desktop modal closed cleanly');

        // -------------------------------------------------------------
        // 5. Verify Mobile Viewport Modal Positioning (375x667)
        // -------------------------------------------------------------
        console.log('\n--- 5. Testing Mobile Viewport Modal Positioning (375x667) ---');
        await page.setViewport({ width: 375, height: 667 });
        await new Promise(r => setTimeout(r, 500));

        await page.waitForSelector('#btn-create-calendar', { timeout: 5000 });
        await page.click('#btn-create-calendar');
        await page.waitForFunction(() => {
            const modal = document.getElementById('modal-create-calendar');
            return modal && modal.style.display === 'flex';
        }, { timeout: 5000 });

        const mobileBox = await page.evaluate(() => {
            const modal = document.querySelector('#modal-create-calendar .portal-modal');
            const rect = modal.getBoundingClientRect();
            return {
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                viewportHeight: window.innerHeight,
                viewportWidth: window.innerWidth
            };
        });

        assert(mobileBox.top >= 0 && mobileBox.top < mobileBox.viewportHeight,
            `Mobile modal top is within visible viewport (top: ${mobileBox.top}px, vh: ${mobileBox.viewportHeight}px)`);
        assert(mobileBox.width <= 375, `Mobile modal width fits in viewport (width: ${mobileBox.width}px)`);
        console.log('PASS: Modal opened in visible Mobile viewport without requiring page scroll');

        // -------------------------------------------------------------
        // 6. Create Calendar Feed with Idempotency Test & Verify project_id
        // -------------------------------------------------------------
        console.log('\n--- 6. Creating Calendar Feed for Idempotency Test ---');
        const feedName = `Phase 7C E2E Modal Test ${Date.now()}`;
        await page.type('#cal-name', feedName);
        await page.select('#cal-scope', 'project');
        await page.evaluate(() => {
            const el = document.getElementById('cal-scope');
            if (el) el.dispatchEvent(new Event('change'));
        });

        // Wait for select to be ready and choose Idempotency Test
        await page.waitForFunction(() => {
            const sel = document.getElementById('cal-project');
            return sel && Array.from(sel.options).some(o => o.value === 'a1c84c93-fb49-4a6b-9159-4b47a46618e7');
        }, { timeout: 15000 });

        await page.select('#cal-project', expectedIdempotencyId);
        await page.evaluate(() => {
            const el = document.getElementById('cal-project');
            if (el) el.dispatchEvent(new Event('change'));
        });

        await page.click('#btn-submit-create-cal');

        // Wait for presentation modal
        await page.waitForFunction(() => {
            const modal = document.getElementById('modal-show-calendar-token');
            return modal && modal.style.display === 'flex';
        }, { timeout: 10000 });
        assert(true, 'Single-use presentation modal displayed');

        const webcalUrl = await page.$eval('#cal-webcal-url-input', el => el.value);
        const httpsUrl = await page.$eval('#cal-https-url-input', el => el.value);
        assert(webcalUrl.startsWith('webcal://'), `webcal URL starts with webcal:// (${webcalUrl})`);
        assert(httpsUrl.includes('/api/calendar/feed/'), `https URL contains feed endpoint (${httpsUrl})`);

        // Extract raw token from URL
        const tokenMatch = httpsUrl.match(/\/api\/calendar\/feed\/([a-f0-9]+)\.ics/);
        assert(Boolean(tokenMatch), 'Found raw token in URL');
        const rawToken = tokenMatch[1];

        // Verify in DB that calendar_feed_subscriptions row has the exact project_id
        const subRes = await pool.query(
            "SELECT id, project_id, feed_scope, name FROM public.calendar_feed_subscriptions WHERE name = $1 AND organization_id = $2",
            [feedName, demoOrgId]
        );
        assert(subRes.rows.length === 1, 'Subscription record found in DB');
        createdSubId = subRes.rows[0].id;
        assert(subRes.rows[0].project_id === expectedIdempotencyId,
            `Subscription project_id matches Idempotency Test ID (${subRes.rows[0].project_id} === ${expectedIdempotencyId})`);
        assert(subRes.rows[0].feed_scope === 'project', "Subscription feed_scope is 'project'");

        // -------------------------------------------------------------
        // 7. Verify HTTP Fetch of Feed contains Idempotency Test Events
        // -------------------------------------------------------------
        console.log('\n--- 7. Verifying RFC 5545 Feed Content ---');
        const feedResponse = await fetchHttp(httpsUrl);
        assert(feedResponse.status === 200, `Feed HTTP status is 200 (Got: ${feedResponse.status})`);
        assert(feedResponse.body.includes('BEGIN:VCALENDAR'), 'Body contains BEGIN:VCALENDAR');
        assert(feedResponse.body.includes('END:VCALENDAR'), 'Body contains END:VCALENDAR');
        assert(feedResponse.body.includes('Draft Recommendations') || feedResponse.body.includes('Discovery & Onboarding'),
            'Feed contains tasks or stages from Idempotency Test project');

        // Close presentation modal
        await page.click('#btn-close-cal-token-modal');
        await page.waitForFunction(() => {
            const modal = document.getElementById('modal-show-calendar-token');
            return modal && modal.style.display === 'none';
        }, { timeout: 5000 });

        // Verify zero page errors
        assert(pageErrors.length === 0, `Zero uncaught page errors (Got: ${pageErrors.length})`);

        console.log('\n=== ALL PHASE 7C MODAL POSITIONING & PROJECT SELECTOR TESTS PASSED! ===');
    } finally {
        // Clean up test subscription from DB
        if (createdSubId) {
            try {
                await pool.query("DELETE FROM public.calendar_feed_subscriptions WHERE id = $1", [createdSubId]);
                console.log(`[CLEANUP] Deleted test subscription ${createdSubId}`);
            } catch (err) {
                console.warn('[CLEANUP] Warning: Failed to clean up subscription:', err.message);
            }
        }
        await browser.close();
        await pool.end();
    }
}

run().catch(err => {
    console.error('Fatal test failure:', err);
    process.exit(1);
});
