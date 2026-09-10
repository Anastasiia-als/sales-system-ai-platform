// scratch/test_phase8b_provider_routing.js
// Phase 8B Provider Routing, Fail-Closed Production Semantics & UI Error Handling

const assert = require('assert');
const { Pool } = require('pg');
const puppeteer = require('puppeteer');
const { AIGateway } = require('../js/portal/api/ai-gateway.js');
const { getOwnerAuthToken, getOwnerPassword } = require('./auth_test_helper.js');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

async function run() {
    console.log("=== Phase 8B: Provider Routing & Fail-Closed Suite ===");

    const originalEnv = process.env.NODE_ENV;
    const originalGeminiKey = process.env.GEMINI_API_KEY;
    const originalMockTransport = process.env.AI_MOCK_TRANSPORT;

    try {
        // Find test organization and user
        const orgRes = await pool.query("SELECT id FROM public.organizations WHERE slug = 'demo-client' OR name ILIKE '%demo%' LIMIT 1");
        assert(orgRes.rows.length > 0, "Test organization found");
        const testOrgId = orgRes.rows[0].id;

        const ownerRes = await pool.query("SELECT id, email FROM public.profiles WHERE global_role = 'owner' LIMIT 1");
        assert(ownerRes.rows.length > 0, "Test owner profile found");
        const testUserId = ownerRes.rows[0].id;
        const ownerEmail = ownerRes.rows[0].email;

        const rawNotes = "Обговорили запуск нового етапу проєкту. Вирішили розпочати бета-тестування наступного тижня. Анастасія підготує технічне завдання до 15 вересня.";

        // -------------------------------------------------------------
        // 1. Local Dev / Manual Acceptance (PENDING_LIVE_ACTIVATION)
        // -------------------------------------------------------------
        console.log("\n--- 1. Testing Local Dev / Manual Acceptance (No GEMINI_API_KEY) ---");
        delete process.env.GEMINI_API_KEY;
        delete process.env.AI_MOCK_TRANSPORT;
        process.env.NODE_ENV = 'development';

        const devGateway = new AIGateway({ pool, env: 'development' });
        assert.strictEqual(devGateway.resolveTargetProvider(null), 'mock', "Default provider resolves to 'mock' in dev without GEMINI_API_KEY");

        const devGenResult = await devGateway.generateStructured({
            organizationId: testOrgId,
            userId: testUserId,
            featureName: 'meeting_intelligence',
            templateKey: 'meeting_intelligence_v1',
            variables: { raw_notes: rawNotes }
        });

        assert.strictEqual(devGenResult.ok, true, "Dev generation succeeded");
        assert.strictEqual(devGenResult.provider, 'mock', "Provider used was 'mock'");
        assert(devGenResult.data && Array.isArray(devGenResult.data.decisions), "Decisions array returned");
        assert(devGenResult.data.candidate_actions.length > 0, "Candidate actions returned");
        console.log("PASS: Local Dev / Manual Acceptance generates structured protocol via Mock provider without GEMINI_API_KEY");

        // -------------------------------------------------------------
        // 2. HTTP Endpoint in Local Dev Mode (No GEMINI_API_KEY)
        // -------------------------------------------------------------
        console.log("\n--- 2. Testing HTTP /api/v1/ai/generate-structured in Dev Mode ---");
        const token = await getOwnerAuthToken();
        const httpResp = await fetch('http://localhost:8002/api/v1/ai/generate-structured', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                organizationId: testOrgId,
                featureName: 'meeting_intelligence',
                templateKey: 'meeting_intelligence_v1',
                variables: { raw_notes: rawNotes }
            })
        });

        assert.strictEqual(httpResp.status, 200, "HTTP status 200 in dev without GEMINI_API_KEY");
        const httpJson = await httpResp.json();
        assert.strictEqual(httpJson.ok, true, "HTTP response ok: true");
        assert.strictEqual(httpJson.provider, 'mock', "HTTP response provider: 'mock'");
        console.log("PASS: HTTP API resolves to Mock provider and succeeds without GEMINI_API_KEY in dev");

        // -------------------------------------------------------------
        // 3. Production Mode without GEMINI_API_KEY: Fail-Closed (No Mock Fallback)
        // -------------------------------------------------------------
        console.log("\n--- 3. Testing Production Mode without GEMINI_API_KEY (Fail-Closed) ---");
        process.env.NODE_ENV = 'production';
        delete process.env.GEMINI_API_KEY;

        const prodGateway = new AIGateway({ pool, env: 'production' });

        let prodError = null;
        try {
            await prodGateway.generateStructured({
                organizationId: testOrgId,
                userId: testUserId,
                featureName: 'meeting_intelligence',
                templateKey: 'meeting_intelligence_v1',
                variables: { raw_notes: rawNotes }
            });
        } catch (err) {
            prodError = err;
        }

        assert(prodError !== null, "Production mode threw error when GEMINI_API_KEY is missing");
        assert.strictEqual(prodError.code, 'LIVE_AI_UNAVAILABLE', "Error code is LIVE_AI_UNAVAILABLE");
        assert.strictEqual(prodError.statusCode, 503, "Status code is 503");
        assert(prodError.message.includes("forbidden in production"), "Error message forbids mock fallback in production");
        console.log("PASS: Production mode fails closed (HTTP 503 / LIVE_AI_UNAVAILABLE) without GEMINI_API_KEY");

        // -------------------------------------------------------------
        // 4. Production Mode rejects client forcing mock
        // -------------------------------------------------------------
        console.log("\n--- 4. Testing Production Mode Rejection of Client Forcing Mock ---");
        let clientMockError = null;
        try {
            await prodGateway.generateStructured({
                organizationId: testOrgId,
                userId: testUserId,
                featureName: 'meeting_intelligence',
                templateKey: 'meeting_intelligence_v1',
                variables: { raw_notes: rawNotes },
                provider: 'mock'
            });
        } catch (err) {
            clientMockError = err;
        }

        assert(clientMockError !== null, "Client attempting to force mock in production was rejected");
        assert.strictEqual(clientMockError.code, 'FORBIDDEN_PROVIDER', "Error code is FORBIDDEN_PROVIDER");
        assert.strictEqual(clientMockError.statusCode, 403, "Status code is 403");
        console.log("PASS: Production mode rejects client attempt to force mock (HTTP 403 / FORBIDDEN_PROVIDER)");

        // -------------------------------------------------------------
        // 5. Provider Allowlist Verification
        // -------------------------------------------------------------
        console.log("\n--- 5. Testing Provider Allowlist Protection ---");
        let allowlistError = null;
        try {
            await devGateway.generateStructured({
                organizationId: testOrgId,
                userId: testUserId,
                featureName: 'meeting_intelligence',
                templateKey: 'meeting_intelligence_v1',
                variables: { raw_notes: rawNotes },
                provider: 'unapproved_external_llm'
            });
        } catch (err) {
            allowlistError = err;
        }

        assert(allowlistError !== null, "Unapproved provider was rejected");
        assert.strictEqual(allowlistError.code, 'INVALID_PROVIDER', "Error code is INVALID_PROVIDER");
        assert.strictEqual(allowlistError.statusCode, 400, "Status code is 400");
        console.log("PASS: Unapproved provider rejected with INVALID_PROVIDER (HTTP 400)");

        // Restore environment for browser test
        process.env.NODE_ENV = 'development';

        // -------------------------------------------------------------
        // 6. Browser UI Error Handling & State Preservation Test
        // -------------------------------------------------------------
        console.log("\n--- 6. Testing Browser UI Error Handling & Notes Preservation ---");
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        try {
            // Find meeting
            const meetRes = await pool.query("SELECT id FROM public.meetings ORDER BY created_at DESC LIMIT 1");
            assert(meetRes.rows.length > 0, "Meeting found for browser test");
            const meetingId = meetRes.rows[0].id;

            // Login
            await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });
            await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
            await page.type('#auth-email-pwd', ownerEmail);
            await page.type('#auth-password', getOwnerPassword());
            await page.click('#btn-submit-pwd');
            await page.waitForSelector('.portal-sidebar', { timeout: 15000 });

            // Navigate to meeting detail view
            await page.goto(`http://localhost:8002/#/portal/meetings/${meetingId}`, { waitUntil: 'networkidle0' });
            await page.waitForSelector('#btn-ai-meeting-intelligence', { visible: true });
            await page.click('#btn-ai-meeting-intelligence');

            await page.waitForSelector('#ai-stage-input', { visible: true });

            // Type raw notes
            const testNotes = "Тестові нотатки для перевірки збереження тексту при помилці.";
            await page.type('#ai-raw-notes-input', testNotes);

            // Temporarily mock network route to fail
            await page.setRequestInterception(true);
            const failHandler = (request) => {
                if (request.url().includes('/api/v1/ai/generate-structured') && request.method() === 'POST') {
                    request.respond({
                        status: 503,
                        contentType: 'application/json',
                        body: JSON.stringify({ ok: false, error: 'Simulated AI Service Unavailable' })
                    });
                } else {
                    request.continue();
                }
            };
            page.on('request', failHandler);

            // Intercept browser dialog (alert)
            let alertMessage = '';
            page.on('dialog', async (dialog) => {
                alertMessage = dialog.message();
                await dialog.dismiss();
            });

            // Click generate button
            await page.click('#btn-run-ai-generation');

            // Wait for failure and recovery back to stage input
            await page.waitForFunction(() => {
                const inputStage = document.getElementById('ai-stage-input');
                const loadingStage = document.getElementById('ai-stage-loading');
                const runBtn = document.getElementById('btn-run-ai-generation');
                return inputStage && inputStage.style.display !== 'none' &&
                       loadingStage && loadingStage.style.display === 'none' &&
                       runBtn && !runBtn.disabled;
            }, { timeout: 5000 });

            // Verify raw notes preserved
            const preservedNotes = await page.$eval('#ai-raw-notes-input', el => el.value);
            assert.strictEqual(preservedNotes, testNotes, "Raw notes preserved exactly in textarea after failure");

            // Verify button is accessible/clickable again
            const isBtnDisabled = await page.$eval('#btn-run-ai-generation', el => el.disabled);
            assert.strictEqual(isBtnDisabled, false, "Run button is re-enabled and clickable after failure");

            // Verify alert message contained error
            assert(alertMessage.includes("Simulated AI Service Unavailable"), "Alert displayed server error message");

            console.log("PASS: UI Error handling verified — loading spinner hidden, input restored, button re-enabled, raw notes preserved");

            // Remove request interception
            page.off('request', failHandler);
            await page.setRequestInterception(false);

            // Now click generate again with live server (should succeed smoothly with Mock provider)
            await page.click('#btn-run-ai-generation');
            await page.waitForSelector('#ai-stage-review', { visible: true, timeout: 5000 });

            const summaryVal = await page.$eval('#edit-ai-summary', el => el.value);
            assert(summaryVal.length > 0, "Review stage rendered successfully with summary");
            console.log("PASS: Subsequent generation succeeded smoothly and entered Human-in-the-Loop Review stage");

            await page.click('#btn-close-ai-modal');
        } finally {
            await browser.close();
        }

        console.log("\n=== Phase 8B Provider Routing & Fail-Closed Suite 100% Passed ===");
    } finally {
        if (originalEnv !== undefined) process.env.NODE_ENV = originalEnv;
        else delete process.env.NODE_ENV;

        if (originalGeminiKey !== undefined) process.env.GEMINI_API_KEY = originalGeminiKey;
        else delete process.env.GEMINI_API_KEY;

        if (originalMockTransport !== undefined) process.env.AI_MOCK_TRANSPORT = originalMockTransport;
        else delete process.env.AI_MOCK_TRANSPORT;

        await pool.end();
    }
}

run().catch(err => {
    console.error("FAIL:", err);
    process.exit(1);
});
