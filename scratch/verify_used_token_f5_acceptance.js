const http = require('http');
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

async function run() {
    console.log("=== Verification: Dev-Server Stability, Used Token F5 & Already Completed State ===");

    // 1. Check HTTP server on localhost:8002
    console.log("\n--- 1. Testing Server HTTP Reachability ---");
    const serverStatus = await new Promise((resolve) => {
        http.get('http://localhost:8002/index.html', (res) => {
            resolve(res.statusCode);
        }).on('error', (err) => {
            resolve(err.message);
        });
    });
    assert(serverStatus === 200, `Dev-server responds with HTTP 200 on localhost:8002 (Got: ${serverStatus})`);

    // 2. Check the user's manual acceptance task data in DB
    console.log("\n--- 2. Verifying User's Manual Acceptance Task & Submission Preservation ---");
    const userTaskId = '02f8e8b7-83d1-49af-9e18-3c3206505482';
    const userTaskRes = await pool.query("SELECT id, title, status, completed_at FROM public.tasks WHERE id = $1", [userTaskId]);
    assert(userTaskRes.rows.length === 1, "User's task exists in DB");
    assert(userTaskRes.rows[0].status === 'done' || userTaskRes.rows[0].status === 'todo', "User's task exists in DB with valid status ('done' or 'todo')");
    assert(userTaskRes.rows[0].status === 'done' ? userTaskRes.rows[0].completed_at !== null : userTaskRes.rows[0].completed_at === null, "completed_at matches status");

    const userTokenRes = await pool.query("SELECT id, status, used_at FROM public.client_action_tokens WHERE task_id = $1", [userTaskId]);
    assert(userTokenRes.rows.length === 1, "User's token exists in DB");
    assert(userTokenRes.rows[0].status === 'used', "User's token status is strictly 'used'");
    assert(userTokenRes.rows[0].used_at !== null, "User's token used_at is set");

    const userSubRes = await pool.query("SELECT id, submission_type, payload FROM public.task_submissions WHERE task_id = $1", [userTaskId]);
    assert(userSubRes.rows.length === 1, "User's submission exists in DB (exactly 1 record)");
    assert(userSubRes.rows[0].submission_type === 'public_link', "User's submission type is 'public_link'");
    assert(userSubRes.rows[0].payload.text === 'Тестова відповідь для перевірки клієнтської дії.', "User's submitted text is 100% preserved");

    // 3. Test Real Chromium E2E: Used Token URL & F5 Persistence
    console.log("\n--- 3. Testing Used Token URL and F5 Reload in Real Chromium ---");
    // We create a temporary task to get a known raw token, submit it, and open it in the browser
    const orgRes = await pool.query("INSERT INTO public.organizations (name, status) VALUES ('Org F5 Test', 'active') RETURNING id;");
    const orgId = orgRes.rows[0].id;

    const pmRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1;");
    const ownerId = pmRes.rows[0].id;

    const projRes = await pool.query("INSERT INTO public.projects (organization_id, name, status, responsible_pm_id) VALUES ($1, 'Proj F5 Test', 'active', $2) RETURNING id;", [orgId, ownerId]);
    const projId = projRes.rows[0].id;

    const taskRes = await pool.query("INSERT INTO public.tasks (organization_id, project_id, title, status, responsibility_type, is_client_visible) VALUES ($1, $2, 'Fill Form For F5 Check', 'todo', 'client', true) RETURNING id;", [orgId, projId]);
    const taskId = taskRes.rows[0].id;

    // Generate token
    const genRes = await pool.query(`
        SET LOCAL role TO authenticated;
        SET LOCAL request.jwt.claims TO '{"sub":"${ownerId}"}';
        SELECT public.generate_action_token('${taskId}') AS res;
    `);
    const rawToken = genRes[genRes.length - 1].rows[0].res.raw_token;
    assert(typeof rawToken === 'string' && rawToken.startsWith('fwa_'), "Generated fresh action token");

    // First submission (simulating the client submission)
    const submit1 = await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Initial client response\"}'::jsonb) AS res;", [rawToken]);
    assert(submit1.rows[0].res.success === true, "Initial submission succeeded");

    // Launch Chromium browser
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const usedUrl = `http://localhost:8002/index.html#/action/${rawToken}`;
    console.log(`Navigating to used token URL: ${usedUrl}`);
    await page.goto(usedUrl, { waitUntil: 'networkidle0' });

    // Wait for ALREADY_COMPLETED state
    await page.waitForSelector("#state-already-completed", { timeout: 10000 });
    assert(true, "Element '#state-already-completed' is rendered on initial load");

    const titleText1 = await page.$eval(".public-state-title", el => el.textContent.trim());
    assert(titleText1 === "Дію вже виконано", `State title is 'Дію вже виконано' (Got: '${titleText1}')`);

    const formExists1 = await page.$("#public-action-form");
    assert(formExists1 === null, "Submission form is NOT available (already completed)");

    // Test F5 Reload
    console.log("Simulating F5 reload on used token URL...");
    await page.reload({ waitUntil: 'networkidle0' });

    await page.waitForSelector("#state-already-completed", { timeout: 10000 });
    assert(true, "Element '#state-already-completed' persisted after F5 reload");

    const titleText2 = await page.$eval(".public-state-title", el => el.textContent.trim());
    assert(titleText2 === "Дію вже виконано", `State title is still 'Дію вже виконано' after F5 (Got: '${titleText2}')`);

    const formExists2 = await page.$("#public-action-form");
    assert(formExists2 === null, "Submission form is still NOT available after F5 reload");

    // Test rapid multiple F5 reloads to verify server socket resilience
    console.log("Testing 3 consecutive rapid F5 reloads for server stability...");
    for (let i = 1; i <= 3; i++) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector("#state-already-completed", { timeout: 10000 });
    }
    assert(true, "Server stably handled rapid F5 reloads without dropping connections");

    await browser.close();

    // 4. Test Second Submit Attempt (Must be Rejected)
    console.log("\n--- 4. Testing Second Submit Rejection on Used Token ---");
    let duplicateError = null;
    try {
        await pool.query("SELECT public.submit_public_client_action($1, '{\"text\":\"Attempt duplicate submission\"}'::jsonb) AS res;", [rawToken]);
    } catch (err) {
        duplicateError = err.message;
    }
    assert(duplicateError !== null && duplicateError.includes("Action has already been submitted"), `Second submit correctly rejected: '${duplicateError}'`);

    // Verify DB counts for test task
    const testSubs = await pool.query("SELECT COUNT(*) AS cnt FROM public.task_submissions WHERE task_id = $1;", [taskId]);
    assert(parseInt(testSubs.rows[0].cnt, 10) === 1, "task_submissions count strictly remained 1 (0 duplicate rows)");

    // Cleanup temporary test fixtures
    await pool.query("DELETE FROM public.task_submissions WHERE task_id = $1;", [taskId]);
    await pool.query("DELETE FROM public.client_action_tokens WHERE task_id = $1;", [taskId]);
    await pool.query("DELETE FROM public.tasks WHERE id = $1;", [taskId]);
    await pool.query("DELETE FROM public.projects WHERE id = $1;", [projId]);
    await pool.query("DELETE FROM public.organizations WHERE id = $1;", [orgId]);

    // 5. Final server check
    const finalCheck = await new Promise((resolve) => {
        http.get('http://localhost:8002/index.html', (res) => resolve(res.statusCode)).on('error', (err) => resolve(err.message));
    });
    assert(finalCheck === 200, "Dev-server is actively running and responding with HTTP 200");

    console.log("\n=== ALL CHECKS PASSED: DEV-SERVER RESILIENT, ALREADY COMPLETED STATE VERIFIED ===");
    await pool.end();
}

run().catch((err) => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
