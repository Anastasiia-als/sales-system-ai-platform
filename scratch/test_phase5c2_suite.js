const { Client } = require('pg');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function runTests() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('=== PHASE 5C.2 AUTOMATED TEST SUITE ===');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✔ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${testName} - ${details}`);
      failed++;
    }
  }

  try {
    // 1. Check Billing Profiles
    const bpRes = await client.query(`SELECT * FROM public.billing_profiles WHERE is_active = true`);
    assert(bpRes.rows.length > 0, '1. Active billing profile exists', `Found ${bpRes.rows.length}`);
    const profile = bpRes.rows[0];
    assert(!!profile.iban && !!profile.swift, '2. Billing profile has IBAN and SWIFT');

    // 2. Fetch an organization and project for testing
    const projRes = await client.query(`SELECT id as project_id, organization_id FROM public.projects LIMIT 1`);
    const testProject = projRes.rows[0];

    // 3. Create Draft Invoice with Items
    const draftRes = await client.query(`
      INSERT INTO public.invoices (
        organization_id, project_id, billing_profile_id, currency, status, issue_date, due_date
      ) VALUES ($1, $2, $3, 'CZK', 'draft', CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days')
      RETURNING id, status, invoice_number
    `, [testProject.organization_id, testProject.project_id, profile.id]);
    const draftInv = draftRes.rows[0];
    assert(draftInv.status === 'draft', '3. Draft invoice created with status draft');
    assert(draftInv.invoice_number === null, '4. Draft invoice does not consume sequence number');

    // 4. Add Line Items (Integer minor unit math)
    const item1 = await client.query(`
      INSERT INTO public.invoice_items (
        invoice_id, description, quantity, unit_price_minor, tax_rate, sort_order
      ) VALUES ($1, 'Послуги аналітики', 2, 500000, 20, 1)
      RETURNING subtotal_minor, tax_minor, total_minor
    `, [draftInv.id]);
    // 2 * 500000 = 1000000 subtotal. 20% tax = 200000. Total = 1200000.
    assert(Number(item1.rows[0].subtotal_minor) === 1000000, '5. Line item subtotal calculation (2 * 5000 = 10000)', `Got ${item1.rows[0].subtotal_minor}`);
    assert(Number(item1.rows[0].tax_minor) === 200000, '6. Line item tax calculation (20% of 10000 = 2000)', `Got ${item1.rows[0].tax_minor}`);
    assert(Number(item1.rows[0].total_minor) === 1200000, '7. Line item total calculation (12000)', `Got ${item1.rows[0].total_minor}`);

    // Check parent invoice total synchronization
    const invCheck = await client.query(`SELECT subtotal_minor, tax_minor, total_minor, outstanding_minor FROM public.invoices WHERE id = $1`, [draftInv.id]);
    assert(Number(invCheck.rows[0].total_minor) === 1200000, '8. Parent invoice synced totals from line items', `Got ${invCheck.rows[0].total_minor}`);
    assert(Number(invCheck.rows[0].outstanding_minor) === 1200000, '9. Parent invoice outstanding matches total');

    // 5. Issue Invoice (Sequence & Snapshot generation)
    const issueRes = await client.query(`SELECT public.issue_invoice($1) as res`, [draftInv.id]);
    const issuedInvRes = await client.query(`SELECT * FROM public.invoices WHERE id = $1`, [draftInv.id]);
    const issuedInv = issuedInvRes.rows[0];

    assert(issuedInv.status === 'issued', '10. Invoice status transitioned to issued');
    assert(issuedInv.invoice_number && issuedInv.invoice_number.startsWith('FW-'), '11. Atomic sequential invoice number generated', issuedInv.invoice_number);
    assert(issuedInv.seller_snapshot && issuedInv.seller_snapshot.iban === profile.iban, '12. Seller snapshot captured into JSONB');
    assert(issuedInv.buyer_snapshot && !!issuedInv.buyer_snapshot.organization_name, '13. Buyer snapshot captured into JSONB');
    assert(issuedInv.items_snapshot && issuedInv.items_snapshot.length === 1, '14. Line items captured into snapshot');

    // 6. Test Immutability Trigger (Cannot modify line items or total once issued)
    let immutabilityBlocked = false;
    try {
      await client.query(`UPDATE public.invoice_items SET unit_price_minor = 999999 WHERE invoice_id = $1`, [draftInv.id]);
    } catch (e) {
      immutabilityBlocked = true;
    }
    assert(immutabilityBlocked, '15. Immutability guard prevents modifying line items of issued invoice');

    // 7. Partial Payment Allocation
    await client.query(`
      INSERT INTO public.project_payments (
        organization_id, project_id, invoice_id, amount_minor, currency, payment_method, reference
      ) VALUES ($1, $2, $3, 400000, 'CZK', 'bank_transfer', 'PART-PAY-01')
    `, [testProject.organization_id, testProject.project_id, draftInv.id]);

    const partialInvCheck = await client.query(`SELECT status, paid_minor, outstanding_minor FROM public.invoices WHERE id = $1`, [draftInv.id]);
    assert(partialInvCheck.rows[0].status === 'partially_paid', '16. Invoice status transitioned to partially_paid', partialInvCheck.rows[0].status);
    assert(Number(partialInvCheck.rows[0].paid_minor) === 400000, '17. Invoice paid_minor updated to 400000');
    assert(Number(partialInvCheck.rows[0].outstanding_minor) === 800000, '18. Invoice outstanding_minor updated to 800000');

    // 8. Anti-Overpayment Guard (Attempting to pay 900000 when outstanding is 800000)
    let overpaymentBlocked = false;
    try {
      await client.query(`
        INSERT INTO public.project_payments (
          organization_id, project_id, invoice_id, amount_minor, currency, payment_method, reference
        ) VALUES ($1, $2, $3, 900000, 'CZK', 'bank_transfer', 'OVER-PAY-01')
      `, [testProject.organization_id, testProject.project_id, draftInv.id]);
    } catch (e) {
      overpaymentBlocked = true;
    }
    assert(overpaymentBlocked, '19. Anti-overpayment guard rejected payment exceeding balance due');

    // 9. Full Payment Allocation (Pay remaining 800000)
    await client.query(`
      INSERT INTO public.project_payments (
        organization_id, project_id, invoice_id, amount_minor, currency, payment_method, reference
      ) VALUES ($1, $2, $3, 800000, 'CZK', 'bank_transfer', 'FINAL-PAY-01')
    `, [testProject.organization_id, testProject.project_id, draftInv.id]);

    const fullInvCheck = await client.query(`SELECT status, paid_minor, outstanding_minor, paid_at FROM public.invoices WHERE id = $1`, [draftInv.id]);
    assert(fullInvCheck.rows[0].status === 'paid', '20. Invoice status transitioned to paid', fullInvCheck.rows[0].status);
    assert(Number(fullInvCheck.rows[0].outstanding_minor) === 0, '21. Invoice outstanding balance is 0');
    assert(fullInvCheck.rows[0].paid_at !== null, '22. Invoice paid_at timestamp recorded');

    // 10. Audit Log Immutability
    const auditRes = await client.query(`SELECT * FROM public.invoice_audit_events WHERE invoice_id = $1`, [draftInv.id]);
    assert(auditRes.rows.length > 0, '23. Audit events created for issue and payments', `Count: ${auditRes.rows.length}`);

    let auditMutationBlocked = false;
    try {
      await client.query(`UPDATE public.invoice_audit_events SET action = 'created' WHERE invoice_id = $1`, [draftInv.id]);
    } catch (e) {
      auditMutationBlocked = true;
    }
    assert(auditMutationBlocked, '24. Direct UPDATE on invoice_audit_events is strictly prohibited');

    // 11. Clean up test invoice & payments
    await client.query(`DELETE FROM public.project_payments WHERE invoice_id = $1`, [draftInv.id]);
    await client.query(`UPDATE public.invoices SET status = 'draft' WHERE id = $1`, [draftInv.id]);
    await client.query(`DELETE FROM public.invoice_items WHERE invoice_id = $1`, [draftInv.id]);
    await client.query(`DELETE FROM public.invoices WHERE id = $1`, [draftInv.id]);

    console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTests();
