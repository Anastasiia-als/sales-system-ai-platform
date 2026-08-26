-- FIRSTWIN Client Portal — Phase 5C.2: Billing, Invoices, Accounts Receivable & Client Payment Requests
-- Target: PostgreSQL / Supabase with Hardened Row-Level Security (RLS)

-- -----------------------------------------------------------------------------
-- 1. Billing Profiles Table (Issuer legal entities & bank details)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'CZ',
  registration_number TEXT,
  tax_id TEXT,
  vat_number TEXT,
  legal_address TEXT NOT NULL,
  billing_email TEXT NOT NULL,
  phone TEXT,
  bank_name TEXT NOT NULL,
  bank_account TEXT,
  iban TEXT NOT NULL,
  swift TEXT NOT NULL,
  default_currency TEXT NOT NULL DEFAULT 'CZK' CHECK (default_currency IN ('CZK', 'UAH', 'EUR', 'USD', 'PLN', 'GBP')),
  payment_instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_billing_profiles_updated_at ON public.billing_profiles;
CREATE TRIGGER set_billing_profiles_updated_at
  BEFORE UPDATE ON public.billing_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Seed Default FIRSTWIN Billing Profile if not exists
INSERT INTO public.billing_profiles (
  id, name, legal_name, country, registration_number, tax_id, vat_number,
  legal_address, billing_email, phone, bank_name, bank_account, iban, swift,
  default_currency, payment_instructions, is_active
) VALUES (
  '00000000-0000-5000-a000-000000000001',
  'FIRSTWIN Primary (CZ)',
  'FIRSTWIN Consulting s.r.o.',
  'CZ',
  '12345678',
  'CZ12345678',
  'CZ12345678',
  'Václavské náměstí 846/1, 110 00 Praha 1, Czech Republic',
  'billing@firstwin.cz',
  '+420 777 123 456',
  'Fio banka, a.s.',
  '2001234567/2010',
  'CZ6520100000002001234567',
  'FIOBCZPPXXX',
  'CZK',
  'Будь ласка, вказуйте номер рахунку як Variable Symbol (VS) або призначення платежу.',
  true
) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Concurrency-Safe Invoice Sequence Generator
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  year_number INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next_num INTEGER;
  v_invoice_number TEXT;
BEGIN
  -- Row-level lock on the sequence record for the given year
  INSERT INTO public.invoice_sequences (year_number, last_number, updated_at)
  VALUES (p_year, 1, NOW())
  ON CONFLICT (year_number) DO UPDATE
  SET last_number = public.invoice_sequences.last_number + 1,
      updated_at = NOW()
  RETURNING last_number INTO v_next_num;

  -- Format: FW-YYYY-000001
  v_invoice_number := 'FW-' || p_year::TEXT || '-' || LPAD(v_next_num::TEXT, 6, '0');
  RETURN v_invoice_number;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Invoices Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  billing_profile_id UUID REFERENCES public.billing_profiles(id) ON DELETE RESTRICT,
  payment_schedule_id UUID REFERENCES public.project_payment_schedule(id) ON DELETE SET NULL,
  commercial_terms_id UUID REFERENCES public.project_commercial_terms(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'CZK' CHECK (currency IN ('CZK', 'UAH', 'EUR', 'USD', 'PLN', 'GBP')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  subtotal_minor BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
  tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor BIGINT NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  paid_minor BIGINT NOT NULL DEFAULT 0 CHECK (paid_minor >= 0),
  outstanding_minor BIGINT NOT NULL DEFAULT 0 CHECK (outstanding_minor >= 0),
  notes TEXT,
  payment_instructions TEXT,
  seller_snapshot JSONB,
  buyer_snapshot JSONB,
  items_snapshot JSONB,
  cancellation_reason TEXT,
  issued_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_invoice_due_date CHECK (due_date >= issue_date),
  CONSTRAINT check_invoice_paid_not_exceed_total CHECK (paid_minor <= total_minor)
);

CREATE INDEX IF NOT EXISTS idx_invoices_org ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_proj ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_currency ON public.invoices(currency);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);

DROP TRIGGER IF EXISTS set_invoices_updated_at ON public.invoices;
CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 4. Invoice Items Table (1..N Line items)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00 CHECK (quantity > 0),
  unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (tax_rate >= 0),
  subtotal_minor BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_minor >= 0),
  tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor BIGINT NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_inv ON public.invoice_items(invoice_id);

