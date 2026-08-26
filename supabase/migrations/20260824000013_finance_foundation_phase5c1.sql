-- FIRSTWIN Client Portal — Phase 5C.1: Finance Foundation, Project Economics & Payment Tracking
-- Target: PostgreSQL / Supabase with Hardened Row-Level Security (RLS)

-- -----------------------------------------------------------------------------
-- 1. Commercial Terms Table (1 active terms record per project)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_commercial_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'CZK' CHECK (currency IN ('CZK', 'UAH', 'EUR', 'USD', 'PLN', 'GBP')),
  contract_value_minor BIGINT NOT NULL DEFAULT 0 CHECK (contract_value_minor >= 0),
  commercial_model TEXT NOT NULL DEFAULT 'fixed_fee' CHECK (commercial_model IN ('fixed_fee', 'retainer', 'milestone_based', 'hourly', 'custom')),
  contract_status TEXT NOT NULL DEFAULT 'draft' CHECK (contract_status IN ('draft', 'proposed', 'active', 'completed', 'cancelled')),
  contract_number TEXT,
  contract_date DATE,
  contract_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  payment_terms_text TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_terms_org ON public.project_commercial_terms(organization_id);
CREATE INDEX IF NOT EXISTS idx_commercial_terms_proj ON public.project_commercial_terms(project_id);

