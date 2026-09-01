-- FIRSTWIN — Phase ADS-1: Marketing Leads & Advertising Attribution
-- Target: PostgreSQL / Supabase with Row-Level Security (RLS)
-- Spec: docs/technical-specs/ads_tracking_plan.md §4, §6; docs/technical-specs/ads_master_tz.md §13
-- Hardening: server-side rate limiting, input normalization, submission log without PII,
--            content-level dedup, JSON error contract (no raw exceptions for expected cases).
-- NOTE: prepared on branch docs/ads-consolidation; NOT applied to production until owner approval.
-- Rollback: supabase/rollbacks/20260901000025_down.sql

-- -----------------------------------------------------------------------------
-- 1. Marketing Leads Table (public-site lead capture with full ad attribution)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact data (from public forms)
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  telegram TEXT,
  company TEXT,
  niche TEXT,
  managers TEXT,
  has_crm TEXT,
  problem TEXT,
  goal TEXT,
  message TEXT,
  preferred_format TEXT,
  preferred_date DATE,
  preferred_time TEXT,
  payment_method TEXT,

  -- Lead classification
  form_id TEXT NOT NULL CHECK (form_id IN ('consultation', 'contacts', 'chat', 'other')),
  offer_id TEXT CHECK (offer_id IN ('aiauto', 'audit', 'salesdept', 'consult', 'other') OR offer_id IS NULL),
  page_path TEXT,
  country TEXT,
  language TEXT,
  source_channel TEXT NOT NULL DEFAULT 'website',

  -- Advertising attribution (last-touch flattened + full first/last snapshots)
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  gclid TEXT,
  gbraid TEXT,
  wbraid TEXT,
  fbclid TEXT,
  ttclid TEXT,
  platform TEXT,
  campaign_id TEXT,
  ad_id TEXT,
  creative_id TEXT,
  first_touch JSONB,
  last_touch JSONB,
  landing_page TEXT,
  referrer TEXT,

  -- Dedup + consent
  event_id UUID NOT NULL UNIQUE,
  consent_analytics BOOLEAN NOT NULL DEFAULT FALSE,
  consent_marketing BOOLEAN NOT NULL DEFAULT FALSE,

  -- Funnel / quality tracking (ads_master_tz §13)
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'contacted', 'qualified', 'disqualified',
    'booked', 'consultation_paid', 'proposal_sent', 'won', 'lost'
  )),
  disqual_reason TEXT CHECK (disqual_reason IN (
    'wrong_country', 'wrong_business_type', 'no_budget', 'wrong_service',
    'spam_duplicate', 'no_response', 'other'
  ) OR disqual_reason IS NULL),
  first_contact_at TIMESTAMPTZ,
  booked_call_at TIMESTAMPTZ,
  call_show_status TEXT CHECK (call_show_status IN ('booked', 'showed', 'no_show') OR call_show_status IS NULL),
  consultation_paid_at TIMESTAMPTZ,
  qualified_at TIMESTAMPTZ,
  proposal_sent_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  close_reason TEXT,
  revenue NUMERIC(12,2),
  gross_profit NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'UAH',
  lead_cost NUMERIC(12,2),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_marketing_leads_updated_at ON public.marketing_leads;
CREATE TRIGGER set_marketing_leads_updated_at
  BEFORE UPDATE ON public.marketing_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_marketing_leads_created ON public.marketing_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_status ON public.marketing_leads(status);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_campaign ON public.marketing_leads(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_form ON public.marketing_leads(form_id);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_email_recent ON public.marketing_leads(email, created_at);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_phone_recent ON public.marketing_leads(phone, created_at);

-- -----------------------------------------------------------------------------
-- 2. Marketing Lead Events (funnel transition / audit log)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.marketing_leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'generate_lead', 'book_call', 'consultation_paid', 'qualified_lead',
    'disqualified', 'proposal_sent', 'closed_won', 'closed_lost', 'status_change', 'note'
  )),
  payload JSONB,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_lead_events_lead ON public.marketing_lead_events(lead_id, created_at);

