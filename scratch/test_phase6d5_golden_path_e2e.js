const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const SUPABASE_URL = "https://aayqydcdfxhlwizhfjun.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_CZwi_JF1vSKX2q-9XAiojg_6TopfxZY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    '.txt': 'text/plain',
    '.pdf': 'application/pdf'
};

async function run() {
    console.log("=== Starting Phase 6D.5: Canonical Two-Iteration Golden Path E2E Suite ===");

    const createdIds = {
        orgs: [],
        projects: [],
        contacts: [],
        users: [],
        tasks: [],
        tokens: []
    };
    const createdStoragePaths = [];

    let server = null;
    let browser = null;
    let exitCode = 0;

    const mockPdfIter1 = path.resolve(__dirname, 'mock_iter1.pdf');
    const mockPdfIter2 = path.resolve(__dirname, 'mock_iter2.pdf');

    try {
        fs.writeFileSync(mockPdfIter1, '%PDF-1.4 Mock Iteration 1 Attachment Data');
        fs.writeFileSync(mockPdfIter2, '%PDF-1.4 Mock Iteration 2 Attachment Data');

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
                console.log("[EphemeralServer 404]:", req.url);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
        });

        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const port = server.address().port;
        const baseUrl = `http://127.0.0.1:${port}`;
        console.log(`Ephemeral Server running at ${baseUrl}`);

        // 2. Setup Test Data in DB
        const ownerRes = await pool.query("SELECT id, email FROM public.profiles WHERE global_role = 'owner' LIMIT 1;");
        const ownerId = ownerRes.rows[0].id;

        const ts = Date.now();
        const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ($1, 'active') RETURNING id;", [`Org Golden Path 6D5 ${ts}`]);
        const orgId = orgRes.rows[0].id;
        createdIds.orgs.push(orgId);

        const emailClient = `client_golden_${ts}@test.com`;
        const userClientRes = await pool.query("INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id;", [emailClient]);
        const userClientId = userClientRes.rows[0].id;
        createdIds.users.push(userClientId);
        await pool.query("UPDATE public.profiles SET global_role = 'client', full_name = 'Client Golden Path' WHERE id = $1;", [userClientId]);

        const contactRes = await pool.query("INSERT INTO public.contacts (organization_id, first_name, last_name, email) VALUES ($1, 'Golden', 'Client', $2) RETURNING id;", [orgId, emailClient]);
        const contactId = contactRes.rows[0].id;
        createdIds.contacts.push(contactId);

        await pool.query("INSERT INTO public.client_portal_access (organization_id, contact_id, user_id, status) VALUES ($1, $2, $3, 'active');", [orgId, contactId, userClientId]);
        await pool.query("INSERT INTO public.organization_memberships (organization_id, user_id, org_role, is_active) VALUES ($1, $2, 'client', true);", [orgId, userClientId]);

        const projRes = await pool.query("INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Proj Golden Path', 'active', $2) RETURNING id;", [orgId, ownerId]);
        const projId = projRes.rows[0].id;
        createdIds.projects.push(projId);
        await pool.query("INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES ($1, $2, 'client_rep');", [projId, userClientId]);

        // 3. Launch Puppeteer
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const viewports = [
            { name: 'Desktop 1920x1080', width: 1920, height: 1080 },
            { name: 'Mobile 375x812', width: 375, height: 812 }
        ];

        for (const vp of viewports) {
            console.log(`\n======================================================`);
            console.log(`--- Running Golden Path for Viewport: ${vp.name} ---`);
            console.log(`======================================================`);

            const taskRes = await pool.query(`
                INSERT INTO public.tasks (organization_id, project_id, title, description, status, responsibility_type, is_client_visible, client_contact_id)
                VALUES ($1, $2, 'Golden Path Contract Task ' || $3, 'Fill in the questionnaire and attach specifications', 'todo', 'client', true, $4)
                RETURNING id;
            `, [orgId, projId, vp.name, contactId]);
            const taskId = taskRes.rows[0].id;
            createdIds.tasks.push(taskId);

            // Generate Magic Link Token
            const genRes = await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
                SELECT public.generate_action_token('${taskId}') AS res;
            `);
            const tokenData = genRes[genRes.length - 1].rows[0].res;
            const rawToken = tokenData.raw_token;
            createdIds.tokens.push(tokenData.token_id);

            const page = await browser.newPage();
            await page.setViewport({ width: vp.width, height: vp.height });

            const browserErrors = [];
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    const txt = msg.text();
                    // Ignore expected network 404s/favicon
                    if (!txt.includes('favicon') && !txt.includes('net::ERR')) {
                        browserErrors.push(`[${vp.name}] ${txt}`);
                    }
                }
            });
            page.on('pageerror', err => {
                browserErrors.push(`[${vp.name}] Uncaught: ${err.message}`);
            });

            // -------------------------------------------------------------
            // STEP 1: Public Submission (Iteration 1)
            // -------------------------------------------------------------
            console.log(`[${vp.name}] Step 1: Navigating to Public Magic Link page...`);
            await page.goto(`${baseUrl}/index.html#/action/${rawToken}`, { waitUntil: 'networkidle2' });

            await page.waitForSelector("#public-action-text-input", { timeout: 10000 });
            assert(true, `[${vp.name}] Public Action Page loaded successfully`);

            // Type Iteration 1 Response
            const iter1Text = `Відповідь ітерації 1 через Public Magic Link (${vp.name})`;
            await page.type("#public-action-text-input", iter1Text);

            // Attach mock_iter1.pdf
            const fileInput1 = await page.$("#public-file-input");
            if (fileInput1) {
                await fileInput1.uploadFile(mockPdfIter1);
                await new Promise(r => setTimeout(r, 500));
            }

            // Submit Iteration 1
            console.log(`[${vp.name}] Submitting Iteration 1...`);
            await page.$eval("#public-action-submit-btn", el => el.click());

            // Wait for success confirmation or container update
            await page.waitForFunction(() => {
                const el = document.getElementById("public-action-container");
                return el && (el.textContent.includes("Дію успішно надіслано") || el.textContent.includes("Дякуємо") || el.textContent.includes("успішно"));
            }, { timeout: 10000 });
            assert(true, `[${vp.name}] Public Action submission confirmed in UI`);

            // Verify Database after Iteration 1
            const taskAfterIter1 = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1;", [taskId]);
            assert(taskAfterIter1.rows[0].status === 'done', `[${vp.name}] Task status is 'done' after Iteration 1`);
            assert(taskAfterIter1.rows[0].completed_at !== null, `[${vp.name}] completed_at populated after Iteration 1`);

            const tokenAfterIter1 = await pool.query("SELECT status, used_at FROM public.client_action_tokens WHERE id = $1;", [tokenData.token_id]);
            assert(tokenAfterIter1.rows[0].status === 'used', `[${vp.name}] Public token is 'used' after Iteration 1`);

            const sub1Db = await pool.query("SELECT id, submission_type, payload->>'text' as text FROM public.task_submissions WHERE task_id = $1;", [taskId]);
            assert(sub1Db.rows.length === 1, `[${vp.name}] Exactly 1 submission row exists in DB`);
            assert(sub1Db.rows[0].submission_type === 'public_link', `[${vp.name}] Iteration 1 submission_type is 'public_link'`);
            assert(sub1Db.rows[0].text === iter1Text, `[${vp.name}] Iteration 1 text verified`);
            const sub1Id = sub1Db.rows[0].id;

            // -------------------------------------------------------------
            // STEP 2: PM Reopen
            // -------------------------------------------------------------
            console.log(`[${vp.name}] Step 2: PM executes Reopen...`);
            const reopenRes = await pool.query(`
                SET LOCAL role TO authenticated;
                SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
                SELECT public.reopen_client_action('${taskId}') AS res;
            `);
            assert(reopenRes[reopenRes.length - 1].rows[0].res.success === true, `[${vp.name}] PM reopen succeeded`);

            const taskAfterReopen = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1;", [taskId]);
            assert(taskAfterReopen.rows[0].status === 'todo', `[${vp.name}] Task status successfully returned to 'todo'`);
            assert(taskAfterReopen.rows[0].completed_at === null, `[${vp.name}] completed_at is NULL after reopen`);

            // Verify historical token remains dead
            const tokenAfterReopen = await pool.query("SELECT status FROM public.client_action_tokens WHERE id = $1;", [tokenData.token_id]);
            assert(tokenAfterReopen.rows[0].status === 'used', `[${vp.name}] Historical token remains 'used' (never reactivated)`);

            // -------------------------------------------------------------
            // STEP 3: Client Portal Submission (Iteration 2)
            // -------------------------------------------------------------
            console.log(`[${vp.name}] Step 3: Navigating to Client Portal...`);
            await page.goto(`${baseUrl}/index.html#/client/actions`, { waitUntil: 'networkidle2' });

            // Authenticate in browser as Owner (who also has full access) or client
            await page.evaluate(async () => {
                const { PortalAuth } = await import('./js/portal/auth/auth-service.js');
                await PortalAuth.init();
                await PortalAuth.signInWithPassword('anzaitseva96@gmail.com', 'Password123!');
            });
            await new Promise(r => setTimeout(r, 1000));

            // Open Action Detail Modal
            console.log(`[${vp.name}] Opening modal for reopened task...`);
            await page.evaluate(async (tid, pid, oid, cid) => {
                const clientActionsModule = await import('./js/client/ui/client-actions-view.js');
                const task = {
                    id: tid,
                    title: 'Golden Path Contract Task',
                    status: 'todo',
                    responsibility_type: 'client',
                    is_client_visible: true,
                    organization_id: oid,
                    project_id: pid,
                    client_contact_id: cid
                };
                clientActionsModule.openActionDetailModal(task, () => {
                    console.log('Action detail callback');
                });
            }, taskId, projId, orgId, contactId);

            await page.waitForSelector("#action-detail-modal", { timeout: 10000 });
            assert(true, `[${vp.name}] #action-detail-modal opened`);

            // Verify Iteration 1 is displayed in Submission History block
            console.log(`[${vp.name}] Verifying Submission History block...`);
            await page.waitForFunction(() => {
                const el = document.getElementById("client-action-review-section");
                return el && el.textContent.includes("Ітерація 1");
            }, { timeout: 10000 });

            const reviewSectionText = await page.$eval("#client-action-review-section", el => el.textContent);
            assert(reviewSectionText.includes("Історія попередніх відповідей") || reviewSectionText.includes("історії"), `[${vp.name}] History section rendered`);
            assert(reviewSectionText.includes("Ітерація 1"), `[${vp.name}] Iteration 1 badge rendered`);
            assert(reviewSectionText.includes("Публічне посилання"), `[${vp.name}] Public link channel badge rendered`);
            assert(reviewSectionText.includes(iter1Text), `[${vp.name}] Iteration 1 text preserved and visible in history`);

            // Fill in Iteration 2 response
            const iter2Text = `Оновлена відповідь ітерації 2 через Client Portal (${vp.name})`;
            await page.type("#client-action-text-input", iter2Text);

            // Attach mock_iter2.pdf
            const fileInput2 = await page.$("#client-action-file-input");
            if (fileInput2) {
                await fileInput2.uploadFile(mockPdfIter2);
                await page.waitForFunction(() => {
                    const el = document.getElementById("client-action-selected-files");
                    return el && el.textContent.includes("mock_iter2.pdf");
                }, { timeout: 5000 });
                assert(true, `[${vp.name}] Iteration 2 file selected in dropzone`);
            }

            // Click Submit Button
            console.log(`[${vp.name}] Submitting Iteration 2 via Client Portal...`);
            await page.$eval("#btn-submit-client-action", el => el.click());

            await new Promise(r => setTimeout(r, 1000));
            const btnState = await page.evaluate(() => {
                const btn = document.getElementById("btn-submit-client-action");
                const err = document.getElementById("client-action-form-error");
                return {
                    btn: btn ? { disabled: btn.disabled, text: btn.textContent } : null,
                    err: err ? { display: err.style.display, text: err.textContent } : null
                };
            });
            console.log(`[${vp.name}] Button & Error State:`, JSON.stringify(btnState));

            // Wait for modal to close
            await page.waitForFunction(() => {
                return !document.getElementById("action-detail-modal");
            }, { timeout: 15000 });
            assert(true, `[${vp.name}] Modal closed after submitting Iteration 2`);

            // -------------------------------------------------------------
            // STEP 4: Authoritative DB Verification of the Complete Golden Path
            // -------------------------------------------------------------
            console.log(`[${vp.name}] Step 4: Authoritative verification of completed Golden Path in DB...`);
            const taskFinal = await pool.query("SELECT status, completed_at FROM public.tasks WHERE id = $1;", [taskId]);
            assert(taskFinal.rows[0].status === 'done', `[${vp.name}] Final tasks.status is 'done'`);
            assert(taskFinal.rows[0].completed_at !== null, `[${vp.name}] Final tasks.completed_at IS NOT NULL`);

            const allSubs = await pool.query(`
                SELECT id, submission_type, payload->>'text' as text, created_at, attachments 
                FROM public.task_submissions 
                WHERE task_id = $1 
                ORDER BY created_at ASC;
            `, [taskId]);

            assert(allSubs.rows.length === 2, `[${vp.name}] Exactly 2 submissions preserved in history`);
            
            // Assert Iteration 1
            assert(allSubs.rows[0].id === sub1Id, `[${vp.name}] Iteration 1 immutable id matches`);
            assert(allSubs.rows[0].submission_type === 'public_link', `[${vp.name}] Iteration 1 submission_type = 'public_link'`);
            assert(allSubs.rows[0].text === iter1Text, `[${vp.name}] Iteration 1 text preserved intact`);

            // Assert Iteration 2
            assert(allSubs.rows[1].submission_type === 'authenticated_portal', `[${vp.name}] Iteration 2 submission_type = 'authenticated_portal'`);
            assert(allSubs.rows[1].text === iter2Text, `[${vp.name}] Iteration 2 text recorded accurately`);
            assert(allSubs.rows[1].attachments && allSubs.rows[1].attachments.length > 0, `[${vp.name}] Iteration 2 attachment recorded`);

            // Track any uploaded storage path for clean removal
            if (allSubs.rows[1].attachments && allSubs.rows[1].attachments.length > 0) {
                allSubs.rows[1].attachments.forEach(att => {
                    if (att.path) createdStoragePaths.push(att.path);
                });
            }

            // Verify browser runtime errors = 0
            assert(browserErrors.length === 0, `[${vp.name}] Browser runtime errors = 0 (Got: ${browserErrors.join('; ')})`);

            await page.close();
        }

        console.log("\n======================================================");
        console.log("CANONICAL TWO-ITERATION GOLDEN PATH FULLY VERIFIED 100%!");
        console.log("======================================================");

    } catch(e) {
        console.error("FATAL ERROR in test_phase6d5_golden_path_e2e:", e);
        exitCode = 1;
    } finally {
        console.log("\n--- Executing Golden Path Fixture Cleanup ---");
        try {
            if (browser) await browser.close();
            if (server) await new Promise(r => server.close(r));
            if (fs.existsSync(mockPdfIter1)) fs.unlinkSync(mockPdfIter1);
            if (fs.existsSync(mockPdfIter2)) fs.unlinkSync(mockPdfIter2);

            if (createdStoragePaths.length > 0) {
                await supabase.storage.from('project-documents').remove(createdStoragePaths);
                console.log("Cleaned up registered storage paths:", createdStoragePaths);
            }

            await pool.query("SET session_replication_role = 'replica';");
            if (createdIds.tasks.length > 0) {
                await pool.query("DELETE FROM public.notifications WHERE organization_id = ANY($1::uuid[])", [createdIds.orgs]);
                await pool.query("DELETE FROM public.task_submissions WHERE task_id = ANY($1::uuid[])", [createdIds.tasks]);
                await pool.query("DELETE FROM public.client_action_tokens WHERE task_id = ANY($1::uuid[])", [createdIds.tasks]);
                await pool.query("DELETE FROM public.tasks WHERE id = ANY($1::uuid[])", [createdIds.tasks]);
            }
            if (createdIds.projects.length > 0) {
                await pool.query("DELETE FROM public.project_memberships WHERE project_id = ANY($1::uuid[])", [createdIds.projects]);
                await pool.query("DELETE FROM public.projects WHERE id = ANY($1::uuid[])", [createdIds.projects]);
            }
            if (createdIds.orgs.length > 0) {
                await pool.query("DELETE FROM public.client_portal_access WHERE organization_id = ANY($1::uuid[])", [createdIds.orgs]);
                await pool.query("DELETE FROM public.organization_memberships WHERE organization_id = ANY($1::uuid[])", [createdIds.orgs]);
                await pool.query("DELETE FROM public.contacts WHERE organization_id = ANY($1::uuid[])", [createdIds.orgs]);
                await pool.query("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", [createdIds.orgs]);
            }
            if (createdIds.users.length > 0) {
                await pool.query("DELETE FROM public.profiles WHERE id = ANY($1::uuid[])", [createdIds.users]);
                await pool.query("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [createdIds.users]);
            }
            await pool.query("SET session_replication_role = 'origin';");
            console.log("Cleanup completed targeting only exact created IDs.");
        } catch(cleanupErr) {
            console.error("Cleanup error in golden path suite:", cleanupErr);
        }
        await pool.end();
        if (exitCode !== 0) process.exit(exitCode);
    }
}

run();
