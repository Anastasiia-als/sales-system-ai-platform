-- FIRSTWIN Client Portal — Phase 2B.1: Task Permission Hardening Migration
-- Target: PostgreSQL / Supabase with Row-Level Security (RLS)

-- -----------------------------------------------------------------------------
-- 1. Hardened Task Update RLS Policy
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tasks updatable by org admin or assigned project members" ON public.tasks;
DROP POLICY IF EXISTS "Tasks updatable by org admin or assignee" ON public.tasks;

CREATE POLICY "Tasks updatable by org admin or assignee" ON public.tasks
  FOR UPDATE USING (
    public.is_org_admin(organization_id)
    OR (
      public.is_project_member(project_id)
      AND assignee_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_org_admin(organization_id)
    OR (
      public.is_project_member(project_id)
      AND assignee_user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Database Trigger for Specialist Tamper Protection
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_task_unauthorized_modifications()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Allow all modifications for Global Owner or Organization Admins / PMs
  IF public.is_org_admin(OLD.organization_id) THEN
    RETURN NEW;
  END IF;

  -- 2. For non-admin project members (Specialists):
  -- Ensure user is the assigned user on the record
  IF OLD.assignee_user_id IS NULL OR OLD.assignee_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Specialists are only permitted to update tasks assigned directly to them';
  END IF;

  -- 3. Strictly block modification of organization or project boundaries
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify task organization_id';
  END IF;

  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify task project_id';
  END IF;

  -- 4. Strictly block modification of stage and milestone associations
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    RAISE EXCEPTION 'Unauthorized: Specialists cannot change task stage association';
  END IF;

  IF NEW.milestone_id IS DISTINCT FROM OLD.milestone_id THEN
    RAISE EXCEPTION 'Unauthorized: Specialists cannot change task milestone association';
  END IF;

  -- 5. Strictly block reassignment of assignee_user_id
  IF NEW.assignee_user_id IS DISTINCT FROM OLD.assignee_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Specialists cannot reassign task assignee';
  END IF;

  -- 6. Strictly block priority changes (Controlled exclusively by PM / Admin)
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    RAISE EXCEPTION 'Unauthorized: Task priority can only be modified by PM or Admin';
  END IF;

  -- 7. Strictly block responsibility type and client contact tampering
  IF NEW.responsibility_type IS DISTINCT FROM OLD.responsibility_type THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify task responsibility type';
  END IF;

  IF NEW.client_contact_id IS DISTINCT FROM OLD.client_contact_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify task client contact';
  END IF;

  -- 8. Strictly block visibility and audit changes
  IF NEW.is_client_visible IS DISTINCT FROM OLD.is_client_visible THEN
    RAISE EXCEPTION 'Unauthorized: Specialists cannot alter task client visibility';
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify task created_by metadata';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_prevent_task_unauthorized_modifications ON public.tasks;
CREATE TRIGGER trg_prevent_task_unauthorized_modifications
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_task_unauthorized_modifications();
