-- ==============================================================================
-- Migration: 20260902000026_phase6d1_data_and_submission_core.sql
-- Phase 6D.1: Secure Data & Unified Submission Core
-- Hardened in Phase 6D.1.1: Strict 256-bit CSPRNG, Client-to-Client Isolation,
-- Direct Token Table Default Deny for Clients/Specialists/Anonymous
-- ==============================================================================

-- 1. Table: public.client_action_tokens
CREATE TABLE IF NOT EXISTS public.client_action_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'used')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial Unique Index: Exactly ONE active, unused token per task
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_action_single_active_token 
ON public.client_action_tokens (task_id) 
WHERE (status = 'active' AND used_at IS NULL);

-- Lookup & Task Index
CREATE INDEX IF NOT EXISTS idx_client_action_tokens_hash ON public.client_action_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_client_action_tokens_task_id ON public.client_action_tokens (task_id);

ALTER TABLE public.client_action_tokens ENABLE ROW LEVEL SECURITY;

-- 2. Table: public.task_submissions
CREATE TABLE IF NOT EXISTS public.task_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    token_id UUID NULL REFERENCES public.client_action_tokens(id) ON DELETE SET NULL UNIQUE,
    submitted_by_contact_id UUID NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
    submitted_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    submission_type TEXT NOT NULL CHECK (submission_type IN ('public_link', 'authenticated_portal')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_submissions_task_id ON public.task_submissions (task_id);

ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;

-- 3. Tenant Ownership Invariant Protection Trigger
CREATE OR REPLACE FUNCTION public.enforce_task_tenant_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_expected_org_id UUID;
BEGIN
    SELECT organization_id INTO v_expected_org_id FROM public.tasks WHERE id = NEW.task_id;
    IF v_expected_org_id IS NULL THEN
        RAISE EXCEPTION 'Parent task % not found.', NEW.task_id;
    END IF;
    
    IF NEW.organization_id IS DISTINCT FROM v_expected_org_id THEN
        RAISE EXCEPTION 'Tenant mismatch: organization_id % does not match task organization_id %', 
            NEW.organization_id, v_expected_org_id;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_action_tokens_tenant_guard ON public.client_action_tokens;
CREATE TRIGGER trg_client_action_tokens_tenant_guard
BEFORE INSERT OR UPDATE ON public.client_action_tokens
FOR EACH ROW EXECUTE FUNCTION public.enforce_task_tenant_consistency();

DROP TRIGGER IF EXISTS trg_task_submissions_tenant_guard ON public.task_submissions;
CREATE TRIGGER trg_task_submissions_tenant_guard
BEFORE INSERT OR UPDATE ON public.task_submissions
FOR EACH ROW EXECUTE FUNCTION public.enforce_task_tenant_consistency();

-- 4. Unified Internal Atomic Submission Core
CREATE OR REPLACE FUNCTION public._execute_client_action_submission_core(
    p_task_id UUID,
    p_token_id UUID DEFAULT NULL,
    p_submission_type TEXT DEFAULT 'public_link',
    p_contact_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_payload JSONB DEFAULT '{}'::jsonb,
    p_attachments JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_task RECORD;
    v_sub_id UUID;
BEGIN
    -- 1. Pessimistic Row Locking
    SELECT * INTO v_task 
    FROM public.tasks 
    WHERE id = p_task_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found or access denied.';
    END IF;

    -- 2. Client Responsibility Check
    IF v_task.responsibility_type <> 'client' THEN
        RAISE EXCEPTION 'This task is not a client action.';
    END IF;

    -- 3. Double Completion Blocker
    IF v_task.status = 'done' THEN
        RAISE EXCEPTION 'Action is already completed.';
    END IF;

    -- 3b. Authoritative Server-Side Attachment Validation
    IF p_attachments IS NOT NULL AND jsonb_typeof(p_attachments) = 'array' THEN
        IF jsonb_array_length(p_attachments) > 5 THEN
            RAISE EXCEPTION 'Attachments limit exceeded: maximum 5 files allowed.';
        END IF;

        DECLARE
            v_att JSONB;
            v_att_name TEXT;
            v_att_size BIGINT;
            v_att_ext TEXT;
        BEGIN
            FOR v_att IN SELECT * FROM jsonb_array_elements(p_attachments)
            LOOP
                v_att_name := v_att->>'name';
                v_att_size := COALESCE((v_att->>'size')::BIGINT, 0);

                IF v_att_size > 26214400 THEN
                    RAISE EXCEPTION 'File % exceeds maximum size of 25 MB.', v_att_name;
                END IF;

                v_att_ext := lower(substring(v_att_name from '\.([a-zA-Z0-9]+)$'));

                IF v_att_ext IS NULL OR v_att_ext NOT IN ('pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx', 'zip', 'csv') THEN
                    RAISE EXCEPTION 'File format of % is not allowed. Permitted formats: pdf, png, jpg, jpeg, docx, xlsx, zip, csv.', v_att_name;
                END IF;
            END LOOP;
        END;
    END IF;

    -- 4. Create Task Submission
    INSERT INTO public.task_submissions (
        organization_id,
        task_id,
        token_id,
        submitted_by_contact_id,
        submitted_by_user_id,
        submission_type,
        payload,
        attachments
    ) VALUES (
        v_task.organization_id,
        p_task_id,
        p_token_id,
        p_contact_id,
        p_user_id,
        p_submission_type,
        COALESCE(p_payload, '{}'::jsonb),
        COALESCE(p_attachments, '[]'::jsonb)
    ) RETURNING id INTO v_sub_id;

    -- 5. Mark Task Done
    UPDATE public.tasks
    SET status = 'done',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_task_id;

    -- 6. Invalidate Tokens
    IF p_token_id IS NOT NULL THEN
        UPDATE public.client_action_tokens
        SET status = 'used',
            used_at = NOW()
        WHERE id = p_token_id;
    END IF;

    -- Revoke any remaining active tokens for this task
    UPDATE public.client_action_tokens
    SET status = 'revoked',
        revoked_at = NOW()
    WHERE task_id = p_task_id 
      AND status = 'active' 
      AND (p_token_id IS NULL OR id <> p_token_id);

    -- 7. Trigger Phase 6C Automation Engine (Exactly Once)
    PERFORM public.evaluate_automation_rules(
        'client_action_completed',
        v_task.project_id,
        jsonb_build_object(
            'task_id', p_task_id,
            'submission_id', v_sub_id,
            'submission_type', p_submission_type
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_sub_id,
        'task_id', p_task_id,
        'status', 'done'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Token Generation RPC (Strict 256-bit CSPRNG Entropy Contract)
CREATE OR REPLACE FUNCTION public.generate_action_token(p_task_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_task RECORD;
    v_is_owner BOOLEAN := FALSE;
    v_is_pm_admin BOOLEAN := FALSE;
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

    -- 2. Permissions Authorization
    SELECT (global_role = 'owner') INTO v_is_owner
    FROM public.profiles 
    WHERE id = auth.uid();

    IF NOT COALESCE(v_is_owner, FALSE) THEN
        SELECT EXISTS (
            SELECT 1 FROM public.organization_memberships 
            WHERE organization_id = v_task.organization_id 
              AND user_id = auth.uid() 
              AND org_role IN ('pm', 'org_admin')
        ) OR EXISTS (
            SELECT 1 FROM public.project_memberships 
            WHERE project_id = v_task.project_id 
              AND user_id = auth.uid() 
              AND project_role = 'pm'
        ) INTO v_is_pm_admin;

        IF NOT COALESCE(v_is_pm_admin, FALSE) THEN
            RAISE EXCEPTION 'Access denied: Only Owner, Org Admin, or Project PM can generate action links.';
        END IF;
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

-- 6. Token Revoke & Regenerate RPCs
CREATE OR REPLACE FUNCTION public.revoke_action_token(p_task_id UUID, p_token_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    v_task RECORD;
    v_is_owner BOOLEAN := FALSE;
    v_is_pm_admin BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Task not found.'; END IF;

    SELECT (global_role = 'owner') INTO v_is_owner FROM public.profiles WHERE id = auth.uid();
    IF NOT COALESCE(v_is_owner, FALSE) THEN
        SELECT EXISTS (
            SELECT 1 FROM public.organization_memberships 
            WHERE organization_id = v_task.organization_id 
              AND user_id = auth.uid() 
              AND org_role IN ('pm', 'org_admin')
        ) OR EXISTS (
            SELECT 1 FROM public.project_memberships 
            WHERE project_id = v_task.project_id 
              AND user_id = auth.uid() 
              AND project_role = 'pm'
        ) INTO v_is_pm_admin;

        IF NOT COALESCE(v_is_pm_admin, FALSE) THEN
            RAISE EXCEPTION 'Access denied.';
        END IF;
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

CREATE OR REPLACE FUNCTION public.regenerate_action_token(p_task_id UUID)
RETURNS JSONB AS $$
BEGIN
    RETURN public.generate_action_token(p_task_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Public Action Retrieval RPC (Strict Data Minimization)
CREATE OR REPLACE FUNCTION public.get_public_client_action(p_raw_token TEXT)
RETURNS JSONB AS $$
DECLARE
    v_hash VARCHAR(64);
    v_token RECORD;
    v_task RECORD;
    v_proj RECORD;
    v_org RECORD;
BEGIN
    IF p_raw_token IS NULL OR length(p_raw_token) < 8 THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

    SELECT * INTO v_token
    FROM public.client_action_tokens
    WHERE token_hash = v_hash;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = v_token.task_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    SELECT name INTO v_proj FROM public.projects WHERE id = v_task.project_id;
    SELECT name INTO v_org FROM public.organizations WHERE id = v_task.organization_id;

    -- Differentiated privacy response
    IF v_token.status = 'revoked' THEN
        RETURN jsonb_build_object('status', 'revoked');
    END IF;

    IF v_token.status = 'used' OR v_token.used_at IS NOT NULL OR v_task.status = 'done' THEN
        RETURN jsonb_build_object(
            'status', 'already_used',
            'title', v_task.title,
            'is_completed', true
        );
    END IF;

    IF v_token.expires_at <= NOW() THEN
        RETURN jsonb_build_object('status', 'expired');
    END IF;

    -- Active Safe Projection (Strict Allowlist)
    RETURN jsonb_build_object(
        'status', 'active',
        'action_id', v_task.id,
        'title', v_task.title,
        'description', v_task.description,
        'due_date', v_task.due_date,
        'project_name', v_proj.name,
        'organization_name', v_org.name,
        'is_completed', false,
        'requires_attachments', false,
        'max_attachments', 5
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Public Submission RPC
CREATE OR REPLACE FUNCTION public.submit_public_client_action(
    p_raw_token TEXT,
    p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_hash VARCHAR(64);
    v_token RECORD;
BEGIN
    IF p_raw_token IS NULL OR length(p_raw_token) < 8 THEN
        RAISE EXCEPTION 'Invalid token.';
    END IF;

    v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

    -- Lock Token Row
    SELECT * INTO v_token
    FROM public.client_action_tokens
    WHERE token_hash = v_hash
    FOR UPDATE;

    IF NOT FOUND OR v_token.status = 'revoked' OR v_token.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid or revoked token.';
    END IF;

    IF v_token.status = 'used' OR v_token.used_at IS NOT NULL THEN
        RAISE EXCEPTION 'Action has already been submitted.';
    END IF;

    IF v_token.expires_at <= NOW() THEN
        RAISE EXCEPTION 'Token has expired.';
    END IF;

    -- Route to Unified Core
    RETURN public._execute_client_action_submission_core(
        v_token.task_id,
        v_token.id,
        'public_link',
        NULL,
        NULL,
        p_payload,
        COALESCE(p_payload->'attachments', '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Authenticated Submission RPC
CREATE OR REPLACE FUNCTION public.submit_authenticated_client_action(
    p_task_id UUID,
    p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_task RECORD;
    v_contact_id UUID;
    v_is_member BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found or access denied.';
    END IF;

    IF v_task.responsibility_type <> 'client' THEN
        RAISE EXCEPTION 'This task is not a client action.';
    END IF;

    -- Verify client access
    IF NOT public.can_client_access_project(v_task.project_id) THEN
        -- Check if owner or team PM
        SELECT (global_role = 'owner') INTO v_is_member FROM public.profiles WHERE id = auth.uid();
        IF NOT COALESCE(v_is_member, FALSE) THEN
            SELECT EXISTS (
                SELECT 1 FROM public.organization_memberships 
                WHERE organization_id = v_task.organization_id AND user_id = auth.uid()
            ) INTO v_is_member;
        END IF;

        IF NOT COALESCE(v_is_member, FALSE) THEN
            RAISE EXCEPTION 'Access denied to this project.';
        END IF;
    END IF;

    v_contact_id := public.get_client_contact_id_for_user(v_task.organization_id);

    -- Route to Unified Core
    RETURN public._execute_client_action_submission_core(
        p_task_id,
        NULL,
        'authenticated_portal',
        v_contact_id,
        auth.uid(),
        p_payload,
        COALESCE(p_payload->'attachments', '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Reopen Client Action (Owner / PM / Client Authorized)
CREATE OR REPLACE FUNCTION public.reopen_client_action(p_task_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_task RECORD;
  v_contact_id UUID;
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or access denied.';
  END IF;

  IF v_task.responsibility_type <> 'client' THEN
    RAISE EXCEPTION 'This task is not a client action.';
  END IF;

  -- Verify authorization: Owner OR PM/Org Admin OR Client Contact with access
  SELECT (global_role = 'owner') INTO v_is_authorized FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_authorized, FALSE) THEN
    SELECT EXISTS (
        SELECT 1 FROM public.organization_memberships 
        WHERE organization_id = v_task.organization_id AND user_id = auth.uid() AND org_role IN ('pm', 'org_admin')
    ) OR EXISTS (
        SELECT 1 FROM public.project_memberships 
        WHERE project_id = v_task.project_id AND user_id = auth.uid() AND project_role = 'pm'
    ) INTO v_is_authorized;
  END IF;

  IF NOT COALESCE(v_is_authorized, FALSE) THEN
    IF public.can_client_access_project(v_task.project_id) THEN
      v_is_authorized := TRUE;
      IF v_task.client_contact_id IS NOT NULL THEN
        v_contact_id := public.get_client_contact_id_for_user(v_task.organization_id);
        IF v_contact_id IS NULL OR v_contact_id <> v_task.client_contact_id THEN
          RAISE EXCEPTION 'This action is assigned to another contact.';
        END IF;
      END IF;
    END IF;
  END IF;

  IF NOT COALESCE(v_is_authorized, FALSE) THEN
    RAISE EXCEPTION 'Access denied to this project.';
  END IF;

  UPDATE public.tasks
  SET status = 'todo',
      completed_at = NULL,
      updated_at = NOW()
  WHERE id = p_task_id;

  RETURN jsonb_build_object('success', true, 'task_id', p_task_id, 'status', 'todo');
END;
$$;

-- 11. Hardened Row Level Security (RLS) Policies
-- client_action_tokens
-- STRICT DEFAULT DENY for Authenticated Clients, Specialists, Anonymous, and Foreign Tenants
DROP POLICY IF EXISTS "Owner manage client action tokens" ON public.client_action_tokens;
CREATE POLICY "Owner manage client action tokens" ON public.client_action_tokens
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner'));

DROP POLICY IF EXISTS "PM Admin manage client action tokens" ON public.client_action_tokens;
CREATE POLICY "PM Admin manage client action tokens" ON public.client_action_tokens
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.organization_memberships 
        WHERE organization_id = client_action_tokens.organization_id 
          AND user_id = auth.uid() 
          AND org_role IN ('pm', 'org_admin')
    )
);

-- Drop previous client read policy on tokens table:
DROP POLICY IF EXISTS "Client read own org client action tokens" ON public.client_action_tokens;

-- task_submissions
DROP POLICY IF EXISTS "Owner manage task submissions" ON public.task_submissions;
CREATE POLICY "Owner manage task submissions" ON public.task_submissions
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner'));

DROP POLICY IF EXISTS "PM Admin manage task submissions" ON public.task_submissions;
CREATE POLICY "PM Admin manage task submissions" ON public.task_submissions
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.organization_memberships 
        WHERE organization_id = task_submissions.organization_id 
          AND user_id = auth.uid() 
          AND org_role IN ('pm', 'org_admin')
    )
);

DROP POLICY IF EXISTS "Client manage own org task submissions" ON public.task_submissions;
DROP POLICY IF EXISTS "Client view assigned task submissions" ON public.task_submissions;
CREATE POLICY "Client view assigned task submissions" ON public.task_submissions
FOR SELECT USING (
    public.is_active_client_user(organization_id)
    AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = task_submissions.task_id
          AND t.responsibility_type = 'client'
          AND t.is_client_visible = TRUE
          AND public.can_client_access_project(t.project_id)
          AND (
              t.client_contact_id IS NULL 
              OR t.client_contact_id = public.get_client_contact_id_for_user(t.organization_id)
          )
    )
    AND (
        task_submissions.submitted_by_contact_id IS NULL 
        OR task_submissions.submitted_by_contact_id = public.get_client_contact_id_for_user(task_submissions.organization_id)
    )
);
