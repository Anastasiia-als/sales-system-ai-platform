/**
 * scratch/test_phase8b_independent_fixture.js
 * Independent Fixture Regression & Chromium E2E Test Suite
 *
 * Verifies with unseen user input fixture:
 * "Обговорили підготовку до повторної перевірки інтеграцій. Вирішили залишити поточну CRM без змін до завершення пілотного періоду. Також погодили провести повторну перевірку 23 вересня. Марія має терміново перевірити доступ до CRM до 20 вересня. Анастасія підготує короткий звіт за результатами перевірки до 22 вересня. Клієнт має передати оновлений логотип до 25 вересня, низький пріоритет."
 *
 * Asserts:
 * 1. Exactly 2 ground truth decisions extracted (zero hallucination).
 * 2. Exactly 3 candidate actions extracted (zero omitted, zero hallucinated).
 * 3. Maria task: priority='high', due_date='2026-09-20', unassigned ('').
 * 4. Anastasiia task: priority='medium', due_date='2026-09-22', matched to Anastasiia.
 * 5. Client logo task: priority='low', due_date='2026-09-25', responsibility='client', unassigned ('').
 * 6. Real Chromium Browser E2E verifies actual DOM select.value and input.value for all properties.
 */

const { Pool } = require('pg');
const { AIGateway } = require('../js/portal/api/ai-gateway.js');
const puppeteer = require('puppeteer');
const { getOwnerPassword, loadEnv } = require('./auth_test_helper.js');

loadEnv();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

