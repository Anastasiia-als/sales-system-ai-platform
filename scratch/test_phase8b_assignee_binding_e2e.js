// scratch/test_phase8b_assignee_binding_e2e.js
// Phase 8B: Chromium E2E & Unit Suite for Automatic Assignee Binding & DOM Synchronization

const puppeteer = require('puppeteer');
const { Pool } = require('pg');
const { getOwnerPassword, loadEnv } = require('./auth_test_helper.js');

loadEnv();

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

async function run() {
    console.log("=== Phase 8B: Assignee Binding & DOM Synchronization Suite ===");

    // 1. Ensure Petro Ivanov fixture user exists in auth.users and public.profiles
    const petroId = '77777777-7777-7777-7777-777777777777';
    await pool.query(
        "INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, 'petro.ivanov@firstwin.io', '{\"full_name\": \"Петро Іванов\", \"global_role\": \"specialist\"}') ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email",
        [petroId]
    );
    await pool.query(
        "INSERT INTO public.profiles (id, full_name, email, global_role) VALUES ($1, 'Петро Іванов', 'petro.ivanov@firstwin.io', 'specialist') ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, global_role = EXCLUDED.global_role",
        [petroId]
    );
    console.log("PASS: Petro Ivanov fixture profile verified in DB");

    // Fetch Anastasia's ID
    const anastasiaRes = await pool.query("SELECT id, full_name FROM public.profiles WHERE email = 'anzaitseva96@gmail.com'");
    assert(anastasiaRes.rows.length > 0, "Anastasiia Owner profile exists");
    const anastasiaId = anastasiaRes.rows[0].id;

    // 2. Launch Puppeteer Browser
    console.log("\n--- 2. Launching Chromium E2E Session ---");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('console', msg => {
        const txt = msg.text();
        if (txt.includes('error') || txt.includes('Error')) {
            console.log('[Browser Console]:', txt);
        }
    });

    try {
        await page.setViewport({ width: 1440, height: 900 });

        // Step 1: Sign in as Owner
        console.log("\n--- Step 1: Signing in as Owner ---");
        await page.goto('http://localhost:8002/#/portal/auth', { waitUntil: 'networkidle0' });
        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', getOwnerPassword());
        await page.click('#btn-submit-pwd');
        await delay(2500);

        // Step 2: Navigate to target meeting
        console.log("\n--- Step 2: Navigating to Meeting Detail View ---");
        const meetingId = '5601b9e6-2efd-4a97-b99b-36d602ffa42b';
        await page.goto(`http://localhost:8002/#/portal/meetings/${meetingId}`, { waitUntil: 'networkidle0' });
        await delay(1500);

        // Step 3: Open AI Meeting Intelligence Modal
        console.log("\n--- Step 3: Opening AI Intelligence Modal ---");
        await page.waitForSelector('#btn-ai-meeting-intelligence', { timeout: 8000 });
        await page.click('#btn-ai-meeting-intelligence');
        await page.waitForSelector('#ai-stage-input', { timeout: 5000 });

        // Step 4: Input Raw Notes Fixture
        console.log("\n--- Step 4: Submitting Raw Notes Fixture ---");
        const rawNotes = "Обговорили запуск нового етапу проєкту. Вирішили розпочати бета-тестування наступного тижня. Анастасія підготує технічне завдання до 15 вересня. Петро перевірить інтеграцію та надасть результат до 17 вересня. Клієнт має надати тестовий доступ до Google Calendar до 14 вересня. Також погодили, що після тестування команда підготує фінальні рекомендації.";
        
        await page.evaluate((notes) => {
            const el = document.getElementById('ai-raw-notes-input');
            if (el) el.value = notes;
        }, rawNotes);

        // Step 5: Click Generate
        await page.click('#btn-run-ai-generation');
        console.log("Waiting for AI Review stage to render...");
        await page.waitForFunction(() => {
            const el = document.getElementById('ai-stage-review');
            return el && el.style.display !== 'none';
        }, { timeout: 15000 });

        // Step 6: Verify DOM Select Values & Options
        console.log("\n--- Step 6: Verifying DOM select.value and selected options ---");
        const candidateData = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('.ai-candidate-card'));
            return cards.map(card => {
                const title = card.querySelector('.ai-candidate-title')?.value || '';
                const respSelect = card.querySelector('.ai-candidate-resp');
                const respValue = respSelect?.value || '';
                const respText = respSelect?.options[respSelect.selectedIndex]?.text || '';

                const assigneeSelect = card.querySelector('.ai-candidate-assignee');
                const assigneeValue = assigneeSelect?.value || '';
                const assigneeSelectedText = assigneeSelect?.options[assigneeSelect.selectedIndex]?.text || '';
                const dataMatched = assigneeSelect?.getAttribute('data-matched-assignee') || '';

                const allOptions = Array.from(assigneeSelect?.options || []).map(o => ({ value: o.value, text: o.text }));

                return {
                    title,
                    respValue,
                    respText,
                    assigneeValue,
                    assigneeSelectedText,
                    dataMatched,
                    optionsCount: allOptions.length,
                    allOptions
                };
            });
        });

        console.log("Extracted Candidate DOM States:", JSON.stringify(candidateData, null, 2));

        assert(candidateData.length === 3, `Exactly 3 candidate cards rendered (got ${candidateData.length})`);

        // Task 1: Anastasia
        const task1 = candidateData.find(c => c.title.includes("технічне завдання"));
        assert(!!task1, "Task 1 (Технічне завдання) is present in DOM");
        assert(task1.respValue === "internal", "Task 1 responsibility select value is 'internal'");
        assert(task1.assigneeValue === anastasiaId, `Task 1 select.value is strictly Anastasiia's UUID '${anastasiaId}' (got '${task1.assigneeValue}')`);
        assert(task1.assigneeSelectedText.includes("Anastasiia"), `Task 1 selected option text displays Anastasiia (got '${task1.assigneeSelectedText}')`);
        assert(task1.dataMatched === anastasiaId, `Task 1 data-matched-assignee matches Anastasiia's UUID`);

        // Task 2: Petro
        const task2 = candidateData.find(c => c.title.includes("інтеграцію"));
        assert(!!task2, "Task 2 (Перевірити інтеграцію) is present in DOM");
        assert(task2.respValue === "internal", "Task 2 responsibility select value is 'internal'");
        assert(task2.assigneeValue === petroId, `Task 2 select.value is strictly Petro's UUID '${petroId}' (got '${task2.assigneeValue}')`);
        assert(task2.assigneeSelectedText.includes("Петро"), `Task 2 selected option text displays Petro (got '${task2.assigneeSelectedText}')`);
        assert(task2.dataMatched === petroId, `Task 2 data-matched-assignee matches Petro's UUID`);

        // Task 3: Client Task
        const task3 = candidateData.find(c => c.title.includes("Google Calendar") || c.respValue === "client");
        assert(!!task3, "Task 3 (Google Calendar) is present in DOM");
        assert(task3.respValue === "client", "Task 3 responsibility select value is 'client'");
        assert(task3.assigneeValue === "", `Task 3 select.value is strictly empty string for unassigned generic client (got '${task3.assigneeValue}')`);
        assert(task3.assigneeSelectedText.includes("Не призначено"), `Task 3 selected option displays '— Не призначено —' (got '${task3.assigneeSelectedText}')`);

        // Step 7: Test Dynamic Responsibility Switch
        console.log("\n--- Step 7: Testing Dynamic Responsibility Switch in DOM ---");
        const switchResult = await page.evaluate(() => {
            const firstCard = document.querySelector('.ai-candidate-card');
            const respSelect = firstCard.querySelector('.ai-candidate-resp');
            const assigneeSelect = firstCard.querySelector('.ai-candidate-assignee');

            // Switch to client
            respSelect.value = 'client';
            respSelect.dispatchEvent(new Event('change'));

            const optionsAfterClient = Array.from(assigneeSelect.options).map(o => o.text);
            const valAfterClient = assigneeSelect.value;

            // Switch back to internal
            respSelect.value = 'internal';
            respSelect.dispatchEvent(new Event('change'));

            const optionsAfterInternal = Array.from(assigneeSelect.options).map(o => o.text);
            const valAfterInternal = assigneeSelect.value;

            return {
                optionsAfterClient,
                valAfterClient,
                optionsAfterInternal,
                valAfterInternal
            };
        });

        assert(switchResult.valAfterClient === "", "Assignee select resets to empty on switch to client");
        assert(switchResult.optionsAfterClient.some(t => t.includes("Клієнт") || t.includes("CEO") || t.includes("Head of Marketing") || t.includes("Не призначено")), "Client contacts populated on switch to client");
        assert(switchResult.optionsAfterInternal.some(t => t.includes("Anastasiia") || t.includes("Петро")), "Internal users populated on switch back to internal");

        console.log("\n=== Phase 8B Assignee Binding & DOM Synchronization Suite 100% Passed ===");
    } finally {
        await browser.close();
        await pool.end();
    }
}

run().catch(err => {
    console.error("TEST FAILED:", err);
    process.exit(1);
});
