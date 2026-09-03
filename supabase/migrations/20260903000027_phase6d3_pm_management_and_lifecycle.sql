-- ============================================================================
-- Migration: 20260903000027_phase6d3_pm_management_and_lifecycle.sql
-- Description: Phase 6D.3 PM Management UI & Magic Link Lifecycle RPCs
-- ============================================================================

-- 1. Helper function: Is authorized PM/Admin for task
CREATE OR REPLACE FUNCTION public._is_authorized_pm_for_task(p_task_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_task RECORD;
    v_is_owner BOOLEAN := FALSE;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Global Owner Check
    SELECT (global_role = 'owner') INTO v_is_owner 
    FROM public.profiles 
    WHERE id = auth.uid();
    
    IF COALESCE(v_is_owner, FALSE) THEN
        RETURN TRUE;
    END IF;

    -- Org Admin or Org PM Check
    SELECT EXISTS (
        SELECT 1 FROM public.organization_memberships 
        WHERE organization_id = v_task.organization_id 
          AND user_id = auth.uid() 
          AND org_role IN ('pm', 'org_admin', 'admin')
    ) INTO v_is_authorized;

    IF v_is_authorized THEN
        RETURN TRUE;
    END IF;

    -- Project-Scoped PM Check: responsible_pm_id OR project_memberships with PM role ONLY
    SELECT (p.responsible_pm_id = auth.uid()) OR EXISTS (
        SELECT 1 FROM public.project_memberships pm
        WHERE pm.project_id = v_task.project_id 
          AND pm.user_id = auth.uid() 
          AND pm.project_role = 'pm'
    ) INTO v_is_authorized
    FROM public.projects p
    WHERE p.id = v_task.project_id;

    RETURN COALESCE(v_is_authorized, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Token Generation RPC (with strict server-derived PM authorization)
CREATE OR REPLACE FUNCTION public.generate_action_token(p_task_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_task RECORD;
    v_raw_token TEXT;
    v_token_hash VARCHAR(64);
    v_expires_at TIMESTAMPTZ;
    v_token_id UUID;
BEGIN
    -- 1. Lock Task
    SELECT * INTO v_task 
    FROM public.tasks 
    WHERE id = p_task_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found.';
    END IF;

    IF v_task.responsibility_type <> 'client' THEN
        RAISE EXCEPTION 'Task is not a client action.';
    END IF;

    -- 2. Strict Server-Derived PM Authorization
    IF NOT public._is_authorized_pm_for_task(p_task_id) THEN
        RAISE EXCEPTION 'Access denied: Only Owner, Org Admin, or Project PM can generate action links.';
    END IF;

    -- 3. Atomically Revoke Prior Active Unused Tokens
    UPDATE public.client_action_tokens
    SET status = 'revoked',
        revoked_at = NOW()
    WHERE task_id = p_task_id 
      AND status = 'active' 
      AND used_at IS NULL;

    -- 4. Generate EXACT 256-bit (32 CSPRNG bytes) Cryptographic Token & Hash
    v_raw_token := 'fwa_' || encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');
    v_expires_at := NOW() + INTERVAL '14 days';

    -- 5. Insert Hash Record (Derived organization_id)
    INSERT INTO public.client_action_tokens (
        organization_id,
        task_id,
        token_hash,
        status,
        expires_at,
        created_by
    ) VALUES (
        v_task.organization_id,
        p_task_id,
        v_token_hash,
        'active',
        v_expires_at,
        auth.uid()
    ) RETURNING id INTO v_token_id;

    -- 6. Return raw token ONCE in response
    RETURN jsonb_build_object(
        'success', true,
        'raw_token', v_raw_token,
        'token_id', v_token_id,
        'expires_at', v_expires_at,
        'public_url', '#/action/' || v_raw_token
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Token Revocation RPC
CREATE OR REPLACE FUNCTION public.revoke_action_token(p_task_id UUID, p_token_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_task RECORD;
BEGIN
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task not found.'; END IF;

    -- Strict Server-Derived PM Authorization
    IF NOT public._is_authorized_pm_for_task(p_task_id) THEN
        RAISE EXCEPTION 'Access denied: Only Owner, Org Admin, or Project PM can revoke action links.';
    END IF;

    UPDATE public.client_action_tokens
    SET status = 'revoked',
        revoked_at = NOW()
    WHERE task_id = p_task_id 
      AND status = 'active'
      AND (p_token_id IS NULL OR id = p_token_id);

    RETURN jsonb_build_object('success', true, 'status', 'revoked');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Token Regeneration RPC
CREATE OR REPLACE FUNCTION public.regenerate_action_token(p_task_id UUID)
RETURNS JSONB AS $$
BEGIN
    RETURN public.generate_action_token(p_task_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Reopen Client Action RPC (Canonical PM Management Operation)
CREATE OR REPLACE FUNCTION public.reopen_client_action(p_task_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_task RECORD;
BEGIN
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found or access denied.';
    END IF;

    IF v_task.responsibility_type <> 'client' THEN
        RAISE EXCEPTION 'This task is not a client action.';
    END IF;

    -- Strict Server-Derived PM Authorization
    IF NOT public._is_authorized_pm_for_task(p_task_id) THEN
        RAISE EXCEPTION 'Access denied: Only Owner, Org Admin, or Project PM can reopen client actions.';
    END IF;

    -- Update Task State to todo
    UPDATE public.tasks
    SET status = 'todo',
        completed_at = NULL,
        updated_at = NOW()
    WHERE id = p_task_id;

    -- Invalidate any active tokens from prior lifecycle
    UPDATE public.client_action_tokens
    SET status = 'revoked',
        revoked_at = NOW()
    WHERE task_id = p_task_id 
      AND status = 'active';

    RETURN jsonb_build_object('success', true, 'task_id', p_task_id, 'status', 'todo');
END;
$$;

-- 6. RPC: Get Client Action Token Status (Precedence-Based Canonical State)
CREATE OR REPLACE FUNCTION public.get_client_action_token_status(p_task_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_task RECORD;
    v_has_submissions BOOLEAN := FALSE;
    v_latest_token RECORD;
    v_active_token RECORD;
BEGIN
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found.';
    END IF;

    -- Authorization: PM, Admin, Owner, or Active Client Member
    IF NOT public._is_authorized_pm_for_task(p_task_id) THEN
        IF NOT (
            public.is_active_client_user(v_task.organization_id)
            AND public.can_client_access_project(v_task.project_id)
        ) THEN
            RAISE EXCEPTION 'Access denied.';
        END IF;
    END IF;

    -- Check if any submissions exist
    SELECT EXISTS (
        SELECT 1 FROM public.task_submissions WHERE task_id = p_task_id
    ) INTO v_has_submissions;

    -- Order of Precedence 1: Task done + submission exists -> 'done'
    IF v_task.status = 'done' AND v_has_submissions THEN
        RETURN jsonb_build_object(
            'status', 'done',
            'is_completed', true,
            'completed_at', v_task.completed_at
        );
    END IF;

    -- Check for currently active token
    SELECT * INTO v_active_token
    FROM public.client_action_tokens
    WHERE task_id = p_task_id AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Order of Precedence 2 & 3: Active token exists
    IF FOUND THEN
        IF v_active_token.expires_at > NOW() THEN
            RETURN jsonb_build_object(
                'status', 'active',
                'token_id', v_active_token.id,
                'expires_at', v_active_token.expires_at,
                'created_at', v_active_token.created_at,
                'is_completed', false
            );
        ELSE
            RETURN jsonb_build_object(
                'status', 'expired',
                'token_id', v_active_token.id,
                'expires_at', v_active_token.expires_at,
                'created_at', v_active_token.created_at,
                'is_completed', false
            );
        END IF;
    END IF;

    -- Order of Precedence 4: Task in todo lifecycle after Reopen
    IF v_has_submissions AND v_task.status = 'todo' THEN
        -- Task was completed and reopened -> canonical state is 'none' («Не згенеровано»)
        RETURN jsonb_build_object(
            'status', 'none',
            'is_completed', false,
            'reopened', true
        );
    END IF;

    -- Check for latest revoked token (without reopen)
    SELECT * INTO v_latest_token
    FROM public.client_action_tokens
    WHERE task_id = p_task_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND AND v_latest_token.status = 'revoked' THEN
        RETURN jsonb_build_object(
            'status', 'revoked',
            'token_id', v_latest_token.id,
            'revoked_at', v_latest_token.revoked_at,
            'is_completed', false
        );
    END IF;

    -- Order of Precedence 5: No active token and no explicit revocation -> 'none'
    RETURN jsonb_build_object(
        'status', 'none',
        'is_completed', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Get Task Submissions (with PM / Scoped Authorization)
CREATE OR REPLACE FUNCTION public.get_task_submissions(p_task_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_task RECORD;
    v_res JSONB;
BEGIN
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found.';
    END IF;

    -- Authorization check
    IF NOT public._is_authorized_pm_for_task(p_task_id) THEN
        IF NOT (
            public.is_active_client_user(v_task.organization_id)
            AND public.can_client_access_project(v_task.project_id)
        ) THEN
            RAISE EXCEPTION 'Access denied.';
        END IF;
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'task_id', s.task_id,
            'token_id', s.token_id,
            'submission_type', s.submission_type,
            'payload', s.payload,
            'attachments', s.attachments,
            'created_at', s.created_at,
            'submitted_by_user_id', s.submitted_by_user_id,
            'submitted_by_user_name', p.full_name,
            'submitted_by_contact_id', s.submitted_by_contact_id,
            'submitted_by_contact_name', TRIM(COALESCE(cc.first_name, '') || ' ' || COALESCE(cc.last_name, '')),
            'submitted_by_contact_email', cc.email
        ) ORDER BY s.created_at ASC
    ) INTO v_res
    FROM public.task_submissions s
    LEFT JOIN public.profiles p ON p.id = s.submitted_by_user_id
    LEFT JOIN public.contacts cc ON cc.id = s.submitted_by_contact_id
    WHERE s.task_id = p_task_id;

    RETURN COALESCE(v_res, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Hardened RLS Policies for PM Memberships
DROP POLICY IF EXISTS "PM Admin manage client action tokens" ON public.client_action_tokens;
CREATE POLICY "PM Admin manage client action tokens" ON public.client_action_tokens
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.organization_memberships 
        WHERE organization_id = client_action_tokens.organization_id 
          AND user_id = auth.uid() 
          AND org_role IN ('pm', 'org_admin', 'admin')
    ) OR EXISTS (
        SELECT 1 FROM public.tasks t
        JOIN public.projects p ON p.id = t.project_id
        WHERE t.id = client_action_tokens.task_id
          AND (
            p.responsible_pm_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.project_memberships pm
                WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.project_role = 'pm'
            )
          )
    )
);

DROP POLICY IF EXISTS "PM Admin manage task submissions" ON public.task_submissions;
CREATE POLICY "PM Admin manage task submissions" ON public.task_submissions
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.organization_memberships 
        WHERE organization_id = task_submissions.organization_id 
          AND user_id = auth.uid() 
          AND org_role IN ('pm', 'org_admin', 'admin')
    ) OR EXISTS (
        SELECT 1 FROM public.tasks t
        JOIN public.projects p ON p.id = t.project_id
        WHERE t.id = task_submissions.task_id
          AND (
            p.responsible_pm_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.project_memberships pm
                WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.project_role = 'pm'
            )
          )
    )
);

-- 9. Explicit Grants
GRANT EXECUTE ON FUNCTION public._is_authorized_pm_for_task(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_action_token(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_action_token(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.regenerate_action_token(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_client_action(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_client_action_token_status(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_task_submissions(UUID) TO authenticated, service_role;

-- 10. Update prevent_task_unauthorized_modifications to recognize project-scoped PMs
CREATE OR REPLACE FUNCTION public.prevent_task_unauthorized_modifications()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_id UUID;
BEGIN
  -- 1. Allow all modifications for Direct DB Admin, Global Owner, Org Admins / PMs, or Project-Scoped PMs
  IF auth.uid() IS NULL 
     OR public.is_org_admin(OLD.organization_id)
     OR EXISTS (
         SELECT 1 FROM public.projects p
         WHERE p.id = OLD.project_id AND p.responsible_pm_id = auth.uid()
     )
     OR EXISTS (
         SELECT 1 FROM public.project_memberships pm
         WHERE pm.project_id = OLD.project_id AND pm.user_id = auth.uid() AND pm.project_role = 'pm'
     ) THEN
    RETURN NEW;
  END IF;

  -- 2. Client User Path:
  IF OLD.responsibility_type = 'client' AND OLD.is_client_visible = TRUE THEN
    IF public.is_active_client_user(OLD.organization_id) AND public.can_client_access_project(OLD.project_id) THEN
      IF OLD.client_contact_id IS NOT NULL THEN
        v_contact_id := public.get_client_contact_id_for_user(OLD.organization_id);
        IF v_contact_id IS NULL OR v_contact_id <> OLD.client_contact_id THEN
          RAISE EXCEPTION 'Unauthorized: Client action is assigned to another contact';
        END IF;
      END IF;

      IF NEW.status NOT IN ('todo', 'done') THEN
        RAISE EXCEPTION 'Unauthorized: Clients can only mark actions as done or todo';
      END IF;

      IF NEW.title IS DISTINCT FROM OLD.title OR
         NEW.description IS DISTINCT FROM OLD.description OR
         NEW.organization_id IS DISTINCT FROM OLD.organization_id OR
         NEW.project_id IS DISTINCT FROM OLD.project_id OR
         NEW.stage_id IS DISTINCT FROM OLD.stage_id OR
         NEW.milestone_id IS DISTINCT FROM OLD.milestone_id OR
         NEW.assignee_user_id IS DISTINCT FROM OLD.assignee_user_id OR
         NEW.priority IS DISTINCT FROM OLD.priority OR
         NEW.responsibility_type IS DISTINCT FROM OLD.responsibility_type OR
         NEW.client_contact_id IS DISTINCT FROM OLD.client_contact_id OR
         NEW.is_client_visible IS DISTINCT FROM OLD.is_client_visible OR
         NEW.created_by IS DISTINCT FROM OLD.created_by OR
         NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Unauthorized: Clients cannot modify task metadata';
      END IF;

      RETURN NEW;
    END IF;
  END IF;

  -- 3. Specialist Path:
  IF OLD.assignee_user_id IS NULL OR OLD.assignee_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Specialists are only permitted to update tasks assigned directly to them';
  END IF;

  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify task organization_id';
  END IF;
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify task project_id';
  END IF;
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    RAISE EXCEPTION 'Unauthorized: Specialists cannot change task stage association';
  END IF;
  IF NEW.milestone_id IS DISTINCT FROM OLD.milestone_id THEN
    RAISE EXCEPTION 'Unauthorized: Specialists cannot change task milestone association';
  END IF;
  IF NEW.assignee_user_id IS DISTINCT FROM OLD.assignee_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Specialists cannot reassign task assignee';
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    RAISE EXCEPTION 'Unauthorized: Task priority can only be modified by PM or Admin';
  END IF;
  IF NEW.responsibility_type IS DISTINCT FROM OLD.responsibility_type THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify task responsibility type';
  END IF;
  IF NEW.client_contact_id IS DISTINCT FROM OLD.client_contact_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify task client contact';
  END IF;
  IF NEW.is_client_visible IS DISTINCT FROM OLD.is_client_visible THEN
    RAISE EXCEPTION 'Unauthorized: Specialists cannot alter task client visibility';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Unauthorized: Cannot modify task created_by metadata';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

