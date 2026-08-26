const { execSync } = require('child_process');

const testSuites = [
  { name: 'Phase 4A Security', cmd: 'node test_phase4a_security.js' },
  { name: 'Phase 4B Security', cmd: 'node test_phase4b_security.js' },
  { name: 'Phase 4B.3 Security', cmd: 'node test_phase4b3_security.js' },
  { name: 'Phase 5A Security', cmd: 'node test_phase5a_security.js' },
  { name: 'Phase 5B Notifications', cmd: 'node test_phase5b_security.js' },
  { name: 'Phase 5B.1 Mutation Hardening', cmd: 'node test_phase5b1_security.js' },
  { name: 'Phase 5C.1 Security', cmd: 'node test_phase5c1_security.js' },
  { name: 'Phase 5C.1 Calculations', cmd: 'node test_phase5c1_calculations.js' },
  { name: 'Phase 5C.1.1 UAH & Multi-Currency', cmd: 'node test_phase5c1_1_suite.js' },
  { name: 'Phase 5C.2 Base Invoicing', cmd: 'node scratch/test_phase5c2_suite.js' },
  { name: 'Phase 5C.2.1 RLS Matrix', cmd: 'node scratch/test_phase5c2_1_rls_matrix.js' },
  { name: 'Phase 5C.2.1 Final Acceptance', cmd: 'node scratch/test_phase5c2_1_final_acceptance.js' },
  { name: 'Phase 5C.2.2 Browser Routes (9/9)', cmd: 'node scratch/test_phase5c2_2_full_browser.js' },
  { name: 'Phase 5D Calculations', cmd: 'node scratch/test_phase5d_calculations.js' },
  { name: 'Phase 5D Security & RLS', cmd: 'node scratch/test_phase5d_security.js' },
  { name: 'Phase 5D Browser Acceptance', cmd: 'node scratch/test_phase5d_browser.js' },
  { name: 'Phase 5D.1 Acceptance & Export', cmd: 'node scratch/test_phase5d1_acceptance.js' }
];

console.log('=== RUNNING FULL MASTER REGRESSION (PHASE 4A - 5D) ===\n');

let passedCount = 0;
let totalCount = testSuites.length;
const results = [];

for (const suite of testSuites) {
  process.stdout.write(`Running ${suite.name}... `);
  try {
    const output = execSync(suite.cmd, { stdio: 'pipe' }).toString();
    console.log('✔ PASS');
    results.push({ name: suite.name, status: 'PASS' });
    passedCount++;
  } catch (err) {
    console.log('✖ FAIL');
    console.error(err.stdout ? err.stdout.toString() : err.message);
    results.push({ name: suite.name, status: 'FAIL' });
  }
}

console.log('\n=================================================');
console.log(`FULL REGRESSION SUMMARY: ${passedCount} / ${totalCount} SUITES PASSED (${Math.round(passedCount/totalCount*100)}%)`);
console.log('=================================================');

if (passedCount < totalCount) process.exit(1);
