const { Client } = require('pg');

const DB_CONFIG = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.aayqydcdfxhlwizhfjun',
  password: process.env.SUPABASE_DB_PASSWORD || '4zCbX8YXlhSHMSZFAc7qCXMJFw9!',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

async function fixTriggerFunctions() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  console.log('--- Fixing Trigger Functions for Finance Entities ---');

  await client.query(`
    -- 1. Base Project-Org Consistency Trigger Function
    CREATE OR REPLACE FUNCTION public.validate_finance_project_org_consistency()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    DECLARE
      v_proj_org_id UUID;
    BEGIN
      SELECT organization_id INTO v_proj_org_id
      FROM public.projects
      WHERE id = NEW.project_id;

      IF v_proj_org_id IS NULL THEN
        RAISE EXCEPTION 'Referenced project does not exist.' USING ERRCODE = '23503';
      END IF;

      IF NEW.organization_id IS DISTINCT FROM v_proj_org_id THEN
        NEW.organization_id := v_proj_org_id;
      END IF;

      RETURN NEW;
    END;
    $$;

    -- 2. Commercial Terms specific validation
    CREATE OR REPLACE FUNCTION public.validate_commercial_terms_consistency()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    DECLARE
      v_doc_proj_id UUID;
    BEGIN
      IF NEW.contract_document_id IS NOT NULL THEN
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

    -- 3. Payments specific validation
    CREATE OR REPLACE FUNCTION public.validate_payment_consistency()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    DECLARE
      v_sched_proj_id UUID;
      v_sched_curr TEXT;
    BEGIN
      IF NEW.payment_schedule_id IS NOT NULL THEN
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

      RETURN NEW;
    END;
    $$;

    -- Re-bind triggers
    DROP TRIGGER IF EXISTS trg_validate_commercial_terms_consistency ON public.project_commercial_terms;
    CREATE TRIGGER trg_validate_commercial_terms_consistency
      BEFORE INSERT OR UPDATE ON public.project_commercial_terms
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_finance_project_org_consistency();

    DROP TRIGGER IF EXISTS trg_validate_commercial_terms_doc ON public.project_commercial_terms;
    CREATE TRIGGER trg_validate_commercial_terms_doc
      BEFORE INSERT OR UPDATE ON public.project_commercial_terms
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_commercial_terms_consistency();

    DROP TRIGGER IF EXISTS trg_validate_payment_schedule_consistency ON public.project_payment_schedule;
    CREATE TRIGGER trg_validate_payment_schedule_consistency
      BEFORE INSERT OR UPDATE ON public.project_payment_schedule
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_finance_project_org_consistency();

    DROP TRIGGER IF EXISTS trg_validate_payments_consistency ON public.project_payments;
    CREATE TRIGGER trg_validate_payments_consistency
      BEFORE INSERT OR UPDATE ON public.project_payments
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_finance_project_org_consistency();

    DROP TRIGGER IF EXISTS trg_validate_payments_schedule ON public.project_payments;
    CREATE TRIGGER trg_validate_payments_schedule
      BEFORE INSERT OR UPDATE ON public.project_payments
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_payment_consistency();

    DROP TRIGGER IF EXISTS trg_validate_costs_consistency ON public.project_costs;
    CREATE TRIGGER trg_validate_costs_consistency
      BEFORE INSERT OR UPDATE ON public.project_costs
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_finance_project_org_consistency();
  `);

  console.log('✔ Trigger functions updated and re-bound successfully.');
  await client.end();
}

fixTriggerFunctions().catch(err => {
  console.error(err);
  process.exit(1);
});
