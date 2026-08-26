-- FIRSTWIN Client Portal — Phase 2A: Roadmap, Project Stages & Milestones Migration
-- Target: PostgreSQL / Supabase with Row-Level Security (RLS)

-- -----------------------------------------------------------------------------
-- 1. Project Stages Table (Ordered phases of project execution)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'not_started' 
    CHECK (status IN ('not_started', 'in_progress', 'waiting_client', 'blocked', 'completed')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date DATE,
  target_date DATE,
  is_client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_project_stages_updated_at ON public.project_stages;
CREATE TRIGGER set_project_stages_updated_at
  BEFORE UPDATE ON public.project_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_project_stages_project ON public.project_stages(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_project_stages_org ON public.project_stages(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_stages_status ON public.project_stages(status);

-- -----------------------------------------------------------------------------
-- 2. Milestones Table (Checkpoints inside a stage)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.project_stages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'completed')),
  completed_at TIMESTAMPTZ,
  is_client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_milestones_updated_at ON public.milestones;
CREATE TRIGGER set_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_milestones_stage ON public.milestones(stage_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON public.milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_org ON public.milestones(organization_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON public.milestones(status);

-- -----------------------------------------------------------------------------
-- 3. Trigger for Automatic Milestone Completion Timestamp Management
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_milestone_completion_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    NEW.completed_at = COALESCE(NEW.completed_at, NOW());
  ELSIF NEW.status = 'pending' THEN
    NEW.completed_at = NULL;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_milestone_completion_time ON public.milestones;
CREATE TRIGGER trg_milestone_completion_time
  BEFORE INSERT OR UPDATE ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_milestone_completion_time();

-- -----------------------------------------------------------------------------
-- 4. Consistency Trigger: Ensure Stage & Milestone share same project_id & organization_id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_milestone_stage_consistency()
RETURNS TRIGGER AS $$
DECLARE
  stage_proj_id UUID;
  stage_org_id UUID;
BEGIN
  SELECT project_id, organization_id INTO stage_proj_id, stage_org_id
  FROM public.project_stages
  WHERE id = NEW.stage_id;

  IF stage_proj_id IS NULL THEN
    RAISE EXCEPTION 'Target project stage does not exist';
  END IF;

  -- Auto-align milestone project_id & organization_id to matching stage
  NEW.project_id = stage_proj_id;
  NEW.organization_id = stage_org_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_milestone_stage_consistency ON public.milestones;
CREATE TRIGGER trg_validate_milestone_stage_consistency
  BEFORE INSERT OR UPDATE ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_milestone_stage_consistency();

-- -----------------------------------------------------------------------------
-- 5. Row-Level Security (RLS) for project_stages & milestones
-- -----------------------------------------------------------------------------
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- 5.1 Project Stages RLS Policies
DROP POLICY IF EXISTS "Project stages viewable by authorized project members" ON public.project_stages;
CREATE POLICY "Project stages viewable by authorized project members" ON public.project_stages
  FOR SELECT USING (
    public.is_project_member(project_id)
  );

DROP POLICY IF EXISTS "Project stages insertable by org admin or global owner" ON public.project_stages;
CREATE POLICY "Project stages insertable by org admin or global owner" ON public.project_stages
  FOR INSERT WITH CHECK (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Project stages updatable by org admin or global owner" ON public.project_stages;
CREATE POLICY "Project stages updatable by org admin or global owner" ON public.project_stages
  FOR UPDATE USING (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Project stages deletable by org admin or global owner" ON public.project_stages;
CREATE POLICY "Project stages deletable by org admin or global owner" ON public.project_stages
  FOR DELETE USING (
    public.is_org_admin(organization_id)
  );

-- 5.2 Milestones RLS Policies
DROP POLICY IF EXISTS "Milestones viewable by authorized project members" ON public.milestones;
CREATE POLICY "Milestones viewable by authorized project members" ON public.milestones
  FOR SELECT USING (
    public.is_project_member(project_id)
  );

DROP POLICY IF EXISTS "Milestones insertable by org admin or global owner" ON public.milestones;
CREATE POLICY "Milestones insertable by org admin or global owner" ON public.milestones
  FOR INSERT WITH CHECK (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Milestones updatable by org admin or global owner" ON public.milestones;
CREATE POLICY "Milestones updatable by org admin or global owner" ON public.milestones
  FOR UPDATE USING (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Milestones deletable by org admin or global owner" ON public.milestones;
CREATE POLICY "Milestones deletable by org admin or global owner" ON public.milestones
  FOR DELETE USING (
    public.is_org_admin(organization_id)
  );
