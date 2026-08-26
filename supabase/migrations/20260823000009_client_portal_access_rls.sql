-- =============================================================================
-- FIRSTWIN Client Portal — Phase 4A Migration
-- Client Access, Invitations, Authentication, Controlled RPCs & Hardened Client RLS
-- Target: PostgreSQL / Supabase with Row-Level Security (RLS)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Client Portal Access Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_portal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'revoked')),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated_at trigger
DROP TRIGGER IF EXISTS set_client_portal_access_updated_at ON public.client_portal_access;
CREATE TRIGGER set_client_portal_access_updated_at
  BEFORE UPDATE ON public.client_portal_access
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performant lookup
CREATE INDEX IF NOT EXISTS idx_cpa_org ON public.client_portal_access(organization_id);
CREATE INDEX IF NOT EXISTS idx_cpa_contact ON public.client_portal_access(contact_id);
CREATE INDEX IF NOT EXISTS idx_cpa_user ON public.client_portal_access(user_id);
CREATE INDEX IF NOT EXISTS idx_cpa_status ON public.client_portal_access(status);

-- Ensure no duplicate active or invited access for the same contact within an organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_cpa_unique_active_invited
  ON public.client_portal_access(organization_id, contact_id)
  WHERE status IN ('invited', 'active');

-- Enable RLS
ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. Client Access Security Helper Functions
-- Hardened with SECURITY DEFINER and search_path = public, pg_temp
-- -----------------------------------------------------------------------------

-- Helper: Is active client user in the organization?
CREATE OR REPLACE FUNCTION public.is_active_client_user(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_portal_access cpa
    JOIN public.organization_memberships om
      ON om.organization_id = cpa.organization_id
     AND om.user_id = cpa.user_id
     AND om.is_active = TRUE
    WHERE cpa.organization_id = p_org_id
      AND cpa.user_id = auth.uid()
      AND cpa.status = 'active'
  );
$$;

-- Helper: Can client access a specific project?
CREATE OR REPLACE FUNCTION public.can_client_access_project(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.project_memberships pm
      ON pm.project_id = p.id
     AND pm.user_id = auth.uid()
    JOIN public.client_portal_access cpa
      ON cpa.organization_id = p.organization_id
     AND cpa.user_id = auth.uid()
     AND cpa.status = 'active'
    JOIN public.organization_memberships om
      ON om.organization_id = p.organization_id
     AND om.user_id = auth.uid()
     AND om.is_active = TRUE
    WHERE p.id = p_project_id
  );
$$;

-- Helper: Can client access a specific document?
CREATE OR REPLACE FUNCTION public.can_client_access_document(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = p_document_id
      AND d.is_client_visible = TRUE
      AND d.internal_access_scope = 'project_team'
      AND d.archived_at IS NULL
      AND public.can_client_access_project(d.project_id)
  );
$$;