function assert(condition, message) {
    if (!condition) {
        console.error("FAIL: " + message);
        process.exit(1);
    }
    console.log("PASS: " + message);
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function run() {
    console.log("=== Phase 8B: Independent Unseen Fixture Regression & E2E Suite ===");

    const independentRawNotes = "Обговорили підготовку до повторної перевірки інтеграцій. Вирішили залишити поточну CRM без змін до завершення пілотного періоду. Також погодили провести повторну перевірку 23 вересня. Марія має терміново перевірити доступ до CRM до 20 вересня. Анастасія підготує короткий звіт за результатами перевірки до 22 вересня. Клієнт має передати оновлений логотип до 25 вересня, низький пріоритет.";

    const gateway = new AIGateway();

    // Ensure server is in AI mock mode
    try {
        await fetch('http://localhost:8002/api/v1/ai/mock-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true })
        });
    } catch (_) {}

    // 1. Gateway Unit Test on Independent Fixture
    console.log("\n--- 1. Testing Gateway Extraction on Independent Fixture ---");
    const genResult = await gateway.generateStructured({
        organizationId: "e8b4f668-058f-4817-93bb-83229a18f9ec",
        projectId: "35584958-81c3-477c-b5bb-e71398bf540f",
        userId: null,
        featureName: "meeting_intelligence",
        templateKey: "meeting_intelligence_v1",
        provider: "mock",
        variables: {
            project_name: "Source Template Project",
            organization_name: "Acme Digital",
            participants: [
                { name: "Anastasiia (Owner)", alias: "Анастасія" },
                { name: "Петро Іванов", role: "Developer", alias: "Петро" }
            ],
            raw_notes: independentRawNotes
        }
    });

    assert(genResult && genResult.ok, "Gateway generation succeeded with ok: true");
    const data = genResult.data;

    // Decisions assertions
    console.log("\nExtracted Decisions:", data.decisions);
    assert(Array.isArray(data.decisions), "Decisions is an array");
    assert(data.decisions.length === 2, `Exactly 2 decisions extracted (got ${data.decisions.length})`);
    assert(data.decisions.some(d => d.includes("залишити поточну CRM") || d.includes("Залишити поточну CRM")), "Decision 1 (Залишити CRM без змін) is present");
    assert(data.decisions.some(d => d.includes("повторну перевірку 23 вересня") || d.includes("Повторну перевірку 23 вересня")), "Decision 2 (Провести повторну перевірку 23 вересня) is present");

    // Candidate Actions assertions
    console.log("\nExtracted Candidate Actions:", JSON.stringify(data.candidate_actions, null, 2));
    assert(Array.isArray(data.candidate_actions), "Candidate actions is an array");
    assert(data.candidate_actions.length === 3, `Exactly 3 candidate actions extracted (got ${data.candidate_actions.length})`);

    // Action 1: Maria
    const mariaTask = data.candidate_actions.find(a => a.description.includes("Марія"));
    assert(!!mariaTask, "Maria task is present");
    assert(mariaTask.priority === "high", `Maria task priority is 'high' due to 'терміново' (got '${mariaTask.priority}')`);
    assert(mariaTask.due_date === "2026-09-20", `Maria task due date is '2026-09-20' (got '${mariaTask.due_date}')`);
    assert(mariaTask.responsibility === "internal", `Maria task responsibility is 'internal' (got '${mariaTask.responsibility}')`);
    assert(mariaTask.assignee_name === "Марія", `Maria task assignee_name is 'Марія' (got '${mariaTask.assignee_name}')`);
    assert(mariaTask.title.includes("Перевірити доступ до CRM"), `Maria task title is clean infinitive (got '${mariaTask.title}')`);

    // Action 2: Anastasiia
    const anastasiaTask = data.candidate_actions.find(a => a.description.includes("Анастасія"));
    assert(!!anastasiaTask, "Anastasiia task is present");
    assert(anastasiaTask.priority === "medium", `Anastasiia task priority is 'medium' neutral default (got '${anastasiaTask.priority}')`);
    assert(anastasiaTask.due_date === "2026-09-22", `Anastasiia task due date is '2026-09-22' (got '${anastasiaTask.due_date}')`);
    assert(anastasiaTask.responsibility === "internal", `Anastasiia task responsibility is 'internal' (got '${anastasiaTask.responsibility}')`);
    assert(anastasiaTask.title.includes("Підготувати короткий звіт"), `Anastasiia task title is clean infinitive (got '${anastasiaTask.title}')`);

    // Action 3: Client Logo
    const clientLogoTask = data.candidate_actions.find(a => a.description.includes("логотип") || a.title.includes("логотип"));
    assert(!!clientLogoTask, "Client logo task is present");
    assert(clientLogoTask.priority === "low", `Client logo task priority is 'low' due to 'низький пріоритет' (got '${clientLogoTask.priority}')`);
    assert(clientLogoTask.due_date === "2026-09-25", `Client logo task due date is '2026-09-25' (got '${clientLogoTask.due_date}')`);
    assert(clientLogoTask.responsibility === "client", `Client logo task responsibility is 'client' (got '${clientLogoTask.responsibility}')`);
    assert(clientLogoTask.title.includes("Передати оновлений логотип"), `Client logo task title is clean infinitive (got '${clientLogoTask.title}')`);

    // 2. Real Chromium Browser E2E Test
    console.log("\n--- 2. Chromium Browser E2E Verification on Independent Fixture ---");

    // Fetch Anastasia's ID from DB
    const anastasiaRes = await pool.query("SELECT id, full_name FROM public.profiles WHERE email = 'anzaitseva96@gmail.com'");
    assert(anastasiaRes.rows.length > 0, "Anastasiia Owner profile found in DB");
    const anastasiaId = anastasiaRes.rows[0].id;

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        await page.setViewport({ width: 1440, height: 900 });

        // Step 1: Sign in
        await page.goto('http://localhost:8002/#/portal/auth', { waitUntil: 'networkidle0' });
        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', getOwnerPassword());
        await page.click('#btn-submit-pwd');
        await delay(2000);

        // Step 2: Open meeting detail view
        const meetingId = '5601b9e6-2efd-4a97-b99b-36d602ffa42b';
        await page.goto(`http://localhost:8002/#/portal/meetings/${meetingId}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('#btn-ai-meeting-intelligence', { timeout: 8000 });
        assert(true, "Meeting detail view loaded");

        // Step 3: Open AI Intelligence modal
        await page.click('#btn-ai-meeting-intelligence');
        await page.waitForSelector('#ai-meeting-backdrop', { visible: true, timeout: 5000 });
        await page.waitForSelector('#ai-raw-notes-input', { timeout: 5000 });

        // Step 4: Input the independent raw text
        await page.evaluate((notes) => {
            const el = document.getElementById('ai-raw-notes-input');
            if (el) el.value = notes;
        }, independentRawNotes);

        // Step 5: Click Generate
        await page.click('#btn-run-ai-generation');
        await page.waitForFunction(() => {
            const el = document.getElementById('ai-stage-review');
            return el && el.style.display !== 'none' && el.innerHTML.trim().length > 0;
        }, { timeout: 15000 });
        assert(true, "Stage 2 rendered with generated protocol");

        // Step 6: Verify DOM Elements
        const domCandidates = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('.ai-candidate-card'));
            return cards.map(card => {
                const title = card.querySelector('.ai-candidate-title')?.value || '';
                const respSelect = card.querySelector('.ai-candidate-resp');
                const respValue = respSelect?.value || '';
                const respText = respSelect?.options[respSelect.selectedIndex]?.text || '';

                const prioSelect = card.querySelector('.ai-candidate-prio');
                const prioValue = prioSelect?.value || '';
                const prioText = prioSelect?.options[prioSelect.selectedIndex]?.text || '';

                const assigneeSelect = card.querySelector('.ai-candidate-assignee');
                const assigneeValue = assigneeSelect?.value || '';
                const assigneeText = assigneeSelect?.options[assigneeSelect.selectedIndex]?.text || '';

                const dueInput = card.querySelector('.ai-candidate-due');
                const dueValue = dueInput?.value || '';

                return {
                    title,
                    respValue,
                    respText,
                    prioValue,
                    prioText,
                    assigneeValue,
                    assigneeText,
                    dueValue
                };
            });
        });

        console.log("\nExtracted DOM Candidate Cards:", JSON.stringify(domCandidates, null, 2));

        assert(domCandidates.length === 3, `Exactly 3 candidate cards rendered in DOM (got ${domCandidates.length})`);

        // DOM Card 1: Maria
        const domMaria = domCandidates.find(c => c.title.includes("CRM"));
        assert(!!domMaria, "DOM Maria task card exists");
        assert(domMaria.respValue === "internal", "DOM Maria responsibility select.value is 'internal'");
        assert(domMaria.prioValue === "high", `DOM Maria priority select.value is 'high' (got '${domMaria.prioValue}')`);
        assert(domMaria.prioText.includes("Високий"), `DOM Maria priority text is 'Високий' (got '${domMaria.prioText}')`);
        assert(domMaria.assigneeValue === "", `DOM Maria assignee select.value is '' for unknown user (got '${domMaria.assigneeValue}')`);
        assert(domMaria.assigneeText.includes("Не призначено"), `DOM Maria displays '— Не призначено —' (got '${domMaria.assigneeText}')`);
        assert(domMaria.dueValue === "2026-09-20", `DOM Maria date input.value is '2026-09-20' (got '${domMaria.dueValue}')`);

        // DOM Card 2: Anastasiia
        const domAnastasiia = domCandidates.find(c => c.title.includes("звіт"));
        assert(!!domAnastasiia, "DOM Anastasiia task card exists");
        assert(domAnastasiia.respValue === "internal", "DOM Anastasiia responsibility select.value is 'internal'");
        assert(domAnastasiia.prioValue === "medium", `DOM Anastasiia priority select.value is 'medium' (got '${domAnastasiia.prioValue}')`);
        assert(domAnastasiia.prioText.includes("Середній"), `DOM Anastasiia priority text is 'Середній' (got '${domAnastasiia.prioText}')`);
        assert(domAnastasiia.assigneeValue === anastasiaId, `DOM Anastasiia assignee select.value is matched UUID '${anastasiaId}' (got '${domAnastasiia.assigneeValue}')`);
        assert(domAnastasiia.assigneeText.includes("Anastasiia"), `DOM Anastasiia displays 'Anastasiia (Owner)' (got '${domAnastasiia.assigneeText}')`);
        assert(domAnastasiia.dueValue === "2026-09-22", `DOM Anastasiia date input.value is '2026-09-22' (got '${domAnastasiia.dueValue}')`);

        // DOM Card 3: Client Logo
        const domClient = domCandidates.find(c => c.title.includes("логотип") || c.respValue === "client");
        assert(!!domClient, "DOM Client logo task card exists");
        assert(domClient.respValue === "client", "DOM Client responsibility select.value is 'client'");
        assert(domClient.prioValue === "low", `DOM Client priority select.value is 'low' (got '${domClient.prioValue}')`);
        assert(domClient.prioText.includes("Низький"), `DOM Client priority text is 'Низький' (got '${domClient.prioText}')`);
        assert(domClient.assigneeValue === "", `DOM Client assignee select.value is '' unassigned (got '${domClient.assigneeValue}')`);
        assert(domClient.assigneeText.includes("Не призначено"), `DOM Client displays '— Не призначено —' (got '${domClient.assigneeText}')`);
        assert(domClient.dueValue === "2026-09-25", `DOM Client date input.value is '2026-09-25' (got '${domClient.dueValue}')`);

        // Cancel modal without applying to DB (clean invariant)
        await page.click('#btn-cancel-ai-review');
        await page.waitForFunction(() => {
            const m = document.getElementById('ai-meeting-backdrop');
            return !m;
        }, { timeout: 5000 });
        assert(true, "Modal safely closed without applying stale items to DB");

    } finally {
        await browser.close();
        await pool.end();
    }

    console.log("\n=== Phase 8B Independent Unseen Fixture Suite 100% Passed ===");
}

run().catch(err => {
    console.error("Independent Fixture Suite Failed:", err);
    process.exit(1);
});
