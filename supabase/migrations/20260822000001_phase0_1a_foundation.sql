-- FIRSTWIN Client Portal — Phase 0.1A & 0.1B: Secure Data Foundation Migration
-- Target: PostgreSQL / Supabase with Hardened Row-Level Security (RLS)

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create updated_at trigger function with hardened search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 3. Profiles (Linked 1-to-1 with Supabase auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  phone TEXT,
  telegram TEXT,
  global_role TEXT NOT NULL DEFAULT 'client' CHECK (global_role IN ('owner', 'pm', 'specialist', 'client')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on auth.user created (Defaults global_role to 'client')
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, global_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    COALESCE(NEW.raw_user_meta_data->>'global_role', 'client')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. Organizations (Tenant Boundary)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
  lead_id TEXT, -- Reference to FIRSTWIN CRM lead if converted
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_organizations_updated_at ON public.organizations;
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Organization Memberships (User <-> Organization relation)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_role TEXT NOT NULL DEFAULT 'client' CHECK (org_role IN ('owner', 'admin', 'pm', 'member', 'client')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

DROP TRIGGER IF EXISTS set_org_memberships_updated_at ON public.organization_memberships;
CREATE TRIGGER set_org_memberships_updated_at
  BEFORE UPDATE ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON public.organization_memberships(organization_id);

-- -----------------------------------------------------------------------------
-- 6. Projects (Scoped to Organization)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  project_type TEXT NOT NULL DEFAULT 'custom',
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'review', 'completed', 'on_hold')),
  health_status TEXT NOT NULL DEFAULT 'on_track' CHECK (health_status IN ('on_track', 'at_risk', 'delayed')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  start_date DATE,
  target_end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_projects_updated_at ON public.projects;
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(organization_id);

-- -----------------------------------------------------------------------------
-- 7. Project Memberships (User <-> Project assignment)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_role TEXT NOT NULL DEFAULT 'member' CHECK (project_role IN ('pm', 'lead_consultant', 'specialist', 'member', 'client_rep')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_memberships_user ON public.project_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_project_memberships_proj ON public.project_memberships(project_id);

-- -----------------------------------------------------------------------------
-- 8. Hardened Security Helper Functions (With search_path & Strict RBAC)
-- -----------------------------------------------------------------------------

-- ONLY 'owner' has global platform access. PM is NOT a global administrator.
CREATE OR REPLACE FUNCTION public.is_global_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND global_role = 'owner'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Checks if user is an active member of the organization
CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT (
    public.is_global_owner()
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships
      WHERE organization_id = target_org_id
        AND user_id = auth.uid()
        AND is_active = TRUE
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Checks if user is an administrator/PM in that SPECIFIC organization
CREATE OR REPLACE FUNCTION public.is_org_admin(target_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT (
    public.is_global_owner()
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships
      WHERE organization_id = target_org_id
        AND user_id = auth.uid()
        AND org_role IN ('owner', 'admin', 'pm')
        AND is_active = TRUE
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Checks if user is a member of the project or organization admin
CREATE OR REPLACE FUNCTION public.is_project_member(target_project_id UUID)
RETURNS BOOLEAN AS $$
  SELECT (
    public.is_global_owner()
    OR EXISTS (
      SELECT 1 FROM public.project_memberships
      WHERE project_id = target_project_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.organization_memberships om ON om.organization_id = p.organization_id
      WHERE p.id = target_project_id
        AND om.user_id = auth.uid()
        AND om.is_active = TRUE
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 9. Role Escalation Protection Trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent user from changing their own global_role unless done by global owner
  IF OLD.global_role IS DISTINCT FROM NEW.global_role THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_global_owner() THEN
      RAISE EXCEPTION 'Access Denied: Only global owner can modify global_role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();

-- -----------------------------------------------------------------------------
-- 10. Row-Level Security (RLS) Policies
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_memberships ENABLE ROW LEVEL SECURITY;

-- 10.1 Profiles RLS
DROP POLICY IF EXISTS "Profiles viewable by self, common org teammates, or owner" ON public.profiles;
CREATE POLICY "Profiles viewable by self, common org teammates, or owner" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.is_global_owner()
    OR EXISTS (
      SELECT 1 FROM public.organization_memberships my_m
      JOIN public.organization_memberships their_m ON my_m.organization_id = their_m.organization_id
      WHERE my_m.user_id = auth.uid()
        AND my_m.is_active = TRUE
        AND their_m.user_id = profiles.id
        AND their_m.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- 10.2 Organizations RLS (Strict Tenant Isolation)
DROP POLICY IF EXISTS "Organizations viewable by members or global owner" ON public.organizations;
CREATE POLICY "Organizations viewable by members or global owner" ON public.organizations
  FOR SELECT USING (
    public.is_org_member(id)
  );

DROP POLICY IF EXISTS "Organizations insertable by global owner" ON public.organizations;
CREATE POLICY "Organizations insertable by global owner" ON public.organizations
  FOR INSERT WITH CHECK (
    public.is_global_owner()
  );

DROP POLICY IF EXISTS "Organizations updatable by org admins or global owner" ON public.organizations;
CREATE POLICY "Organizations updatable by org admins or global owner" ON public.organizations
  FOR UPDATE USING (
    public.is_org_admin(id)
  );

DROP POLICY IF EXISTS "Organizations deletable by global owner" ON public.organizations;
CREATE POLICY "Organizations deletable by global owner" ON public.organizations
  FOR DELETE USING (
    public.is_global_owner()
  );

-- 10.3 Organization Memberships RLS
DROP POLICY IF EXISTS "Memberships viewable by organization members" ON public.organization_memberships;
CREATE POLICY "Memberships viewable by organization members" ON public.organization_memberships
  FOR SELECT USING (
    public.is_org_member(organization_id)
  );

DROP POLICY IF EXISTS "Memberships insertable by org admin or global owner" ON public.organization_memberships;
CREATE POLICY "Memberships insertable by org admin or global owner" ON public.organization_memberships
  FOR INSERT WITH CHECK (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Memberships updatable by org admin or global owner" ON public.organization_memberships;
CREATE POLICY "Memberships updatable by org admin or global owner" ON public.organization_memberships
  FOR UPDATE USING (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Memberships deletable by org admin or global owner" ON public.organization_memberships;
CREATE POLICY "Memberships deletable by org admin or global owner" ON public.organization_memberships
  FOR DELETE USING (
    public.is_org_admin(organization_id)
  );

-- 10.4 Projects RLS
DROP POLICY IF EXISTS "Projects viewable by authorized members" ON public.projects;
CREATE POLICY "Projects viewable by authorized members" ON public.projects
  FOR SELECT USING (
    public.is_project_member(id)
  );

DROP POLICY IF EXISTS "Projects insertable by org admin or global owner" ON public.projects;
CREATE POLICY "Projects insertable by org admin or global owner" ON public.projects
  FOR INSERT WITH CHECK (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Projects updatable by org admin or global owner" ON public.projects;
CREATE POLICY "Projects updatable by org admin or global owner" ON public.projects
  FOR UPDATE USING (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Projects deletable by org admin or global owner" ON public.projects;
CREATE POLICY "Projects deletable by org admin or global owner" ON public.projects
  FOR DELETE USING (
    public.is_org_admin(organization_id)
  );

-- 10.5 Project Memberships RLS
DROP POLICY IF EXISTS "Project memberships viewable by project members" ON public.project_memberships;
CREATE POLICY "Project memberships viewable by project members" ON public.project_memberships
  FOR SELECT USING (
    public.is_project_member(project_id)
  );

DROP POLICY IF EXISTS "Project memberships manageable by org admin or global owner" ON public.project_memberships;
CREATE POLICY "Project memberships manageable by org admin or global owner" ON public.project_memberships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_memberships.project_id
        AND public.is_org_admin(p.organization_id)
    )
  );
