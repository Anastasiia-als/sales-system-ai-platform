/**
 * scratch/test_phase8b_raw_notes_fidelity.js
 * Regression & Fidelity Test for Phase 8B: Raw Notes Semantic Grounding & Zero-Hallucination
 *
 * Verifies with exact user input fixture:
 * "Обговорили запуск нового етапу проєкту. Вирішили розпочати бета-тестування наступного тижня. Анастасія підготує технічне завдання до 15 вересня. Петро перевірить інтеграцію та надасть результат до 17 вересня. Клієнт має надати тестовий доступ до Google Calendar до 14 вересня. Також погодили, що після тестування команда підготує фінальні рекомендації."
 *
 * Asserts:
 * 1. Summary does NOT contain any project template or external strings.
 * 2. Decisions contain ONLY ground truth decisions from raw notes.
 * 3. Decisions do NOT contain hallucinated mock items ("Затвердити структуру ролей...", "Підготувати комерційні умови...").
 * 4. Action items strictly extract all 3 tasks with exact responsibility, due_date and assignees.
 * 5. In real browser E2E, date picker is populated with extracted due_dates and assignees are pre-selected.
 */

const { Pool } = require('pg');
const { AIGateway } = require('../js/portal/api/ai-gateway.js');
const puppeteer = require('puppeteer');
const { getOwnerPassword } = require('./auth_test_helper.js');

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

