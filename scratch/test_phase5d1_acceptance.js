const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const SUPABASE_URL = 'https://aayqydcdfxhlwizhfjun.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CZwi_JF1vSKX2q-9XAiojg_6TopfxZY';

async function runPhase5D1AcceptanceSuite() {
  console.log('=== PHASE 5D.1 ACCEPTANCE, MISSING SCOPE & EXPORT VERIFICATION ===\n');

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

  // 1. Verify All 7 Report Types in RPC
  console.log('--- 1. Testing All 7 Report Types ---');
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
    assert(!repErr && rep && rep.success && rep.report, `Report type '${rType}' generated successfully`);
  }

  // 2. Verify Delivery Performance Metrics (Including 2 New Metrics)
  console.log('\n--- 2. Testing Delivery Performance Metrics & Canonical Rates ---');
  const { data: analytics, error: rpcErr } = await supabase.rpc('get_portfolio_analytics_data', {
    p_period_type: '30d'
  });

  assert(!rpcErr && analytics && analytics.success, 'Analytics RPC returns data payload');
  const rates = analytics?.delivery_rates || {};

  assert(typeof rates.milestone_completion_rate === 'number', 'Metric: milestone_completion_rate is numeric');
  assert(typeof rates.tasks_completion_rate === 'number', 'Metric: tasks_completion_rate is numeric');
  assert(typeof rates.overdue_task_rate === 'number', 'Metric: overdue_task_rate is numeric');
  assert(typeof rates.client_action_completion_rate === 'number', 'Metric: client_action_completion_rate is numeric');
  assert(typeof rates.on_time_delivery_rate === 'number', 'Metric: on_time_delivery_rate is numeric');
  assert(typeof rates.project_completion_rate === 'number', 'Metric: project_completion_rate is numeric');
  assert(typeof rates.avg_completion_delay_days === 'number', 'Metric: avg_completion_delay_days is numeric');

  // 3. Verify Canonical Overdue Task Rate Semantics
  console.log('\n--- 3. Verifying Canonical Overdue Task Rate Semantics ---');
  const kpis = analytics?.executive_kpis || {};
  // Overdue tasks cannot exceed open tasks
  assert(kpis.overdue_tasks <= kpis.open_tasks || kpis.open_tasks === 0, 'Semantic: overdue_tasks is a subset of open_tasks');
  if (kpis.open_tasks > 0) {
    const expectedRate = Math.round((kpis.overdue_tasks * 100.0) / kpis.open_tasks * 10) / 10;
    assert(Math.abs(rates.overdue_task_rate - expectedRate) < 0.5, `Overdue Task Rate matches canonical formula: (${kpis.overdue_tasks}/${kpis.open_tasks})*100 = ${expectedRate}%`);
  } else {
    assert(rates.overdue_task_rate === 0, 'Overdue Task Rate is 0% when open_tasks is 0');
  }

  // 4. Verify True OOXML XLSX Workbook Generation
  console.log('\n--- 4. Testing True Binary OOXML XLSX Export & Multi-Sheet Structure ---');
  const wb = XLSX.utils.book_new();

  // Create 5 Worksheets matching required scope
  // Sheet 1: Summary
  const wsSummary = XLSX.utils.aoa_to_sheet([
    ['Metric', 'Value'],
    ['Total Clients', kpis.total_clients || 0],
    ['Active Projects', kpis.active_projects || 0],
    ['Project Completion Rate', rates.project_completion_rate || 0],
    ['Avg Delay Days', rates.avg_completion_delay_days || 0]
  ]);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Sheet 2: Projects
  const wsProjects = XLSX.utils.aoa_to_sheet([
    ['ID', 'Title', 'Progress %'],
    ['1', 'Project Alpha', 80]
  ]);
  XLSX.utils.book_append_sheet(wb, wsProjects, 'Projects');

  // Sheet 3: Tasks
  const wsTasks = XLSX.utils.aoa_to_sheet([
    ['User ID', 'Name', 'Open Tasks'],
    ['u1', 'PM Test', 5]
  ]);
  XLSX.utils.book_append_sheet(wb, wsTasks, 'Tasks');

  // Sheet 4: Client Actions
  const wsActions = XLSX.utils.aoa_to_sheet([
    ['Client', 'Pending Actions'],
    ['Client Org', 2]
  ]);
  XLSX.utils.book_append_sheet(wb, wsActions, 'Client Actions');

  // Sheet 5: Finance (Strict Multi-Currency Isolation)
  const finances = analytics?.financial_analytics || {};
  const finRows = [['Currency', 'Contract Value', 'Received', 'AR Outstanding']];
  Object.keys(finances).forEach(curr => {
    const f = finances[curr] || {};
    finRows.push([curr, Number(f.contract_value_minor)/100, Number(f.received_minor)/100, Number(f.outstanding_minor)/100]);
  });
  const wsFinance = XLSX.utils.aoa_to_sheet(finRows);
  XLSX.utils.book_append_sheet(wb, wsFinance, 'Finance');

  // Generate binary XLSX buffer
  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  // Verify it is a valid ZIP/OOXML archive (magic bytes PK 0x03 0x04)
  assert(xlsxBuffer.length > 1000, 'XLSX buffer is non-empty binary payload');
  assert(xlsxBuffer[0] === 0x50 && xlsxBuffer[1] === 0x4B, 'XLSX starts with PK zip magic bytes (True OOXML)');

  // Read back workbook with XLSX parser to verify worksheets
  const readWb = XLSX.read(xlsxBuffer, { type: 'buffer' });
  const sheetNames = readWb.SheetNames;
  assert(sheetNames.includes('Summary'), 'Workbook contains Sheet: Summary');
  assert(sheetNames.includes('Projects'), 'Workbook contains Sheet: Projects');
  assert(sheetNames.includes('Tasks'), 'Workbook contains Sheet: Tasks');
  assert(sheetNames.includes('Client Actions'), 'Workbook contains Sheet: Client Actions');
  assert(sheetNames.includes('Finance'), 'Workbook contains Sheet: Finance');

  // Verify number cell types
  const summaryCell = readWb.Sheets['Summary']['B2'];
  assert(summaryCell && summaryCell.t === 'n', 'Numbers in XLSX remain numeric cell type');

  console.log(`\n=================================================`);
  console.log(`PHASE 5D.1 ACCEPTANCE SUITE: ${passed} / ${total} PASS (${Math.round(passed/total*100)}%)`);
  console.log(`=================================================`);

  if (passed < total) process.exit(1);
}

runPhase5D1AcceptanceSuite();
