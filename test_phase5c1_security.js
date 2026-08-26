const { Client: PgClient } = require('pg');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

const OWNER_USER_ID = '27852879-0d5f-4c72-889d-69a0989302d2'; // Anastasiia (Owner)
const PM_USER_ID = '11111111-1111-1111-1111-111111111111'; // PM Tester Alpha
const SPECIALIST_USER_ID = '22222222-2222-2222-2222-222222222222'; // Specialist Tester Alpha
const CLIENT_ALPHA_USER_ID = '44444444-4444-4444-4444-444444444444'; // Client Alpha Tester
const CLIENT_BETA_USER_ID = '55555555-5555-5555-5555-555555555555'; // Client Beta Tester

const ALPHA_ORG_ID = '21bb5fe2-ff1d-473a-b329-bc02b97ba069';
const BETA_ORG_ID = '59f079d0-c8c9-4703-88a7-c4934f64b69e';

async function runSession(userId, testFn) {
  const client = new PgClient(DB_CONFIG);
  await client.connect();
  try {
    await client.query("BEGIN;");
    await client.query("SET LOCAL role = 'authenticated';");
    await client.query("SELECT set_config('request.jwt.claims', $1, true);", [
      JSON.stringify({ sub: userId, role: 'authenticated' })
    ]);
    const result = await testFn(client);
    await client.query("COMMIT;");
    return result;
  } catch (err) {
    await client.query("ROLLBACK;");
    throw err;
  } finally {
    await client.end();
  }
}

