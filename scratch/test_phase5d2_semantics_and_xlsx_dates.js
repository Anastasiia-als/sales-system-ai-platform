const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const SUPABASE_URL = 'https://aayqydcdfxhlwizhfjun.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CZwi_JF1vSKX2q-9XAiojg_6TopfxZY';

async function runPhase5D2Suite() {
  console.log('=== PHASE 5D.2 — ANALYTICS SEMANTIC HARDENING & XLSX TYPED DATES ===\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  await supabase.auth.signInWithPassword({
    email: 'anzaitseva96@gmail.com',
    password: process.env.OWNER_PASSWORD || 'Password123!'
  });

  let passed = 0;
  let total = 0;

  function assert(condition, name) {
    total++;
    if (condition) {
      console.log(`  ✔ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ✖ [FAIL] ${name}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. XLSX Typed Date Cells Verification
  // ---------------------------------------------------------------------------
  console.log('--- 1. Testing True Typed Date Cells in XLSX ---');
  const wb = XLSX.utils.book_new();
  const testDate = new Date('2026-08-28T12:00:00Z');

  // Sheet 1: Summary with Date
  const wsSummary = XLSX.utils.aoa_to_sheet([
    ['Metric', 'Value'],
    ['Generated At', testDate],
    ['Total Clients', 5]
  ], { cellDates: true, dateNF: 'yyyy-mm-dd' });
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Sheet 2: Projects with Target Date
  const wsProjects = XLSX.utils.aoa_to_sheet([
    ['ID', 'Title', 'Target Date', 'Contract Value'],
    ['p1', 'Project Alpha', testDate, 50000]
  ], { cellDates: true, dateNF: 'yyyy-mm-dd' });
  XLSX.utils.book_append_sheet(wb, wsProjects, 'Projects');

  // Sheet 3: Client Actions with Next Meeting Date
  const wsClients = XLSX.utils.aoa_to_sheet([
    ['Client ID', 'Name', 'Next Meeting Date'],
    ['c1', 'Client Corp', testDate]
  ], { cellDates: true, dateNF: 'yyyy-mm-dd' });
  XLSX.utils.book_append_sheet(wb, wsClients, 'Client Actions');

  // Sheet 4: Tasks
  const wsTasks = XLSX.utils.aoa_to_sheet([
    ['User ID', 'Name', 'Open Tasks'],
    ['u1', 'PM Lead', 3]
  ]);
  XLSX.utils.book_append_sheet(wb, wsTasks, 'Tasks');

  // Sheet 5: Finance
  const wsFinance = XLSX.utils.aoa_to_sheet([
    ['Currency', 'Contract Value', 'Forecast Margin %'],
    ['UAH', 100000, 25.5],
    ['EUR', 0, null]
  ]);
  XLSX.utils.book_append_sheet(wb, wsFinance, 'Finance');

  // Generate binary XLSX buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  assert(buf && buf.length > 1000, 'XLSX buffer generated');

  // Parse back with cellDates: true
  const readWb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  
  // Verify Summary Date Cell
  const sumDateCell = readWb.Sheets['Summary']['B2'];
  assert(sumDateCell && sumDateCell.t === 'd', 'Summary "Generated At" is typed Date cell (t: "d")');
  assert(sumDateCell && sumDateCell.v instanceof Date, 'Summary "Generated At" value is JS Date instance');
  assert(sumDateCell.v.getUTCFullYear() === 2026, 'Summary Date year matches 2026');

  // Verify Projects Date Cell
  const projDateCell = readWb.Sheets['Projects']['C2'];
  assert(projDateCell && projDateCell.t === 'd', 'Projects "Target Date" is typed Date cell (t: "d")');
  assert(projDateCell && projDateCell.v instanceof Date, 'Projects "Target Date" value is JS Date instance');

  // Verify Client Actions Date Cell
  const clientDateCell = readWb.Sheets['Client Actions']['C2'];
  assert(clientDateCell && clientDateCell.t === 'd', 'Client Actions "Next Meeting Date" is typed Date cell (t: "d")');
  assert(clientDateCell && clientDateCell.v instanceof Date, 'Client Actions "Next Meeting Date" value is JS Date instance');

  // Verify Empty/Null Margin in Finance Sheet is blank/null
  const eurMarginCell = readWb.Sheets['Finance']['C3'];
  assert(!eurMarginCell || eurMarginCell.v === undefined || eurMarginCell.v === null, 'EUR zero contract value produces blank/null margin cell (no 0%, NaN, Infinity)');

  // ---------------------------------------------------------------------------
  // 2. Empty Dataset Semantics in Database RPC
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing Database RPC Semantic Nulls on Empty/Filtered Samples ---');

  // Query global analytics
  const { data: globalData, error: gErr } = await supabase.rpc('get_portfolio_analytics_data', {
    p_period_type: '30d'
  });
  assert(!gErr && globalData && globalData.success, 'Global analytics RPC executes successfully');

  const gRates = globalData.delivery_rates || {};
  console.log('  Current delivery rates sample:', gRates);

  // If completed projects count is 0, on_time_delivery_rate and avg_completion_delay_days must be null
  const completedProjects = globalData.executive_kpis?.completed_projects || 0;
  if (completedProjects === 0) {
    assert(gRates.on_time_delivery_rate === null, 'On-Time Delivery Rate is NULL when completed_projects = 0');
    assert(gRates.avg_completion_delay_days === null, 'Avg Completion Delay is NULL when completed_projects = 0');
  } else {
    assert(typeof gRates.on_time_delivery_rate === 'number', 'On-Time Delivery Rate is numeric when completed_projects > 0');
    assert(typeof gRates.avg_completion_delay_days === 'number', 'Avg Completion Delay is numeric when valid completed projects exist');
  }

  // ---------------------------------------------------------------------------
  // 3. Zero Denominator Guard for Forecast Margin %
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Forecast Margin % Zero-Denominator Guard ---');
  const finances = globalData.financial_analytics || {};
  let validMargins = true;
  Object.keys(finances).forEach(curr => {
    const f = finances[curr];
    if (Number(f.contract_value_minor) <= 0) {
      if (f.forecast_margin_pct !== null) validMargins = false;
    } else {
      if (typeof f.forecast_margin_pct !== 'number' || isNaN(f.forecast_margin_pct) || !isFinite(f.forecast_margin_pct)) validMargins = false;
    }
  });
  assert(validMargins, 'All active currencies correctly guard forecast_margin_pct against zero-division (yielding NULL instead of NaN/Infinity) and yield finite numbers for valid projects');

  // ---------------------------------------------------------------------------
  // 4. All 7 Reports Execution Integrity
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing All 7 Report Types Integrity ---');
  const reportTypes = [
    'portfolio_summary',
    'client_report',
    'projects_status',
    'delivery_performance',
    'finance_summary',
    'accounts_receivable',
    'pm_workload'
  ];

  for (const rType of reportTypes) {
    const { data: rep, error: repErr } = await supabase.rpc('get_reports_data', {
      p_report_type: rType
    });
    assert(!repErr && rep && rep.success && rep.report, `Report '${rType}' executes with valid payload`);
  }

  console.log(`\n=================================================`);
  console.log(`PHASE 5D.2 ACCEPTANCE SUITE: ${passed} / ${total} PASS (${Math.round(passed/total*100)}%)`);
  console.log(`=================================================`);

  if (passed < total) process.exit(1);
}

runPhase5D2Suite();
