const { execSync } = require('child_process');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });

const suites = [
    'test_eval_dashboard.js', 'test_owner_dashboard_data.js', 'test_phase5c2_1_final_acceptance.js',
    'test_phase5c2_1_rls_matrix.js', 'test_phase5c2_suite.js',
    'test_phase5d1_acceptance.js', 'test_phase5d2_semantics_and_xlsx_dates.js', 'test_phase5d31_evidence.js',
    'test_phase5d32_evidence.js', 'test_phase5d3_consistency.js',
    'test_phase5d_calculations.js', 'test_phase5d_security.js', 'test_phase6a_comprehensive.js',
    'test_phase6a_idempotency.js', 'test_phase6a_materialization.js',
    'test_phase6b_cloning.js', 'test_phase6c_client_action.js',
    'test_phase6c_concurrency.js', 'test_phase6c_dependencies.js', 'test_phase6c_exit_conditions.js',
    'test_phase6c_health_engine.js', 'test_phase6c_rule_engine.js', 'test_phase6c_rule_loop.js',
    'test_phase6c_sla_engine.js', 'test_phase6c_sla_escalation.js',
    'test_phase6c_data_preservation_guard.js',
    'test_phase6d_tokens.js', 'test_phase6d_leakage_evidence.js', 'test_phase6d_lifecycle.js',
    'test_phase6d_concurrency.js', 'test_phase6d_cross_channel.js',
    'test_phase6d_data_minimization.js', 'test_phase6d_tenant_invariant.js',
    'test_phase6d_rls_tokens.js', 'test_phase6d_client_isolation.js',
    'test_phase6d_exact_once_side_effects.js', 'test_phase6d_rollback.js',
    'test_phase6d2_ui_states.js', 'test_phase6d2_submission.js',
    'test_phase6d2_validation.js', 'test_phase6d2_e2e_browser.js',
    'test_phase6d2_rate_limit_and_abuse.js',
    'test_phase6d3_rbac_matrix.js', 'test_phase6d3_token_lifecycle.js',
    'test_phase6d3_cross_channel.js', 'test_phase6d3_reopen_audit.js',
    'test_phase6d3_security_review.js', 'test_phase6d3_e2e_browser.js',
    'test_server_resilience_regression.js', 'verify_used_token_f5_acceptance.js',
    'test_phase6d4_isolation_and_rbac.js', 'test_phase6d4_token_revocation_and_storage.js',
    'test_phase6d4_notification_cardinality.js', 'test_phase6d4_e2e_browser.js',
    'test_phase6d4_reopened_action_modal_e2e.js', 'test_phase6d4_multi_iteration_isolated.js',
    'test_phase6d5_concurrency_linearization.js', 'test_phase6d5_storage_security_audit.js',
    'test_phase6d5_golden_path_e2e.js', 'test_phase6d5_fixture_isolation_audit.js',
    'test_phase7a_security_and_emission.js', 'test_phase7a_outbox_routing.js',
    'test_phase7a_lifecycle_and_integrity.js', 'test_phase7a_vault_and_leakage.js',
    'test_phase7a_ssrf_and_network.js', 'test_phase7a_hmac_and_replay.js',
    'test_phase7a_payload_minimization.js', 'test_phase7a_e2e_delivery.js',
    'test_phase7a_browser_integrations_e2e.js', 'test_phase7a_task_edit_e2e.js',
    'test_phase7a_real_delivery_e2e.js',
    'test_phase7b_allowlist_and_events.js', 'test_phase7b_duplicate_destination.js',
    'test_phase7b_vault_and_leakage.js', 'test_phase7b_rbac_matrix.js',
    'test_phase7b_lifecycle_and_integrity.js', 'test_phase7b_connection_validation.js',
    'test_phase7b_markdown_parser.js', 'test_phase7b_rate_limit_and_backoff.js',
    'test_phase7b_chat_identity.js', 'test_phase7b_real_delivery_e2e.js',
    'test_phase7b_auth_task_completed_fanout.js'
];

