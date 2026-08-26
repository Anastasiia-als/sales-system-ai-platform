const { Client: PgClient } = require('pg');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

const OWNER_USER_ID = '27852879-0d5f-4c72-889d-69a0989302d2';
const ALPHA_ORG_ID = '21bb5fe2-ff1d-473a-b329-bc02b97ba069';
const ALPHA_PROJ_1_ID = '170d3c57-224b-4ae5-a384-0ccdf17252cc';
const BETA_ORG_ID = '59f079d0-c8c9-4703-88a7-c4934f64b69e';
const BETA_PROJ_1_ID = 'e02cb139-64c5-45f3-af3d-b7725a306581';

async function runTests() {
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

  console.log('=== Phase 5C.1: Financial Calculations, Lifecycle & Integrity Suite ===\n');

  try {
    // Ensure deterministic payments for Alpha 1
    const schedRes = await client.query(`SELECT id FROM public.project_payment_schedule WHERE project_id = $1 ORDER BY sort_order ASC LIMIT 1`, [ALPHA_PROJ_1_ID]);
    const firstTrancheId = schedRes.rows[0]?.id || null;

    await client.query(`DELETE FROM public.project_payments WHERE project_id = $1 AND id NOT IN ('22222222-2222-5000-a000-000000000201')`, [ALPHA_PROJ_1_ID]);
    await client.query(`
      INSERT INTO public.project_payments (
        id, organization_id, project_id, payment_schedule_id, amount_minor, currency, paid_at, payment_method, reference, created_by
      ) VALUES (
        '22222222-2222-5000-a000-000000000201', '21bb5fe2-ff1d-473a-b329-bc02b97ba069', '170d3c57-224b-4ae5-a384-0ccdf17252cc',
        $1, 4000000, 'CZK', NOW() - INTERVAL '5 days', 'bank_transfer', 'INIT-40K-CZK', '27852879-0d5f-4c72-889d-69a0989302d2'
      ) ON CONFLICT (id) DO UPDATE SET amount_minor = 4000000, payment_schedule_id = $1;
    `, [firstTrancheId]);

    // 1. Formula Testing on Alpha 1 Fixture
    // Contract: 120,000 CZK (12,000,000 minor)
    // Payments: 40,000 CZK (4,000,000 minor)
    // Planned Costs: 25k + 5k = 30k CZK (3,000,000 minor)
    // Actual Costs: 10k CZK (1,000,000 minor)

    const termsRes = await client.query(`SELECT contract_value_minor, currency FROM public.project_commercial_terms WHERE project_id = $1;`, [ALPHA_PROJ_1_ID]);
    const contractValueMinor = parseInt(termsRes.rows[0].contract_value_minor, 10);
    assert(contractValueMinor === 12000000, 'Contract Value is 120,000 CZK (12,000,000 minor)');

    const paymentsRes = await client.query(`SELECT COALESCE(SUM(amount_minor), 0) AS collected FROM public.project_payments WHERE project_id = $1;`, [ALPHA_PROJ_1_ID]);
    const collectedMinor = parseInt(paymentsRes.rows[0].collected, 10);
    assert(collectedMinor === 4000000, 'Collected is 40,000 CZK (4,000,000 minor)');

    const outstandingMinor = Math.max(contractValueMinor - collectedMinor, 0);
    assert(outstandingMinor === 8000000, 'Outstanding is 80,000 CZK (8,000,000 minor)');

    const costsPlannedRes = await client.query(`SELECT COALESCE(SUM(amount_minor), 0) AS planned FROM public.project_costs WHERE project_id = $1 AND cost_type = 'planned';`, [ALPHA_PROJ_1_ID]);
    const plannedCostMinor = parseInt(costsPlannedRes.rows[0].planned, 10);
    assert(plannedCostMinor === 3000000, 'Planned Costs = 30,000 CZK (3,000,000 minor)');

    const costsActualRes = await client.query(`SELECT COALESCE(SUM(amount_minor), 0) AS actual FROM public.project_costs WHERE project_id = $1 AND cost_type = 'actual';`, [ALPHA_PROJ_1_ID]);
    const actualCostMinor = parseInt(costsActualRes.rows[0].actual, 10);
    assert(actualCostMinor === 1000000, 'Actual Costs = 10,000 CZK (1,000,000 minor)');

    const forecastResultMinor = contractValueMinor - plannedCostMinor;
    assert(forecastResultMinor === 9000000, 'Forecast Result = 90,000 CZK (9,000,000 minor)');

    const forecastMarginPercent = contractValueMinor > 0 ? (forecastResultMinor / contractValueMinor) * 100 : 0;
    assert(Math.round(forecastMarginPercent) === 75, 'Forecast Margin % = 75%');

    const cashResultMinor = collectedMinor - actualCostMinor;
    assert(cashResultMinor === 3000000, 'Current Cash Result = 30,000 CZK (3,000,000 minor)');

    // 2. Scenario 1: Partial Payment Lifecycle Test
    // Create temporary test tranche of 30,000 CZK (3,000,000 minor)
    const testTrancheId = '22222222-2222-5000-a000-000000000999';
    await client.query(`
      INSERT INTO public.project_payment_schedule (
        id, organization_id, project_id, title, amount_minor, currency, due_date, status, created_by
      ) VALUES (
        $1, $2, $3, 'Test Dynamic Tranche 30k', 3000000, 'CZK', CURRENT_DATE + INTERVAL '10 days', 'planned', $4
      ) ON CONFLICT (id) DO UPDATE SET amount_minor = 3000000, status = 'planned';
    `, [testTrancheId, ALPHA_ORG_ID, ALPHA_PROJ_1_ID, OWNER_USER_ID]);

    // Record partial payment of 20,000 CZK (2,000,000 minor)
    const testPayment1Id = '22222222-2222-5000-a000-000000000991';
    await client.query(`
      INSERT INTO public.project_payments (
        id, organization_id, project_id, payment_schedule_id, amount_minor, currency, paid_at, payment_method, created_by
      ) VALUES (
        $1, $2, $3, $4, 2000000, 'CZK', NOW(), 'bank_transfer', $5
      ) ON CONFLICT (id) DO UPDATE SET amount_minor = 2000000;
    `, [testPayment1Id, ALPHA_ORG_ID, ALPHA_PROJ_1_ID, testTrancheId, OWNER_USER_ID]);

    // Verify derived status: partially_paid and remaining 10k
    const trancheAfterPart1 = await client.query(`SELECT status FROM public.project_payment_schedule WHERE id = $1;`, [testTrancheId]);
    assert(trancheAfterPart1.rows[0].status === 'partially_paid', 'Tranche automatically transitions to partially_paid on partial payment');

    const totalPaidTranche = await client.query(`SELECT SUM(amount_minor) AS total_paid FROM public.project_payments WHERE payment_schedule_id = $1;`, [testTrancheId]);
    const remainingTranche = 3000000 - parseInt(totalPaidTranche.rows[0].total_paid, 10);
    assert(remainingTranche === 1000000, 'Remaining tranche amount correctly calculated as 10,000 CZK (1,000,000 minor)');

    // Complete tranche with second payment of 10,000 CZK (1,000,000 minor)
    const testPayment2Id = '22222222-2222-5000-a000-000000000992';
    await client.query(`
      INSERT INTO public.project_payments (
        id, organization_id, project_id, payment_schedule_id, amount_minor, currency, paid_at, payment_method, created_by
      ) VALUES (
        $1, $2, $3, $4, 1000000, 'CZK', NOW(), 'bank_transfer', $5
      ) ON CONFLICT (id) DO UPDATE SET amount_minor = 1000000;
    `, [testPayment2Id, ALPHA_ORG_ID, ALPHA_PROJ_1_ID, testTrancheId, OWNER_USER_ID]);

    const trancheAfterFull = await client.query(`SELECT status FROM public.project_payment_schedule WHERE id = $1;`, [testTrancheId]);
    assert(trancheAfterFull.rows[0].status === 'paid', 'Tranche automatically transitions to paid on full payment');

    // 3. Overpayment Prevention Test
    let overpaymentBlocked = false;
    try {
      await client.query(`
        INSERT INTO public.project_payments (
          organization_id, project_id, payment_schedule_id, amount_minor, currency, paid_at, payment_method, created_by
        ) VALUES (
          $1, $2, $3, 500000, 'CZK', NOW(), 'bank_transfer', $4
        );
      `, [ALPHA_ORG_ID, ALPHA_PROJ_1_ID, testTrancheId, OWNER_USER_ID]);
    } catch (e) {
      overpaymentBlocked = true;
    }
    assert(overpaymentBlocked, 'Overpayment exceeding tranche amount is STRICTLY BLOCKED by trigger');

    // Cleanup dynamic test records
    await client.query(`DELETE FROM public.project_payments WHERE id IN ($1, $2);`, [testPayment1Id, testPayment2Id]);
    await client.query(`DELETE FROM public.project_payment_schedule WHERE id = $1;`, [testTrancheId]);

    // 4. Data Integrity Validations
    // 4.1 Zero Payment Rejection
    let zeroPaymentBlocked = false;
    try {
      await client.query(`
        INSERT INTO public.project_payments (
          organization_id, project_id, amount_minor, currency
        ) VALUES ($1, $2, 0, 'CZK');
      `, [ALPHA_ORG_ID, ALPHA_PROJ_1_ID]);
    } catch (e) {
      zeroPaymentBlocked = true;
    }
    assert(zeroPaymentBlocked, 'Zero amount payment is rejected (amount_minor > 0 check)');

    // 4.2 Negative Payment Rejection
    let negativePaymentBlocked = false;
    try {
      await client.query(`
        INSERT INTO public.project_payments (
          organization_id, project_id, amount_minor, currency
        ) VALUES ($1, $2, -5000, 'CZK');
      `, [ALPHA_ORG_ID, ALPHA_PROJ_1_ID]);
    } catch (e) {
      negativePaymentBlocked = true;
    }
    assert(negativePaymentBlocked, 'Negative amount payment is rejected');

    // 4.3 Cross-Project Link Rejection
    let crossProjectBlocked = false;
    try {
      // Trying to link Alpha 1 tranche to Beta 1 payment
      await client.query(`
        INSERT INTO public.project_payments (
          organization_id, project_id, payment_schedule_id, amount_minor, currency
        ) VALUES (
          $1, $2, '11111111-1111-5000-a000-000000000201', 50000, 'EUR'
        );
      `, [BETA_ORG_ID, BETA_PROJ_1_ID]);
    } catch (e) {
      crossProjectBlocked = true;
    }
    assert(crossProjectBlocked, 'Cross-project tranche linking is rejected by validation trigger');

    // 4.4 Currency Mismatch Rejection
    let currencyMismatchBlocked = false;
    try {
      // Trying to pay in EUR for CZK tranche
      await client.query(`
        INSERT INTO public.project_payments (
          organization_id, project_id, payment_schedule_id, amount_minor, currency
        ) VALUES (
          $1, $2, '11111111-1111-5000-a000-000000000201', 50000, 'EUR'
        );
      `, [ALPHA_ORG_ID, ALPHA_PROJ_1_ID]);
    } catch (e) {
      currencyMismatchBlocked = true;
    }
    assert(currencyMismatchBlocked, 'Payment currency mismatch against tranche currency is rejected');

    // 5. Overdue Detection Evaluation Test
    const evalRes = await client.query(`SELECT public.evaluate_notifications();`);
    assert(evalRes.rows[0].evaluate_notifications.success === true, 'evaluate_notifications() with finance rules executes cleanly');

    const overdueTranche = await client.query(`SELECT status FROM public.project_payment_schedule WHERE id = '11111111-1111-5000-a000-000000000204';`);
    assert(overdueTranche.rows[0].status === 'overdue', 'Overdue past due_date tranche is evaluated as overdue');

  } finally {
    await client.end();
  }

  console.log(`\n========================================`);
  console.log(`Phase 5C.1 Calculation & Integrity Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
