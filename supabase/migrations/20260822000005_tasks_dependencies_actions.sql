-- FIRSTWIN Client Portal — Phase 2B: Tasks, Dependencies & Client Actions Migration
-- Target: PostgreSQL / Supabase with Row-Level Security (RLS)

-- -----------------------------------------------------------------------------
-- 1. Tasks Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.project_stages(id) ON DELETE SET NULL,
  milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'waiting_client', 'blocked', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assignee_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  responsibility_type TEXT NOT NULL DEFAULT 'internal'
    CHECK (responsibility_type IN ('internal', 'client')),
  client_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  is_client_visible BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON public.tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_stage ON public.tasks(stage_id);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON public.tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

-- -----------------------------------------------------------------------------
-- 2. Task Dependencies Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_task_dependency UNIQUE(task_id, depends_on_task_id),
  CONSTRAINT chk_no_self_dependency CHECK(task_id <> depends_on_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_dep_task ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dep_depends_on ON public.task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dep_project ON public.task_dependencies(project_id);

-- -----------------------------------------------------------------------------
-- 3. Automatic Task Completion Timestamp Trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_task_completion_time()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    NEW.completed_at = COALESCE(NEW.completed_at, NOW());
  ELSIF NEW.status != 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_task_completion_time ON public.tasks;
CREATE TRIGGER trg_task_completion_time
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_completion_time();

-- -----------------------------------------------------------------------------
-- 4. Task Consistency & Client Action Visibility Validation Trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_task_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_stage_proj_id UUID;
  v_stage_org_id UUID;
  v_milestone_proj_id UUID;
  v_milestone_stage_id UUID;
BEGIN
  -- 1. Client action must be client visible
  IF NEW.responsibility_type = 'client' THEN
    NEW.is_client_visible = TRUE;
  END IF;

  -- 2. Validate stage alignment
  IF NEW.stage_id IS NOT NULL THEN
    SELECT project_id, organization_id INTO v_stage_proj_id, v_stage_org_id
    FROM public.project_stages
    WHERE id = NEW.stage_id;

    IF v_stage_proj_id IS NULL THEN
      RAISE EXCEPTION 'Target project stage does not exist';
    END IF;

    IF v_stage_proj_id <> NEW.project_id OR v_stage_org_id <> NEW.organization_id THEN
      RAISE EXCEPTION 'Stage belongs to a different project or organization';
    END IF;
  END IF;

  -- 3. Validate milestone alignment
  IF NEW.milestone_id IS NOT NULL THEN
    SELECT project_id, stage_id INTO v_milestone_proj_id, v_milestone_stage_id
    FROM public.milestones
    WHERE id = NEW.milestone_id;

    IF v_milestone_proj_id IS NULL THEN
      RAISE EXCEPTION 'Target milestone does not exist';
    END IF;

    IF v_milestone_proj_id <> NEW.project_id THEN
      RAISE EXCEPTION 'Milestone belongs to a different project';
    END IF;

    IF NEW.stage_id IS NOT NULL AND v_milestone_stage_id <> NEW.stage_id THEN
      RAISE EXCEPTION 'Milestone does not belong to the assigned stage';
    END IF;

    -- If stage_id was not set but milestone has stage, auto-associate
    IF NEW.stage_id IS NULL THEN
      NEW.stage_id = v_milestone_stage_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_task_consistency ON public.tasks;
CREATE TRIGGER trg_validate_task_consistency
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_consistency();

-- -----------------------------------------------------------------------------
-- 5. Task Dependency Validation & Cycle Prevention Trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_task_dependency()
RETURNS TRIGGER AS $$
DECLARE
  v_task_proj_id UUID;
  v_task_org_id UUID;
  v_dep_proj_id UUID;
  v_dep_org_id UUID;
  v_cycle_detected BOOLEAN;
BEGIN
  -- 1. Verify task_id and depends_on_task_id exist and get their project_ids
  SELECT project_id, organization_id INTO v_task_proj_id, v_task_org_id
  FROM public.tasks WHERE id = NEW.task_id;

  SELECT project_id, organization_id INTO v_dep_proj_id, v_dep_org_id
  FROM public.tasks WHERE id = NEW.depends_on_task_id;

  IF v_task_proj_id IS NULL OR v_dep_proj_id IS NULL THEN
    RAISE EXCEPTION 'One or both tasks for dependency do not exist';
  END IF;

  IF v_task_proj_id <> v_dep_proj_id OR v_task_org_id <> v_dep_org_id THEN
    RAISE EXCEPTION 'Cannot create cross-project or cross-organization dependency';
  END IF;

  NEW.project_id = v_task_proj_id;
  NEW.organization_id = v_task_org_id;

  -- 2. Detect Cycles (Ensure task_id cannot be reached by following dependencies from depends_on_task_id)
  WITH RECURSIVE dependency_chain AS (
    SELECT td.depends_on_task_id AS current_task_id
    FROM public.task_dependencies td
    WHERE td.task_id = NEW.depends_on_task_id
    
    UNION
    
    SELECT td.depends_on_task_id
    FROM public.task_dependencies td
    JOIN dependency_chain dc ON td.task_id = dc.current_task_id
  )
  SELECT EXISTS (
    SELECT 1 FROM dependency_chain WHERE current_task_id = NEW.task_id
  ) INTO v_cycle_detected;

  IF v_cycle_detected THEN
    RAISE EXCEPTION 'Circular dependency detected: Task cannot depend on a task that directly or indirectly depends on it';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_task_dependency ON public.task_dependencies;
CREATE TRIGGER trg_validate_task_dependency
  BEFORE INSERT OR UPDATE ON public.task_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_dependency();

-- -----------------------------------------------------------------------------
-- 6. Row-Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

-- 6.1 Tasks RLS
DROP POLICY IF EXISTS "Tasks viewable by authorized project members" ON public.tasks;
CREATE POLICY "Tasks viewable by authorized project members" ON public.tasks
  FOR SELECT USING (
    public.is_project_member(project_id)
  );

DROP POLICY IF EXISTS "Tasks insertable by org admin or global owner" ON public.tasks;
CREATE POLICY "Tasks insertable by org admin or global owner" ON public.tasks
  FOR INSERT WITH CHECK (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Tasks updatable by org admin or assigned project members" ON public.tasks;
CREATE POLICY "Tasks updatable by org admin or assigned project members" ON public.tasks
  FOR UPDATE USING (
    public.is_org_admin(organization_id)
    OR (
      public.is_project_member(project_id)
    )
  )
  WITH CHECK (
    (
      public.is_org_admin(organization_id)
      OR (
        public.is_project_member(project_id)
      )
    )
  );

DROP POLICY IF EXISTS "Tasks deletable by org admin or global owner" ON public.tasks;
CREATE POLICY "Tasks deletable by org admin or global owner" ON public.tasks
  FOR DELETE USING (
    public.is_org_admin(organization_id)
  );

-- 6.2 Task Dependencies RLS
DROP POLICY IF EXISTS "Task dependencies viewable by project members" ON public.task_dependencies;
CREATE POLICY "Task dependencies viewable by project members" ON public.task_dependencies
  FOR SELECT USING (
    public.is_project_member(project_id)
  );

DROP POLICY IF EXISTS "Task dependencies insertable by org admin or global owner" ON public.task_dependencies;
CREATE POLICY "Task dependencies insertable by org admin or global owner" ON public.task_dependencies
  FOR INSERT WITH CHECK (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Task dependencies updatable by org admin or global owner" ON public.task_dependencies;
CREATE POLICY "Task dependencies updatable by org admin or global owner" ON public.task_dependencies
  FOR UPDATE USING (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Task dependencies deletable by org admin or global owner" ON public.task_dependencies;
CREATE POLICY "Task dependencies deletable by org admin or global owner" ON public.task_dependencies
  FOR DELETE USING (
    public.is_org_admin(organization_id)
  );
