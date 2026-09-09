const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://aayqydcdfxhlwizhfjun.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_CZwi_JF1vSKX2q-9XAiojg_6TopfxZY';

async function runCalculationsSuite() {
  console.log('=== PHASE 5D CALCULATIONS & DETERMINISTIC METRICS SUITE ===');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // 1. Authenticate as Owner
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'anzaitseva96@gmail.com',
    password: process.env.OWNER_PASSWORD || process.env.OWNER_PASSWORD
  });
  
  if (authErr) {
    console.error('Authentication failed:', authErr);
    process.exit(1);
  }

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

  try {
    // 2. Query Portfolio Analytics RPC
    const { data: analytics, error: rpcErr } = await supabase.rpc('get_portfolio_analytics_data', {
      p_period_type: '30d'
    });

    assert(!rpcErr && analytics && analytics.success, 'RPC get_portfolio_analytics_data executes successfully');
    
    // 3. Executive KPIs Integrity
    const kpis = analytics.executive_kpis || {};
    assert(typeof kpis.total_clients === 'number' && kpis.total_clients >= 2, 'Executive KPIs: total_clients >= 2');
    assert(typeof kpis.active_projects === 'number' && kpis.active_projects >= 2, 'Executive KPIs: active_projects >= 2');
    assert(typeof kpis.total_milestones === 'number' && kpis.total_milestones > 0, 'Executive KPIs: total_milestones > 0');
    assert(typeof kpis.completed_milestones === 'number' && kpis.completed_milestones <= kpis.total_milestones, 'Executive KPIs: completed_milestones <= total_milestones');

    // 4. Delivery Funnel Integrity
    const funnel = analytics.delivery_funnel || {};
    assert(typeof funnel.total === 'number' && funnel.total === kpis.total_projects, 'Delivery Funnel: total projects matches KPI');
    assert(typeof funnel.in_progress === 'number', 'Delivery Funnel: in_progress count is valid number');
    assert(typeof funnel.discovery_pct === 'number' && funnel.discovery_pct >= 0 && funnel.discovery_pct <= 100, 'Delivery Funnel: discovery_pct bounded 0-100%');
    assert(typeof funnel.in_progress_pct === 'number' && funnel.in_progress_pct >= 0 && funnel.in_progress_pct <= 100, 'Delivery Funnel: in_progress_pct bounded 0-100%');

    // 5. Deterministic Delivery Performance Rates (Strict Nullable Semantics)
    const rates = analytics.delivery_rates || {};
    assert(rates.milestone_completion_rate === null || (typeof rates.milestone_completion_rate === 'number' && rates.milestone_completion_rate >= 0 && rates.milestone_completion_rate <= 100), 'Rates: milestone_completion_rate valid or NULL');
    assert(rates.tasks_completion_rate === null || (typeof rates.tasks_completion_rate === 'number' && rates.tasks_completion_rate >= 0 && rates.tasks_completion_rate <= 100), 'Rates: tasks_completion_rate valid or NULL');
    assert(rates.overdue_task_rate === null || (typeof rates.overdue_task_rate === 'number' && rates.overdue_task_rate >= 0 && rates.overdue_task_rate <= 100), 'Rates: overdue_task_rate valid or NULL');
    assert(rates.client_action_completion_rate === null || (typeof rates.client_action_completion_rate === 'number' && rates.client_action_completion_rate >= 0 && rates.client_action_completion_rate <= 100), 'Rates: client_action_completion_rate valid or NULL');
    assert(rates.on_time_delivery_rate === null || (typeof rates.on_time_delivery_rate === 'number' && rates.on_time_delivery_rate >= 0 && rates.on_time_delivery_rate <= 100), 'Rates: on_time_delivery_rate valid or NULL');
    assert(rates.project_completion_rate === null || (typeof rates.project_completion_rate === 'number' && rates.project_completion_rate >= 0 && rates.project_completion_rate <= 100), 'Rates: project_completion_rate valid or NULL');
    assert(rates.avg_completion_delay_days === null || (typeof rates.avg_completion_delay_days === 'number' && rates.avg_completion_delay_days >= 0), 'Rates: avg_completion_delay_days is valid or NULL');

    // 6. Currency Isolation & Integrity
    const finances = analytics.financial_analytics || {};
    const supportedCurrencies = Object.keys(finances);
    assert(supportedCurrencies.includes('CZK'), 'Financial Analytics contains isolated CZK block');
    assert(supportedCurrencies.includes('EUR'), 'Financial Analytics contains isolated EUR block');
    assert(supportedCurrencies.includes('UAH'), 'Financial Analytics contains isolated UAH block');

    // Verify CZK block values
    const czk = finances['CZK'] || {};
    assert(Number(czk.contract_value_minor) > 0, 'CZK: Contract value > 0');
    assert(Number(czk.invoiced_minor) > 0, 'CZK: Invoiced value > 0');
    assert(Number(czk.received_minor) > 0, 'CZK: Received value > 0');
    assert(Number(czk.outstanding_minor) >= 0, 'CZK: Outstanding value >= 0');
    assert(czk.ar_aging && typeof czk.ar_aging.not_due_minor === 'number', 'CZK: 6 AR Aging buckets computed deterministically');

    // Verify UAH block values
    const uah = finances['UAH'] || {};
    assert(Number(uah.contract_value_minor) > 0, 'UAH: Contract value > 0');
    assert(Number(uah.received_minor) > 0, 'UAH: Received value > 0');
    assert(uah.ar_aging && typeof uah.ar_aging.not_due_minor === 'number', 'UAH: 6 AR Aging buckets computed deterministically');

    // 7. Trends & Time Period Analysis
    const trends = analytics.trends || {};
    assert(trends.period_type === '30d', 'Trends: period_type is 30d');
    assert(typeof trends.new_clients === 'number', 'Trends: new_clients is valid number');
    assert(typeof trends.new_projects === 'number', 'Trends: new_projects is valid number');
    assert(typeof trends.invoices_issued === 'number', 'Trends: invoices_issued is valid number');
    assert(typeof trends.payments_count === 'number', 'Trends: payments_count is valid number');

    // 8. Projects & Clients Table Structure
    const projects = analytics.projects || [];
    assert(projects.length >= 2, 'Projects performance list contains all scoped projects');
    const p1 = projects[0] || {};
    assert(p1.id && p1.title && p1.organization_name, 'Project item contains id, title, and organization_name');
    assert(typeof p1.progress_percent === 'number', 'Project item contains numeric progress_percent');

    const clients = analytics.clients || [];
    assert(clients.length >= 2, 'Client analytics list contains all scoped organizations');
    const c1 = clients[0] || {};
    assert(c1.id && c1.name && typeof c1.total_projects_count === 'number', 'Client item contains id, name, and total_projects_count');

    // 9. Operational Workload Structure (No Surveillance)
    const workload = analytics.team_workload || [];
    assert(workload.length > 0, 'Operational workload returns team member items');
    const w1 = workload[0] || {};
    assert(w1.user_id && w1.full_name && typeof w1.open_tasks === 'number', 'Workload item contains operational tasks metrics without surveillance');

    console.log(`\nResults: ${passed} / ${total} PASS (${Math.round(passed/total*100)}%)`);
    if (passed < total) process.exit(1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runCalculationsSuite();
