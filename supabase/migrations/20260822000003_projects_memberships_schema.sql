-- FIRSTWIN Client Portal — Phase 1B: Projects & Memberships Migration
-- Target: PostgreSQL / Supabase with Row-Level Security (RLS)

-- 1. Extend Projects table with Phase 1B fields
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS health TEXT DEFAULT 'on_track',
  ADD COLUMN IF NOT EXISTS target_date DATE,
  ADD COLUMN IF NOT EXISTS responsible_pm_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Initial data backfill for existing rows if any
UPDATE public.projects SET name = title WHERE name IS NULL AND title IS NOT NULL;
UPDATE public.projects SET health = health_status WHERE health IS NULL AND health_status IS NOT NULL;
UPDATE public.projects SET target_date = target_end_date WHERE target_date IS NULL AND target_end_date IS NOT NULL;

-- 2. Update Constraints on Projects
-- Update status check constraint to support Phase 1B statuses
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check 
  CHECK (status IN (
    'draft',
    'onboarding',
    'discovery',
    'in_progress',
    'waiting_client',
    'waiting_for_client',
    'blocked',
    'client_review',
    'completed',
    'paused',
    'archived',
    'planning',
    'active',
    'review',
    'on_hold'
  ));

-- Update health check constraint
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_health_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_health_check
  CHECK (health IN ('on_track', 'at_risk', 'delayed'));

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_health_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_health_status_check
  CHECK (health_status IN ('on_track', 'at_risk', 'delayed'));

-- Update Project Memberships role check constraint
ALTER TABLE public.project_memberships DROP CONSTRAINT IF EXISTS project_memberships_project_role_check;
ALTER TABLE public.project_memberships ADD CONSTRAINT project_memberships_project_role_check 
  CHECK (project_role IN ('pm', 'admin', 'lead_consultant', 'specialist', 'it_specialist', 'member', 'client_rep'));

-- 3. Bi-directional Synchronization Trigger for Projects legacy & current fields
CREATE OR REPLACE FUNCTION public.handle_project_field_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync name and title
  IF NEW.name IS NOT NULL AND (NEW.title IS NULL OR NEW.title = '') THEN
    NEW.title = NEW.name;
  ELSIF NEW.title IS NOT NULL AND (NEW.name IS NULL OR NEW.name = '') THEN
    NEW.name = NEW.title;
  END IF;

  -- Default name/title if both empty
  IF (NEW.name IS NULL OR NEW.name = '') AND (NEW.title IS NULL OR NEW.title = '') THEN
    NEW.name = 'Новий проєкт';
    NEW.title = 'Новий проєкт';
  END IF;

  -- Sync health and health_status
  IF NEW.health IS NOT NULL THEN
    NEW.health_status = NEW.health;
  ELSIF NEW.health_status IS NOT NULL THEN
    NEW.health = NEW.health_status;
  END IF;

  -- Sync target_date and target_end_date
  IF NEW.target_date IS NOT NULL THEN
    NEW.target_end_date = NEW.target_date;
  ELSIF NEW.target_end_date IS NOT NULL THEN
    NEW.target_date = NEW.target_end_date;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_projects_field_sync ON public.projects;
CREATE TRIGGER trg_projects_field_sync
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_project_field_sync();

-- 4. Hardened Security Helper Functions (With search_path & Strict RBAC)
-- Checks if user is an explicit project member OR an admin/PM of that specific organization
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
      WHERE p.id = target_project_id
        AND public.is_org_admin(p.organization_id)
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_projects_responsible_pm ON public.projects(responsible_pm_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_health ON public.projects(health);

-- 6. Row-Level Security (RLS) Policies on Projects
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

-- 7. Row-Level Security (RLS) Policies on Project Memberships
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
