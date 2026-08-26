const { Client } = require('pg');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

const OWNER_ID = '27852879-0d5f-4c72-889d-69a0989302d2';
const PM_ID = '11111111-1111-1111-1111-111111111111';

// Stable UUIDs
const ALPHA_ORG_ID = '21bb5fe2-ff1d-473a-b329-bc02b97ba069';
const ALPHA_PROJ_1_ID = '170d3c57-224b-4ae5-a384-0ccdf17252cc';
const ALPHA_PROJ_2_ID = '6af58a69-dbd9-43b8-b04f-68a38da1c2bb';
const BETA_ORG_ID = '59f079d0-c8c9-4703-88a7-c4934f64b69e';
const BETA_PROJ_1_ID = 'e02cb139-64c5-45f3-af3d-b7725a306581';

// Deterministic Commercial Terms IDs
const ALPHA_1_TERMS_ID = '11111111-1111-5000-a000-000000000101';
const ALPHA_2_TERMS_ID = '11111111-1111-5000-a000-000000000102';
const BETA_1_TERMS_ID  = '11111111-1111-5000-b000-000000000101';

// Tranche IDs for Alpha 1
const ALPHA_1_TRANCHE_1_ID = '11111111-1111-5000-a000-000000000201';
const ALPHA_1_TRANCHE_2_ID = '11111111-1111-5000-a000-000000000202';
const ALPHA_1_TRANCHE_3_ID = '11111111-1111-5000-a000-000000000203';

// Tranche IDs for Alpha 2 (Overdue demo)
const ALPHA_2_TRANCHE_1_ID = '11111111-1111-5000-a000-000000000204';
const ALPHA_2_TRANCHE_2_ID = '11111111-1111-5000-a000-000000000205';

// Tranche IDs for Beta 1 (Multi-currency EUR)
const BETA_1_TRANCHE_1_ID = '11111111-1111-5000-b000-000000000201';
const BETA_1_TRANCHE_2_ID = '11111111-1111-5000-b000-000000000202';

// Payment IDs
const ALPHA_1_PAYMENT_1_ID = '11111111-1111-5000-a000-000000000301';
const BETA_1_PAYMENT_1_ID  = '11111111-1111-5000-b000-000000000301';

// Cost IDs
const COST_SPECIALIST_PLANNED_ID = '11111111-1111-5000-a000-000000000401';
const COST_SOFTWARE_PLANNED_ID   = '11111111-1111-5000-a000-000000000402';
const COST_SPECIALIST_ACTUAL_ID  = '11111111-1111-5000-a000-000000000403';

