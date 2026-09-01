const fs = require('fs');

let c1 = fs.readFileSync('scratch/test_phase6c_concurrency.js', 'utf8');
c1 = c1.replace(/'Rule'/g, "'TestRule'");
fs.writeFileSync('scratch/test_phase6c_concurrency.js', c1, 'utf8');

let c2 = fs.readFileSync('scratch/test_phase6c_client_action.js', 'utf8');
c2 = c2.replace(/'RuleCA'/g, "'TestRuleCA'");
fs.writeFileSync('scratch/test_phase6c_client_action.js', c2, 'utf8');
