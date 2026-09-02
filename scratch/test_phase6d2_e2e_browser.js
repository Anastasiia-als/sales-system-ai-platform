const http = require('http');
const fs = require('fs');
const path = require('path');
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

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain'
};

async function run() {
    console.log("=== Starting Phase 6D.2 Real Chromium E2E Browser Suite ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];
    const createdUserIds = [];

    let server = null;
    let browser = null;

    try {
        // 1. Start Static HTTP Server with robust MIME resolution
        const rootDir = path.resolve(__dirname, '..');
        server = http.createServer((req, res) => {
            let reqPath = req.url.split('?')[0].split('#')[0];
            if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
            const filePath = path.join(rootDir, reqPath);

            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const ext = path.extname(filePath).toLowerCase();
                const mime = MIME_TYPES[ext] || 'application/octet-stream';
                res.writeHead(200, {
                    'Content-Type': mime,
                    'Access-Control-Allow-Origin': '*'
                });
                fs.createReadStream(filePath).pipe(res);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end("Not Found: " + reqPath);
            }
        });

        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const port = server.address().port;
        const baseUrl = `http://127.0.0.1:${port}`;
        console.log(`Local test server running at ${baseUrl}`);

        // 2. Setup Database State (Org, Project, Task, Token)
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('E2E Public Org', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pmUserRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'pm_e2e_${Date.now()}@example.com') RETURNING id`);
        const pmUserId = pmUserRes.rows[0].id;
        createdUserIds.push(pmUserId);
        await pool.query("UPDATE public.profiles SET global_role = 'specialist' WHERE id = $1", [pmUserId]);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, title, responsible_pm_id) VALUES ($1, 'E2E Public Project', 'active', 'E2E Public Project', $2) RETURNING id",
            [orgId, pmUserId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        const tRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, description, status, responsibility_type, is_client_visible, due_date) VALUES ($1, $2, 'E2E Signoff Action', 'Please submit your approval for delivery milestone.', 'todo', 'client', true, NOW() + INTERVAL '3 days') RETURNING id",
            [orgId, projectId]
        );
        const taskId = tRes.rows[0].id;
        createdTaskIds.push(taskId);

        const gRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskId}') AS res;
        `);
        const token = gRes[gRes.length - 1].rows[0].res;

        // 3. Launch Headless Chromium
        console.log("3. Launching Headless Chromium Browser...");
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.log('PAGE ERROR:', err));

        // 4. Initial Navigation to Public Action Page
        console.log("4. Navigating to Public Action URL in anonymous context...");
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(`${baseUrl}/index.html#/action/${token.raw_token}`, { waitUntil: 'networkidle0' });

        // Wait for Active Screen
        await page.waitForSelector('#state-active', { timeout: 10000 });
        const titleText = await page.$eval('.public-action-title', el => el.textContent);
        assert(titleText.includes('E2E Signoff Action'), "Task title rendered in browser UI");

        const descText = await page.$eval('.public-action-desc-box', el => el.textContent);
        assert(descText.includes('Please submit your approval'), "Task description rendered in browser UI");

        // 5. Test Multi-Viewport Responsiveness & Zero Horizontal Scroll
        console.log("5. Testing Multi-Viewport Responsiveness on rendered page...");
        const viewports = [
            { name: "Desktop 1920x1080", width: 1920, height: 1080 },
            { name: "Laptop 1366x768", width: 1366, height: 768 },
            { name: "Tablet 768x1024", width: 768, height: 1024 },
            { name: "Mobile 375x812", width: 375, height: 812 }
        ];

        for (const vp of viewports) {
            await page.setViewport({ width: vp.width, height: vp.height });
            await new Promise(r => setTimeout(r, 100));

            const isPortalActive = await page.evaluate(() => document.documentElement.classList.contains('portal-active'));
            const isActionActive = await page.evaluate(() => document.documentElement.classList.contains('public-action-active'));
            assert(isPortalActive && isActionActive, `[${vp.name}] Layout isolation classes attached`);

            const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
            const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
            assert(scrollWidth <= clientWidth, `[${vp.name}] Zero horizontal overflow (scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth})`);
        }

        // Restore viewport for submission
        await page.setViewport({ width: 1280, height: 800 });

        // 6. Test Form Submission
        console.log("6. Submitting Response via Browser UI...");
        await page.type('#public-action-text-input', 'Milestone approved unconditionally by Client.');
        
        await page.evaluate(() => {
            const btn = document.getElementById('public-action-submit-btn');
            if (btn) btn.click();
        });

        // Check if error box or success appeared
        await new Promise(r => setTimeout(r, 2000));
        const html = await page.evaluate(() => document.getElementById('public-action-container')?.innerHTML || '');
        console.log('CONTAINER HTML AFTER CLICK:\n', html);

        // Verify Success State rendered
        await page.waitForSelector('#state-success', { timeout: 10000 });
        const successTitle = await page.$eval('#state-success .public-state-title', el => el.textContent);
        assert(successTitle.includes('успішно надіслано'), "Success screen rendered after submission");

        // 7. Test F5 Reload -> Already Completed state
        console.log("7. Reloading Browser (F5) to verify State: ALREADY_COMPLETED...");
        await page.reload({ waitUntil: 'networkidle0' });
        await page.waitForSelector('#state-already-completed', { timeout: 10000 });
        const completedTitle = await page.$eval('#state-already-completed .public-state-title', el => el.textContent);
        assert(completedTitle.includes('вже виконано'), "F5 reload deterministically displays 'Дію вже виконано'");

        // 8. Test Invalid Token in Browser
        console.log("8. Testing Invalid Token route in Browser...");
        await page.goto(`${baseUrl}/index.html#/action/fwa_invalid_token_12345678901234567890123456789012`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('#state-not-found', { timeout: 10000 });
        const notFoundTitle = await page.$eval('#state-not-found .public-state-title', el => el.textContent);
        assert(notFoundTitle.includes('не знайдено'), "Invalid token displays 'Дію не знайдено'");

        // 9. Test Revoked Token in Browser
        console.log("9. Testing Revoked Token route in Browser...");
        const tRevRes = await pool.query(
            "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Revoked E2E Action', 'todo', 'client', true) RETURNING id",
            [orgId, projectId]
        );
        const taskRevId = tRevRes.rows[0].id;
        createdTaskIds.push(taskRevId);

        const gRevRes = await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.generate_action_token('${taskRevId}') AS res;
        `);
        const tokenRev = gRevRes[gRevRes.length - 1].rows[0].res;

        await pool.query(`
            SET LOCAL role TO authenticated;
            SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
            SELECT public.revoke_action_token('${taskRevId}');
        `);

        await page.goto(`${baseUrl}/index.html#/action/${tokenRev.raw_token}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('#state-revoked', { timeout: 10000 });
        const revokedTitle = await page.$eval('#state-revoked .public-state-title', el => el.textContent);
        assert(revokedTitle.includes('недоступне'), "Revoked token displays 'Посилання більше недоступне'");

        console.log("PASS: Phase 6D.2 Real Chromium E2E Browser Suite passed 100%!");
    } catch(e) {
        console.error("FATAL ERROR in E2E Browser Suite:", e);
        exitCode = 1;
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
        if (server) {
            await new Promise(resolve => server.close(resolve)).catch(() => {});
        }
        try {
            await pool.query("SET session_replication_role = 'replica';");
            if (createdTaskIds.length > 0) {
                await pool.query("DELETE FROM public.task_submissions WHERE task_id = ANY($1::uuid[])", [createdTaskIds]);
                await pool.query("DELETE FROM public.client_action_tokens WHERE task_id = ANY($1::uuid[])", [createdTaskIds]);
                await pool.query("DELETE FROM public.tasks WHERE id = ANY($1::uuid[])", [createdTaskIds]);
            }
            if (createdProjectIds.length > 0) {
                await pool.query("DELETE FROM public.project_memberships WHERE project_id = ANY($1::uuid[])", [createdProjectIds]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdProjectIds]);
            }
            if (createdOrgIds.length > 0) {
                await pool.query("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", [createdOrgIds]);
            }
            if (createdUserIds.length > 0) {
                await pool.query("DELETE FROM public.profiles WHERE id = ANY($1::uuid[])", [createdUserIds]);
                await pool.query("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [createdUserIds]);
            }
            await pool.query("SET session_replication_role = 'origin';");
        } catch(e) {
            console.error("Cleanup error in E2E browser suite:", e);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