async function seedFixtures() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  console.log('--- Seeding Canonical Phase 5C.1 Finance Fixtures ---');

  // 1. Commercial Terms: Demo Project Alpha 1 (120,000 CZK = 12,000,000 minor)
  await client.query(`
    INSERT INTO public.project_commercial_terms (
      id, organization_id, project_id, currency, contract_value_minor, commercial_model,
      contract_status, contract_number, contract_date, payment_terms_text, notes, created_by
    ) VALUES (
      $1, $2, $3, 'CZK', 12000000, 'milestone_based',
      'active', 'FW-2026-A101', '2026-08-01', 'Оплата 3 траншами згідно з етапами аудиту',
      'Клієнт погоджує оплати за актами приймання', $4
    ) ON CONFLICT (project_id) DO UPDATE SET
      contract_value_minor = EXCLUDED.contract_value_minor,
      currency = EXCLUDED.currency,
      commercial_model = EXCLUDED.commercial_model,
      contract_status = EXCLUDED.contract_status,
      contract_number = EXCLUDED.contract_number,
      contract_date = EXCLUDED.contract_date,
      payment_terms_text = EXCLUDED.payment_terms_text,
      notes = EXCLUDED.notes;
  `, [ALPHA_1_TERMS_ID, ALPHA_ORG_ID, ALPHA_PROJ_1_ID, OWNER_ID]);

  // 2. Commercial Terms: Demo Project Alpha 2 (80,000 CZK)
  await client.query(`
    INSERT INTO public.project_commercial_terms (
      id, organization_id, project_id, currency, contract_value_minor, commercial_model,
      contract_status, contract_number, contract_date, payment_terms_text, notes, created_by
    ) VALUES (
      $1, $2, $3, 'CZK', 8000000, 'fixed_fee',
      'active', 'FW-2026-A102', '2026-08-10', '50% аванс, 50% по завершенню',
      'Прострочений перший транш для перевірки алертерів', $4
    ) ON CONFLICT (project_id) DO UPDATE SET
      contract_value_minor = EXCLUDED.contract_value_minor,
      contract_status = EXCLUDED.contract_status;
  `, [ALPHA_2_TERMS_ID, ALPHA_ORG_ID, ALPHA_PROJ_2_ID, OWNER_ID]);

  // 3. Commercial Terms: Demo Project Beta 1 (5,000 EUR = 500,000 minor)
  await client.query(`
    INSERT INTO public.project_commercial_terms (
      id, organization_id, project_id, currency, contract_value_minor, commercial_model,
      contract_status, contract_number, contract_date, payment_terms_text, notes, created_by
    ) VALUES (
      $1, $2, $3, 'EUR', 500000, 'fixed_fee',
      'active', 'FW-2026-B201', '2026-08-15', '100% після погодження документації',
      'Міжнародний клієнт (EUR)', $4
    ) ON CONFLICT (project_id) DO UPDATE SET
      contract_value_minor = EXCLUDED.contract_value_minor,
      currency = EXCLUDED.currency;
  `, [BETA_1_TERMS_ID, BETA_ORG_ID, BETA_PROJ_1_ID, OWNER_ID]);

  // 4. Payment Schedule for Alpha 1 (3 tranches of 40,000 CZK)
  // Tranche 1: Paid (due 10 days ago)
  await client.query(`
    INSERT INTO public.project_payment_schedule (
      id, organization_id, project_id, commercial_terms_id, title, amount_minor, currency,
      due_date, status, sort_order, created_by
    ) VALUES (
      $1, $2, $3, $4, 'Транш 1: Аванс за аудит', 4000000, 'CZK',
      CURRENT_DATE - INTERVAL '10 days', 'paid', 1, $5
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = EXCLUDED.amount_minor,
      due_date = EXCLUDED.due_date,
      status = EXCLUDED.status;
  `, [ALPHA_1_TRANCHE_1_ID, ALPHA_ORG_ID, ALPHA_PROJ_1_ID, ALPHA_1_TERMS_ID, OWNER_ID]);

  // Tranche 2: Upcoming (due in 5 days)
  await client.query(`
    INSERT INTO public.project_payment_schedule (
      id, organization_id, project_id, commercial_terms_id, title, amount_minor, currency,
      due_date, status, sort_order, created_by
    ) VALUES (
      $1, $2, $3, $4, 'Транш 2: Погодження структури CRM', 4000000, 'CZK',
      CURRENT_DATE + INTERVAL '5 days', 'planned', 2, $5
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = EXCLUDED.amount_minor,
      due_date = EXCLUDED.due_date,
      status = EXCLUDED.status;
  `, [ALPHA_1_TRANCHE_2_ID, ALPHA_ORG_ID, ALPHA_PROJ_1_ID, ALPHA_1_TERMS_ID, OWNER_ID]);

  // Tranche 3: Future (due in 25 days)
  await client.query(`
    INSERT INTO public.project_payment_schedule (
      id, organization_id, project_id, commercial_terms_id, title, amount_minor, currency,
      due_date, status, sort_order, created_by
    ) VALUES (
      $1, $2, $3, $4, 'Транш 3: Фінальна здача проєкту', 4000000, 'CZK',
      CURRENT_DATE + INTERVAL '25 days', 'planned', 3, $5
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = EXCLUDED.amount_minor,
      due_date = EXCLUDED.due_date,
      status = EXCLUDED.status;
  `, [ALPHA_1_TRANCHE_3_ID, ALPHA_ORG_ID, ALPHA_PROJ_1_ID, ALPHA_1_TERMS_ID, OWNER_ID]);

  // 5. Payment Schedule for Alpha 2 (Tranche 1 Overdue, Tranche 2 Future)
  await client.query(`
    INSERT INTO public.project_payment_schedule (
      id, organization_id, project_id, commercial_terms_id, title, amount_minor, currency,
      due_date, status, sort_order, created_by
    ) VALUES (
      $1, $2, $3, $4, 'Авансовий платіж 50%', 4000000, 'CZK',
      CURRENT_DATE - INTERVAL '3 days', 'overdue', 1, $5
    ) ON CONFLICT (id) DO UPDATE SET
      status = 'overdue', due_date = CURRENT_DATE - INTERVAL '3 days';
  `, [ALPHA_2_TRANCHE_1_ID, ALPHA_ORG_ID, ALPHA_PROJ_2_ID, ALPHA_2_TERMS_ID, OWNER_ID]);

  await client.query(`
    INSERT INTO public.project_payment_schedule (
      id, organization_id, project_id, commercial_terms_id, title, amount_minor, currency,
      due_date, status, sort_order, created_by
    ) VALUES (
      $1, $2, $3, $4, 'Фінальний платіж 50%', 4000000, 'CZK',
      CURRENT_DATE + INTERVAL '30 days', 'planned', 2, $5
    ) ON CONFLICT (id) DO UPDATE SET
      status = 'planned';
  `, [ALPHA_2_TRANCHE_2_ID, ALPHA_ORG_ID, ALPHA_PROJ_2_ID, ALPHA_2_TERMS_ID, OWNER_ID]);

  // 6. Payment Schedule for Beta 1 (EUR 5,000)
  await client.query(`
    INSERT INTO public.project_payment_schedule (
      id, organization_id, project_id, commercial_terms_id, title, amount_minor, currency,
      due_date, status, sort_order, created_by
    ) VALUES (
      $1, $2, $3, $4, 'Повна оплата за консалтинг', 500000, 'EUR',
      CURRENT_DATE + INTERVAL '14 days', 'planned', 1, $5
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = 500000, currency = 'EUR';
  `, [BETA_1_TRANCHE_1_ID, BETA_ORG_ID, BETA_PROJ_1_ID, BETA_1_TERMS_ID, OWNER_ID]);

  // 7. Actual Payment for Alpha 1 (40,000 CZK for Tranche 1)
  await client.query(`
    INSERT INTO public.project_payments (
      id, organization_id, project_id, payment_schedule_id, amount_minor, currency,
      paid_at, payment_method, reference, comment, created_by
    ) VALUES (
      $1, $2, $3, $4, 4000000, 'CZK',
      NOW() - INTERVAL '8 days', 'bank_transfer', 'INV-2026-081',
      'Оплата авансу отримана на розрахунковий рахунок', $5
    ) ON CONFLICT (id) DO NOTHING;
  `, [ALPHA_1_PAYMENT_1_ID, ALPHA_ORG_ID, ALPHA_PROJ_1_ID, ALPHA_1_TRANCHE_1_ID, OWNER_ID]);

  // 8. Owner Costs for Alpha 1
  // Cost 1: Specialist Work (Planned 25,000 CZK)
  await client.query(`
    INSERT INTO public.project_costs (
      id, organization_id, project_id, category, title, amount_minor, currency,
      cost_type, status, incurred_at, vendor_or_recipient, notes, created_by
    ) VALUES (
      $1, $2, $3, 'specialist', 'Робота провідного консультанта', 2500000, 'CZK',
      'planned', 'approved', CURRENT_DATE + INTERVAL '10 days', 'Олексій (Спеціаліст)',
      'Плановий бюджет на аудит процесів', $4
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = EXCLUDED.amount_minor,
      cost_type = EXCLUDED.cost_type;
  `, [COST_SPECIALIST_PLANNED_ID, ALPHA_ORG_ID, ALPHA_PROJ_1_ID, OWNER_ID]);

  // Cost 2: Software / Infrastructure (Planned 5,000 CZK)
  await client.query(`
    INSERT INTO public.project_costs (
      id, organization_id, project_id, category, title, amount_minor, currency,
      cost_type, status, incurred_at, vendor_or_recipient, notes, created_by
    ) VALUES (
      $1, $2, $3, 'software', 'Ліцензії CRM та сервіси аналітики', 500000, 'CZK',
      'planned', 'approved', CURRENT_DATE + INTERVAL '5 days', 'HubSpot / Supabase',
      'ПЗ для інтеграції та конфігурації', $4
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = EXCLUDED.amount_minor,
      cost_type = EXCLUDED.cost_type;
  `, [COST_SOFTWARE_PLANNED_ID, ALPHA_ORG_ID, ALPHA_PROJ_1_ID, OWNER_ID]);

  // Cost 3: Specialist Work (Actual Incurred 10,000 CZK)
  await client.query(`
    INSERT INTO public.project_costs (
      id, organization_id, project_id, category, title, amount_minor, currency,
      cost_type, status, incurred_at, vendor_or_recipient, notes, created_by
    ) VALUES (
      $1, $2, $3, 'specialist', 'Фактична оплата за первинний аудит', 1000000, 'CZK',
      'actual', 'paid', CURRENT_DATE - INTERVAL '5 days', 'Олексій (Спеціаліст)',
      'Виплачено за підсумками першого етапу', $4
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = EXCLUDED.amount_minor,
      cost_type = EXCLUDED.cost_type;
  `, [COST_SPECIALIST_ACTUAL_ID, ALPHA_ORG_ID, ALPHA_PROJ_1_ID, OWNER_ID]);

  console.log('✔ Phase 5C.1 Finance Fixtures seeded successfully.');
  await client.end();
}

seedFixtures().catch(err => {
  console.error('Fixture seeding error:', err);
  process.exit(1);
});
