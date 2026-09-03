-- ==============================================================================
-- Migration: 20260904000028_phase6d4_authenticated_portal_and_actions.sql
-- Description: Phase 6D.4 Client Portal Integration & Authenticated Actions
-- ==============================================================================

-- 1. Hardened Tasks Client Select RLS Policy (Strict Client A vs Client B isolation)
DROP POLICY IF EXISTS "tasks_client_select" ON public.tasks;
CREATE POLICY "tasks_client_select"
  ON public.tasks
  FOR SELECT
  USING (
    is_client_visible = TRUE AND
    responsibility_type = 'client' AND
    public.can_client_access_project(project_id) AND
    (
      client_contact_id IS NULL OR 
      client_contact_id = public.get_client_contact_id_for_user(organization_id)
    )
  );

-- 2. Hardened submit_authenticated_client_action RPC (Server-Derived Contact Authority & Revoke Magic Links)
CREATE OR REPLACE FUNCTION public.submit_authenticated_client_action(
    p_task_id UUID,
    p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_task RECORD;
    v_contact_id UUID;
    v_is_member BOOLEAN := FALSE;
    v_attachments JSONB;
BEGIN
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found or access denied.';
    END IF;

    IF v_task.responsibility_type <> 'client' THEN
        RAISE EXCEPTION 'This task is not a client action.';
    END IF;

    -- Verify client access to project
    IF NOT public.can_client_access_project(v_task.project_id) THEN
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

    -- Authoritative server-derived contact identity
    v_contact_id := public.get_client_contact_id_for_user(v_task.organization_id);

    -- Strict Client A vs Client B isolation within same organization
    IF v_task.client_contact_id IS NOT NULL THEN
        IF v_contact_id IS NULL OR v_contact_id <> v_task.client_contact_id THEN
            IF NOT (public.is_global_owner() OR public._is_authorized_pm_for_task(p_task_id)) THEN
                RAISE EXCEPTION 'Access denied: Client action is assigned to another contact.';
            END IF;
        END IF;
    END IF;

    -- Extract attachments from payload
    v_attachments := COALESCE(p_payload->'attachments', '[]'::jsonb);

    -- Delegate to Unified Core (passing p_token_id = NULL)
    -- Unified Core strictly executes:
    -- 1. Pessimistic row locking
    -- 2. Server-side attachment allowlist & 25MB validation
    -- 3. Marks task done, records task_submissions with authenticated_portal
    -- 4. Revokes all active Magic Link tokens (status='revoked', revoked_at=NOW(), used_at=NULL)
    -- 5. Fires Automation Engine exactly once
    -- 6. Generates deterministic notifications (PM != Owner -> 2 rows, PM == Owner -> 1 row)
    RETURN public._execute_client_action_submission_core(
        p_task_id,
        NULL,
        'authenticated_portal',
        v_contact_id,
        auth.uid(),
        p_payload,
        v_attachments
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Server-Side Authoritative Storage Path Generator
CREATE OR REPLACE FUNCTION public.generate_client_action_storage_path(
    p_task_id UUID,
    p_filename TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_task RECORD;
    v_contact_id UUID;
    v_clean_filename TEXT;
    v_ext TEXT;
    v_file_uuid UUID;
    v_storage_path TEXT;
BEGIN
    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found or access denied.';
    END IF;

    IF v_task.responsibility_type <> 'client' THEN
        RAISE EXCEPTION 'This task is not a client action.';
    END IF;

    IF NOT public.can_client_access_project(v_task.project_id) THEN
        IF NOT (public.is_global_owner() OR public._is_authorized_pm_for_task(p_task_id)) THEN
            RAISE EXCEPTION 'Access denied to this project.';
        END IF;
    END IF;

    -- Verify client contact assignment if assigned
    IF v_task.client_contact_id IS NOT NULL THEN
        v_contact_id := public.get_client_contact_id_for_user(v_task.organization_id);
        IF v_contact_id IS NULL OR v_contact_id <> v_task.client_contact_id THEN
            IF NOT (public.is_global_owner() OR public._is_authorized_pm_for_task(p_task_id)) THEN
                RAISE EXCEPTION 'Access denied: Client action is assigned to another contact.';
            END IF;
        END IF;
    END IF;

    -- Sanitize filename: strip path traversal and special characters
    v_clean_filename := regexp_replace(p_filename, '[^a-zA-Z0-9._-]', '_', 'g');
    v_clean_filename := regexp_replace(v_clean_filename, '^\.+', '', 'g');
    
    -- Extract and validate extension
    v_ext := lower(substring(v_clean_filename from '\.([a-zA-Z0-9]+)$'));
    IF v_ext IS NULL OR v_ext NOT IN ('pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx', 'zip', 'csv') THEN
        RAISE EXCEPTION 'File format of % is not allowed. Permitted: pdf, png, jpg, jpeg, docx, xlsx, zip, csv.', p_filename;
    END IF;

    v_file_uuid := gen_random_uuid();
    v_storage_path := 'client-actions/' || v_task.organization_id || '/' || v_task.project_id || '/' || v_task.id || '/' || v_file_uuid || '_' || v_clean_filename;

    RETURN jsonb_build_object(
        'storage_path', v_storage_path,
        'filename', v_clean_filename,
        'extension', v_ext,
        'task_id', v_task.id,
        'organization_id', v_task.organization_id,
        'project_id', v_task.project_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Storage Policies on project-documents for client action attachments
DROP POLICY IF EXISTS "Allow authenticated upload of project-documents" ON storage.objects;
CREATE POLICY "Allow authenticated upload of project-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (storage.foldername(name))[1] <> 'client-actions'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND (
      public.is_global_owner()
      OR public.is_org_admin(((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS "Allow authenticated read of project-documents" ON storage.objects;
CREATE POLICY "Allow authenticated read of project-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND (
      public.is_global_owner()
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND (storage.foldername(name))[1] <> 'client-actions'
        AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
        AND public.is_org_admin(((storage.foldername(name))[1])::uuid)
      )
      OR (
        (storage.foldername(name))[2] IS NOT NULL
        AND (storage.foldername(name))[3] IS NOT NULL
        AND (storage.foldername(name))[1] <> 'client-actions'
        AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
        AND (storage.foldername(name))[3] ~ '^[0-9a-fA-F-]{36}$'
        AND public.is_project_member(((storage.foldername(name))[2])::uuid)
        AND EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.id = ((storage.foldername(name))[3])::uuid
            AND d.internal_access_scope = 'project_team'
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'client'
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.organization_memberships
          WHERE organization_id = ((storage.foldername(name))[1])::uuid
            AND user_id = auth.uid()
            AND org_role = 'client'
            AND is_active = TRUE
        )
      )
    )
  );

DROP POLICY IF EXISTS "Allow client action attachments upload" ON storage.objects;
CREATE POLICY "Allow client action attachments upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-documents' AND
  (storage.foldername(name))[1] = 'client-actions' AND
  (storage.foldername(name))[2] IS NOT NULL AND
  (storage.foldername(name))[3] IS NOT NULL AND
  (storage.foldername(name))[4] IS NOT NULL AND
  (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$' AND
  (storage.foldername(name))[3] ~ '^[0-9a-fA-F-]{36}$' AND
  (storage.foldername(name))[4] ~ '^[0-9a-fA-F-]{36}$' AND
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = ((storage.foldername(objects.name))[4])::uuid
      AND t.organization_id = ((storage.foldername(objects.name))[2])::uuid
      AND t.project_id = ((storage.foldername(objects.name))[3])::uuid
      AND t.responsibility_type = 'client'
      AND (
        public.is_global_owner() OR
        public._is_authorized_pm_for_task(t.id) OR
        (
          public.can_client_access_project(t.project_id) AND
          (t.client_contact_id IS NULL OR t.client_contact_id = public.get_client_contact_id_for_user(t.organization_id))
        )
      )
  )
);

DROP POLICY IF EXISTS "Allow client action attachments read" ON storage.objects;
CREATE POLICY "Allow client action attachments read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'project-documents' AND
  (storage.foldername(name))[1] = 'client-actions' AND
  (storage.foldername(name))[2] IS NOT NULL AND
  (storage.foldername(name))[3] IS NOT NULL AND
  (storage.foldername(name))[4] IS NOT NULL AND
  (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$' AND
  (storage.foldername(name))[3] ~ '^[0-9a-fA-F-]{36}$' AND
  (storage.foldername(name))[4] ~ '^[0-9a-fA-F-]{36}$' AND
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = ((storage.foldername(objects.name))[4])::uuid
      AND t.organization_id = ((storage.foldername(objects.name))[2])::uuid
      AND t.project_id = ((storage.foldername(objects.name))[3])::uuid
      AND t.responsibility_type = 'client'
      AND (
        public.is_global_owner() OR
        public._is_authorized_pm_for_task(t.id) OR
        (
          public.can_client_access_project(t.project_id) AND
          (t.client_contact_id IS NULL OR t.client_contact_id = public.get_client_contact_id_for_user(t.organization_id))
        )
      )
  )
);

-- 5. Reopen Client Action Enhancement (Notify assigned client user)
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
  v_client_user_id UUID;
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
  IF public.is_global_owner() OR public._is_authorized_pm_for_task(p_task_id) THEN
    v_is_authorized := TRUE;
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

  -- Notify Assigned Client User (if assigned)
  IF v_task.client_contact_id IS NOT NULL THEN
    SELECT user_id INTO v_client_user_id
    FROM public.client_portal_access
    WHERE contact_id = v_task.client_contact_id AND status = 'active'
    LIMIT 1;

    IF v_client_user_id IS NOT NULL AND v_client_user_id != auth.uid() THEN
      INSERT INTO public.notifications (
        recipient_user_id,
        actor_user_id,
        organization_id,
        project_id,
        event_type,
        severity,
        title,
        message,
        entity_type,
        entity_id,
        deep_link,
        dedupe_key,
        created_at
      ) VALUES (
        v_client_user_id,
        auth.uid(),
        v_task.organization_id,
        v_task.project_id,
        'client_action_reopened',
        'info',
        'Дію повернено в роботу',
        'Менеджер повернув дію «' || v_task.title || '» до виконання.',
        'task',
        v_task.id,
        '#/client',
        'task_reopen:' || v_task.id || ':' || v_client_user_id || ':' || TO_CHAR(NOW(), 'YYYY-MM-DD-HH24-MI-SS'),
        NOW()
      )
      ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'task_id', p_task_id, 'status', 'todo');