-- -----------------------------------------------------------------------------
-- 3. Submission Log (rate limiting + technical error journal, NO personal data)
--    Stores only: hashed client IP, form id, outcome code, timestamp.
--    Rows older than 7 days are purged opportunistically on every submission.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_submission_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  form_id TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN (
    'created', 'duplicate_event', 'duplicate_content', 'honeypot',
    'rate_limited', 'validation_error', 'server_error'
  )),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_submission_log_ip ON public.marketing_submission_log(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_marketing_submission_log_created ON public.marketing_submission_log(created_at);

-- -----------------------------------------------------------------------------
-- 4. Row-Level Security
--    Public site NEVER touches these tables directly: inserts go through the
--    SECURITY DEFINER RPC below; reads/updates are owner-only.
-- -----------------------------------------------------------------------------
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_submission_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Marketing leads readable by global owner" ON public.marketing_leads;
CREATE POLICY "Marketing leads readable by global owner" ON public.marketing_leads
  FOR SELECT USING (public.is_global_owner());

DROP POLICY IF EXISTS "Marketing leads updatable by global owner" ON public.marketing_leads;
CREATE POLICY "Marketing leads updatable by global owner" ON public.marketing_leads
  FOR UPDATE USING (public.is_global_owner());

DROP POLICY IF EXISTS "Marketing leads deletable by global owner" ON public.marketing_leads;
CREATE POLICY "Marketing leads deletable by global owner" ON public.marketing_leads
  FOR DELETE USING (public.is_global_owner());

DROP POLICY IF EXISTS "Marketing lead events readable by global owner" ON public.marketing_lead_events;
CREATE POLICY "Marketing lead events readable by global owner" ON public.marketing_lead_events
  FOR SELECT USING (public.is_global_owner());

DROP POLICY IF EXISTS "Marketing lead events insertable by global owner" ON public.marketing_lead_events;
CREATE POLICY "Marketing lead events insertable by global owner" ON public.marketing_lead_events
  FOR INSERT WITH CHECK (public.is_global_owner());

DROP POLICY IF EXISTS "Submission log readable by global owner" ON public.marketing_submission_log;
CREATE POLICY "Submission log readable by global owner" ON public.marketing_submission_log
  FOR SELECT USING (public.is_global_owner());

-- No INSERT policy on marketing_leads / marketing_submission_log for clients:
-- anonymous writes are only possible through public.submit_marketing_lead below.

-- -----------------------------------------------------------------------------
-- 5. Internal helpers (not exposed to clients)
-- -----------------------------------------------------------------------------

-- Pseudonymized client IP from PostgREST request headers. Never stores raw IP.
CREATE OR REPLACE FUNCTION public.marketing_client_ip_hash()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_headers JSONB;
  v_ip TEXT;
BEGIN
  BEGIN
    v_headers := NULLIF(current_setting('request.headers', TRUE), '')::JSONB;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;
  IF v_headers IS NOT NULL THEN
    v_ip := COALESCE(
      split_part(v_headers->>'x-forwarded-for', ',', 1),
      v_headers->>'x-real-ip'
    );
  END IF;
  IF v_ip IS NULL OR TRIM(v_ip) = '' THEN
    RETURN 'unknown';
  END IF;
  RETURN md5('fw-leads:' || TRIM(v_ip));
END;
$$;

REVOKE ALL ON FUNCTION public.marketing_client_ip_hash() FROM PUBLIC;

-- -----------------------------------------------------------------------------
-- 6. Public lead submission RPC (SECURITY DEFINER, callable by anon)
--    Contract: ALWAYS returns JSONB {ok, ...} for expected outcomes:
--      success:    {ok:true,  lead_id, event_id, duplicate:false}
--      duplicate:  {ok:true,  lead_id, event_id, duplicate:true}
--      honeypot:   {ok:true,  lead_id:null, duplicate:false}   (bots learn nothing)
--      rate limit: {ok:false, error:'rate_limited'}
--      validation: {ok:false, error:'validation', field:'...'}
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_marketing_lead(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_existing UUID;
  v_lead_id UUID;
  v_name TEXT;
  v_form_id TEXT;
  v_email TEXT;
  v_phone TEXT;
  v_telegram TEXT;
  v_ip_hash TEXT;
  v_count_hour INT;
  v_count_day INT;
  v_count_global_hour INT;
BEGIN
  v_ip_hash := public.marketing_client_ip_hash();
  v_form_id := COALESCE(p->>'form_id', 'other');

  -- Opportunistic retention cleanup: the log keeps at most 7 days of rows
  DELETE FROM public.marketing_submission_log WHERE created_at < NOW() - INTERVAL '7 days';

  -- Payload size cap (before any parsing work)
  IF length(p::text) > 20000 THEN
    INSERT INTO public.marketing_submission_log (ip_hash, form_id, outcome, error_code)
    VALUES (v_ip_hash, v_form_id, 'validation_error', 'payload_too_large');
    RETURN jsonb_build_object('ok', FALSE, 'error', 'validation', 'field', 'payload');
  END IF;

  -- Honeypot: bots fill hidden fields; humans never see them. Pretend success.
  IF COALESCE(p->>'website_hp', '') <> '' THEN
    INSERT INTO public.marketing_submission_log (ip_hash, form_id, outcome)
    VALUES (v_ip_hash, v_form_id, 'honeypot');
    RETURN jsonb_build_object('ok', TRUE, 'lead_id', NULL, 'duplicate', FALSE);
  END IF;

  -- Server-side rate limiting (per pseudonymized IP + global spike guard)
  SELECT COUNT(*) INTO v_count_hour FROM public.marketing_submission_log
    WHERE ip_hash = v_ip_hash AND outcome = 'created' AND created_at > NOW() - INTERVAL '1 hour';
  SELECT COUNT(*) INTO v_count_day FROM public.marketing_submission_log
    WHERE ip_hash = v_ip_hash AND outcome = 'created' AND created_at > NOW() - INTERVAL '24 hours';
  SELECT COUNT(*) INTO v_count_global_hour FROM public.marketing_submission_log
    WHERE outcome = 'created' AND created_at > NOW() - INTERVAL '1 hour';

  IF v_count_hour >= 5 OR v_count_day >= 20 OR v_count_global_hour >= 100 THEN
    INSERT INTO public.marketing_submission_log (ip_hash, form_id, outcome)
    VALUES (v_ip_hash, v_form_id, 'rate_limited');
    RETURN jsonb_build_object('ok', FALSE, 'error', 'rate_limited');
  END IF;

  -- Normalization
  v_name := NULLIF(TRIM(COALESCE(p->>'name', '')), '');
  v_email := LOWER(NULLIF(TRIM(COALESCE(p->>'email', '')), ''));
  v_phone := NULLIF(regexp_replace(COALESCE(p->>'phone', ''), '[^0-9+]', '', 'g'), '');
  v_telegram := NULLIF(TRIM(COALESCE(p->>'telegram', '')), '');

  -- Malformed email is dropped (not stored as junk), unless it is the only contact
  IF v_email IS NOT NULL AND v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    v_email := NULL;
  END IF;

  -- Validation
  IF v_name IS NULL THEN
    INSERT INTO public.marketing_submission_log (ip_hash, form_id, outcome, error_code)
    VALUES (v_ip_hash, v_form_id, 'validation_error', 'name_required');
    RETURN jsonb_build_object('ok', FALSE, 'error', 'validation', 'field', 'name');
  END IF;
  IF v_phone IS NULL AND v_email IS NULL AND v_telegram IS NULL THEN
    INSERT INTO public.marketing_submission_log (ip_hash, form_id, outcome, error_code)
    VALUES (v_ip_hash, v_form_id, 'validation_error', 'contact_required');
    RETURN jsonb_build_object('ok', FALSE, 'error', 'validation', 'field', 'contact');
  END IF;

  v_event_id := COALESCE(NULLIF(p->>'event_id', '')::UUID, gen_random_uuid());

  -- Dedup level 1: same browser event_id submitted twice (retry, double click)
  SELECT id INTO v_existing FROM public.marketing_leads WHERE event_id = v_event_id;
  IF v_existing IS NOT NULL THEN
    INSERT INTO public.marketing_submission_log (ip_hash, form_id, outcome)
    VALUES (v_ip_hash, v_form_id, 'duplicate_event');
    RETURN jsonb_build_object('ok', TRUE, 'lead_id', v_existing, 'event_id', v_event_id, 'duplicate', TRUE);
  END IF;

  -- Dedup level 2: same contact re-submitted on the same form within 10 minutes
  SELECT id INTO v_existing FROM public.marketing_leads
    WHERE form_id = CASE WHEN v_form_id IN ('consultation', 'contacts', 'chat') THEN v_form_id ELSE 'other' END
      AND created_at > NOW() - INTERVAL '10 minutes'
      AND (
        (v_email IS NOT NULL AND email = v_email)
        OR (v_phone IS NOT NULL AND phone = v_phone)
      )
    ORDER BY created_at DESC
    LIMIT 1;
  IF v_existing IS NOT NULL THEN
    INSERT INTO public.marketing_submission_log (ip_hash, form_id, outcome)
    VALUES (v_ip_hash, v_form_id, 'duplicate_content');
    RETURN jsonb_build_object('ok', TRUE, 'lead_id', v_existing, 'event_id', v_event_id, 'duplicate', TRUE);
  END IF;

  INSERT INTO public.marketing_leads (
    name, phone, email, telegram, company, niche, managers, has_crm,
    problem, goal, message, preferred_format, preferred_date, preferred_time,
    payment_method, form_id, offer_id, page_path, country, language,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    gclid, gbraid, wbraid, fbclid, ttclid,
    platform, campaign_id, ad_id, creative_id,
    first_touch, last_touch, landing_page, referrer,
    event_id, consent_analytics, consent_marketing
  ) VALUES (
    LEFT(v_name, 200),
    LEFT(v_phone, 50),
    LEFT(v_email, 200),
    LEFT(v_telegram, 100),
    LEFT(NULLIF(TRIM(COALESCE(p->>'company', '')), ''), 300),
    LEFT(NULLIF(TRIM(COALESCE(p->>'niche', '')), ''), 300),
    LEFT(NULLIF(TRIM(COALESCE(p->>'managers', '')), ''), 50),
    LEFT(NULLIF(TRIM(COALESCE(p->>'has_crm', '')), ''), 100),
    LEFT(NULLIF(TRIM(COALESCE(p->>'problem', '')), ''), 3000),
    LEFT(NULLIF(TRIM(COALESCE(p->>'goal', '')), ''), 3000),
    LEFT(NULLIF(TRIM(COALESCE(p->>'message', '')), ''), 3000),
    LEFT(NULLIF(TRIM(COALESCE(p->>'preferred_format', '')), ''), 50),
    NULLIF(p->>'preferred_date', '')::DATE,
    LEFT(NULLIF(TRIM(COALESCE(p->>'preferred_time', '')), ''), 50),
    LEFT(NULLIF(TRIM(COALESCE(p->>'payment_method', '')), ''), 50),
    CASE WHEN v_form_id IN ('consultation', 'contacts', 'chat') THEN v_form_id ELSE 'other' END,
    CASE WHEN p->>'offer_id' IN ('aiauto', 'audit', 'salesdept', 'consult') THEN p->>'offer_id' ELSE NULL END,
    LEFT(NULLIF(p->>'page_path', ''), 500),
    LEFT(NULLIF(p->>'country', ''), 10),
    LEFT(NULLIF(p->>'language', ''), 10),
    LEFT(NULLIF(p->>'utm_source', ''), 200),
    LEFT(NULLIF(p->>'utm_medium', ''), 200),
    LEFT(NULLIF(p->>'utm_campaign', ''), 300),
    LEFT(NULLIF(p->>'utm_content', ''), 300),
    LEFT(NULLIF(p->>'utm_term', ''), 300),
    LEFT(NULLIF(p->>'gclid', ''), 300),
    LEFT(NULLIF(p->>'gbraid', ''), 300),
    LEFT(NULLIF(p->>'wbraid', ''), 300),
    LEFT(NULLIF(p->>'fbclid', ''), 300),
    LEFT(NULLIF(p->>'ttclid', ''), 300),
    LEFT(NULLIF(p->>'platform', ''), 50),
    LEFT(NULLIF(p->>'campaign_id', ''), 200),
    LEFT(NULLIF(p->>'ad_id', ''), 200),
    LEFT(NULLIF(p->>'creative_id', ''), 200),
    CASE WHEN jsonb_typeof(p->'first_touch') = 'object' THEN p->'first_touch' ELSE NULL END,
    CASE WHEN jsonb_typeof(p->'last_touch') = 'object' THEN p->'last_touch' ELSE NULL END,
    LEFT(NULLIF(p->>'landing_page', ''), 1000),
    LEFT(NULLIF(p->>'referrer', ''), 1000),
    v_event_id,
    COALESCE((p->>'consent_analytics')::BOOLEAN, FALSE),
    COALESCE((p->>'consent_marketing')::BOOLEAN, FALSE)
  )
  RETURNING id INTO v_lead_id;

  INSERT INTO public.marketing_lead_events (lead_id, event_type, payload)
  VALUES (v_lead_id, 'generate_lead', jsonb_build_object(
    'form_id', v_form_id,
    'offer_id', p->>'offer_id',
    'event_id', v_event_id
  ));

  INSERT INTO public.marketing_submission_log (ip_hash, form_id, outcome)
  VALUES (v_ip_hash, v_form_id, 'created');

  RETURN jsonb_build_object('ok', TRUE, 'lead_id', v_lead_id, 'event_id', v_event_id, 'duplicate', FALSE);
EXCEPTION WHEN OTHERS THEN
  -- Unexpected failure: log the error class only (no payload, no personal data)
  INSERT INTO public.marketing_submission_log (ip_hash, form_id, outcome, error_code)
  VALUES (v_ip_hash, v_form_id, 'server_error', SQLSTATE);
  RETURN jsonb_build_object('ok', FALSE, 'error', 'server_error');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_marketing_lead(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_marketing_lead(JSONB) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Owner funnel-status RPC (records timestamped transition + event row)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_marketing_lead_status(
  p_lead_id UUID,
  p_status TEXT,
  p_disqual_reason TEXT DEFAULT NULL,
  p_revenue NUMERIC DEFAULT NULL,
  p_currency TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type TEXT;
BEGIN
  IF NOT public.is_global_owner() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN (
    'new', 'contacted', 'qualified', 'disqualified',
    'booked', 'consultation_paid', 'proposal_sent', 'won', 'lost'
  ) THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'disqualified' AND (p_disqual_reason IS NULL OR p_disqual_reason NOT IN (
    'wrong_country', 'wrong_business_type', 'no_budget', 'wrong_service',
    'spam_duplicate', 'no_response', 'other'
  )) THEN
    RAISE EXCEPTION 'disqual_reason is required for disqualified status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.marketing_leads SET
    status = p_status,
    disqual_reason = CASE WHEN p_status = 'disqualified' THEN p_disqual_reason ELSE disqual_reason END,
    first_contact_at = CASE WHEN p_status = 'contacted' AND first_contact_at IS NULL THEN NOW() ELSE first_contact_at END,
    booked_call_at = CASE WHEN p_status = 'booked' AND booked_call_at IS NULL THEN NOW() ELSE booked_call_at END,
    consultation_paid_at = CASE WHEN p_status = 'consultation_paid' AND consultation_paid_at IS NULL THEN NOW() ELSE consultation_paid_at END,
    qualified_at = CASE WHEN p_status = 'qualified' AND qualified_at IS NULL THEN NOW() ELSE qualified_at END,
    proposal_sent_at = CASE WHEN p_status = 'proposal_sent' AND proposal_sent_at IS NULL THEN NOW() ELSE proposal_sent_at END,
    closed_at = CASE WHEN p_status IN ('won', 'lost') AND closed_at IS NULL THEN NOW() ELSE closed_at END,
    revenue = COALESCE(p_revenue, revenue),
    currency = COALESCE(p_currency, currency),
    notes = CASE WHEN p_note IS NOT NULL THEN COALESCE(notes || E'\n', '') || p_note ELSE notes END
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead not found' USING ERRCODE = '22023';
  END IF;

  v_event_type := CASE p_status
    WHEN 'booked' THEN 'book_call'
    WHEN 'consultation_paid' THEN 'consultation_paid'
    WHEN 'qualified' THEN 'qualified_lead'
    WHEN 'disqualified' THEN 'disqualified'
    WHEN 'proposal_sent' THEN 'proposal_sent'
    WHEN 'won' THEN 'closed_won'
    WHEN 'lost' THEN 'closed_lost'
    ELSE 'status_change'
  END;

  INSERT INTO public.marketing_lead_events (lead_id, event_type, payload, actor_id)
  VALUES (p_lead_id, v_event_type, jsonb_build_object(
    'status', p_status, 'disqual_reason', p_disqual_reason,
    'revenue', p_revenue, 'currency', p_currency, 'note', p_note
  ), auth.uid());

  RETURN jsonb_build_object('ok', TRUE, 'lead_id', p_lead_id, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.update_marketing_lead_status(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_marketing_lead_status(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
