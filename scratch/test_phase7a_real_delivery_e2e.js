const puppeteer = require('puppeteer');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const k = trimmed.substring(0, idx).trim();
            const v = trimmed.substring(idx + 1).trim();
            if (!process.env[k]) {
                process.env[k] = v;
            }
        }
    }
}

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

function fetchWebhookSiteRequests(token) {
    return new Promise((resolve) => {
        const url = `https://webhook.site/token/${token}/requests?sorting=newest`;
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ data: [] });
                }
            });
        });
        req.on('error', (err) => {
            console.warn('[webhook.site warning] Transient network fetch error:', err.message);
            resolve({ data: [] });
        });
    });
}

function clearWebhookSiteRequests(token) {
    return new Promise((resolve) => {
        const req = https.request(`https://webhook.site/token/${token}/request`, { method: 'DELETE' }, () => {
            resolve();
        });
        req.on('error', () => resolve());
        req.end();
    });
}

async function getFreshWebhookSiteToken(pool) {
    const tokenData = await new Promise((resolve, reject) => {
        const req = https.request('https://webhook.site/token', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.end();
    });

    const token = tokenData.uuid;
    const targetUrl = `https://webhook.site/${token}`;

    const secRes = await pool.query(
        "SELECT vault.create_secret($1, $2, $3) AS sec_id",
        [targetUrl, 'endpoint_url_' + Date.now(), 'Target URL for webhook endpoint: Demo Client Corp']
    );
    const newSecId = secRes.rows[0].sec_id;

    await pool.query(
        "UPDATE public.integration_endpoints SET url_secret_id = $1, url_hostname = 'webhook.site', is_active = true WHERE organization_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'",
        [newSecId]
    );

    return token;
}

async function resolveWebhookToken(pool) {
    let token = 'dceda492-20ac-455a-a1d8-c1d34011b334';
    const isRateLimited = await new Promise((resolve) => {
        const req = https.request(`https://webhook.site/${token}`, { method: 'POST' }, res => {
            resolve(res.statusCode === 429);
        });
        req.on('error', () => resolve(true));
        req.write('{}');
        req.end();
    });

    if (isRateLimited) {
        console.log("Current webhook.site token is rate-limited (HTTP 429). Generating fresh webhook.site token...");
        token = await getFreshWebhookSiteToken(pool);
        console.log(`Fresh webhook.site token configured: ${token}`);
    } else {
        await clearWebhookSiteRequests(token);
    }
    return token;
}

async function run() {
    console.log("=== Starting Real Chromium Phase 7A Webhook Delivery E2E Suite ===");

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', err => {
        console.error("PAGE ERROR:", err.message);
        pageErrors.push(err.message);
    });

    page.on('console', msg => {
        if (msg.type() === 'error') {
            const txt = msg.text();
            // Filter expected benign noise if any
            if (!txt.includes('favicon') && !txt.includes('404')) {
                consoleErrors.push(txt);
            }
        }
    });

    try {
        // -------------------------------------------------------------
        // 1. Owner Authentication
        // -------------------------------------------------------------
        console.log("\n--- 1. Authenticating as Owner ---");
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });

        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', process.env.OWNER_PASSWORD || process.env.OWNER_PASSWORD);
        await page.click('#btn-submit-pwd');

        // Wait for portal shell to load
        await page.waitForSelector('.portal-sidebar', { timeout: 15000 });
        console.log("Owner authenticated successfully!");

        // 2. Fetch baseline request count from webhook.site
        const token = await resolveWebhookToken(pool);
        const initialRequests = await fetchWebhookSiteRequests(token);
        const baselineTotal = initialRequests.total || 0;
        console.log(`Baseline webhook.site total requests: ${baselineTotal}`);

        // 3. User navigation path: Clients -> Demo Client Corp -> Projects -> Idempotency Test -> Tasks
        console.log("\n--- 2. Navigating to Idempotency Test Tasks ---");
        await page.goto('http://localhost:8002/#/portal/clients', { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.body.innerText.includes("Demo Client Corp"), { timeout: 10000 });

        const clientLink = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(a => a.textContent.includes("Demo Client Corp"));
            return target ? target.getAttribute('href') : null;
        });
        await page.goto(`http://localhost:8002/${clientLink}`, { waitUntil: 'networkidle0' });

        await page.waitForSelector('.portal-tab-btn[data-tab="projects"]', { timeout: 10000 });
        await page.click('.portal-tab-btn[data-tab="projects"]');

        await page.waitForFunction(() => document.body.innerText.includes("Idempotency Test"), { timeout: 10000 });
        const projectLink = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const target = links.find(a => a.textContent.includes("Idempotency Test"));
            return target ? target.getAttribute('href') : null;
        });
        await page.goto(`http://localhost:8002/${projectLink}`, { waitUntil: 'networkidle0' });

        await page.waitForSelector('.portal-tab-btn[data-tab="tasks"]', { timeout: 10000 });
        await page.click('.portal-tab-btn[data-tab="tasks"]');
        console.log("Switched to Tasks tab!");

        await page.waitForFunction(() => document.body.innerText.includes("Draft Recommendations"), { timeout: 10000 });
        const taskId = await page.evaluate(() => {
            const titleSpan = Array.from(document.querySelectorAll('.portal-task-title')).find(el => el.textContent.includes("Draft Recommendations"));
            return titleSpan ? titleSpan.getAttribute('data-task-id') : null;
        });
        assert(Boolean(taskId), `Found Draft Recommendations task ID: ${taskId}`);

        // Ensure Demo Client Corp integration endpoint is active
        await pool.query("UPDATE public.integration_endpoints SET is_active = true WHERE organization_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'");

        // Ensure task is in 'todo' before triggering 'done'
        const currentDbStatus = await pool.query('SELECT status FROM public.tasks WHERE id = $1', [taskId]);
        if (currentDbStatus.rows[0].status !== 'todo') {
            await pool.query("UPDATE public.tasks SET status = 'todo' WHERE id = $1", [taskId]);
            await page.reload({ waitUntil: 'networkidle0' });
            await page.waitForSelector('.portal-tab-btn[data-tab="tasks"]', { timeout: 10000 });
            await page.click('.portal-tab-btn[data-tab="tasks"]');
            await page.waitForSelector(`.btn-open-task-detail[data-task-id="${taskId}"]`, { timeout: 10000 });
        }

        // 4. Open task modal, change status to 'done', and save
        console.log("\n--- 3. Completing Task (todo -> done) in UI ---");
        const editBtn = await page.$(`.btn-open-task-detail[data-task-id="${taskId}"]`);
        await editBtn.click();
        await page.waitForSelector('#form-task-modal', { timeout: 5000 });

        await page.select('#task-status', 'done');

        await page.evaluate(() => {
            const modal = document.querySelector('.portal-modal');
            if (modal) modal.scrollTop = modal.scrollHeight;
        });

        await page.click('#btn-submit-task-modal');

        // Modal closes cleanly
        await page.waitForFunction(() => !document.getElementById('form-task-modal'), { timeout: 10000 });
        assert(true, "Task edit modal closed cleanly");

        // Task row updates in UI
        await page.waitForFunction((id) => {
            const sel = document.querySelector(`.portal-task-row[data-task-id="${id}"] .task-status-select`);
            return sel && sel.value === 'done';
        }, { timeout: 10000 }, taskId);
        assert(true, "Task status updated to done in UI");

        // 5. Verify background dispatcher claims and delivers
        console.log("\n--- 4. Verifying Outbox Delivery in Background Dispatcher ---");
        let deliveryRow = null;
        for (let i = 0; i < 15; i++) {
            const outRes = await pool.query(`
                SELECT o.*, e.event_type, e.payload_json
                FROM public.integration_outbox o
                JOIN public.integration_events e ON o.event_id = e.id
                WHERE e.event_type = 'task.completed'
                  AND e.payload_json->>'task_id' = $1
                  AND o.channel_type = 'webhook'
                  AND o.created_at >= NOW() - INTERVAL '1 minute'
                ORDER BY o.created_at DESC
                LIMIT 1
            `, [taskId]);

            if (outRes.rows.length > 0 && outRes.rows[0].status === 'delivered') {
                deliveryRow = outRes.rows[0];
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        assert(Boolean(deliveryRow), "Outbox record transitioned to delivered");
        assert(deliveryRow.status === 'delivered', "Outbox status is delivered");
        assert(deliveryRow.attempts_count >= 1, `Attempts count >= 1 (Got: ${deliveryRow.attempts_count})`);
        assert(deliveryRow.last_http_status === 200, `Last HTTP status is 200 (Got: ${deliveryRow.last_http_status})`);
        assert(Boolean(deliveryRow.delivered_at), "Delivered_at timestamp is populated");
        console.log(`Outbox delivery ID: ${deliveryRow.id}, Delivered at: ${deliveryRow.delivered_at}`);

        // 6. Navigate to UI Integrations -> Deliveries tab
        console.log("\n--- 5. Verifying Delivery in UI (Integrations -> Outbox Log) ---");
        await page.goto('http://localhost:8002/#/portal/integrations', { waitUntil: 'networkidle0' });
        await page.waitForSelector('#integrations-org-select option[value="cccccccc-cccc-cccc-cccc-cccccccccccc"]', { timeout: 10000 });
        await page.select('#integrations-org-select', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
        await page.evaluate(() => {
            const el = document.getElementById('integrations-org-select');
            if (el) el.dispatchEvent(new Event('change'));
        });
        await page.waitForSelector('#tab-btn-deliveries', { timeout: 10000 });
        await page.click('#tab-btn-deliveries');

        // Wait for table to render delivery row
        await page.waitForFunction(() => {
            const table = document.getElementById('deliveries-table-body');
            return table && table.textContent.includes('task.completed') && table.textContent.includes('200');
        }, { timeout: 10000 });
        assert(true, "UI Deliveries tab renders task.completed with HTTP 200");

        // Check badge in UI table
        const uiDeliveryInfo = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#deliveries-table-body tr'));
            const firstRow = rows[0];
            if (!firstRow) return null;
            return {
                text: firstRow.textContent,
                hasDeliveredBadge: Boolean(firstRow.querySelector('.badge-success'))
            };
        });
        assert(Boolean(uiDeliveryInfo && uiDeliveryInfo.hasDeliveredBadge), "UI displays green success badge for delivered webhook");

        // 7. Verify actual HTTP POST on webhook.site
        console.log("\n--- 6. Verifying Delivery Received on webhook.site ---");
        let webhookReceived = false;
        let receivedReq = null;

        for (let attempt = 0; attempt < 10; attempt++) {
            const requests = await fetchWebhookSiteRequests(token);
            if (requests.data && requests.data.length > 0) {
                const match = requests.data.find(r => {
                    const deliveryHeader = r.headers['x-firstwin-delivery'] ? r.headers['x-firstwin-delivery'][0] : null;
                    return deliveryHeader === deliveryRow.id;
                });
                if (match) {
                    webhookReceived = true;
                    receivedReq = match;
                    break;
                }
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        assert(webhookReceived, `webhook.site received exact delivery request ${deliveryRow.id}`);
        console.log("Webhook.site successfully verified request arrival!");

        // Check headers
        const sig256 = receivedReq.headers['x-firstwin-signature-256'] ? receivedReq.headers['x-firstwin-signature-256'][0] : null;
        const tsHeader = receivedReq.headers['x-firstwin-timestamp'] ? receivedReq.headers['x-firstwin-timestamp'][0] : null;
        assert(Boolean(sig256 && sig256.startsWith('sha256=')), "X-Firstwin-Signature-256 header present with sha256= prefix");
        assert(Boolean(tsHeader), "X-Firstwin-Timestamp header present");

        // Check payload allowlist
        const payload = JSON.parse(receivedReq.content);
        assert(payload.event === 'task.completed', "Payload event matches task.completed");
        assert(payload.organization_id === deliveryRow.organization_id, "Payload tenant isolation preserved");
        assert(payload.data.title === 'Draft Recommendations', "Payload data contains task title");
        assert(payload.data.status === 'done', "Payload data contains status done");
        assert(payload.data.project_name === 'Idempotency Test', "Payload data contains project name");
        assert(payload.data.responsibility_type === 'internal', "Payload data contains responsibility type");

        // Ensure zero prohibited fields (no tokens, passwords, raw SQL, user PII)
        const contentStr = JSON.stringify(payload);
        assert(!contentStr.includes('password'), "Zero passwords in payload");
        assert(!contentStr.includes('secret'), "Zero secrets in payload");
        assert(!contentStr.includes('token'), "Zero tokens in payload");

        // 8. Idempotency & Duplicate Guard: Verify exact-once delivery row per event+destination
        console.log("\n--- 7. Idempotency & Exact-Once Verification ---");
        const dupCheck = await pool.query(`
            SELECT COUNT(*) as cnt
            FROM public.integration_outbox
            WHERE event_id = $1 AND destination_id = $2
        `, [deliveryRow.event_id, deliveryRow.destination_id]);
        assert(parseInt(dupCheck.rows[0].cnt, 10) === 1, "Exactly 1 outbox record exists for this event and destination");

        console.log("\n=== ALL REAL CHROMIUM & WEBHOOK.SITE E2E CHECKS PASSED! ===");
    } catch (err) {
        console.error("E2E Test Suite Failed:", err);
        throw err;
    } finally {
        await browser.close();
        await pool.end();
    }
}

run();
