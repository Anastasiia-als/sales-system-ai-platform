/**
 * scratch/test_phase8b_browser_e2e.js
 * End-to-End Browser UI Test for Phase 8B: Meeting Intelligence & Action Item Extraction
 * 1. Authenticates as Owner in real browser (Puppeteer)
 * 2. Navigates to Meeting Detail View
 * 3. Clicks '#btn-ai-meeting-intelligence'
 * 4. Fills raw notes and clicks '#btn-run-ai-generation'
 * 5. Verifies Review Stage (Human-in-the-Loop) displays Summary, Decisions, and Candidate Tasks
 * 6. Edits candidate task and clicks '#btn-apply-ai-items'
 * 7. Verifies tasks and decisions are created in database with source_meeting_id
 */

const puppeteer = require('puppeteer');
const { Pool } = require('pg');
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
    console.log("=== Phase 8B: Browser E2E Suite ===");

    // 0. Enable AI mock mode on server
    try {
        await fetch('http://localhost:8002/api/v1/ai/mock-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true })
        });
    } catch (_) {}

    const ownerUserRes = await pool.query("SELECT id FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
    const ownerId = ownerUserRes.rows[0]?.id;
    assert(!!ownerId, "Found owner ID");

    // Fetch demo organization & project for fixture
    const orgRes = await pool.query("SELECT id FROM public.organizations WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' LIMIT 1");
    const orgId = orgRes.rows[0]?.id || "cccccccc-cccc-cccc-cccc-cccccccccccc";

    const projRes = await pool.query("SELECT id FROM public.projects WHERE organization_id = $1 LIMIT 1", [orgId]);
    const projId = projRes.rows[0]?.id;
    assert(!!projId, "Found demo project ID");

    // Create test meeting
    const testMeetingId = 'bbbbbbbb-1111-2222-3333-444444444444';
    try {
        await pool.query("SET session_replication_role = 'replica';");
        await pool.query("DELETE FROM public.meeting_ai_artifacts WHERE meeting_id = $1", [testMeetingId]);
        await pool.query("DELETE FROM public.tasks WHERE source_meeting_id = $1", [testMeetingId]);
        await pool.query("DELETE FROM public.meeting_decisions WHERE meeting_id = $1", [testMeetingId]);
        await pool.query("DELETE FROM public.meeting_notes WHERE meeting_id = $1", [testMeetingId]);
        await pool.query("DELETE FROM public.meetings WHERE id = $1", [testMeetingId]);
        await pool.query("SET session_replication_role = 'origin';");
    } catch (_) {}

    await pool.query(`
        INSERT INTO public.meetings (
            id, organization_id, project_id, title, meeting_type, status, start_at, end_at, organizer_user_id
        ) VALUES (
            $1, $2, $3, 'Phase 8B E2E Intelligence Meeting', 'review', 'completed', NOW(), NOW() + interval '1 hour', $4
        )
    `, [testMeetingId, orgId, projId, ownerId]);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });
        await page.setCacheEnabled(false);

        page.on('pageerror', err => {
            console.error('[BROWSER PAGE ERROR]:', err.message);
        });

        page.on('console', msg => {
            console.log(`[BROWSER CONSOLE ${msg.type()}]:`, msg.text());
        });

        page.on('dialog', async d => {
            console.log('[BROWSER DIALOG]:', d.message());
            await d.dismiss();
        });

        // 1. Authenticate as Owner
        console.log("Logging in as owner...");
        await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });

        await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
        await page.type('#auth-email-pwd', 'anzaitseva96@gmail.com');
        await page.type('#auth-password', getOwnerPassword());
        await page.click('#btn-submit-pwd');

        await page.waitForSelector('.portal-sidebar', { timeout: 15000 });
        assert(true, "Owner authenticated successfully");

        // 2. Navigate to Meeting Detail View
        console.log(`Navigating to meeting: http://localhost:8002/#/portal/meetings/${testMeetingId}`);
        await page.goto(`http://localhost:8002/#/portal/meetings/${testMeetingId}`, { waitUntil: 'networkidle0' });

        await page.waitForSelector('#btn-ai-meeting-intelligence', { timeout: 10000 });
        assert(true, "Header button '#btn-ai-meeting-intelligence' is visible");

        // 3. Open AI Intelligence Modal
        await page.click('#btn-ai-meeting-intelligence');
        await page.waitForSelector('#ai-meeting-backdrop', { timeout: 5000 });
        assert(true, "Meeting Intelligence Modal opened (Stage 1)");

        // 4. Fill raw notes in Stage 1
        const rawNotes = `
            Зустріч по фіналізації Phase 8B.
            Погоджено дизайн модального вікна та Human-in-the-Loop review.
            Рішення: Впровадити обов'язковий етап ручної верифікації перед створенням задач.
            Завдання: Оновити документацію та протестувати у браузері.
        `;
        await page.waitForSelector('#ai-raw-notes-input', { timeout: 5000 });
        await page.type('#ai-raw-notes-input', rawNotes);

        // 5. Click Run Generation via evaluate to ensure exact trigger
        console.log("Triggering AI generation button click...");
        await page.evaluate(() => {
            const btn = document.getElementById('btn-run-ai-generation');
            if (!btn) throw new Error("Button #btn-run-ai-generation not found");
            btn.click();
        });

        // 6. Wait for Stage 2 (Review) to appear
        console.log("Waiting for Stage 2 Review...");
        await page.waitForFunction(() => {
            const el = document.getElementById('ai-stage-review');
            return el && el.style.display !== 'none' && el.innerHTML.trim().length > 0;
        }, { timeout: 15000 });
        assert(true, "Stage 2 (Human-in-the-Loop Review) rendered successfully");

        // Verify summary textarea is populated
        const summaryVal = await page.$eval('#edit-ai-summary', el => el.value);
        assert(summaryVal && summaryVal.length > 0, "Summary field is populated");

        // Verify candidate actions exist
        const candidateCards = await page.$$('.ai-candidate-card');
        assert(candidateCards.length > 0, `Found ${candidateCards.length} candidate action cards`);

        // Edit first candidate title to append '(Curated E2E)'
        await page.evaluate(() => {
            const titleInput = document.querySelector('.ai-candidate-title');
            if (titleInput) {
                titleInput.value = titleInput.value + ' (Curated E2E)';
            }
        });

        // 7. Click Apply Protocol button
        console.log("Triggering Apply Protocol button click...");
        await page.evaluate(() => {
            const btn = document.getElementById('btn-apply-ai-items');
            if (!btn) throw new Error("Button #btn-apply-ai-items not found");
            btn.click();
        });

        // Wait for modal to disappear
        await page.waitForFunction(() => {
            return !document.getElementById('ai-meeting-backdrop');
        }, { timeout: 10000 });
        assert(true, "Modal closed after applying protocol");

        // 8. Verify database results
        const artCheck = await pool.query(
            "SELECT * FROM public.meeting_ai_artifacts WHERE meeting_id = $1 ORDER BY created_at DESC LIMIT 1",
            [testMeetingId]
        );
        assert(artCheck.rows.length === 1, "Meeting AI artifact persisted in database");
        assert(artCheck.rows[0].status === 'applied', "Artifact status transitioned to 'applied'");

        const tasksCheck = await pool.query(
            "SELECT * FROM public.tasks WHERE source_meeting_id = $1",
            [testMeetingId]
        );
        assert(tasksCheck.rows.length > 0, `Tasks created in public.tasks (count: ${tasksCheck.rows.length})`);
        const curatedTask = tasksCheck.rows.find(t => t.title.includes('(Curated E2E)'));
        assert(!!curatedTask, "Curated task with '(Curated E2E)' found in public.tasks");

        const decCheck = await pool.query(
            "SELECT * FROM public.meeting_decisions WHERE meeting_id = $1",
            [testMeetingId]
        );
        assert(decCheck.rows.length > 0, `Decisions created in public.meeting_decisions (count: ${decCheck.rows.length})`);

        const noteCheck = await pool.query(
            "SELECT * FROM public.meeting_notes WHERE meeting_id = $1 AND note_type = 'summary'",
            [testMeetingId]
        );
        assert(noteCheck.rows.length === 1, "Summary note created in public.meeting_notes");

    } finally {
        await browser.close();

        // Clean up test meeting fixtures
        try {
            await pool.query("SET session_replication_role = 'replica';");
            await pool.query("DELETE FROM public.meeting_ai_artifacts WHERE meeting_id = $1", [testMeetingId]);
            await pool.query("DELETE FROM public.tasks WHERE source_meeting_id = $1", [testMeetingId]);
            await pool.query("DELETE FROM public.meeting_decisions WHERE meeting_id = $1", [testMeetingId]);
            await pool.query("DELETE FROM public.meeting_notes WHERE meeting_id = $1", [testMeetingId]);
            await pool.query("DELETE FROM public.meetings WHERE id = $1", [testMeetingId]);
            await pool.query("SET session_replication_role = 'origin';");
        } catch (_) {}

        await pool.end();
    }

    console.log("=== Phase 8B Browser E2E Suite 100% Passed ===");
}

run().catch(err => {
    console.error("FAIL with exception:", err);
    process.exit(1);
});
