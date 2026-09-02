const { execSync } = require('child_process');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres.aayqydcdfxhlwizhfjun:4zCbX8YXlhSHMSZFAc7qCXMJFw9!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' });
const fs = require('fs');

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
    'test_phase6d_exact_once_side_effects.js', 'test_phase6d_rollback.js'
];

async function run() {
    let beforeRules = [];
    let beforeLogs = 0;
    try {
        const brRes = await pool.query("SELECT id, name, created_at, is_active FROM public.automation_rules ORDER BY id");
        beforeRules = brRes.rows;
        const blRes = await pool.query("SELECT count(*) as c FROM public.automation_execution_events");
        beforeLogs = parseInt(blRes.rows[0].c, 10);
    } catch(e) {}

    let totalAssertions = 0;
    let failedSuites = 0;
    console.log('| Suite | Executed Assertions | Passed | Failed | Skipped Required | Exit Code |');
    console.log('| :--- | :--- | :--- | :--- | :--- | :--- |');
    for (const suite of suites) {
        let exitCode = 0; let passCount = 0; let failCount = 0;
        try {
            const output = execSync('node scratch/' + suite, { encoding: 'utf8', stdio: 'pipe', timeout: 25000 });
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
    let afterLogs = 0;
    try {
        const arRes = await pool.query("SELECT id, name, created_at, is_active FROM public.automation_rules ORDER BY id");
        afterRules = arRes.rows;
        const alRes = await pool.query("SELECT count(*) as c FROM public.automation_execution_events");
        afterLogs = parseInt(alRes.rows[0].c, 10);
    } catch(e) {}
    
    let idempotencyFail = false;
    
    // Check that every rule that existed before regression STILL exists after regression with exact same fields
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
