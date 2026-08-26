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
const ALPHA_ORG_ID = '21bb5fe2-ff1d-473a-b329-bc02b97ba069';

// Stable UUIDs for Ukrainian UAH Demo Project
const UAH_PROJECT_ID = '33333333-3333-3333-3333-333333333331';
const UAH_TERMS_ID = '33333333-3333-5000-c000-000000000101';

const UAH_TRANCHE_1_ID = '33333333-3333-5000-c000-000000000201';
const UAH_TRANCHE_2_ID = '33333333-3333-5000-c000-000000000202';
const UAH_TRANCHE_3_ID = '33333333-3333-5000-c000-000000000203';

const UAH_PAYMENT_1_ID = '33333333-3333-5000-c000-000000000301';

const UAH_COST_PLANNED_1_ID = '33333333-3333-5000-c000-000000000401';
const UAH_COST_PLANNED_2_ID = '33333333-3333-5000-c000-000000000402';
const UAH_COST_ACTUAL_1_ID  = '33333333-3333-5000-c000-000000000403';

async function seedUahFixture() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  console.log('--- Seeding Canonical Phase 5C.1.1 Ukrainian UAH Demo Project Fixture ---');

  // 1. Ensure Project exists in public.projects
  await client.query(`
    INSERT INTO public.projects (
      id, organization_id, title, description, project_type, status, health_status, progress_percent
    ) VALUES (
      $1, $2, 'Demo Project Gamma 1 (Впровадження AI Sales Assistant)', 'Впровадження AI Sales Assistant для автоматизації лідогенерації',
      'custom', 'active', 'on_track', 35
    ) ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      health_status = EXCLUDED.health_status;
  `, [UAH_PROJECT_ID, ALPHA_ORG_ID]);

  // 2. Commercial Terms in UAH (150,000 UAH = 15,000,000 minor units)
  await client.query(`
    INSERT INTO public.project_commercial_terms (
      id, organization_id, project_id, currency, contract_value_minor, commercial_model,
      contract_status, contract_number, contract_date, payment_terms_text, notes, created_by
    ) VALUES (
      $1, $2, $3, 'UAH', 15000000, 'milestone_based',
      'active', 'FW-2026-U301', '2026-08-01',
      'Оплата 3 рівними траншами по 50 000 ₴ згідно з графіком розробки',
      'Український проєкт у гривні (UAH)', $4
    ) ON CONFLICT (project_id) DO UPDATE SET
      contract_value_minor = EXCLUDED.contract_value_minor,
      currency = EXCLUDED.currency,
      commercial_model = EXCLUDED.commercial_model,
      contract_status = EXCLUDED.contract_status,
      contract_number = EXCLUDED.contract_number,
      payment_terms_text = EXCLUDED.payment_terms_text,
      notes = EXCLUDED.notes;
  `, [UAH_TERMS_ID, ALPHA_ORG_ID, UAH_PROJECT_ID, OWNER_ID]);

  // 3. Payment Schedule (3 x 50,000 UAH = 5,000,000 minor)
  // Tranche 1: Paid (due 10 days ago)
  await client.query(`
    INSERT INTO public.project_payment_schedule (
      id, organization_id, project_id, commercial_terms_id, title, amount_minor, currency,
      due_date, status, sort_order, created_by
    ) VALUES (
      $1, $2, $3, $4, 'Транш 1: Архітектура та прототип', 5000000, 'UAH',
      CURRENT_DATE - INTERVAL '10 days', 'paid', 1, $5
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = EXCLUDED.amount_minor,
      currency = EXCLUDED.currency,
      due_date = EXCLUDED.due_date,
      status = EXCLUDED.status;
  `, [UAH_TRANCHE_1_ID, ALPHA_ORG_ID, UAH_PROJECT_ID, UAH_TERMS_ID, OWNER_ID]);

  // Tranche 2: Overdue (due 3 days ago)
  await client.query(`
    INSERT INTO public.project_payment_schedule (
      id, organization_id, project_id, commercial_terms_id, title, amount_minor, currency,
      due_date, status, sort_order, created_by
    ) VALUES (
      $1, $2, $3, $4, 'Транш 2: Навчання моделі та інтеграція', 5000000, 'UAH',
      CURRENT_DATE - INTERVAL '3 days', 'overdue', 2, $5
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = EXCLUDED.amount_minor,
      currency = EXCLUDED.currency,
      due_date = CURRENT_DATE - INTERVAL '3 days',
      status = 'overdue';
  `, [UAH_TRANCHE_2_ID, ALPHA_ORG_ID, UAH_PROJECT_ID, UAH_TERMS_ID, OWNER_ID]);

  // Tranche 3: Planned (due in 20 days)
  await client.query(`
    INSERT INTO public.project_payment_schedule (
      id, organization_id, project_id, commercial_terms_id, title, amount_minor, currency,
      due_date, status, sort_order, created_by
    ) VALUES (
      $1, $2, $3, $4, 'Транш 3: Фінальне тестування та реліз', 5000000, 'UAH',
      CURRENT_DATE + INTERVAL '20 days', 'planned', 3, $5
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = EXCLUDED.amount_minor,
      currency = EXCLUDED.currency,
      due_date = EXCLUDED.due_date,
      status = EXCLUDED.status;
  `, [UAH_TRANCHE_3_ID, ALPHA_ORG_ID, UAH_PROJECT_ID, UAH_TERMS_ID, OWNER_ID]);

  // 4. Actual Payment (50,000 UAH for Tranche 1)
  await client.query(`
    INSERT INTO public.project_payments (
      id, organization_id, project_id, payment_schedule_id, amount_minor, currency,
      paid_at, payment_method, reference, comment, created_by
    ) VALUES (
      $1, $2, $3, $4, 5000000, 'UAH',
      NOW() - INTERVAL '8 days', 'bank_transfer', 'UAH-PAY-001',
      'Оплата першого траншу на поточний рахунок у ПриватБанку', $5
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = EXCLUDED.amount_minor,
      currency = EXCLUDED.currency;
  `, [UAH_PAYMENT_1_ID, ALPHA_ORG_ID, UAH_PROJECT_ID, UAH_TRANCHE_1_ID, OWNER_ID]);

  // 5. Costs in UAH (Owner only)
  // Cost 1: Planned Specialist Work (35,000 UAH)
  await client.query(`
    INSERT INTO public.project_costs (
      id, organization_id, project_id, category, title, amount_minor, currency,
      cost_type, status, incurred_at, vendor_or_recipient, notes, created_by
    ) VALUES (
      $1, $2, $3, 'specialist', 'Розробка AI моделей та промптів', 3500000, 'UAH',
      'planned', 'approved', CURRENT_DATE + INTERVAL '5 days', 'Дмитро (AI Engineer)',
      'Плановий гонорар спеціаліста', $4
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = EXCLUDED.amount_minor,
      currency = EXCLUDED.currency;
  `, [UAH_COST_PLANNED_1_ID, ALPHA_ORG_ID, UAH_PROJECT_ID, OWNER_ID]);

  // Cost 2: Planned Software / GPU (10,000 UAH)
  await client.query(`
    INSERT INTO public.project_costs (
      id, organization_id, project_id, category, title, amount_minor, currency,
      cost_type, status, incurred_at, vendor_or_recipient, notes, created_by
    ) VALUES (
      $1, $2, $3, 'software', 'Хмарна інфраструктура GPU (LLM Inference)', 1000000, 'UAH',
      'planned', 'approved', CURRENT_DATE + INTERVAL '10 days', 'RunPod / AWS',
      'Серверні потужності', $4
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = EXCLUDED.amount_minor,
      currency = EXCLUDED.currency;
  `, [UAH_COST_PLANNED_2_ID, ALPHA_ORG_ID, UAH_PROJECT_ID, OWNER_ID]);

  // Cost 3: Actual Cost Incurred (20,000 UAH)
  await client.query(`
    INSERT INTO public.project_costs (
      id, organization_id, project_id, category, title, amount_minor, currency,
      cost_type, status, incurred_at, vendor_or_recipient, notes, created_by
    ) VALUES (
      $1, $2, $3, 'specialist', 'Аванс провідному AI інженеру', 2000000, 'UAH',
      'actual', 'paid', CURRENT_DATE - INTERVAL '5 days', 'Дмитро (AI Engineer)',
      'Виплачено за розробку архітектури', $4
    ) ON CONFLICT (id) DO UPDATE SET
      amount_minor = EXCLUDED.amount_minor,
      currency = EXCLUDED.currency;
  `, [UAH_COST_ACTUAL_1_ID, ALPHA_ORG_ID, UAH_PROJECT_ID, OWNER_ID]);

  console.log('✔ Phase 5C.1.1 Ukrainian UAH Demo Project seeded successfully.');
  await client.end();
}

seedUahFixture().catch(err => {
  console.error('Fixture seeding error:', err);
  process.exit(1);
});
