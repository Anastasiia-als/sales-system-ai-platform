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
    console.log("=== Starting Phase 6D.4 Real Chromium E2E Browser Suite ===");

    const createdOrgIds = [];
    const createdProjectIds = [];
    const createdTaskIds = [];
    const createdUserIds = [];

    let server = null;
    let browser = null;

    try {
        // 1. Static HTTP Server
        const rootDir = path.resolve(__dirname, '..');
        server = http.createServer((req, res) => {
            let reqPath = req.url.split('?')[0].split('#')[0];
            if (reqPath === '/favicon.ico') {
                res.writeHead(204);
                res.end();
                return;
            }
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

        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org Client Portal Browser 6D4', 'active') RETURNING id");
        const orgId = orgRes.rows[0].id;
        createdOrgIds.push(orgId);

        const pRes = await pool.query(
            "INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Project Client Portal 6D4', 'active', $2) RETURNING id",
            [orgId, ownerId]
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
                "INSERT INTO public.tasks (organization_id, project_id, title, description, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Provide Project Requirements ' || $3, 'Please attach your specifications PDF.', 'todo', 'client', true) RETURNING id",
                [orgId, projectId, vp.name]
            );
            const taskId = tRes.rows[0].id;
            createdTaskIds.push(taskId);

            const page = await browser.newPage();
            await page.setViewport({ width: vp.width, height: vp.height });

            page.on('console', msg => {
                const text = msg.text();
                if (text.includes('Error') || text.includes('error') || text.includes('[ClientActions]')) {
                    console.log(`[PAGE LOG]`, text);
                }
            });
            page.on('pageerror', err => console.log('[PAGE ERROR]:', err.message));

            // Navigate to page
            const targetUrl = `${baseUrl}/index.html#/portal/projects/${projectId}`;
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});

            // Authenticate in browser
            await page.evaluate(async (pwd) => {
                const { PortalAuth } = await import('./js/portal/auth/auth-service.js');
                await PortalAuth.init();
                await PortalAuth.signInWithPassword('anzaitseva96@gmail.com', pwd);
            }, getOwnerPassword());
            await new Promise(r => setTimeout(r, 1000));

            // Mount and render ClientActionsView
            console.log(`[${vp.name}] Opening action modal via ClientActionsView...`);
            await page.evaluate(async (tid, pid, oid) => {
                const clientActionsModule = await import('./js/client/ui/client-actions-view.js');

                const task = {
                    id: tid,
                    title: 'Provide Project Requirements',
                    description: 'Please attach your specifications PDF.',
                    status: 'todo',
                    responsibility_type: 'client',
                    is_client_visible: true,
                    organization_id: oid,
                    project_id: pid
                };

                clientActionsModule.openActionDetailModal(task, () => {
                    console.log('Action updated successfully callback fired');
                });
            }, taskId, projectId, orgId);

            // Wait for Modal
            await page.waitForSelector("#action-detail-modal", { timeout: 5000 });
            assert(true, `[${vp.name}] #action-detail-modal rendered successfully`);

            // Verify comment textarea and submit button
            await page.waitForSelector("#client-action-text-input", { timeout: 5000 });
            await page.waitForSelector("#btn-submit-client-action", { timeout: 5000 });
            assert(true, `[${vp.name}] Form fields (textarea & submit button) exist`);

            // Type response text
            await page.type("#client-action-text-input", `Here are the official specifications for ${vp.name}`);

            // Real file attachment via file input element
            console.log(`[${vp.name}] Attaching real PDF via #client-action-file-input...`);
            const tempPdfPath = path.resolve(__dirname, 'mock_test_spec.pdf');
            fs.writeFileSync(tempPdfPath, '%PDF-1.4 Mock PDF Content For Client Action Submission');
            const fileInput = await page.$("#client-action-file-input");
            await fileInput.uploadFile(tempPdfPath);

            // Wait for selected file badge to appear in dropzone UI
            await page.waitForFunction(() => {
                const el = document.getElementById("client-action-selected-files");
                return el && el.textContent.includes("mock_test_spec.pdf");
            }, { timeout: 5000 });
            assert(true, `[${vp.name}] File list UI shows attached file`);

            // Click Submit Button via UI
            console.log(`[${vp.name}] Clicking #btn-submit-client-action...`);
            await page.click("#btn-submit-client-action");

            // Wait for modal to close (or wait until task in DB is done)
            await page.waitForFunction(() => {
                return !document.getElementById("action-detail-modal");
            }, { timeout: 10000 });
            assert(true, `[${vp.name}] Modal closed after successful submission`);

            // Verify task updated to 'done' in database
            const taskCheck = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1;", [taskId]);
            assert(taskCheck.rows[0].status === 'done', `[${vp.name}] Task status is 'done' in DB`);
            assert(taskCheck.rows[0].completed_at !== null, `[${vp.name}] Task completed_at is populated`);

            // Verify task_submissions row
            const subCheck = await pool.query("SELECT * FROM public.task_submissions WHERE task_id = $1;", [taskId]);
            assert(subCheck.rows.length === 1, `[${vp.name}] task_submissions row created`);
            assert(subCheck.rows[0].submission_type === 'authenticated_portal', `[${vp.name}] submission_type is 'authenticated_portal'`);
            assert(subCheck.rows[0].attachments.length === 1, `[${vp.name}] attachments array persisted in submission`);

            // Re-open modal in completed state to verify submission review rendering
            console.log(`[${vp.name}] Opening modal in completed state for submission review...`);
            await page.evaluate(async (tid, pid, oid) => {
                const clientActionsModule = await import('./js/client/ui/client-actions-view.js');

                const task = {
                    id: tid,
                    title: 'Provide Project Requirements',
                    description: 'Please attach your specifications PDF.',
                    status: 'done',
                    responsibility_type: 'client',
                    is_client_visible: true,
                    organization_id: oid,
                    project_id: pid
                };

                clientActionsModule.openActionDetailModal(task, () => {});
            }, taskId, projectId, orgId);

            // Wait for completed state container
            await page.waitForFunction(() => {
                const modal = document.querySelector("#action-detail-modal");
                return modal && (modal.textContent.includes("Клієнтський портал") || modal.textContent.includes("Авторизований портал"));
            }, { timeout: 5000 });
            assert(true, `[${vp.name}] Submission Review displays authenticated portal channel badge`);

            // Verify attachment download link exists
            await page.waitForSelector("button[onclick*='downloadAttachmentFile']", { timeout: 5000 });
            assert(true, `[${vp.name}] Attachment download CTA rendered`);

            // Verify responsive viewport integrity (no horizontal scrollbar / overflow on modal)
            const isOverflowing = await page.evaluate(() => {
                const modalDialog = document.querySelector("#action-detail-modal > div");
                if (!modalDialog) return false;
                return modalDialog.scrollWidth > window.innerWidth;
            });
            assert(!isOverflowing, `[${vp.name}] Modal dialog fits within viewport without horizontal overflow`);

            // Close page
            await page.close();
        }

        console.log("\n=== SUITE 4 PASSED: REAL CHROMIUM E2E BROWSER TESTS 100% VERIFIED ===");

    } finally {
        if (browser) await browser.close();
        if (server) await new Promise(resolve => server.close(resolve));
        try { fs.unlinkSync(path.resolve(__dirname, 'mock_test_spec.pdf')); } catch (e) {}

        // Exact ID cleanup
        if (createdTaskIds.length > 0) {
            await pool.query("DELETE FROM public.notifications WHERE entity_id = ANY($1);", [createdTaskIds]);
            await pool.query("DELETE FROM public.task_submissions WHERE task_id = ANY($1);", [createdTaskIds]);
            await pool.query("DELETE FROM public.tasks WHERE id = ANY($1);", [createdTaskIds]);
        }
        if (createdProjectIds.length > 0) {
            await pool.query("DELETE FROM public.projects WHERE id = ANY($1);", [createdProjectIds]);
        }
        if (createdOrgIds.length > 0) {
            await pool.query("DELETE FROM public.organizations WHERE id = ANY($1);", [createdOrgIds]);
        }
        if (createdUserIds.length > 0) {
            await pool.query("DELETE FROM public.profiles WHERE id = ANY($1);", [createdUserIds]);
            await pool.query("DELETE FROM auth.users WHERE id = ANY($1);", [createdUserIds]);
        }
        await pool.end();
    }
}

run().catch((err) => {
    console.error("FATAL ERROR IN SUITE 4:", err);
    process.exit(1);
});