END;
$$;

-- 6. Fix handle_task_mutation_notifications (NULL responsible_pm_id handling for Owner notification)
CREATE OR REPLACE FUNCTION public.handle_task_mutation_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proj RECORD;
  v_owner_id UUID;
BEGIN
  SELECT name, responsible_pm_id INTO v_proj
  FROM public.projects
  WHERE id = NEW.project_id;

  SELECT id INTO v_owner_id
  FROM public.profiles
  WHERE global_role = 'owner'
  LIMIT 1;

  -- 1. Task Assigned to Staff Member
  IF NEW.assignee_user_id IS NOT NULL AND (
    TG_OP = 'INSERT' OR 
    (TG_OP = 'UPDATE' AND OLD.assignee_user_id IS DISTINCT FROM NEW.assignee_user_id)
  ) THEN
    PERFORM public.create_internal_notification(
      NEW.assignee_user_id,
      auth.uid(),
      NEW.organization_id,
      NEW.project_id,
      'task_assigned',
      'info',
      'Вам призначено задачу',
      'Нове завдання: «' || NEW.title || '» у проєкті ' || COALESCE(v_proj.name, 'FIRSTWIN'),
      'task',
      NEW.id,
      '#/portal/projects/' || NEW.project_id,
      'task_assigned:' || NEW.id || ':' || NEW.assignee_user_id
    );
  END IF;

  -- 2. Task Elevated to Urgent Priority
  IF NEW.priority = 'urgent' AND (
    TG_OP = 'INSERT' OR 
    (TG_OP = 'UPDATE' AND OLD.priority IS DISTINCT FROM 'urgent')
  ) THEN
    IF NEW.assignee_user_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        NEW.assignee_user_id,
        auth.uid(),
        NEW.organization_id,
        NEW.project_id,
        'task_priority_critical',
        'critical',
        'Критичний пріоритет задачі',
        'Задачі «' || NEW.title || '» встановлено критичний пріоритет!',
        'task',
        NEW.id,
        '#/portal/projects/' || NEW.project_id,
        'task_crit_assignee:' || NEW.id || ':' || NEW.assignee_user_id
      );
    END IF;

    IF v_proj.responsible_pm_id IS NOT NULL AND v_proj.responsible_pm_id != NEW.assignee_user_id THEN
      PERFORM public.create_internal_notification(
        v_proj.responsible_pm_id,
        auth.uid(),
        NEW.organization_id,
        NEW.project_id,
        'task_priority_critical',
        'critical',
        'Критична задача у проєкті',
        'У проєкті «' || COALESCE(v_proj.name, '') || '» з''явилася критична задача: «' || NEW.title || '»',
        'task',
        NEW.id,
        '#/portal/projects/' || NEW.project_id,
        'task_crit_pm:' || NEW.id || ':' || v_proj.responsible_pm_id
      );
    END IF;
  END IF;

  -- 3. Client Action Completed by Client (PM != Owner -> 2 rows, PM == Owner -> 1 row, PM IS NULL -> 1 row)
  IF NEW.responsibility_type = 'client' AND NEW.status = 'done' AND (
    TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'done'
  ) THEN
    -- Notify PM
    IF v_proj.responsible_pm_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        v_proj.responsible_pm_id,
        auth.uid(),
        NEW.organization_id,
        NEW.project_id,
        'client_action_completed',
        'success',
        'Клієнт виконав дію',
        'Клієнт позначив виконаною дію «' || NEW.title || '»',
        'task',
        NEW.id,
        '#/portal/projects/' || NEW.project_id,
        'client_action_done_pm:' || NEW.id || ':' || v_proj.responsible_pm_id || ':' || TO_CHAR(NOW(), 'YYYY-MM-DD-HH24-MI')
      );
    END IF;

    -- Notify Owner (using IS DISTINCT FROM so NULL responsible_pm_id notifies Owner correctly)
    IF v_owner_id IS NOT NULL AND v_owner_id IS DISTINCT FROM v_proj.responsible_pm_id THEN
      PERFORM public.create_internal_notification(
        v_owner_id,
        auth.uid(),
        NEW.organization_id,
        NEW.project_id,
        'client_action_completed',
        'success',
        'Клієнт виконав дію',
        'Клієнт виконав «' || NEW.title || '» (' || COALESCE(v_proj.name, '') || ')',
        'task',
        NEW.id,
        '#/portal/projects/' || NEW.project_id,
        'client_action_done_owner:' || NEW.id || ':' || TO_CHAR(NOW(), 'YYYY-MM-DD-HH24-MI')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