DROP TRIGGER IF EXISTS set_invoice_items_updated_at ON public.invoice_items;
CREATE TRIGGER set_invoice_items_updated_at
  BEFORE UPDATE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Extend project_payments with invoice_id
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'project_payments' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE public.project_payments ADD COLUMN invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.project_payments(invoice_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. Invoice Audit Events Table (Strictly Append-Only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'issued', 'sent', 'viewed', 'payment_recorded', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_audit_inv ON public.invoice_audit_events(invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_audit_org ON public.invoice_audit_events(organization_id);

-- -----------------------------------------------------------------------------
-- 7. Triggers & Consistency Functions
-- -----------------------------------------------------------------------------

-- 7.1 Auto-calculate line item subtotals and tax before insert/update
CREATE OR REPLACE FUNCTION public.calculate_invoice_item_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Strict integer minor calculation: subtotal = round(quantity * unit_price_minor)
  NEW.subtotal_minor := ROUND(NEW.quantity * NEW.unit_price_minor)::BIGINT;
  
  -- Tax minor calculation: subtotal * (tax_rate / 100)
  IF NEW.tax_rate > 0 THEN
    NEW.tax_minor := ROUND(NEW.subtotal_minor * (NEW.tax_rate / 100.0))::BIGINT;
  ELSE
    NEW.tax_minor := 0;
  END IF;

  NEW.total_minor := NEW.subtotal_minor + NEW.tax_minor;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_invoice_item ON public.invoice_items;
CREATE TRIGGER trg_calc_invoice_item
  BEFORE INSERT OR UPDATE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_invoice_item_totals();

-- 7.2 Immutability Guard: Prevent editing line items or financials when invoice is not 'draft'
CREATE OR REPLACE FUNCTION public.enforce_invoice_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF TG_TABLE_NAME = 'invoice_items' THEN
    SELECT status INTO v_status FROM public.invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    IF v_status IS NOT NULL AND v_status != 'draft' THEN
      RAISE EXCEPTION 'Cannot modify line items of non-draft invoice (current status: %).', v_status USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'invoices' AND TG_OP = 'UPDATE' THEN
    -- If was already issued/sent/paid, prevent changing financial figures directly without payment mutation
    IF OLD.status != 'draft' AND OLD.status != 'cancelled' THEN
      IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number THEN
        RAISE EXCEPTION 'Cannot modify invoice_number after issue.' USING ERRCODE = '23514';
      END IF;
      IF NEW.currency IS DISTINCT FROM OLD.currency THEN
        RAISE EXCEPTION 'Cannot modify currency of issued invoice.' USING ERRCODE = '23514';
      END IF;
      IF NEW.subtotal_minor IS DISTINCT FROM OLD.subtotal_minor OR NEW.tax_minor IS DISTINCT FROM OLD.tax_minor OR NEW.total_minor IS DISTINCT FROM OLD.total_minor THEN
        RAISE EXCEPTION 'Cannot directly modify subtotal/tax/total of issued invoice.' USING ERRCODE = '23514';
      END IF;
      IF NEW.seller_snapshot IS DISTINCT FROM OLD.seller_snapshot OR NEW.buyer_snapshot IS DISTINCT FROM OLD.buyer_snapshot OR NEW.items_snapshot IS DISTINCT FROM OLD.items_snapshot THEN
        RAISE EXCEPTION 'Cannot alter historical snapshot of issued invoice.' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_items_immutability ON public.invoice_items;
CREATE TRIGGER trg_enforce_invoice_items_immutability
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invoice_immutability();

DROP TRIGGER IF EXISTS trg_enforce_invoices_immutability ON public.invoices;
CREATE TRIGGER trg_enforce_invoices_immutability
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invoice_immutability();

-- 7.3 Recalculate Invoice Aggregates when items change (for Draft invoices)
CREATE OR REPLACE FUNCTION public.sync_invoice_totals_from_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv_id UUID;
  v_subtotal BIGINT;
  v_tax BIGINT;
  v_total BIGINT;
  v_status TEXT;
BEGIN
  v_inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT status INTO v_status FROM public.invoices WHERE id = v_inv_id;
  IF v_status = 'draft' THEN
    SELECT 
      COALESCE(SUM(subtotal_minor), 0),
      COALESCE(SUM(tax_minor), 0),
      COALESCE(SUM(total_minor), 0)
    INTO v_subtotal, v_tax, v_total
    FROM public.invoice_items
    WHERE invoice_id = v_inv_id;

    UPDATE public.invoices
    SET subtotal_minor = v_subtotal,
        tax_minor = v_tax,
        total_minor = v_total,
        outstanding_minor = v_total - paid_minor
    WHERE id = v_inv_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_totals ON public.invoice_items;
CREATE TRIGGER trg_sync_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_invoice_totals_from_items();

-- 7.4 Comprehensive Payment Mutation & Synchronization
CREATE OR REPLACE FUNCTION public.handle_payment_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_schedule_id UUID;
  v_invoice_id UUID;
  v_total_paid BIGINT;
  v_target_amount BIGINT;
  v_due_date DATE;
  v_current_status TEXT;
  v_new_status TEXT;
  v_inv_total BIGINT;
  v_inv_paid BIGINT;
  v_inv_curr TEXT;
  v_inv_status TEXT;
  v_inv_due DATE;
  v_inv_org UUID;
  v_inv_proj UUID;
  v_inv_sched UUID;
  v_inv_num TEXT;
  v_inv_new_status TEXT;
  v_actor UUID;
  v_owner_id UUID;
  rec RECORD;
BEGIN
  v_schedule_id := COALESCE(NEW.payment_schedule_id, OLD.payment_schedule_id);
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  v_actor := auth.uid();

  -- 1. Sync Invoice if payment linked to invoice
  IF v_invoice_id IS NOT NULL THEN
    SELECT total_minor, currency, status, due_date, organization_id, project_id, payment_schedule_id, invoice_number
    INTO v_inv_total, v_inv_curr, v_inv_status, v_inv_due, v_inv_org, v_inv_proj, v_inv_sched, v_inv_num
    FROM public.invoices
    WHERE id = v_invoice_id;

    IF v_inv_total IS NULL THEN
      RAISE EXCEPTION 'Referenced invoice does not exist.' USING ERRCODE = '23503';
    END IF;

    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
      IF NEW.organization_id != v_inv_org THEN
        RAISE EXCEPTION 'Tenant mismatch: payment organization % does not match invoice organization %',
          NEW.organization_id, v_inv_org USING ERRCODE = '23514';
      END IF;

      IF NEW.project_id != v_inv_proj THEN
        RAISE EXCEPTION 'Project mismatch: payment project % does not match invoice project %',
          NEW.project_id, v_inv_proj USING ERRCODE = '23514';
      END IF;

      IF NEW.currency != v_inv_curr THEN
        RAISE EXCEPTION 'Currency mismatch: payment currency % does not match invoice currency %',
          NEW.currency, v_inv_curr USING ERRCODE = '23514';
      END IF;
    END IF;

    -- If payment did not specify schedule_id but invoice is linked to a tranche, sync that tranche as well
    IF v_schedule_id IS NULL AND v_inv_sched IS NOT NULL THEN
      v_schedule_id := v_inv_sched;
    END IF;

    -- Calculate total paid towards this invoice
    SELECT COALESCE(SUM(amount_minor), 0) INTO v_inv_paid
    FROM public.project_payments
    WHERE invoice_id = v_invoice_id;

    -- Overpayment guard: payment cannot exceed total
    IF v_inv_paid > v_inv_total THEN
      RAISE EXCEPTION 'Overpayment denied: total payments (%) exceed invoice total (%) by %',
        v_inv_paid, v_inv_total, (v_inv_paid - v_inv_total) USING ERRCODE = '23514';
    END IF;

    -- Determine new invoice status
    IF v_inv_paid >= v_inv_total THEN
      v_inv_new_status := 'paid';
    ELSIF v_inv_paid > 0 THEN
      v_inv_new_status := 'partially_paid';
    ELSE
      IF CURRENT_DATE > v_inv_due THEN
        v_inv_new_status := 'overdue';
      ELSE
        v_inv_new_status := 'issued';
      END IF;
    END IF;

    UPDATE public.invoices
    SET paid_minor = v_inv_paid,
        outstanding_minor = v_inv_total - v_inv_paid,
        status = v_inv_new_status,
        paid_at = CASE WHEN v_inv_new_status = 'paid' THEN NOW() ELSE NULL END
    WHERE id = v_invoice_id;

    -- Audit log for payment on invoice
    INSERT INTO public.invoice_audit_events (
      organization_id, project_id, invoice_id, action, actor_user_id,
      old_values, new_values, metadata
    ) VALUES (
      COALESCE(NEW.organization_id, OLD.organization_id),
      COALESCE(NEW.project_id, OLD.project_id),
      v_invoice_id,
      CASE WHEN v_inv_new_status = 'paid' THEN 'paid' ELSE 'payment_recorded' END,
      v_actor,
      jsonb_build_object('status', v_inv_status, 'paid_minor', v_inv_paid - COALESCE(NEW.amount_minor, 0)),
      jsonb_build_object('status', v_inv_new_status, 'paid_minor', v_inv_paid, 'payment_id', COALESCE(NEW.id, OLD.id)),
      jsonb_build_object('trigger', 'handle_payment_mutation')
    );

    -- Notify client members on payment received
    FOR rec IN
      SELECT m.user_id
      FROM public.organization_memberships m
      WHERE m.organization_id = COALESCE(NEW.organization_id, OLD.organization_id)
        AND m.is_active = true
        AND m.org_role = 'client'
    LOOP
      INSERT INTO public.notifications (
        recipient_user_id, organization_id, project_id, event_type, severity,
        title, message, entity_type, entity_id, deep_link, dedupe_key, metadata
      ) VALUES (
        rec.user_id, COALESCE(NEW.organization_id, OLD.organization_id), COALESCE(NEW.project_id, OLD.project_id),
        CASE WHEN v_inv_new_status = 'paid' THEN 'invoice_paid' ELSE 'invoice_partially_paid' END,
        'success',
        CASE WHEN v_inv_new_status = 'paid' THEN 'Рахунок оплачено повністю' ELSE 'Зафіксовано часткову оплату рахунку' END,
        'Отримано платіж на суму ' || ROUND(COALESCE(NEW.amount_minor, 0) / 100.0, 2)::TEXT || ' ' || v_inv_curr || ' за рахунком ' || COALESCE(v_inv_num, '') || '.',
        'invoice', v_invoice_id, '#/client/billing/' || v_invoice_id::TEXT,
        'inv_pay_' || COALESCE(NEW.id::TEXT, gen_random_uuid()::TEXT) || '_' || rec.user_id::TEXT,
        jsonb_build_object('invoice_id', v_invoice_id, 'paid_amount_minor', NEW.amount_minor, 'total_paid_minor', v_inv_paid)
      ) ON CONFLICT (dedupe_key) DO NOTHING;
    END LOOP;
  END IF;

  -- 2. Sync Payment Schedule tranche if linked
  IF v_schedule_id IS NOT NULL THEN
    SELECT amount_minor, due_date, status INTO v_target_amount, v_due_date, v_current_status
    FROM public.project_payment_schedule
    WHERE id = v_schedule_id;

    IF v_target_amount IS NOT NULL THEN
      SELECT COALESCE(SUM(amount_minor), 0) INTO v_total_paid
      FROM public.project_payments
      WHERE payment_schedule_id = v_schedule_id
         OR invoice_id IN (SELECT id FROM public.invoices WHERE payment_schedule_id = v_schedule_id);

      IF v_total_paid > v_target_amount THEN
        RAISE EXCEPTION 'Overpayment denied: total payments (%) exceed tranche amount (%) by %',
          v_total_paid, v_target_amount, (v_total_paid - v_target_amount) USING ERRCODE = '23514';
      END IF;

      IF v_total_paid >= v_target_amount THEN
        v_new_status := 'paid';
      ELSIF v_total_paid > 0 THEN
        v_new_status := 'partially_paid';
      ELSE
        IF CURRENT_DATE > v_due_date THEN
          v_new_status := 'overdue';
        ELSE
          v_new_status := 'planned';
        END IF;
      END IF;

      IF v_current_status IS DISTINCT FROM v_new_status THEN
        UPDATE public.project_payment_schedule
        SET status = v_new_status,
            updated_at = NOW()
        WHERE id = v_schedule_id;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_payment_mutation ON public.project_payments;
CREATE TRIGGER trg_handle_payment_mutation
  AFTER INSERT OR UPDATE OR DELETE ON public.project_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_payment_mutation();

-- -----------------------------------------------------------------------------
-- 8. RPC Functions for Invoice Lifecycle
-- -----------------------------------------------------------------------------

-- 8.1 Issue Invoice (Draft -> Issued)
CREATE OR REPLACE FUNCTION public.issue_invoice(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv RECORD;
  v_seller RECORD;
  v_org RECORD;
  v_contact RECORD;
  v_items JSONB;
  v_inv_number TEXT;
  v_seller_snap JSONB;
  v_buyer_snap JSONB;
  v_actor UUID;
  rec RECORD;
BEGIN
  v_actor := auth.uid();

  -- Fetch invoice
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be issued (current status: %).', v_inv.status USING ERRCODE = '23514';
  END IF;

  IF v_inv.total_minor <= 0 THEN
    RAISE EXCEPTION 'Cannot issue invoice with 0 total. Please add line items.' USING ERRCODE = '23514';
  END IF;

  -- Generate atomic sequential invoice number if not already assigned
  IF v_inv.invoice_number IS NULL THEN
    v_inv_number := public.generate_invoice_number(EXTRACT(YEAR FROM v_inv.issue_date)::INTEGER);
  ELSE
    v_inv_number := v_inv.invoice_number;
  END IF;

  -- Build Seller Snapshot
  IF v_inv.billing_profile_id IS NOT NULL THEN
    SELECT * INTO v_seller FROM public.billing_profiles WHERE id = v_inv.billing_profile_id;
  ELSE
    SELECT * INTO v_seller FROM public.billing_profiles WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
  END IF;

  v_seller_snap := jsonb_build_object(
    'billing_profile_id', v_seller.id,
    'name', v_seller.name,
    'legal_name', v_seller.legal_name,
    'country', v_seller.country,
    'registration_number', v_seller.registration_number,
    'tax_id', v_seller.tax_id,
    'vat_number', v_seller.vat_number,
    'legal_address', v_seller.legal_address,
    'billing_email', v_seller.billing_email,
    'phone', v_seller.phone,
    'bank_name', v_seller.bank_name,
    'bank_account', v_seller.bank_account,
    'iban', v_seller.iban,
    'swift', v_seller.swift,
    'payment_instructions', COALESCE(v_inv.payment_instructions, v_seller.payment_instructions)
  );

  -- Build Buyer Snapshot
  SELECT name INTO v_org FROM public.organizations WHERE id = v_inv.organization_id;
  SELECT first_name, last_name, email, phone INTO v_contact FROM public.contacts WHERE organization_id = v_inv.organization_id ORDER BY is_primary DESC, created_at ASC LIMIT 1;

  v_buyer_snap := jsonb_build_object(
    'organization_id', v_inv.organization_id,
    'organization_name', v_org.name,
    'billing_email', v_contact.email,
    'address', NULL,
    'contact_name', CASE WHEN v_contact.first_name IS NOT NULL THEN v_contact.first_name || ' ' || COALESCE(v_contact.last_name, '') ELSE NULL END,
    'contact_email', v_contact.email,
    'contact_phone', v_contact.phone
  );

  -- Build Items Snapshot
  SELECT jsonb_agg(
    jsonb_build_object(
      'description', description,
      'quantity', quantity,
      'unit_price_minor', unit_price_minor,
      'tax_rate', tax_rate,
      'subtotal_minor', subtotal_minor,
      'tax_minor', tax_minor,
      'total_minor', total_minor,
      'sort_order', sort_order
    ) ORDER BY sort_order ASC
  ) INTO v_items
  FROM public.invoice_items
  WHERE invoice_id = p_invoice_id;

  -- Perform Issue Update
  UPDATE public.invoices
  SET invoice_number = v_inv_number,
      billing_profile_id = COALESCE(v_inv.billing_profile_id, v_seller.id),
      seller_snapshot = v_seller_snap,
      buyer_snapshot = v_buyer_snap,
      items_snapshot = v_items,
      status = 'issued',
      issued_at = NOW(),
      outstanding_minor = total_minor - paid_minor,
      updated_at = NOW()
  WHERE id = p_invoice_id;

  -- Audit Log
  INSERT INTO public.invoice_audit_events (
    organization_id, project_id, invoice_id, action, actor_user_id,
    old_values, new_values, metadata
  ) VALUES (
    v_inv.organization_id, v_inv.project_id, p_invoice_id, 'issued', v_actor,
    jsonb_build_object('status', 'draft'),
    jsonb_build_object('status', 'issued', 'invoice_number', v_inv_number, 'total_minor', v_inv.total_minor),
    jsonb_build_object('issued_by', v_actor)
  );

  -- Send invoice_issued notification to client members of the organization
  FOR rec IN
    SELECT m.user_id
    FROM public.organization_memberships m
    WHERE m.organization_id = v_inv.organization_id
      AND m.is_active = true
      AND m.org_role = 'client'
  LOOP
    INSERT INTO public.notifications (
      recipient_user_id, organization_id, project_id, event_type, severity,
      title, message, entity_type, entity_id, deep_link, dedupe_key, metadata
    ) VALUES (
      rec.user_id, v_inv.organization_id, v_inv.project_id, 'invoice_issued', 'info',
      'Виставлено новий рахунок: ' || v_inv_number,
      'Вам виставлено рахунок ' || v_inv_number || ' на суму ' ||
        ROUND(v_inv.total_minor / 100.0, 2)::TEXT || ' ' || v_inv.currency || ' (термін оплати: ' || to_char(v_inv.due_date, 'DD.MM.YYYY') || ').',
      'invoice', p_invoice_id, '#/client/billing/' || p_invoice_id::TEXT,
      'inv_issued_' || p_invoice_id::TEXT || '_' || rec.user_id::TEXT,
      jsonb_build_object('invoice_id', p_invoice_id, 'invoice_number', v_inv_number, 'total_minor', v_inv.total_minor, 'currency', v_inv.currency)
    ) ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'invoice_number', v_inv_number,
    'status', 'issued'
  );
END;
$$;

-- 8.2 Mark Invoice Sent
CREATE OR REPLACE FUNCTION public.mark_invoice_sent(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv RECORD;
  v_actor UUID;
BEGIN
  v_actor := auth.uid();
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.status NOT IN ('issued', 'viewed') THEN
    RAISE EXCEPTION 'Cannot mark invoice as sent in status %.', v_inv.status USING ERRCODE = '23514';
  END IF;

  UPDATE public.invoices
  SET status = 'sent',
      sent_at = NOW(),
      updated_at = NOW()
  WHERE id = p_invoice_id;

  INSERT INTO public.invoice_audit_events (
    organization_id, project_id, invoice_id, action, actor_user_id,
    old_values, new_values, metadata
  ) VALUES (
    v_inv.organization_id, v_inv.project_id, p_invoice_id, 'sent', v_actor,
    jsonb_build_object('status', v_inv.status),
    jsonb_build_object('status', 'sent', 'sent_at', NOW()),
    '{}'::jsonb
  );

  RETURN jsonb_build_object('success', true, 'status', 'sent');
END;
$$;

-- 8.3 Mark Invoice Viewed (Client opened)
CREATE OR REPLACE FUNCTION public.mark_invoice_viewed(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv RECORD;
  v_actor UUID;
BEGIN
  v_actor := auth.uid();
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Only transition if issued or sent, and not already paid/partially_paid
  IF v_inv.status IN ('issued', 'sent') THEN
    UPDATE public.invoices
    SET status = 'viewed',
        viewed_at = COALESCE(viewed_at, NOW()),
        updated_at = NOW()
    WHERE id = p_invoice_id;

    INSERT INTO public.invoice_audit_events (
      organization_id, project_id, invoice_id, action, actor_user_id,
      old_values, new_values, metadata
    ) VALUES (
      v_inv.organization_id, v_inv.project_id, p_invoice_id, 'viewed', v_actor,
      jsonb_build_object('status', v_inv.status),
      jsonb_build_object('status', 'viewed', 'viewed_at', NOW()),
      '{}'::jsonb
    );
  ELSIF v_inv.viewed_at IS NULL THEN
    UPDATE public.invoices SET viewed_at = NOW() WHERE id = p_invoice_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'viewed');
END;
$$;

-- 8.4 Cancel Invoice
CREATE OR REPLACE FUNCTION public.cancel_invoice(p_invoice_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv RECORD;
  v_actor UUID;
BEGIN
  v_actor := auth.uid();
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.status = 'paid' THEN
    RAISE EXCEPTION 'Cannot cancel a fully paid invoice. Please process a refund or credit note.' USING ERRCODE = '23514';
  END IF;

  IF v_inv.paid_minor > 0 THEN
    RAISE EXCEPTION 'Cannot cancel an invoice with recorded payments. Please unapply payments first.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.invoices
  SET status = 'cancelled',
      cancellation_reason = p_reason,
      cancelled_at = NOW(),
      outstanding_minor = 0,
      updated_at = NOW()
  WHERE id = p_invoice_id;

  INSERT INTO public.invoice_audit_events (
    organization_id, project_id, invoice_id, action, actor_user_id,
    old_values, new_values, metadata
  ) VALUES (
    v_inv.organization_id, v_inv.project_id, p_invoice_id, 'cancelled', v_actor,
    jsonb_build_object('status', v_inv.status),
    jsonb_build_object('status', 'cancelled', 'cancellation_reason', p_reason),
    jsonb_build_object('cancelled_by', v_actor)
  );

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. Notification Evaluator Extension (Invoices & Payment Requests)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_notifications()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted_count INTEGER := 0;
  v_owner_id UUID;
  rec RECORD;
BEGIN
  -- Determine Owner user id
  SELECT id INTO v_owner_id FROM public.profiles WHERE global_role = 'owner' ORDER BY created_at ASC LIMIT 1;

  -- 1. Invoice Overdue Notifications
  FOR rec IN
    SELECT 
      i.id AS invoice_id,
      i.invoice_number,
      i.organization_id,
      i.project_id,
      i.currency,
      i.outstanding_minor,
      i.due_date,
      p.title AS project_title,
      o.name AS org_name
    FROM public.invoices i
    JOIN public.projects p ON p.id = i.project_id
    JOIN public.organizations o ON o.id = i.organization_id
    WHERE i.status IN ('issued', 'sent', 'viewed', 'partially_paid', 'overdue')
      AND i.due_date < CURRENT_DATE
      AND i.outstanding_minor > 0
  LOOP
    -- Update invoice status to overdue if not already
    UPDATE public.invoices SET status = 'overdue' WHERE id = rec.invoice_id AND status != 'overdue';

    -- Notify Owner
    IF v_owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_user_id, organization_id, project_id, event_type, severity,
        title, message, entity_type, entity_id, deep_link, dedupe_key, metadata
      ) VALUES (
        v_owner_id, rec.organization_id, rec.project_id, 'invoice_overdue', 'critical',
        'Прострочений рахунок ' || COALESCE(rec.invoice_number, 'б/н'),
        'Рахунок ' || COALESCE(rec.invoice_number, '') || ' для «' || rec.org_name || '» прострочено на суму ' ||
          ROUND(rec.outstanding_minor / 100.0, 2)::TEXT || ' ' || rec.currency || ' (термін: ' || to_char(rec.due_date, 'DD.MM.YYYY') || ').',
        'invoice', rec.invoice_id, '#/portal/invoices/' || rec.invoice_id::TEXT,
        'inv_overdue_' || rec.invoice_id::TEXT || '_' || CURRENT_DATE::TEXT,
        jsonb_build_object('invoice_id', rec.invoice_id, 'outstanding_minor', rec.outstanding_minor, 'currency', rec.currency)
      ) ON CONFLICT (dedupe_key) DO NOTHING;
      IF FOUND THEN v_inserted_count := v_inserted_count + 1; END IF;
    END IF;
  END LOOP;

  -- 2. Invoice Due Soon (Due in 3 days)
  FOR rec IN
    SELECT 
      i.id AS invoice_id,
      i.invoice_number,
      i.organization_id,
      i.project_id,
      i.currency,
      i.outstanding_minor,
      i.due_date,
      p.title AS project_title,
      o.name AS org_name
    FROM public.invoices i
    JOIN public.projects p ON p.id = i.project_id
    JOIN public.organizations o ON o.id = i.organization_id
    WHERE i.status IN ('issued', 'sent', 'viewed')
      AND i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
      AND i.outstanding_minor > 0
  LOOP
    IF v_owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_user_id, organization_id, project_id, event_type, severity,
        title, message, entity_type, entity_id, deep_link, dedupe_key, metadata
      ) VALUES (
        v_owner_id, rec.organization_id, rec.project_id, 'invoice_due_soon', 'warning',
        'Наближається оплата рахунку ' || COALESCE(rec.invoice_number, 'б/н'),
        'Очікується оплата рахунку ' || COALESCE(rec.invoice_number, '') || ' від «' || rec.org_name || '» до ' ||
          to_char(rec.due_date, 'DD.MM.YYYY') || ' (' || ROUND(rec.outstanding_minor / 100.0, 2)::TEXT || ' ' || rec.currency || ').',
        'invoice', rec.invoice_id, '#/portal/invoices/' || rec.invoice_id::TEXT,
        'inv_due_soon_' || rec.invoice_id::TEXT || '_' || CURRENT_DATE::TEXT,
        jsonb_build_object('invoice_id', rec.invoice_id, 'due_date', rec.due_date)
      ) ON CONFLICT (dedupe_key) DO NOTHING;
      IF FOUND THEN v_inserted_count := v_inserted_count + 1; END IF;
    END IF;
  END LOOP;

  -- 3. Overdue Tranche Evaluation (Existing Phase 5C.1 rule)
  FOR rec IN
    SELECT s.id, s.title, s.project_id, s.organization_id, s.amount_minor, s.currency, s.due_date, p.title AS project_title
    FROM public.project_payment_schedule s
    JOIN public.projects p ON p.id = s.project_id
    WHERE s.status IN ('planned', 'due')
      AND s.due_date < CURRENT_DATE
  LOOP
    UPDATE public.project_payment_schedule SET status = 'overdue' WHERE id = rec.id;
    IF v_owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_user_id, organization_id, project_id, event_type, severity,
        title, message, entity_type, entity_id, deep_link, dedupe_key, metadata
      ) VALUES (
        v_owner_id, rec.organization_id, rec.project_id, 'payment_overdue', 'critical',
        'Прострочений платіж: ' || rec.title,
        'Платіж за графіком «' || rec.title || '» у проєкті «' || rec.project_title || '» прострочено на ' ||
          ROUND(rec.amount_minor / 100.0, 2)::TEXT || ' ' || rec.currency || '.',
        'payment_schedule', rec.id, '#/portal/projects/' || rec.project_id::TEXT,
        'sched_overdue_' || rec.id::TEXT || '_' || CURRENT_DATE::TEXT,
        jsonb_build_object('schedule_id', rec.id, 'amount_minor', rec.amount_minor, 'currency', rec.currency)
      ) ON CONFLICT (dedupe_key) DO NOTHING;
      IF FOUND THEN v_inserted_count := v_inserted_count + 1; END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'inserted_notifications', v_inserted_count);
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. Row-Level Security (RLS) Policies
-- -----------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_audit_events ENABLE ROW LEVEL SECURITY;

-- 10.1 Billing Profiles RLS
DROP POLICY IF EXISTS "billing_profiles_owner_all" ON public.billing_profiles;
CREATE POLICY "billing_profiles_owner_all" ON public.billing_profiles
  FOR ALL TO authenticated
  USING (public.is_global_owner())
  WITH CHECK (public.is_global_owner());

DROP POLICY IF EXISTS "billing_profiles_internal_select" ON public.billing_profiles;
CREATE POLICY "billing_profiles_internal_select" ON public.billing_profiles
  FOR SELECT TO authenticated
  USING (
    is_active = true AND (
      public.is_global_owner()
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role IN ('admin', 'team_member', 'consultant'))
    )
  );

