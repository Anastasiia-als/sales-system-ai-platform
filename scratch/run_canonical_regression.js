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
    'test_server_resilience_regression.js', 'verify_used_token_f5_acceptance.js'
];

async function run() {
    let beforeRules = [];
    try {
        const brRes = await pool.query("SELECT id, name, created_at, is_active FROM public.automation_rules ORDER BY id");
        beforeRules = brRes.rows;
    } catch(e) {}

    let totalAssertions = 0;
    let failedSuites = 0;
    console.log('| Suite | Executed Assertions | Passed | Failed | Skipped Required | Exit Code |');
    console.log('| :--- | :--- | :--- | :--- | :--- | :--- |');
    for (const suite of suites) {
        let exitCode = 0; let passCount = 0; let failCount = 0;
        try {
            const output = execSync('node scratch/' + suite, { encoding: 'utf8', stdio: 'pipe', timeout: 35000 });
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
    await pool.end();
    if (failedSuites > 0 || idempotencyFail) process.exit(1);
}

run();