-- Helper: Get client contact ID for current auth user in an organization
CREATE OR REPLACE FUNCTION public.get_client_contact_id_for_user(p_org_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT contact_id
  FROM public.client_portal_access
  WHERE organization_id = p_org_id
    AND user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

-- -----------------------------------------------------------------------------
-- 3. Controlled RPC Functions for Client Actions & Activation
-- -----------------------------------------------------------------------------

-- Complete Client Action
CREATE OR REPLACE FUNCTION public.complete_client_action(p_task_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_task RECORD;
  v_contact_id UUID;
BEGIN
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or access denied.';
  END IF;

  IF v_task.responsibility_type <> 'client' OR v_task.is_client_visible <> TRUE THEN
    RAISE EXCEPTION 'This task is not a client action.';
  END IF;

  IF NOT public.can_client_access_project(v_task.project_id) THEN
    RAISE EXCEPTION 'You do not have access to this project.';
  END IF;

  -- If task has a specific client_contact_id assigned, verify user is that contact
  IF v_task.client_contact_id IS NOT NULL THEN
    v_contact_id := public.get_client_contact_id_for_user(v_task.organization_id);
    IF v_contact_id IS NULL OR v_contact_id <> v_task.client_contact_id THEN
      RAISE EXCEPTION 'This action is assigned to another contact.';
    END IF;
  END IF;

  UPDATE public.tasks
  SET status = 'done',
      completed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_task_id;

  RETURN jsonb_build_object('success', true, 'task_id', p_task_id, 'status', 'done');
END;
$$;

-- Reopen Client Action
CREATE OR REPLACE FUNCTION public.reopen_client_action(p_task_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_task RECORD;
  v_contact_id UUID;
BEGIN
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or access denied.';
  END IF;

  IF v_task.responsibility_type <> 'client' OR v_task.is_client_visible <> TRUE THEN
    RAISE EXCEPTION 'This task is not a client action.';
  END IF;

  IF NOT public.can_client_access_project(v_task.project_id) THEN
    RAISE EXCEPTION 'You do not have access to this project.';
  END IF;

  IF v_task.client_contact_id IS NOT NULL THEN
    v_contact_id := public.get_client_contact_id_for_user(v_task.organization_id);
    IF v_contact_id IS NULL OR v_contact_id <> v_task.client_contact_id THEN
      RAISE EXCEPTION 'This action is assigned to another contact.';
    END IF;
  END IF;

  UPDATE public.tasks
  SET status = 'todo',
      completed_at = NULL,
      updated_at = NOW()
  WHERE id = p_task_id;

  RETURN jsonb_build_object('success', true, 'task_id', p_task_id, 'status', 'todo');
END;
$$;

-- Activate Client Portal Access upon authenticated login/activation
CREATE OR REPLACE FUNCTION public.activate_client_portal_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_email TEXT;
  v_updated_count INT;
BEGIN
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User not authenticated.';
  END IF;

  -- Match by user_id OR by contact email
  UPDATE public.client_portal_access cpa
  SET status = 'active',
      user_id = auth.uid(),
      activated_at = COALESCE(cpa.activated_at, NOW()),
      updated_at = NOW()
  FROM public.contacts c
  WHERE cpa.contact_id = c.id
    AND (cpa.user_id = auth.uid() OR LOWER(c.email) = LOWER(v_user_email))
    AND cpa.status = 'invited';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Ensure organization_memberships has user_id set and active
  UPDATE public.organization_memberships om
  SET user_id = auth.uid(),
      is_active = TRUE,
      updated_at = NOW()
  FROM public.client_portal_access cpa
  WHERE cpa.organization_id = om.organization_id
    AND cpa.user_id = auth.uid()
    AND cpa.status = 'active'
    AND om.user_id = auth.uid();

  -- Update profile global_role to client if currently default or not higher role
  UPDATE public.profiles
  SET global_role = 'client',
      updated_at = NOW()
  WHERE id = auth.uid()
    AND (global_role IS NULL OR global_role NOT IN ('owner', 'pm', 'specialist'));

  RETURN jsonb_build_object('success', true, 'activated_records', v_updated_count);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. RLS Policies for `client_portal_access`
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "cpa_owner_and_admin_all" ON public.client_portal_access;
CREATE POLICY "cpa_owner_and_admin_all"
  ON public.client_portal_access
  FOR ALL
  USING (
    public.is_global_owner() OR
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "cpa_client_select_own" ON public.client_portal_access;
CREATE POLICY "cpa_client_select_own"
  ON public.client_portal_access
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- 5. Hardened Client RLS Policies on Core Platform Tables
-- -----------------------------------------------------------------------------

-- 5.1 Organizations
DROP POLICY IF EXISTS "org_client_select" ON public.organizations;
CREATE POLICY "org_client_select"
  ON public.organizations
  FOR SELECT
  USING (
    public.is_active_client_user(id)
  );

-- 5.2 Contacts
DROP POLICY IF EXISTS "contacts_client_select" ON public.contacts;
CREATE POLICY "contacts_client_select"
  ON public.contacts
  FOR SELECT
  USING (
    public.is_active_client_user(organization_id)
  );

-- 5.3 Projects
DROP POLICY IF EXISTS "projects_client_select" ON public.projects;
CREATE POLICY "projects_client_select"
  ON public.projects
  FOR SELECT
  USING (
    public.can_client_access_project(id)
  );

-- 5.4 Project Stages (Roadmap)
DROP POLICY IF EXISTS "stages_client_select" ON public.project_stages;
CREATE POLICY "stages_client_select"
  ON public.project_stages
  FOR SELECT
  USING (
    is_client_visible = TRUE AND
    public.can_client_access_project(project_id)
  );

-- 5.5 Milestones (Roadmap)
DROP POLICY IF EXISTS "milestones_client_select" ON public.milestones;
CREATE POLICY "milestones_client_select"
  ON public.milestones
  FOR SELECT
  USING (
    is_client_visible = TRUE AND
    public.can_client_access_project(project_id)
  );

-- 5.6 Tasks (Client Actions Read Policy)
DROP POLICY IF EXISTS "tasks_client_select" ON public.tasks;
CREATE POLICY "tasks_client_select"
  ON public.tasks
  FOR SELECT
  USING (
    is_client_visible = TRUE AND
    responsibility_type = 'client' AND
    public.can_client_access_project(project_id)
  );

-- 5.7 Documents
DROP POLICY IF EXISTS "docs_client_select" ON public.documents;
CREATE POLICY "docs_client_select"
  ON public.documents
  FOR SELECT
  USING (
    is_client_visible = TRUE AND
    internal_access_scope = 'project_team' AND
    archived_at IS NULL AND
    public.can_client_access_project(project_id)
  );

-- 5.8 Document Versions
DROP POLICY IF EXISTS "doc_versions_client_select" ON public.document_versions;
CREATE POLICY "doc_versions_client_select"
  ON public.document_versions
  FOR SELECT
  USING (
    public.can_client_access_document(document_id)
  );

-- 5.9 Supabase Storage (project-documents)
DROP POLICY IF EXISTS "client_download_project_documents" ON storage.objects;
CREATE POLICY "client_download_project_documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'project-documents' AND
    EXISTS (
      SELECT 1
      FROM public.document_versions dv
      JOIN public.documents d ON d.id = dv.document_id
      WHERE dv.storage_path = name
        AND public.can_client_access_document(d.id)
    )
  );

-- 5.10 Meetings
DROP POLICY IF EXISTS "meetings_client_select" ON public.meetings;
CREATE POLICY "meetings_client_select"
  ON public.meetings
  FOR SELECT
  USING (
    is_client_visible = TRUE AND
    public.can_client_access_project(project_id)
  );

-- 5.11 Meeting Notes
DROP POLICY IF EXISTS "meeting_notes_client_select" ON public.meeting_notes;
CREATE POLICY "meeting_notes_client_select"
  ON public.meeting_notes
  FOR SELECT
  USING (
    is_client_visible = TRUE AND
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_id
        AND m.is_client_visible = TRUE
        AND public.can_client_access_project(m.project_id)
    )
  );

-- 5.12 Meeting Decisions
DROP POLICY IF EXISTS "meeting_decisions_client_select" ON public.meeting_decisions;
CREATE POLICY "meeting_decisions_client_select"
  ON public.meeting_decisions
  FOR SELECT
  USING (
    is_client_visible = TRUE AND
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_id
        AND m.is_client_visible = TRUE
        AND public.can_client_access_project(m.project_id)
    )
  );

-- 5.13 Meeting Participants
DROP POLICY IF EXISTS "meeting_participants_client_select" ON public.meeting_participants;
CREATE POLICY "meeting_participants_client_select"
  ON public.meeting_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_id
        AND m.is_client_visible = TRUE
        AND public.can_client_access_project(m.project_id)
    )
  );

