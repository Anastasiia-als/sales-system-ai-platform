-- ROLLBACK for 20260901000025_marketing_leads_attribution.sql
-- Removes everything the migration created. Order matters (functions → tables).
-- WARNING: dropping marketing_leads permanently deletes captured leads.
--          Run a backup/export first (see ads_preproduction_release_plan.md §Rollback).

DROP FUNCTION IF EXISTS public.update_marketing_lead_status(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_marketing_lead(JSONB);
DROP FUNCTION IF EXISTS public.marketing_client_ip_hash();

DROP TABLE IF EXISTS public.marketing_submission_log;
DROP TABLE IF EXISTS public.marketing_lead_events;
DROP TABLE IF EXISTS public.marketing_leads;
