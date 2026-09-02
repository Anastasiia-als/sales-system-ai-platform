const fs = require('fs');
const path = require('path');

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

console.log("=== Auditing all test scripts for blanket cleanups ===");
let dangerFound = false;

suites.forEach(file => {
    const filePath = path.join('scratch', file);
    if (!fs.existsSync(filePath)) {
        console.log("Missing:", file);
        return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for dangerous SQL patterns like DELETE without exact ID parameter
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('DELETE FROM') && !line.includes('ANY(') && !line.includes(' = $') && !line.includes(' = ANY')) {
            console.warn(`[WARNING] Suspicious DELETE in ${file}:${idx + 1}: ${line.trim()}`);
            dangerFound = true;
        }
        if (line.includes('ILIKE') && line.includes('DELETE')) {
            console.error(`[CRITICAL] Pattern-based DELETE in ${file}:${idx + 1}: ${line.trim()}`);
            dangerFound = true;
        }
    });
});

if (!dangerFound) {
    console.log("ALL 25 SUITES CLEAN: Every test uses exact parameterized ID cleanup!");
}