-- -----------------------------------------------------------------------------
-- 2. Payment Schedule Table (Tranches / Installments)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_payment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  commercial_terms_id UUID REFERENCES public.project_commercial_terms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'CZK' CHECK (currency IN ('CZK', 'UAH', 'EUR', 'USD', 'PLN', 'GBP')),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'due', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_schedule_proj ON public.project_payment_schedule(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_org ON public.project_payment_schedule(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_due ON public.project_payment_schedule(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_schedule_status ON public.project_payment_schedule(status);

-- -----------------------------------------------------------------------------
-- 3. Payments Table (Actual Received Funds)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  payment_schedule_id UUID REFERENCES public.project_payment_schedule(id) ON DELETE SET NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'CZK' CHECK (currency IN ('CZK', 'UAH', 'EUR', 'USD', 'PLN', 'GBP')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'card', 'cash', 'crypto', 'other')),
  reference TEXT,
  comment TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_proj ON public.project_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON public.project_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_schedule ON public.project_payments(payment_schedule_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.project_payments(paid_at DESC);

-- -----------------------------------------------------------------------------
-- 4. Costs Table (Internal FIRSTWIN Delivery Costs — Owner Only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'specialist' CHECK (category IN ('specialist', 'software', 'contractor', 'marketing', 'travel', 'infrastructure', 'other')),
  title TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL DEFAULT 'CZK' CHECK (currency IN ('CZK', 'UAH', 'EUR', 'USD', 'PLN', 'GBP')),
  cost_type TEXT NOT NULL DEFAULT 'planned' CHECK (cost_type IN ('planned', 'actual')),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('planned', 'approved', 'incurred', 'paid', 'cancelled')),
  incurred_at DATE,
  vendor_or_recipient TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_costs_proj ON public.project_costs(project_id);
CREATE INDEX IF NOT EXISTS idx_costs_org ON public.project_costs(organization_id);
CREATE INDEX IF NOT EXISTS idx_costs_category ON public.project_costs(category);
CREATE INDEX IF NOT EXISTS idx_costs_type ON public.project_costs(cost_type);

-- -----------------------------------------------------------------------------
-- 5. Financial Audit Events Table (Append-Only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('commercial_terms', 'payment_schedule', 'payment', 'cost')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'cancelled', 'payment_recorded', 'deleted')),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_audit_proj ON public.finance_audit_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_audit_org ON public.finance_audit_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_finance_audit_entity ON public.finance_audit_events(entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- 6. Updated At Triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_commercial_terms_updated_at ON public.project_commercial_terms;
CREATE TRIGGER set_commercial_terms_updated_at
  BEFORE UPDATE ON public.project_commercial_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_payment_schedule_updated_at ON public.project_payment_schedule;
CREATE TRIGGER set_payment_schedule_updated_at
  BEFORE UPDATE ON public.project_payment_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_costs_updated_at ON public.project_costs;
CREATE TRIGGER set_costs_updated_at
  BEFORE UPDATE ON public.project_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 7. Consistency & Validation Triggers
-- -----------------------------------------------------------------------------

-- 7.1 Validate project organization consistency & currency matching
CREATE OR REPLACE FUNCTION public.validate_finance_entity_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proj_org_id UUID;
  v_sched_proj_id UUID;
  v_sched_curr TEXT;
  v_doc_proj_id UUID;
BEGIN
  -- Validate project_id belongs to organization_id
  SELECT organization_id INTO v_proj_org_id
  FROM public.projects
  WHERE id = NEW.project_id;

  IF v_proj_org_id IS NULL THEN
    RAISE EXCEPTION 'Referenced project does not exist.' USING ERRCODE = '23503';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM v_proj_org_id THEN
    NEW.organization_id := v_proj_org_id;
  END IF;

  -- Validate payment_schedule_id on project_payments
  IF TG_TABLE_NAME = 'project_payments' AND NEW.payment_schedule_id IS NOT NULL THEN
    SELECT project_id, currency INTO v_sched_proj_id, v_sched_curr
    FROM public.project_payment_schedule
    WHERE id = NEW.payment_schedule_id;

    IF v_sched_proj_id IS NULL THEN
      RAISE EXCEPTION 'Referenced payment schedule tranche does not exist.' USING ERRCODE = '23503';
    END IF;

    IF v_sched_proj_id != NEW.project_id THEN
      RAISE EXCEPTION 'Cross-project payment link denied: payment schedule belongs to project % but payment is for project %',
        v_sched_proj_id, NEW.project_id USING ERRCODE = '23514';
    END IF;

    IF v_sched_curr != NEW.currency THEN
      RAISE EXCEPTION 'Currency mismatch: payment currency % does not match schedule currency %',
        NEW.currency, v_sched_curr USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Validate contract_document_id on project_commercial_terms
  IF TG_TABLE_NAME = 'project_commercial_terms' AND NEW.contract_document_id IS NOT NULL THEN
    SELECT project_id INTO v_doc_proj_id
    FROM public.documents
    WHERE id = NEW.contract_document_id;

    IF v_doc_proj_id IS NOT NULL AND v_doc_proj_id != NEW.project_id THEN
      RAISE EXCEPTION 'Contract document must belong to the same project.' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_commercial_terms_consistency ON public.project_commercial_terms;
CREATE TRIGGER trg_validate_commercial_terms_consistency
  BEFORE INSERT OR UPDATE ON public.project_commercial_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_finance_entity_consistency();

DROP TRIGGER IF EXISTS trg_validate_payment_schedule_consistency ON public.project_payment_schedule;
CREATE TRIGGER trg_validate_payment_schedule_consistency
  BEFORE INSERT OR UPDATE ON public.project_payment_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_finance_entity_consistency();

DROP TRIGGER IF EXISTS trg_validate_payments_consistency ON public.project_payments;
CREATE TRIGGER trg_validate_payments_consistency
  BEFORE INSERT OR UPDATE ON public.project_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_finance_entity_consistency();

DROP TRIGGER IF EXISTS trg_validate_costs_consistency ON public.project_costs;
CREATE TRIGGER trg_validate_costs_consistency
  BEFORE INSERT OR UPDATE ON public.project_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_finance_entity_consistency();

-- 7.2 Payment Schedule Status Synchronization & Overpayment Protection
CREATE OR REPLACE FUNCTION public.handle_payment_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_schedule_id UUID;
  v_total_paid BIGINT;
  v_target_amount BIGINT;
  v_due_date DATE;
  v_current_status TEXT;
  v_new_status TEXT;
  v_proj_name TEXT;
  v_org_name TEXT;
  v_owner_id UUID;
  v_pm_id UUID;
BEGIN
  v_schedule_id := COALESCE(NEW.payment_schedule_id, OLD.payment_schedule_id);

  IF v_schedule_id IS NOT NULL THEN
    -- Get schedule tranche details
    SELECT amount_minor, due_date, status INTO v_target_amount, v_due_date, v_current_status
    FROM public.project_payment_schedule
    WHERE id = v_schedule_id;

    IF v_target_amount IS NOT NULL AND v_current_status != 'cancelled' THEN
      -- Calculate sum of all payments for this tranche
      SELECT COALESCE(SUM(amount_minor), 0) INTO v_total_paid
      FROM public.project_payments
      WHERE payment_schedule_id = v_schedule_id;

      -- Overpayment validation
      IF v_total_paid > v_target_amount THEN
        RAISE EXCEPTION 'Payment exceeds remaining tranche amount (Total: %, Tranche: %). Overpayment is not permitted.',
          v_total_paid, v_target_amount USING ERRCODE = '23514';
      END IF;

      -- Derive status
      IF v_total_paid >= v_target_amount THEN
        v_new_status := 'paid';
      ELSIF v_total_paid > 0 THEN
        v_new_status := 'partially_paid';
      ELSE
        IF v_due_date < CURRENT_DATE THEN
          v_new_status := 'overdue';
        ELSE
          v_new_status := 'planned';
        END IF;
      END IF;

      -- Update tranche status if changed
      IF v_new_status != v_current_status THEN
        UPDATE public.project_payment_schedule
        SET status = v_new_status, updated_at = NOW()
        WHERE id = v_schedule_id;
      END IF;
    END IF;
  END IF;

  -- Audit event logging for payment
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.finance_audit_events (
      organization_id, project_id, entity_type, entity_id, action, actor_user_id, new_values, metadata
    ) VALUES (
      NEW.organization_id, NEW.project_id, 'payment', NEW.id, 'payment_recorded',
      COALESCE(auth.uid(), NEW.created_by),
      to_jsonb(NEW),
      jsonb_build_object('amount_minor', NEW.amount_minor, 'currency', NEW.currency, 'payment_method', NEW.payment_method)
    );

    -- Trigger Notification on Payment Received
    SELECT p.name, o.name, p.responsible_pm_id
    INTO v_proj_name, v_org_name, v_pm_id
    FROM public.projects p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE p.id = NEW.project_id;

    -- Find Owner ID
    SELECT id INTO v_owner_id FROM public.profiles WHERE global_role = 'owner' LIMIT 1;

    IF v_owner_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        p_recipient_user_id := v_owner_id,
        p_actor_user_id := auth.uid(),
        p_organization_id := NEW.organization_id,
        p_project_id := NEW.project_id,
        p_event_type := 'payment_received',
        p_severity := 'success',
        p_title := 'Отримано оплату за проєкт',
        p_message := format('Зафіксовано оплату на суму %s %s для проєкту «%s» (%s).',
          (NEW.amount_minor / 100)::TEXT, NEW.currency, COALESCE(v_proj_name, 'Проєкт'), COALESCE(v_org_name, 'Клієнт')),
        p_entity_type := 'payment',
        p_entity_id := NEW.id,
        p_deep_link := format('#/portal/projects/%s', NEW.project_id),
        p_dedupe_key := format('finance:payment_rcvd:%s:%s', NEW.id, v_owner_id),
        p_metadata := jsonb_build_object('amount_minor', NEW.amount_minor, 'currency', NEW.currency)
      );
    END IF;

    IF v_pm_id IS NOT NULL AND v_pm_id != v_owner_id THEN
      PERFORM public.create_internal_notification(
        p_recipient_user_id := v_pm_id,
        p_actor_user_id := auth.uid(),
        p_organization_id := NEW.organization_id,
        p_project_id := NEW.project_id,
        p_event_type := 'payment_received',
        p_severity := 'success',
        p_title := 'Отримано оплату за проєкт',
        p_message := format('Зафіксовано оплату на суму %s %s для проєкту «%s» (%s).',
          (NEW.amount_minor / 100)::TEXT, NEW.currency, COALESCE(v_proj_name, 'Проєкт'), COALESCE(v_org_name, 'Клієнт')),
        p_entity_type := 'payment',
        p_entity_id := NEW.id,
        p_deep_link := format('#/portal/projects/%s', NEW.project_id),
        p_dedupe_key := format('finance:payment_rcvd:%s:%s', NEW.id, v_pm_id),
        p_metadata := jsonb_build_object('amount_minor', NEW.amount_minor, 'currency', NEW.currency)
      );
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

-- 7.3 Audit Logger for Commercial Terms, Payment Schedule, Costs
CREATE OR REPLACE FUNCTION public.handle_finance_entity_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entity_type TEXT;
  v_action TEXT;
BEGIN
  IF TG_TABLE_NAME = 'project_commercial_terms' THEN
    v_entity_type := 'commercial_terms';
  ELSIF TG_TABLE_NAME = 'project_payment_schedule' THEN
    v_entity_type := 'payment_schedule';
  ELSIF TG_TABLE_NAME = 'project_costs' THEN
    v_entity_type := 'cost';
  ELSE
    v_entity_type := TG_TABLE_NAME;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    INSERT INTO public.finance_audit_events (
      organization_id, project_id, entity_type, entity_id, action, actor_user_id, new_values, metadata
    ) VALUES (
      NEW.organization_id, NEW.project_id, v_entity_type, NEW.id, v_action,
      COALESCE(auth.uid(), NEW.created_by), to_jsonb(NEW), '{}'::jsonb
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    INSERT INTO public.finance_audit_events (
      organization_id, project_id, entity_type, entity_id, action, actor_user_id, old_values, new_values, metadata
    ) VALUES (
      NEW.organization_id, NEW.project_id, v_entity_type, NEW.id, v_action,
      auth.uid(), to_jsonb(OLD), to_jsonb(NEW), '{}'::jsonb
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    INSERT INTO public.finance_audit_events (
      organization_id, project_id, entity_type, entity_id, action, actor_user_id, old_values, metadata
    ) VALUES (
      OLD.organization_id, OLD.project_id, v_entity_type, OLD.id, v_action,
      auth.uid(), to_jsonb(OLD), '{}'::jsonb
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_commercial_terms ON public.project_commercial_terms;
CREATE TRIGGER trg_audit_commercial_terms
  AFTER INSERT OR UPDATE OR DELETE ON public.project_commercial_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_finance_entity_audit();

DROP TRIGGER IF EXISTS trg_audit_payment_schedule ON public.project_payment_schedule;
CREATE TRIGGER trg_audit_payment_schedule
  AFTER INSERT OR UPDATE OR DELETE ON public.project_payment_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_finance_entity_audit();

DROP TRIGGER IF EXISTS trg_audit_costs ON public.project_costs;
CREATE TRIGGER trg_audit_costs
  AFTER INSERT OR UPDATE OR DELETE ON public.project_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_finance_entity_audit();

-- -----------------------------------------------------------------------------
-- 8. Enhanced Proactive Evaluator with Financial Events
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_notifications()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id UUID;
  v_evaluated_count INTEGER := 0;
  v_today_str TEXT := to_char(CURRENT_DATE, 'YYYY-MM-DD');
  r RECORD;
BEGIN
  SELECT id INTO v_owner_id FROM public.profiles WHERE global_role = 'owner' LIMIT 1;

  -- =========================================================================
  -- 1. Operational Task & Delivery Evaluations (from Phase 5B)
  -- =========================================================================

  -- 1.1 Overdue Tasks
  FOR r IN
    SELECT t.id, t.title, t.due_date, t.project_id, t.organization_id, t.assignee_user_id,
           p.name AS project_name, p.responsible_pm_id, o.name AS organization_name
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    JOIN public.organizations o ON o.id = t.organization_id
    WHERE t.status NOT IN ('done', 'cancelled')
      AND t.due_date < CURRENT_DATE
  LOOP
    IF r.assignee_user_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        p_recipient_user_id := r.assignee_user_id,
        p_actor_user_id := NULL,
        p_organization_id := r.organization_id,
        p_project_id := r.project_id,
        p_event_type := 'task_overdue',
        p_severity := 'critical',
        p_title := 'Прострочена задача',
        p_message := format('Завдання «%s» у проєкті «%s» прострочено.', r.title, r.project_name),
        p_entity_type := 'task',
        p_entity_id := r.id,
        p_deep_link := format('#/portal/tasks?search=%s', r.title),
        p_dedupe_key := format('task_overdue:%s:%s:%s', r.id, r.assignee_user_id, v_today_str)
      );
      v_evaluated_count := v_evaluated_count + 1;
    END IF;

    IF r.responsible_pm_id IS NOT NULL AND r.responsible_pm_id != COALESCE(r.assignee_user_id, '00000000-0000-0000-0000-000000000000'::UUID) THEN
      PERFORM public.create_internal_notification(
        p_recipient_user_id := r.responsible_pm_id,
        p_actor_user_id := NULL,
        p_organization_id := r.organization_id,
        p_project_id := r.project_id,
        p_event_type := 'task_overdue',
        p_severity := 'critical',
        p_title := 'Прострочена задача в проєкті',
        p_message := format('Завдання «%s» у проєкті «%s» прострочено.', r.title, r.project_name),
        p_entity_type := 'task',
        p_entity_id := r.id,
        p_deep_link := format('#/portal/projects/%s', r.project_id),
        p_dedupe_key := format('task_overdue:%s:%s:%s', r.id, r.responsible_pm_id, v_today_str)
      );
      v_evaluated_count := v_evaluated_count + 1;
    END IF;
  END LOOP;

  -- 1.2 Overdue Client Actions
  FOR r IN
    SELECT t.id, t.title, t.due_date, t.project_id, t.organization_id,
           p.name AS project_name, p.responsible_pm_id, o.name AS organization_name
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    JOIN public.organizations o ON o.id = t.organization_id
    WHERE t.responsibility_type = 'client'
      AND t.status NOT IN ('done', 'cancelled')
      AND t.due_date < CURRENT_DATE
  LOOP
    IF r.responsible_pm_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        p_recipient_user_id := r.responsible_pm_id,
        p_actor_user_id := NULL,
        p_organization_id := r.organization_id,
        p_project_id := r.project_id,
        p_event_type := 'client_action_overdue',
        p_severity := 'critical',
        p_title := 'Прострочена дія клієнта',
        p_message := format('Клієнт «%s» прострочив дію «%s» у проєкті «%s».', r.organization_name, r.title, r.project_name),
        p_entity_type := 'client_action',
        p_entity_id := r.id,
        p_deep_link := format('#/portal/projects/%s', r.project_id),
        p_dedupe_key := format('client_action_overdue:%s:%s:%s', r.id, r.responsible_pm_id, v_today_str)
      );
      v_evaluated_count := v_evaluated_count + 1;
    END IF;

    IF v_owner_id IS NOT NULL AND v_owner_id != COALESCE(r.responsible_pm_id, '00000000-0000-0000-0000-000000000000'::UUID) THEN
      PERFORM public.create_internal_notification(
        p_recipient_user_id := v_owner_id,
        p_actor_user_id := NULL,
        p_organization_id := r.organization_id,
        p_project_id := r.project_id,
        p_event_type := 'client_action_overdue',
        p_severity := 'critical',
        p_title := 'Прострочена дія клієнта',
        p_message := format('Клієнт «%s» прострочив дію «%s» у проєкті «%s».', r.organization_name, r.title, r.project_name),
        p_entity_type := 'client_action',
        p_entity_id := r.id,
        p_deep_link := format('#/portal/projects/%s', r.project_id),
        p_dedupe_key := format('client_action_overdue:%s:%s:%s', r.id, v_owner_id, v_today_str)
      );
      v_evaluated_count := v_evaluated_count + 1;
    END IF;
  END LOOP;

  -- 1.3 Meetings Starting Soon (Within 30 min)
  FOR r IN
    SELECT m.id, m.title, m.start_at, m.project_id, m.organization_id, m.organizer_user_id,
           o.name AS organization_name, p.name AS project_name
    FROM public.meetings m
    JOIN public.organizations o ON o.id = m.organization_id
    LEFT JOIN public.projects p ON p.id = m.project_id
    WHERE m.status = 'scheduled'
      AND m.start_at >= NOW()
      AND m.start_at <= (NOW() + INTERVAL '30 minutes')
  LOOP
    IF r.organizer_user_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        p_recipient_user_id := r.organizer_user_id,
        p_actor_user_id := NULL,
        p_organization_id := r.organization_id,
        p_project_id := r.project_id,
        p_event_type := 'meeting_starting_soon',
        p_severity := 'warning',
        p_title := 'Зустріч розпочнеться незабаром',
        p_message := format('Зустріч «%s» (%s) розпочнеться протягом 30 хвилин.', r.title, r.organization_name),
        p_entity_type := 'meeting',
        p_entity_id := r.id,
        p_deep_link := format('#/portal/meetings/%s', r.id),
        p_dedupe_key := format('meeting_starting_soon:%s:%s:%s', r.id, r.organizer_user_id, to_char(r.start_at, 'YYYY-MM-DD-HH24-MI'))
      );
      v_evaluated_count := v_evaluated_count + 1;
    END IF;
  END LOOP;

  -- =========================================================================
  -- 2. Phase 5C.1: Financial Events Evaluations
  -- =========================================================================

  -- 2.1 Payment Due Soon (Within 3 days)
  FOR r IN
    SELECT s.id, s.title, s.amount_minor, s.currency, s.due_date, s.project_id, s.organization_id,
           p.name AS project_name, p.responsible_pm_id, o.name AS organization_name
    FROM public.project_payment_schedule s
    JOIN public.projects p ON p.id = s.project_id
    JOIN public.organizations o ON o.id = s.organization_id
    WHERE s.status IN ('planned', 'due', 'partially_paid')
      AND s.due_date >= CURRENT_DATE
      AND s.due_date <= (CURRENT_DATE + INTERVAL '3 days')
  LOOP
    -- Recipient: Owner
    IF v_owner_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        p_recipient_user_id := v_owner_id,
        p_actor_user_id := NULL,
        p_organization_id := r.organization_id,
        p_project_id := r.project_id,
        p_event_type := 'payment_due_soon',
        p_severity := 'warning',
        p_title := 'Наближається термін оплати траншу',
        p_message := format('Транш «%s» на суму %s %s для проєкту «%s» очікується до %s.',
          r.title, (r.amount_minor / 100)::TEXT, r.currency, r.project_name, to_char(r.due_date, 'DD.MM.YYYY')),
        p_entity_type := 'payment_schedule',
        p_entity_id := r.id,
        p_deep_link := format('#/portal/projects/%s', r.project_id),
        p_dedupe_key := format('finance:payment_due_soon:%s:%s:%s', r.id, v_owner_id, r.due_date),
        p_metadata := jsonb_build_object('amount_minor', r.amount_minor, 'currency', r.currency, 'due_date', r.due_date)
      );
      v_evaluated_count := v_evaluated_count + 1;
    END IF;

    -- Recipient: PM
    IF r.responsible_pm_id IS NOT NULL AND r.responsible_pm_id != COALESCE(v_owner_id, '00000000-0000-0000-0000-000000000000'::UUID) THEN
      PERFORM public.create_internal_notification(
        p_recipient_user_id := r.responsible_pm_id,
        p_actor_user_id := NULL,
        p_organization_id := r.organization_id,
        p_project_id := r.project_id,
        p_event_type := 'payment_due_soon',
        p_severity := 'warning',
        p_title := 'Наближається термін оплати траншу',
        p_message := format('Транш «%s» на суму %s %s для проєкту «%s» очікується до %s.',
          r.title, (r.amount_minor / 100)::TEXT, r.currency, r.project_name, to_char(r.due_date, 'DD.MM.YYYY')),
        p_entity_type := 'payment_schedule',
        p_entity_id := r.id,
        p_deep_link := format('#/portal/projects/%s', r.project_id),
        p_dedupe_key := format('finance:payment_due_soon:%s:%s:%s', r.id, r.responsible_pm_id, r.due_date),
        p_metadata := jsonb_build_object('amount_minor', r.amount_minor, 'currency', r.currency, 'due_date', r.due_date)
      );
      v_evaluated_count := v_evaluated_count + 1;
    END IF;
  END LOOP;

  -- 2.2 Payment Overdue (Next day after due date if unpaid remainder > 0 and not cancelled)
  FOR r IN
    SELECT s.id, s.title, s.amount_minor, s.currency, s.due_date, s.project_id, s.organization_id,
           p.name AS project_name, p.responsible_pm_id, o.name AS organization_name,
           (s.amount_minor - COALESCE((SELECT SUM(amount_minor) FROM public.project_payments WHERE payment_schedule_id = s.id), 0)) AS unpaid_minor
    FROM public.project_payment_schedule s
    JOIN public.projects p ON p.id = s.project_id
    JOIN public.organizations o ON o.id = s.organization_id
    WHERE s.status != 'cancelled'
      AND s.due_date < CURRENT_DATE
      AND (s.amount_minor - COALESCE((SELECT SUM(amount_minor) FROM public.project_payments WHERE payment_schedule_id = s.id), 0)) > 0
  LOOP
    -- Auto-mark schedule status as overdue
    UPDATE public.project_payment_schedule
    SET status = 'overdue', updated_at = NOW()
    WHERE id = r.id AND status != 'overdue';

    -- Recipient: Owner
    IF v_owner_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        p_recipient_user_id := v_owner_id,
        p_actor_user_id := NULL,
        p_organization_id := r.organization_id,
        p_project_id := r.project_id,
        p_event_type := 'payment_overdue',
        p_severity := 'critical',
        p_title := 'Прострочено платіж за проєктом',
        p_message := format('Платіж «%s» (залишок %s %s) для проєкту «%s» прострочено з %s.',
          r.title, (r.unpaid_minor / 100)::TEXT, r.currency, r.project_name, to_char(r.due_date, 'DD.MM.YYYY')),
        p_entity_type := 'payment_schedule',
        p_entity_id := r.id,
        p_deep_link := format('#/portal/projects/%s', r.project_id),
        p_dedupe_key := format('finance:payment_overdue:%s:%s:%s', r.id, v_owner_id, v_today_str),
        p_metadata := jsonb_build_object('unpaid_minor', r.unpaid_minor, 'currency', r.currency, 'due_date', r.due_date)
      );
      v_evaluated_count := v_evaluated_count + 1;
    END IF;

    -- Recipient: PM
    IF r.responsible_pm_id IS NOT NULL AND r.responsible_pm_id != COALESCE(v_owner_id, '00000000-0000-0000-0000-000000000000'::UUID) THEN
      PERFORM public.create_internal_notification(
        p_recipient_user_id := r.responsible_pm_id,
        p_actor_user_id := NULL,
        p_organization_id := r.organization_id,
        p_project_id := r.project_id,
        p_event_type := 'payment_overdue',
        p_severity := 'critical',
        p_title := 'Прострочено платіж за проєктом',
        p_message := format('Платіж «%s» (залишок %s %s) для проєкту «%s» прострочено з %s.',
          r.title, (r.unpaid_minor / 100)::TEXT, r.currency, r.project_name, to_char(r.due_date, 'DD.MM.YYYY')),
        p_entity_type := 'payment_schedule',
        p_entity_id := r.id,
        p_deep_link := format('#/portal/projects/%s', r.project_id),
        p_dedupe_key := format('finance:payment_overdue:%s:%s:%s', r.id, r.responsible_pm_id, v_today_str),
        p_metadata := jsonb_build_object('unpaid_minor', r.unpaid_minor, 'currency', r.currency, 'due_date', r.due_date)
      );
      v_evaluated_count := v_evaluated_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'evaluated_count', v_evaluated_count,
    'evaluated_at', NOW()
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.project_commercial_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_payment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_audit_events ENABLE ROW LEVEL SECURITY;