-- -----------------------------------------------------------------------------
-- 6. Hardening Internal Role Policies (Protecting Hidden Stages, Milestones, Tasks)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_internal_project_member(target_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    public.is_global_owner()
    OR (
      (
        EXISTS (
          SELECT 1 FROM public.project_memberships pm
          JOIN public.profiles pr ON pr.id = pm.user_id
          WHERE pm.project_id = target_project_id 
            AND pm.user_id = auth.uid()
            AND pm.project_role <> 'client_rep'
            AND pr.global_role <> 'client'
        )
        OR EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = target_project_id
            AND public.is_org_admin(p.organization_id)
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.client_portal_access cpa
        WHERE cpa.user_id = auth.uid()
          AND cpa.status = 'active'
      )
    )
  );
$$;

DROP POLICY IF EXISTS "Project stages viewable by authorized project members" ON public.project_stages;
CREATE POLICY "Project stages viewable by authorized project members"
  ON public.project_stages
  FOR SELECT
  USING (
    public.is_internal_project_member(project_id)
  );

DROP POLICY IF EXISTS "Milestones viewable by authorized project members" ON public.milestones;
CREATE POLICY "Milestones viewable by authorized project members"
  ON public.milestones
  FOR SELECT
  USING (
    public.is_internal_project_member(project_id)
  );

DROP POLICY IF EXISTS "Tasks viewable by authorized project members" ON public.tasks;
CREATE POLICY "Tasks viewable by authorized project members"
  ON public.tasks
  FOR SELECT
  USING (
    public.is_internal_project_member(project_id)
  );

