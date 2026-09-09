const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { Pool } = require('pg');
const { getOwnerPassword } = require('./auth_test_helper.js');

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
    console.log("=== Starting Phase 6D.3 Real Chromium E2E Browser Suite (Test T) ===");
    let exitCode = 0;
    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];
    const createdUserIds = [];

    let server = null;
    let browser = null;

    try {
        // 1. Start Static HTTP Server
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
                res.end('Not Found');
            }
        });

        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const port = server.address().port;
        const baseUrl = `http://127.0.0.1:${port}`;
        console.log(`Server running at ${baseUrl}`);

        // 2. Setup Test Data in PostgreSQL
        const ownerRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        const ownerId = ownerRes.rows[0].id;

        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org PM UI Browser', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pmRes = await pool.query(`INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'pm_browser_e2e@example.com') RETURNING id;`);
        const pmId = pmRes.rows[0].id;
        createdUserIds.push(pmId);
        await pool.query("UPDATE public.profiles SET global_role = 'owner' WHERE id = $1", [pmId]);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Project PM UI Browser', 'active', $2) RETURNING id",
            [orgId, pmId]
        );
        const projectId = pRes.rows[0].id;
        createdProjectIds.push(projectId);

        // 3. Launch Puppeteer Browser
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const viewports = [
            { name: 'Desktop 1920x1080', width: 1920, height: 1080 },
            { name: 'Mobile 375x812', width: 375, height: 812 }
        ];

        for (const vp of viewports) {
            console.log(`\n--- Testing Viewport: ${vp.name} ---`);
            const tRes = await pool.query(
                "INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Fill Onboarding Form ' || $3, 'todo', 'client', true) RETURNING id",
                [orgId, projectId, vp.name]
            );
            const taskId = tRes.rows[0].id;
            createdTaskIds.push(taskId);

            const page = await browser.newPage();
            await page.setViewport({ width: vp.width, height: vp.height });

            page.on('console', msg => console.log('PAGE CONSOLE:', msg.text()));
            page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

            // Automatically accept confirmation dialogs (for Revoke/Regenerate)
            page.on('dialog', async (dialog) => {
                await dialog.accept();
            });

            // Navigate to Portal
            const targetUrl = `${baseUrl}/index.html#/portal/projects/${projectId}`;
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});

            // Authenticate as Owner
            console.log("Authenticating in browser as owner...");
            await page.evaluate(async (pwd) => {
                const { PortalAuth } = await import('./js/portal/auth/auth-service.js');
                await PortalAuth.init();
                await PortalAuth.signInWithPassword('anzaitseva96@gmail.com', pwd);
            }, getOwnerPassword());
            await new Promise(r => setTimeout(r, 1000));

            // Open Task Modal
            console.log("Opening task modal directly via openTaskModal...");
            await page.evaluate(async (tid, pid, oid) => {
                const tasksModule = await import('./js/portal/ui/portal-project-tasks-view.js');

                const task = {
                    id: tid,
                    title: 'Fill Onboarding Form',
                    status: 'todo',
                    responsibility_type: 'client',
                    is_client_visible: true,
                    organization_id: oid,
                    project_id: pid
                };

                // Create mount point if needed
                let mount = document.getElementById("portal-tasks-modal-mount");
                if (!mount) {
                    mount = document.createElement("div");
                    mount.id = "portal-tasks-modal-mount";
                    document.body.appendChild(mount);
                }

                await tasksModule.openTaskModal(pid, oid, task, [], [], [], [task], [], () => {});
            }, taskId, projectId, orgId);

            // Wait for client action management container
            await page.waitForSelector("#client-action-management-container", { timeout: 5000 });
            assert(true, `[${vp.name}] Client action container mounted in Task Modal`);

            // Verify initial status badge: «Не згенеровано»
            await page.waitForFunction(() => {
                const el = document.querySelector("#client-action-management-container");
                return el && el.textContent.includes("Не згенеровано");
            }, { timeout: 5000 });
            assert(true, `[${vp.name}] Status badge displays 'Не згенеровано'`);

            // Verify Generate Magic Link button exists and click it
            const genBtn = await page.$("#btn-ca-generate");
            assert(genBtn !== null, `[${vp.name}] '#btn-ca-generate' button is rendered`);

            console.log("Clicking Generate Magic Link button...");
            await page.click("#btn-ca-generate");

            // Wait for One-Time Reveal Modal
            await page.waitForSelector("#modal-one-time-reveal", { timeout: 5000 });
            assert(true, `[${vp.name}] One-Time Reveal Modal displayed successfully`);

            // Verify reveal URL input contains 'fwa_'
            const revealUrl = await page.$eval("#reveal-url-input", el => el.value);
            assert(revealUrl.includes("#/action/fwa_"), `[${vp.name}] Reveal input contains valid token URL (#/action/fwa_...)`);

            // Verify copy button exists and can be clicked
            const copyBtn = await page.$("#btn-copy-magic-link");
            assert(copyBtn !== null, `[${vp.name}] Copy button rendered`);
            await page.click("#btn-copy-magic-link");

            // Close the reveal modal
            console.log("Closing One-Time Reveal Modal...");
            await page.click("#btn-done-reveal-modal");
            await page.waitForSelector("#modal-one-time-reveal", { hidden: true, timeout: 5000 });
            assert(true, `[${vp.name}] One-Time Reveal Modal removed from DOM`);

            // Verify status in Task Modal updated reactively to «Активне»
            await page.waitForFunction(() => {
                const el = document.querySelector("#client-action-management-container");
                return el && el.textContent.includes("Активне");
            }, { timeout: 5000 });
            assert(true, `[${vp.name}] Client action status updated reactively to 'Активне'`);

            // Verify Revoke button is now available
            const revokeBtn = await page.$("#btn-ca-revoke");
            assert(revokeBtn !== null, `[${vp.name}] Revoke button is now available`);

            // Click Revoke button
            console.log("Clicking Revoke button...");
            await page.click("#btn-ca-revoke");

            // Wait for status to transition to «Відкликано»
            await page.waitForFunction(() => {
                const el = document.querySelector("#client-action-management-container");
                return el && el.textContent.includes("Відкликано");
            }, { timeout: 5000 });
            assert(true, `[${vp.name}] Client action status updated reactively to 'Відкликано'`);

            // Zero raw token leakage in localStorage or DOM attributes
            const storageTokens = await page.evaluate(() => {
                const found = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    const v = localStorage.getItem(k);
                    if (v && v.includes("fwa_")) found.push(k);
                }
                return found;
            });
            assert(storageTokens.length === 0, `[${vp.name}] Zero raw token found in localStorage`);

            const domRawTokens = await page.evaluate(() => {
                return document.querySelectorAll("[data-raw-token]").length;
            });
            assert(domRawTokens === 0, `[${vp.name}] Zero data-raw-token attributes found in DOM`);

            await page.close();
        }

        console.log("\n=== REAL CHROMIUM E2E BROWSER TESTS (TEST T) PASSED! ===");
    } catch (err) {
        console.error("Test Suite Failed:", err);
        exitCode = 1;
    } finally {
        if (browser) await browser.close();
        if (server) server.close();

        for (const tid of createdTaskIds) {
            await pool.query("DELETE FROM public.client_action_tokens WHERE task_id = $1", [tid]);
            await pool.query("DELETE FROM public.tasks WHERE id = $1", [tid]);
        }
        for (const pid of createdProjectIds) {
            await pool.query("DELETE FROM public.projects WHERE id = $1", [pid]);
        }
        for (const uid of createdUserIds) {
            await pool.query("DELETE FROM public.profiles WHERE id = $1", [uid]);
            await pool.query("DELETE FROM auth.users WHERE id = $1", [uid]);
        }
        for (const oid of createdOrgIds) {
            await pool.query("DELETE FROM public.organizations WHERE id = $1", [oid]);
        }
        await pool.end();
        process.exit(exitCode);
    }
}

run();
