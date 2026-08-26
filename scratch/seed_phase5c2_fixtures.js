const { Client } = require('pg');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function seedFixtures() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('Connected to Supabase PostgreSQL database.');

  // Fetch billing profile
  const profileRes = await client.query(`SELECT id FROM public.billing_profiles ORDER BY created_at ASC LIMIT 1`);
  const billingProfileId = profileRes.rows[0]?.id;
  console.log('Using billing profile:', billingProfileId);

  // Fetch projects and tranches
  const projRes = await client.query(`
    SELECT p.id as project_id, p.organization_id, p.title, s.id as tranche_id, s.amount_minor, s.currency, s.due_date, s.title as tranche_title
    FROM public.projects p
    JOIN public.project_payment_schedule s ON s.project_id = p.id
    ORDER BY p.created_at ASC
  `);

  console.log(`Found ${projRes.rows.length} project tranches.`);

  // Group by project currency
  const czkTranches = projRes.rows.filter(r => r.currency === 'CZK');
  const eurTranches = projRes.rows.filter(r => r.currency === 'EUR');
  const uahTranches = projRes.rows.filter(r => r.currency === 'UAH');

  // 1. Seed CZK Invoices
  if (czkTranches.length > 0) {
    const t1 = czkTranches[0];
    // Check if invoice already exists for this tranche
    const exist1 = await client.query(`SELECT id FROM public.invoices WHERE payment_schedule_id = $1`, [t1.tranche_id]);
    if (exist1.rows.length === 0) {
      console.log('Creating CZK Issued & Paid Invoice for tranche:', t1.tranche_title);
      const invRes = await client.query(`
        INSERT INTO public.invoices (
          organization_id, project_id, billing_profile_id, payment_schedule_id,
          currency, status, issue_date, due_date, notes
        ) VALUES ($1, $2, $3, $4, 'CZK', 'draft', '2026-08-01', '2026-08-15', 'Оплата першого етапу робіт')
        RETURNING id
      `, [t1.organization_id, t1.project_id, billingProfileId, t1.tranche_id]);
      const invId = invRes.rows[0].id;

      await client.query(`
        INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price_minor, tax_rate, sort_order)
        VALUES ($1, $2, 1, $3, 0, 1)
      `, [invId, 'Консалтингові послуги за етапом: ' + t1.tranche_title, t1.amount_minor]);

      // Issue invoice
      await client.query(`SELECT public.issue_invoice($1)`, [invId]);

      // Record payment
      await client.query(`
        INSERT INTO public.project_payments (
          organization_id, project_id, invoice_id, payment_schedule_id,
          amount_minor, currency, paid_at, payment_method, reference, comment
        ) VALUES ($1, $2, $3, $4, $5, 'CZK', '2026-08-10', 'bank_transfer', 'PAY-CZK-001', 'Повна оплата рахунку')
      `, [t1.organization_id, t1.project_id, invId, t1.tranche_id, t1.amount_minor]);
      console.log('✔ Seeded CZK Paid Invoice.');
    }
  }

  // 2. Seed UAH Overdue Invoice
  if (uahTranches.length > 0) {
    const tUah = uahTranches.find(t => t.due_date < '2026-08-26') || uahTranches[0];
    const existUah = await client.query(`SELECT id FROM public.invoices WHERE payment_schedule_id = $1`, [tUah.tranche_id]);
    if (existUah.rows.length === 0) {
      console.log('Creating UAH Overdue Invoice for tranche:', tUah.tranche_title);
      const invRes = await client.query(`
        INSERT INTO public.invoices (
          organization_id, project_id, billing_profile_id, payment_schedule_id,
          currency, status, issue_date, due_date, notes
        ) VALUES ($1, $2, $3, $4, 'UAH', 'draft', '2026-08-05', '2026-08-20', 'Транш 2 - Налаштування аналітики')
        RETURNING id
      `, [tUah.organization_id, tUah.project_id, billingProfileId, tUah.tranche_id]);
      const invId = invRes.rows[0].id;

      await client.query(`
        INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price_minor, tax_rate, sort_order)
        VALUES ($1, $2, 1, $3, 0, 1)
      `, [invId, 'Впровадження аналітики: ' + tUah.tranche_title, tUah.amount_minor]);

      // Issue invoice
      await client.query(`SELECT public.issue_invoice($1)`, [invId]);
      console.log('✔ Seeded UAH Overdue Invoice.');
    }
  }

  // 3. Seed EUR Issued (Not Due) Invoice
  if (eurTranches.length > 0) {
    const tEur = eurTranches[0];
    const existEur = await client.query(`SELECT id FROM public.invoices WHERE payment_schedule_id = $1`, [tEur.tranche_id]);
    if (existEur.rows.length === 0) {
      console.log('Creating EUR Issued Invoice for tranche:', tEur.tranche_title);
      const invRes = await client.query(`
        INSERT INTO public.invoices (
          organization_id, project_id, billing_profile_id, payment_schedule_id,
          currency, status, issue_date, due_date, notes
        ) VALUES ($1, $2, $3, $4, 'EUR', 'draft', '2026-08-25', '2026-09-10', 'Phase 1 Delivery EUR')
        RETURNING id
      `, [tEur.organization_id, tEur.project_id, billingProfileId, tEur.tranche_id]);
      const invId = invRes.rows[0].id;

      await client.query(`
        INSERT INTO public.invoice_items (invoice_id, description, quantity, unit_price_minor, tax_rate, sort_order)
        VALUES ($1, $2, 1, $3, 0, 1)
      `, [invId, 'Audit & Architecture EUR: ' + tEur.tranche_title, tEur.amount_minor]);

      // Issue invoice
      await client.query(`SELECT public.issue_invoice($1)`, [invId]);
      console.log('✔ Seeded EUR Issued Invoice.');
    }
  }

  console.log('✔ All Phase 5C.2 Fixtures verified/seeded.');
  await client.end();
}

seedFixtures().catch(err => {
  console.error('Fixture error:', err);
  process.exit(1);
});
