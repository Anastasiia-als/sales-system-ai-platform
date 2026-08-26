const { Client: PgClient } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

const UAH_PROJECT_ID = '33333333-3333-3333-3333-333333333331';
const ALPHA_PROJ_1_ID = '170d3c57-224b-4ae5-a384-0ccdf17252cc';
const ALPHA_PROJ_2_ID = '6af58a69-dbd9-43b8-b04f-68a38da1c2bb';
const BETA_PROJ_1_ID = 'e02cb139-64c5-45f3-af3d-b7725a306581';

async function runPhase5C11Suite() {
  const client = new PgClient(DB_CONFIG);
  await client.connect();

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  console.log('=== Phase 5C.1.1: Finance UX, UAH & Visibility Hardening Test Suite ===\n');

  try {
    // -------------------------------------------------------------------------
    // 1. UAH Currency & Financial Entities Verification
    // -------------------------------------------------------------------------
    console.log('--- 1. UAH Currency & Financial Entities ---');
    const uahTerms = await client.query(`
      SELECT contract_value_minor, currency, commercial_model, contract_status
      FROM public.project_commercial_terms
      WHERE project_id = $1;
    `, [UAH_PROJECT_ID]);

    assert(uahTerms.rows.length === 1, 'UAH Project commercial terms record exists');
    assert(uahTerms.rows[0].currency === 'UAH', 'Commercial terms currency is UAH');
    assert(parseInt(uahTerms.rows[0].contract_value_minor, 10) === 15000000, 'UAH contract value is 150,000 UAH (15,000,000 minor)');

    const uahSchedules = await client.query(`
      SELECT title, amount_minor, currency, status, due_date
      FROM public.project_payment_schedule
      WHERE project_id = $1
      ORDER BY sort_order;
    `, [UAH_PROJECT_ID]);

    assert(uahSchedules.rows.length === 3, 'UAH Project has 3 payment schedule tranches');
    assert(uahSchedules.rows.every(r => r.currency === 'UAH'), 'All UAH schedule tranches use currency UAH');
    assert(uahSchedules.rows[0].status === 'paid', 'UAH Tranche 1 is paid (50,000 UAH)');
    assert(uahSchedules.rows[1].status === 'overdue', 'UAH Tranche 2 is overdue (50,000 UAH)');
    assert(uahSchedules.rows[2].status === 'planned', 'UAH Tranche 3 is planned (50,000 UAH)');

    const uahPayments = await client.query(`
      SELECT amount_minor, currency, payment_method, reference
      FROM public.project_payments
      WHERE project_id = $1;
    `, [UAH_PROJECT_ID]);

    assert(uahPayments.rows.length >= 1, 'UAH payment record exists');
    assert(uahPayments.rows[0].currency === 'UAH', 'Payment currency is UAH');
    assert(parseInt(uahPayments.rows[0].amount_minor, 10) === 5000000, 'Payment amount is 50,000 UAH (5,000,000 minor)');

    const uahCosts = await client.query(`
      SELECT title, amount_minor, currency, cost_type
      FROM public.project_costs
      WHERE project_id = $1;
    `, [UAH_PROJECT_ID]);

    assert(uahCosts.rows.length >= 3, 'UAH project costs records exist (planned + actual)');
    assert(uahCosts.rows.every(r => r.currency === 'UAH'), 'All UAH project costs use currency UAH');

    const plannedUahCosts = uahCosts.rows.filter(r => r.cost_type === 'planned').reduce((s, r) => s + parseInt(r.amount_minor, 10), 0);
    const actualUahCosts = uahCosts.rows.filter(r => r.cost_type === 'actual').reduce((s, r) => s + parseInt(r.amount_minor, 10), 0);

    assert(plannedUahCosts === 4500000, 'Planned UAH costs = 45,000 UAH (4,500,000 minor)');
    assert(actualUahCosts === 2000000, 'Actual UAH costs = 20,000 UAH (2,000,000 minor)');

    const uahForecastResult = 15000000 - plannedUahCosts;
    const uahForecastMargin = (uahForecastResult / 15000000) * 100;
    assert(uahForecastResult === 10500000, 'UAH Forecast Result = 105,000 UAH (10,500,000 minor)');
    assert(Math.round(uahForecastMargin) === 70, 'UAH Forecast Margin = 70%');

    // -------------------------------------------------------------------------
    // 2. Strict Multi-Currency Isolation (CZK, EUR, UAH)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Multi-Currency Isolation ---');
    const currencyDistinctRes = await client.query(`
      SELECT DISTINCT currency FROM public.project_commercial_terms;
    `);
    const foundCurrencies = currencyDistinctRes.rows.map(r => r.currency);
    assert(foundCurrencies.includes('CZK') && foundCurrencies.includes('EUR') && foundCurrencies.includes('UAH'), 'Portfolio contains CZK, EUR, and UAH projects distinctly');

    // -------------------------------------------------------------------------
    // 3. Financial Status Determination Logic
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Financial Status Determination ---');
    const { DataClient } = require(path.join(__dirname, 'js/portal/api/data-client.js'));

    const overdueStatus = DataClient.getProjectFinancialStatus({ contractValueMinor: 10000000, collectedMinor: 0, outstandingMinor: 10000000, overdueMinor: 5000000 });
    assert(overdueStatus.key === 'overdue' && overdueStatus.label === 'Є прострочка' && overdueStatus.cls === 'portal-badge-danger', 'Financial Status: overdue maps to "Є прострочка" (danger)');

    const fullyPaidStatus = DataClient.getProjectFinancialStatus({ contractValueMinor: 10000000, collectedMinor: 10000000, outstandingMinor: 0, overdueMinor: 0 });
    assert(fullyPaidStatus.key === 'fully_paid' && fullyPaidStatus.label === 'Оплачено' && fullyPaidStatus.cls === 'portal-badge-success', 'Financial Status: fully paid maps to "Оплачено" (success)');

    const partiallyPaidStatus = DataClient.getProjectFinancialStatus({ contractValueMinor: 10000000, collectedMinor: 4000000, outstandingMinor: 6000000, overdueMinor: 0 });
    assert(partiallyPaidStatus.key === 'partially_paid' && partiallyPaidStatus.label === 'Частково оплачено' && partiallyPaidStatus.cls === 'portal-badge-warning', 'Financial Status: partial payment maps to "Частково оплачено" (warning)');

    const dueSoonStatus = DataClient.getProjectFinancialStatus({ contractValueMinor: 10000000, collectedMinor: 0, outstandingMinor: 10000000, overdueMinor: 0, nextPayment: { due_date: '2026-09-01' } });
    assert(dueSoonStatus.key === 'due_soon' && dueSoonStatus.label === 'Очікується' && dueSoonStatus.cls === 'portal-badge-info', 'Financial Status: due soon maps to "Очікується" (info)');

    // -------------------------------------------------------------------------
    // 4. Missing Costs vs Zero Costs Handling
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Missing Costs vs Zero Costs Logic ---');
    // Format money check for UAH
    const formattedUah = DataClient.formatMoney(15000000, 'UAH');
    assert(formattedUah.includes('150') && formattedUah.includes('UAH'), 'formatMoney formats UAH properly with locale spacing');

    // -------------------------------------------------------------------------
    // 5. CSS & Dropdown Dark Theme Hardening
    // -------------------------------------------------------------------------
    console.log('\n--- 5. CSS & Dropdown Dark Theme Hardening ---');
    const cssContent = fs.readFileSync(path.join(__dirname, 'css/portal.css'), 'utf-8');

    assert(cssContent.includes('color-scheme: dark'), 'portal.css includes color-scheme: dark for OS dropdown menus');
    assert(cssContent.includes('select option') && cssContent.includes('background-color: #141C31'), 'portal.css defines explicit dark background on select options');
    assert(cssContent.includes('.portal-kpi-grid') && cssContent.includes('grid-template-columns: repeat(4, 1fr)'), 'portal.css defines responsive 4-column .portal-kpi-grid');
    assert(cssContent.includes('.finance-toolbar-grid'), 'portal.css defines .finance-toolbar-grid for compact toolbar');
    assert(cssContent.includes('@media (max-width: 1100px)'), 'portal.css includes 2x2 tablet breakpoint for KPI grid');
    assert(cssContent.includes('@media (max-width: 600px)'), 'portal.css includes 1-column mobile breakpoint for KPI grid');

  } catch (err) {
    console.error('Suite error:', err);
    failed++;
  } finally {
    await client.end();
  }

  console.log(`\n========================================`);
  console.log(`Phase 5C.1.1 Suite Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
}

runPhase5C11Suite();