async function run() {
    // 0. Enable Telegram Mock Mode to eliminate external Telegram side effects during automated test execution
    try {
        await fetch('http://localhost:8002/api/dispatcher/mock-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: true })
        });
        console.log('[REGRESSION RUNNER] Enabled Telegram mock transport mode on server.');
    } catch (err) {
        console.warn('[REGRESSION RUNNER] Warning: Could not reach server mock mode endpoint:', err.message);
    }
    process.env.TELEGRAM_MOCK_TRANSPORT = 'true';

    let beforeRules = [];
    try {
        const brRes = await pool.query("SELECT id, name, created_at, is_active FROM public.automation_rules ORDER BY id");
        beforeRules = brRes.rows;
    } catch(e) {}

    let totalAssertions = 0;
    let failedSuites = 0;
    console.log('| Suite | Executed Assertions | Passed | Failed | Skipped Required | Exit Code |');
    console.log('| :--- | :--- | :--- | :--- | :--- | :--- |');

    try {
        for (const suite of suites) {
            let exitCode = 0; let passCount = 0; let failCount = 0;
            try {
                const output = execSync('node scratch/' + suite, {
                    encoding: 'utf8',
                    stdio: 'pipe',
                    timeout: 60000,
                    env: { ...process.env, TELEGRAM_MOCK_TRANSPORT: 'true' }
                });
                const matches = output.match(/PASS/g);
                passCount = matches ? matches.length : 1;
                totalAssertions += passCount;
                console.log('| ' + suite + ' | ' + passCount + ' | ' + passCount + ' | 0 | 0 | 0 |');
            } catch (e) {
                exitCode = e.status || 1;
                failedSuites++;
                const output = (e.stdout || '') + (e.stderr || '');
                const pMatches = output.match(/PASS/g); passCount = pMatches ? pMatches.length : 0;
                const fMatches = output.match(/FAIL/g); failCount = fMatches ? fMatches.length : 1;
                totalAssertions += passCount;
                console.log('| ' + suite + ' | ' + (passCount + failCount) + ' | ' + passCount + ' | ' + failCount + ' | 0 | ' + exitCode + ' |');
            }
        }

        let afterRules = [];
        try {
            const arRes = await pool.query("SELECT id, name, created_at, is_active FROM public.automation_rules ORDER BY id");
            afterRules = arRes.rows;
        } catch(e) {}
        
        let idempotencyFail = false;
        const beforeIds = new Set(beforeRules.map(r => r.id));
        const afterIds = new Set(afterRules.map(r => r.id));
        
        const missingRules = beforeRules.filter(r => !afterIds.has(r.id));
        const leakedRules = afterRules.filter(r => !beforeIds.has(r.id));
        
        if (missingRules.length > 0) {
            console.log(`\n[DATA LOSS DETECTED] Pre-existing rules deleted by tests! Missing:`, missingRules);
            idempotencyFail = true;
        } else if (leakedRules.length > 0) {
            console.log(`\n[FIXTURE LEAK DETECTED] New rules left in DB after test run! Leaked:`, leakedRules);
            idempotencyFail = true;
        } else {
            console.log(`\n[DATA PRESERVATION PASS] Total pre-existing rules preserved: ${beforeRules.length} (0 missing, 0 leaked fixtures).`);
        }

        console.log(`\nTotal Assertions: ${totalAssertions}, Failed Suites: ${failedSuites}`);
        if (failedSuites > 0 || idempotencyFail) process.exit(1);
    } finally {
        // Disable Telegram mock transport mode on server
        try {
            await fetch('http://localhost:8002/api/dispatcher/mock-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: false })
            });
            console.log('[REGRESSION RUNNER] Restored live Telegram delivery on server.');
        } catch (_) {}
        delete process.env.TELEGRAM_MOCK_TRANSPORT;

        // Reset Demo Client Corp task state to 'todo' so manual acceptance test is ready
        try {
            await pool.query("UPDATE public.tasks SET status = 'todo', completed_at = NULL WHERE organization_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' AND title = 'Draft Recommendations'");
            await pool.query("UPDATE public.telegram_destinations SET is_active = true WHERE organization_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'");
            console.log('[REGRESSION RUNNER] Reset Demo Client Corp Draft Recommendations task to status: todo.');
        } catch (resetErr) {
            console.warn('[REGRESSION RUNNER] Warning: Failed to reset task:', resetErr.message);
        }

        await pool.end();
    }
}

run();