async function run() {
    console.log("=== Phase 8B: Raw Notes Semantic Fidelity & Grounding Suite ===");

    const rawNotesFixture = "Обговорили запуск нового етапу проєкту. Вирішили розпочати бета-тестування наступного тижня. Анастасія підготує технічне завдання до 15 вересня. Петро перевірить інтеграцію та надасть результат до 17 вересня. Клієнт має надати тестовий доступ до Google Calendar до 14 вересня. Також погодили, що після тестування команда підготує фінальні рекомендації.";

    const gateway = new AIGateway();

    // 0. Ensure server is in AI mock mode
    try {
        await fetch('http://localhost:8002/api/v1/ai/mock-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true })
        });
    } catch (_) {}

    // 1. Test Gateway Direct Generation Grounding
    console.log("\n--- 1. Testing Gateway Extraction Fidelity ---");
    const genResult = await gateway.generateStructured({
        organizationId: "e8b4f668-058f-4817-93bb-83229a18f9ec",
        projectId: "35584958-81c3-477c-b5bb-e71398bf540f",
        userId: null,
        featureName: "meeting_intelligence",
        templateKey: "meeting_intelligence_v1",
        provider: "mock",
        variables: {
            project_name: "Новий: Source Template E2E Project From Clone",
            organization_name: "Acme Digital",
            participants: [
                { name: "Анастасія Зайцева", role: "PM", alias: "Анастасія" },
                { name: "Петро Іванов", role: "Developer", alias: "Петро" },
                { name: "Олена Клієнт", role: "Client Representative", alias: "Клієнт" }
            ],
            raw_notes: rawNotesFixture
        }
    });

    assert(genResult && genResult.ok, "Generation result is ok: true");
    const data = genResult.data;

    // A. Verify Summary Grounding
    console.log("\n--- 2. Verifying Summary Grounding ---");
    console.log("Extracted Summary:", data.summary);
    assert(!data.summary.includes("Source Template"), "Summary does NOT contain 'Source Template' project name");
    assert(!data.summary.includes("E2E Project"), "Summary does NOT contain 'E2E Project'");
    assert(data.summary.includes("етапу") || data.summary.includes("проєкту") || data.summary.includes("бета-тестування"), "Summary captures topics from raw notes");

    // B. Verify Decisions Grounding & Zero Hallucination
    console.log("\n--- 3. Verifying Decisions Zero Hallucination ---");
    console.log("Extracted Decisions:", data.decisions);
    assert(Array.isArray(data.decisions), "Decisions is an array");
    assert(data.decisions.length === 2, `Exactly 2 decisions extracted (got ${data.decisions.length})`);

    assert(!data.decisions.some(d => d.includes("структуру ролей")), "Zero hallucination: 'Затвердити структуру ролей...' is ABSENT");
    assert(!data.decisions.some(d => d.includes("комерційні умови")), "Zero hallucination: 'Підготувати комерційні умови...' is ABSENT");

    assert(data.decisions.some(d => d.includes("бета-тестування")), "Ground truth decision 'Розпочати бета-тестування...' is PRESENT");
    assert(data.decisions.some(d => d.includes("фінальні рекомендації")), "Ground truth decision '...команда підготує фінальні рекомендації' is PRESENT");

    // C. Verify Candidate Actions Details (Responsibility, Dates, Assignees)
    console.log("\n--- 4. Verifying Candidate Actions Exact Details ---");
    console.log("Extracted Candidate Actions:", data.candidate_actions);
    assert(Array.isArray(data.candidate_actions), "Candidate actions is an array");
    assert(data.candidate_actions.length === 3, `Exactly 3 action items extracted (got ${data.candidate_actions.length})`);

    // Anastasia's task
    const anastasiaTask = data.candidate_actions.find(a => (a.assignee_name && a.assignee_name.includes("Анастасія")) || a.title.includes("технічне завдання"));
    assert(!!anastasiaTask, "Anastasia's task for technical specification is PRESENT");
    assert(anastasiaTask.responsibility === "internal", "Anastasia's task has responsibility 'internal'");
    assert(anastasiaTask.due_date === "2026-09-15", `Anastasia's task due date is 2026-09-15 (got ${anastasiaTask.due_date})`);
    assert(anastasiaTask.priority === "medium", `Anastasia's task priority defaults to 'medium' (got '${anastasiaTask.priority}')`);
    assert(anastasiaTask.title.includes("Підготувати технічне завдання"), `Anastasia's task title is formatted cleanly in infinitive (got '${anastasiaTask.title}')`);

    // Peter's task
    const petroTask = data.candidate_actions.find(a => (a.assignee_name && a.assignee_name.includes("Петро")) || a.title.includes("інтеграцію"));
    assert(!!petroTask, "Peter's task for checking integration is PRESENT");
    assert(petroTask.responsibility === "internal", "Peter's task has responsibility 'internal'");
    assert(petroTask.due_date === "2026-09-17", `Peter's task due date is 2026-09-17 (got ${petroTask.due_date})`);
    assert(petroTask.priority === "medium", `Peter's task priority defaults to 'medium' (got '${petroTask.priority}')`);
    assert(petroTask.title.includes("Перевірити інтеграцію"), `Peter's task title is formatted cleanly (got '${petroTask.title}')`);

    // Client's task
    const clientTask = data.candidate_actions.find(a => a.responsibility === "client" || a.title.includes("Google Calendar"));
    assert(!!clientTask, "Client's task for Google Calendar access is PRESENT");
    assert(clientTask.responsibility === "client", "Client's task has responsibility 'client'");
    assert(clientTask.due_date === "2026-09-14", `Client's task due date is 2026-09-14 (got ${clientTask.due_date})`);
    assert(clientTask.priority === "medium", `Client's task priority defaults to 'medium' (got '${clientTask.priority}')`);
    assert(clientTask.title.includes("Надати тестовий доступ"), `Client's task title is formatted cleanly (got '${clientTask.title}')`);

    assert(!data.candidate_actions.some(a => a.title.includes("Підготувати оновлену технічну специфікацію")), "Zero hallucination: stale mock task is ABSENT");

    // 5. Real Chromium Browser UI Test with Exact Fixture
    console.log("\n--- 5. Real Chromium Browser UI Verification ---");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        page.on('console', msg => console.log('[BROWSER]', msg.type(), msg.text()));
        page.on('pageerror', err => console.error('[PAGE ERROR]', err.message));

        await page.setViewport({ width: 1440, height: 900 });
        await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });

        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', getOwnerPassword());
        await page.click('#btn-submit-pwd');

        await page.waitForSelector('.portal-sidebar', { timeout: 15000 });
        assert(true, "Owner authenticated into portal");

        // Navigate to meeting
        await page.goto('http://localhost:8002/#/portal/meetings/5601b9e6-2efd-4a97-b99b-36d602ffa42b', { waitUntil: 'networkidle0' });
        await page.waitForSelector('#btn-ai-meeting-intelligence', { timeout: 10000 });
        assert(true, "Meeting detail view loaded");

        // Open AI intelligence modal
        await page.click('#btn-ai-meeting-intelligence');
        await page.waitForSelector('#ai-meeting-backdrop', { visible: true, timeout: 5000 });
        await page.waitForSelector('#ai-raw-notes-input', { timeout: 5000 });
        assert(true, "AI Modal opened at Stage 1");

        // Fill exact fixture raw notes
        await page.type('#ai-raw-notes-input', rawNotesFixture);
        await new Promise(r => setTimeout(r, 200));

        // Click Run Generation
        await page.evaluate(() => {
            const btn = document.getElementById('btn-run-ai-generation');
            if (btn) btn.click();
        });

        // Wait for Stage 2 review
        await page.waitForFunction(() => {
            const el = document.getElementById('ai-stage-review');
            return el && el.style.display !== 'none' && el.innerHTML.trim().length > 0;
        }, { timeout: 15000 });
        assert(true, "Stage 2 rendered with generated protocol");

        // Check summary in UI textarea
        const uiSummary = await page.$eval('#edit-ai-summary', el => el.value);
        assert(!uiSummary.includes("Source Template"), "UI Summary does NOT contain 'Source Template'");

        // Check decisions in UI
        const uiDecisions = await page.$$eval('.ai-decision-row input.ai-decision-text', els => els.map(e => e.value));
        assert(uiDecisions.length === 2, `UI rendered 2 decisions (got ${uiDecisions.length})`);
        assert(!uiDecisions.some(d => d.includes("структуру ролей")), "UI Decisions do NOT contain 'Затвердити структуру ролей'");

        // Check candidate actions in UI (dates and responsibilities)
        const uiDueDates = await page.$$eval('.ai-candidate-card input.ai-candidate-due', els => els.map(e => e.value));
        console.log("UI due dates:", uiDueDates);
        assert(uiDueDates.includes("2026-09-15"), "UI has pre-filled date '2026-09-15' for Anastasia's task");
        assert(uiDueDates.includes("2026-09-17"), "UI has pre-filled date '2026-09-17' for Peter's task");
        assert(uiDueDates.includes("2026-09-14"), "UI has pre-filled date '2026-09-14' for Client's task");

        const uiPriorities = await page.$$eval('.ai-candidate-card select.ai-candidate-prio', els => els.map(e => e.value));
        console.log("UI priorities:", uiPriorities);
        assert(uiPriorities.length === 3, `UI rendered 3 candidate priority dropdowns (got ${uiPriorities.length})`);
        assert(uiPriorities.every(p => p === "medium"), `All UI candidates default to neutral priority 'medium' (got ${JSON.stringify(uiPriorities)})`);

        // Cancel modal without applying
        await page.click('#btn-cancel-ai-review');
        await page.waitForFunction(() => {
            const m = document.getElementById('ai-meeting-backdrop');
            return !m;
        }, { timeout: 5000 });
        assert(true, "Modal safely cancelled without applying stale items to DB");

    } finally {
        await browser.close();
        await pool.end();
    }

    console.log("\n=== Phase 8B Raw Notes Semantic Fidelity Suite 100% Passed ===");
}

run().catch(err => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
});