async function runTests() {
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

  console.log('=== Phase 5C.1: Finance Access & RLS Security Suite ===\n');

  // 1. Owner Access
  await runSession(OWNER_USER_ID, async (c) => {
    const terms = await c.query(`SELECT id FROM public.project_commercial_terms;`);
    assert(terms.rows.length >= 3, `Owner sees all commercial terms across portfolio (count: ${terms.rows.length})`);

    const schedules = await c.query(`SELECT id FROM public.project_payment_schedule;`);
    assert(schedules.rows.length >= 5, `Owner sees all payment schedules (count: ${schedules.rows.length})`);

    const payments = await c.query(`SELECT id FROM public.project_payments;`);
    assert(payments.rows.length >= 1, `Owner sees all payments (count: ${payments.rows.length})`);

    const costs = await c.query(`SELECT id FROM public.project_costs;`);
    assert(costs.rows.length >= 3, `Owner sees internal delivery costs (count: ${costs.rows.length})`);

    const audits = await c.query(`SELECT id FROM public.finance_audit_events;`);
    assert(audits.rows.length >= 1, `Owner sees financial audit events (count: ${audits.rows.length})`);
  });

  // 2. PM / Admin Access
  await runSession(PM_USER_ID, async (c) => {
    // PM sees Alpha terms
    const terms = await c.query(`SELECT id, organization_id FROM public.project_commercial_terms;`);
    assert(terms.rows.length >= 2, `PM sees commercial terms for assigned Alpha org (count: ${terms.rows.length})`);
    assert(terms.rows.every(r => r.organization_id === ALPHA_ORG_ID), 'PM sees ONLY Alpha commercial terms');

    // PM sees Alpha schedules
    const schedules = await c.query(`SELECT id, organization_id FROM public.project_payment_schedule;`);
    assert(schedules.rows.length >= 5, `PM sees payment schedules for Alpha org (count: ${schedules.rows.length})`);
    assert(schedules.rows.every(r => r.organization_id === ALPHA_ORG_ID), 'PM sees ONLY Alpha payment schedules');

    // PM CANNOT see Beta schedules
    const betaSchedules = await c.query(`SELECT id FROM public.project_payment_schedule WHERE organization_id = $1;`, [BETA_ORG_ID]);
    assert(betaSchedules.rows.length === 0, 'PM CANNOT see Beta payment schedules (0 rows returned)');

    // PM CANNOT see project_costs (Owner-Only RLS)
    const costs = await c.query(`SELECT id FROM public.project_costs;`);
    assert(costs.rows.length === 0, 'PM CANNOT see internal project_costs (Strictly 0 rows via RLS)');

    // PM CANNOT insert project_costs
    let costInsertFailed = false;
    try {
      await c.query(`
        INSERT INTO public.project_costs (
          organization_id, project_id, title, amount_minor, currency, cost_type
        ) VALUES (
          $1, '170d3c57-224b-4ae5-a384-0ccdf17252cc', 'Unauthorized Cost', 500000, 'CZK', 'actual'
        );
      `, [ALPHA_ORG_ID]);
    } catch (e) {
      costInsertFailed = true;
    }
    assert(costInsertFailed, 'PM insert into project_costs is STRICTLY BLOCKED by RLS');
  });

  // 3. Specialist Role Default Deny
  await runSession(SPECIALIST_USER_ID, async (c) => {
    const terms = await c.query(`SELECT id FROM public.project_commercial_terms;`);
    assert(terms.rows.length === 0, 'Specialist sees ZERO commercial terms (Default Deny)');

    const schedules = await c.query(`SELECT id FROM public.project_payment_schedule;`);
    assert(schedules.rows.length === 0, 'Specialist sees ZERO payment schedules (Default Deny)');

    const payments = await c.query(`SELECT id FROM public.project_payments;`);
    assert(payments.rows.length === 0, 'Specialist sees ZERO payments (Default Deny)');

    const costs = await c.query(`SELECT id FROM public.project_costs;`);
    assert(costs.rows.length === 0, 'Specialist sees ZERO internal costs (Default Deny)');

    const audits = await c.query(`SELECT id FROM public.finance_audit_events;`);
    assert(audits.rows.length === 0, 'Specialist sees ZERO financial audit events (Default Deny)');
  });

  // 4. Client Role Default Deny
  await runSession(CLIENT_ALPHA_USER_ID, async (c) => {
    const terms = await c.query(`SELECT id FROM public.project_commercial_terms;`);
    assert(terms.rows.length === 0, 'Client Alpha sees ZERO commercial terms (Default Deny)');

    const schedules = await c.query(`SELECT id FROM public.project_payment_schedule;`);
    assert(schedules.rows.length === 0, 'Client Alpha sees ZERO payment schedules (Default Deny)');

    const payments = await c.query(`SELECT id FROM public.project_payments;`);
    assert(payments.rows.length === 0, 'Client Alpha sees ZERO payments (Default Deny)');

    const costs = await c.query(`SELECT id FROM public.project_costs;`);
    assert(costs.rows.length === 0, 'Client Alpha sees ZERO internal costs (Default Deny)');
  });

  await runSession(CLIENT_BETA_USER_ID, async (c) => {
    const terms = await c.query(`SELECT id FROM public.project_commercial_terms;`);
    assert(terms.rows.length === 0, 'Client Beta sees ZERO commercial terms (Default Deny)');
  });

  // 5. Financial Audit Append-Only Immutability
  await runSession(OWNER_USER_ID, async (c) => {
    let updateAuditBlocked = false;
    try {
      const res = await c.query(`UPDATE public.finance_audit_events SET action = 'tampered' WHERE id = (SELECT id FROM public.finance_audit_events LIMIT 1);`);
      updateAuditBlocked = (res.rowCount === 0);
    } catch (e) {
      updateAuditBlocked = true;
    }
    assert(updateAuditBlocked, 'Direct UPDATE on finance_audit_events is STRICTLY BLOCKED (0 rows affected or error)');

    let deleteAuditBlocked = false;
    try {
      const res = await c.query(`DELETE FROM public.finance_audit_events WHERE id = (SELECT id FROM public.finance_audit_events LIMIT 1);`);
      deleteAuditBlocked = (res.rowCount === 0);
    } catch (e) {
      deleteAuditBlocked = true;
    }
    assert(deleteAuditBlocked, 'Direct DELETE on finance_audit_events is STRICTLY BLOCKED (0 rows affected or error)');
  });

  console.log(`\n========================================`);
  console.log(`Phase 5C.1 Security Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