-- 9.1 Commercial Terms RLS
DROP POLICY IF EXISTS "commercial_terms_select" ON public.project_commercial_terms;
CREATE POLICY "commercial_terms_select" ON public.project_commercial_terms
  FOR SELECT USING (public.is_global_owner() OR public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "commercial_terms_insert" ON public.project_commercial_terms;
CREATE POLICY "commercial_terms_insert" ON public.project_commercial_terms
  FOR INSERT WITH CHECK (public.is_global_owner() OR public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "commercial_terms_update" ON public.project_commercial_terms;
CREATE POLICY "commercial_terms_update" ON public.project_commercial_terms
  FOR UPDATE USING (public.is_global_owner() OR public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "commercial_terms_delete" ON public.project_commercial_terms;
CREATE POLICY "commercial_terms_delete" ON public.project_commercial_terms
  FOR DELETE USING (public.is_global_owner());

-- 9.2 Payment Schedule RLS
DROP POLICY IF EXISTS "payment_schedule_select" ON public.project_payment_schedule;
CREATE POLICY "payment_schedule_select" ON public.project_payment_schedule
  FOR SELECT USING (public.is_global_owner() OR public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "payment_schedule_insert" ON public.project_payment_schedule;
CREATE POLICY "payment_schedule_insert" ON public.project_payment_schedule
  FOR INSERT WITH CHECK (public.is_global_owner() OR public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "payment_schedule_update" ON public.project_payment_schedule;
CREATE POLICY "payment_schedule_update" ON public.project_payment_schedule
  FOR UPDATE USING (public.is_global_owner() OR public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "payment_schedule_delete" ON public.project_payment_schedule;
CREATE POLICY "payment_schedule_delete" ON public.project_payment_schedule
  FOR DELETE USING (public.is_global_owner() OR public.is_org_admin(organization_id));

-- 9.3 Payments RLS
DROP POLICY IF EXISTS "payments_select" ON public.project_payments;
CREATE POLICY "payments_select" ON public.project_payments
  FOR SELECT USING (public.is_global_owner() OR public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "payments_insert" ON public.project_payments;
CREATE POLICY "payments_insert" ON public.project_payments
  FOR INSERT WITH CHECK (public.is_global_owner() OR public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "payments_update" ON public.project_payments;
CREATE POLICY "payments_update" ON public.project_payments
  FOR UPDATE USING (public.is_global_owner());

DROP POLICY IF EXISTS "payments_delete" ON public.project_payments;
CREATE POLICY "payments_delete" ON public.project_payments
  FOR DELETE USING (public.is_global_owner());

-- 9.4 Costs RLS (STRICT OWNER-ONLY)
DROP POLICY IF EXISTS "costs_select" ON public.project_costs;
CREATE POLICY "costs_select" ON public.project_costs
  FOR SELECT USING (public.is_global_owner());

DROP POLICY IF EXISTS "costs_insert" ON public.project_costs;
CREATE POLICY "costs_insert" ON public.project_costs
  FOR INSERT WITH CHECK (public.is_global_owner());

DROP POLICY IF EXISTS "costs_update" ON public.project_costs;
CREATE POLICY "costs_update" ON public.project_costs
  FOR UPDATE USING (public.is_global_owner());

DROP POLICY IF EXISTS "costs_delete" ON public.project_costs;
CREATE POLICY "costs_delete" ON public.project_costs
  FOR DELETE USING (public.is_global_owner());

-- 9.5 Finance Audit Events RLS (Append-Only)
DROP POLICY IF EXISTS "finance_audit_select" ON public.finance_audit_events;
CREATE POLICY "finance_audit_select" ON public.finance_audit_events
  FOR SELECT USING (public.is_global_owner() OR public.is_org_admin(organization_id));