-- 10.2 Invoice Sequences RLS (Owner only for direct, RPC uses security definer)
DROP POLICY IF EXISTS "invoice_sequences_owner_all" ON public.invoice_sequences;
CREATE POLICY "invoice_sequences_owner_all" ON public.invoice_sequences
  FOR ALL TO authenticated
  USING (public.is_global_owner())
  WITH CHECK (public.is_global_owner());

-- 10.3 Invoices RLS
DROP POLICY IF EXISTS "invoices_owner_all" ON public.invoices;
CREATE POLICY "invoices_owner_all" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_global_owner())
  WITH CHECK (public.is_global_owner());

DROP POLICY IF EXISTS "invoices_pm_org_select" ON public.invoices;
CREATE POLICY "invoices_pm_org_select" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    public.is_global_owner()
    OR public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "invoices_pm_org_insert" ON public.invoices;
CREATE POLICY "invoices_pm_org_insert" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_global_owner() OR public.is_org_admin(organization_id))
    AND status = 'draft'
  );

DROP POLICY IF EXISTS "invoices_client_select" ON public.invoices;
CREATE POLICY "invoices_client_select" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    status != 'draft' AND (
      public.is_active_client_user(organization_id)
      OR public.can_client_access_project(project_id)
    )
  );

-- 10.4 Invoice Items RLS
DROP POLICY IF EXISTS "invoice_items_owner_all" ON public.invoice_items;
CREATE POLICY "invoice_items_owner_all" ON public.invoice_items
  FOR ALL TO authenticated
  USING (public.is_global_owner())
  WITH CHECK (public.is_global_owner());

