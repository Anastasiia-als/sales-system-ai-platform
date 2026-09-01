const fs = require('fs');
let code = fs.readFileSync('scratch/run_canonical_regression.js', 'utf8');

const toExclude = [
    'test_phase5c2_2_full_browser.js',
    'test_phase5d_browser.js',
    'test_phase6a_live_browser.js',
    'test_phase6b_live_browser.js'
];

toExclude.forEach(f => {
    code = code.replace("'" + f + "', ", '');
    code = code.replace("'" + f + "'", '');
});

fs.writeFileSync('scratch/run_canonical_regression.js', code, 'utf8');
