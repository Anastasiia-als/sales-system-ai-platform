const fs = require('fs');
['test_phase6c_client_action.js', 'test_phase6c_concurrency.js', 'test_phase6c_dependencies.js', 'test_phase6c_exit_conditions.js', 'test_phase6c_health_engine.js', 'test_phase6c_rule_engine.js', 'test_phase6c_rule_loop.js', 'test_phase6c_sla_engine.js', 'test_phase6c_sla_escalation.js'].forEach(f => {
    let c = fs.readFileSync('scratch/' + f, 'utf8');
    if(c.includes("name: 'Rule'") || c.includes("name: 'RuleCA'") || c.includes('name: "Rule"') || c.includes('name: "RuleCA"')) console.log(f);
});