DROP POLICY IF EXISTS "invoice_items_pm_select" ON public.invoice_items;
CREATE POLICY "invoice_items_pm_select" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND (public.is_global_owner() OR public.is_org_admin(i.organization_id))
    )
  );

DROP POLICY IF EXISTS "invoice_items_pm_draft_insert" ON public.invoice_items;
CREATE POLICY "invoice_items_pm_draft_insert" ON public.invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.status = 'draft'
        AND (public.is_global_owner() OR public.is_org_admin(i.organization_id))
    )
  );

DROP POLICY IF EXISTS "invoice_items_client_select" ON public.invoice_items;
CREATE POLICY "invoice_items_client_select" ON public.invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND i.status != 'draft'
        AND (
          public.is_active_client_user(i.organization_id)
          OR public.can_client_access_project(i.project_id)
        )
    )
  );

-- 10.5 Invoice Audit Events RLS (Strictly Append-Only & Owner/PM Select)
DROP POLICY IF EXISTS "inv_audit_owner_select" ON public.invoice_audit_events;
CREATE POLICY "inv_audit_owner_select" ON public.invoice_audit_events
  FOR SELECT TO authenticated
  USING (public.is_global_owner());

DROP POLICY IF EXISTS "inv_audit_pm_select" ON public.invoice_audit_events;
CREATE POLICY "inv_audit_pm_select" ON public.invoice_audit_events
  FOR SELECT TO authenticated
  USING (
    public.is_global_owner()
    OR public.is_org_admin(organization_id)
  );

-- Block direct UPDATE or unauthorized DELETE on invoice_audit_events
CREATE OR REPLACE FUNCTION public.block_invoice_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Direct UPDATE on invoice_audit_events is strictly prohibited.' USING ERRCODE = '42501';
  ELSIF TG_OP = 'DELETE' THEN
    -- Prevent direct delete by non-owners
    IF auth.uid() IS NOT NULL AND NOT public.is_global_owner() THEN
      RAISE EXCEPTION 'Direct DELETE on invoice_audit_events is strictly prohibited.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_inv_audit_update_delete ON public.invoice_audit_events;
CREATE TRIGGER trg_block_inv_audit_update_delete
  BEFORE UPDATE OR DELETE ON public.invoice_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.block_invoice_audit_mutation();
