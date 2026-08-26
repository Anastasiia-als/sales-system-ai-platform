-- FIRSTWIN Client Portal — Phase 1A: Contacts & Organization Fields Migration
-- Target: PostgreSQL / Supabase with Row-Level Security (RLS)

-- 1. Extend Organizations table with client profile fields
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS responsible_pm_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Update status check constraint on organizations if needed
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_status_check 
  CHECK (status IN ('active', 'paused', 'completed', 'archived', 'on_hold'));

-- -----------------------------------------------------------------------------
-- 2. Contacts Table (Scoped to Organization)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  position TEXT,
  email TEXT,
  phone TEXT,
  telegram TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  is_decision_maker BOOLEAN NOT NULL DEFAULT FALSE,
  is_technical_contact BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_contacts_updated_at ON public.contacts;
CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_contacts_org ON public.contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_primary ON public.contacts(organization_id) WHERE is_primary = TRUE;

-- -----------------------------------------------------------------------------
-- 3. Contacts Row-Level Security (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Contacts are viewable by members of that organization or global owner
DROP POLICY IF EXISTS "Contacts viewable by organization members or global owner" ON public.contacts;
CREATE POLICY "Contacts viewable by organization members or global owner" ON public.contacts
  FOR SELECT USING (
    public.is_org_member(organization_id)
  );

-- Contacts are manageable (insert/update/delete) by org admins, PMs, or global owner
DROP POLICY IF EXISTS "Contacts insertable by org admin or global owner" ON public.contacts;
CREATE POLICY "Contacts insertable by org admin or global owner" ON public.contacts
  FOR INSERT WITH CHECK (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Contacts updatable by org admin or global owner" ON public.contacts;
CREATE POLICY "Contacts updatable by org admin or global owner" ON public.contacts
  FOR UPDATE USING (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Contacts deletable by org admin or global owner" ON public.contacts;
CREATE POLICY "Contacts deletable by org admin or global owner" ON public.contacts
  FOR DELETE USING (
    public.is_org_admin(organization_id)
  );
