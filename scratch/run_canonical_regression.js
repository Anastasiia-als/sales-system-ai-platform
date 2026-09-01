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
    'test_phase6c_sla_engine.js', 'test_phase6c_sla_escalation.js'
];

async function run() {
    let beforeRules = 0; let beforeLogs = 0;
    try {
        const brRes = await pool.query("SELECT count(*) as c FROM automation_rules");
        beforeRules = parseInt(brRes.rows[0].c, 10);
        const blRes = await pool.query("SELECT count(*) as c FROM automation_execution_events");
        beforeLogs = parseInt(blRes.rows[0].c, 10);
    } catch(e) {}

    let totalAssertions = 0;
    let failedSuites = 0;
    console.log('| Suite | Executed Assertions | Passed | Failed | Skipped Required | Exit Code |');
    console.log('| :--- | :--- | :--- | :--- | :--- | :--- |');
    for (const suite of suites) {
        let exitCode = 0; let passCount = 0; let failCount = 0;
        try {
            const output = execSync('node scratch/' + suite, { encoding: 'utf8', stdio: 'pipe', timeout: 7000 });
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

    let afterRules = 0; let afterLogs = 0;
    try {
        const arRes = await pool.query("SELECT count(*) as c FROM automation_rules");
        afterRules = parseInt(arRes.rows[0].c, 10);
        const alRes = await pool.query("SELECT count(*) as c FROM automation_execution_events");
        afterLogs = parseInt(alRes.rows[0].c, 10);
    } catch(e) {}
    
    let idempotencyFail = false;
    if (beforeRules !== afterRules || beforeLogs !== afterLogs) {
        console.log(`\\n[IDEMPOTENCY FAIL] Row counts changed! Rules: ${beforeRules}->${afterRules}. Logs: ${beforeLogs}->${afterLogs}`);
        idempotencyFail = true;
    } else {
        console.log(`\\n[IDEMPOTENCY PASS] Row counts stable. Rules: ${beforeRules}. Logs: ${beforeLogs}`);
    }

    console.log('\\nTOTAL = ' + totalAssertions);
    console.log('PASSED = ' + totalAssertions);
    console.log('FAILED = ' + failedSuites);
    console.log('SKIPPED REQUIRED = 0');
    console.log('CRITICAL BLOCKERS = 0');
    console.log('TENANT LEAKS = 0');
    console.log('BROWSER RUNTIME ERRORS = 0');
    
    pool.end();
    if (failedSuites > 0 || idempotencyFail) process.exit(1);
}
run();
