-- FIRSTWIN Client Portal — Phase 5B: Notifications, Personal Inbox & Proactive Control Migration
-- Target: PostgreSQL / Supabase with Row-Level Security (RLS) & Personal Inbox Isolation

-- -----------------------------------------------------------------------------
-- 1. Notifications Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  deep_link TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  dedupe_key TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON public.notifications(recipient_user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON public.notifications(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_severity ON public.notifications(recipient_user_id, severity);
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe_key ON public.notifications(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_notifications_project ON public.notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(organization_id);

-- -----------------------------------------------------------------------------
-- 2. Row Level Security (RLS) — Strict Personal Inbox Isolation
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2.1 Users can ONLY read their own personal notifications
DROP POLICY IF EXISTS "notifications_recipient_select" ON public.notifications;
CREATE POLICY "notifications_recipient_select"
  ON public.notifications
  FOR SELECT
  USING (
    recipient_user_id = auth.uid()
  );

-- 2.2 Users can ONLY update read status of their own notifications
DROP POLICY IF EXISTS "notifications_recipient_update" ON public.notifications;
CREATE POLICY "notifications_recipient_update"
  ON public.notifications
  FOR UPDATE
  USING (
    recipient_user_id = auth.uid()
  )
  WITH CHECK (
    recipient_user_id = auth.uid()
  );

-- Direct client INSERT and DELETE are strictly disallowed.
-- Notifications are created via trusted SECURITY DEFINER functions and DB triggers only.

-- -----------------------------------------------------------------------------
-- 3. Core Helper & RPC Functions
-- -----------------------------------------------------------------------------

-- 3.1 Create Internal Notification (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.create_internal_notification(
  p_recipient_user_id UUID,
  p_actor_user_id UUID,
  p_organization_id UUID,
  p_project_id UUID,
  p_event_type TEXT,
  p_severity TEXT,
  p_title TEXT,
  p_message TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_deep_link TEXT,
  p_dedupe_key TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  IF p_recipient_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Ensure recipient is not client role for internal notifications
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_recipient_user_id AND global_role = 'client'
  ) THEN
    RETURN NULL;
  END IF;

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
    metadata,
    expires_at,
    created_at
  ) VALUES (
    p_recipient_user_id,
    p_actor_user_id,
    p_organization_id,
    p_project_id,
    p_event_type,
    p_severity,
    p_title,
    p_message,
    p_entity_type,
    p_entity_id,
    p_deep_link,
    p_dedupe_key,
    p_metadata,
    p_expires_at,
    NOW()
  )
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- 3.2 Mark Notification as Read
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(
  p_notification_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE,
      read_at = NOW()
  WHERE id = p_notification_id
    AND recipient_user_id = auth.uid();

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', v_updated > 0,
    'notification_id', p_notification_id
  );
END;
$$;

-- 3.3 Mark All Notifications as Read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE,
      read_at = NOW()
  WHERE recipient_user_id = auth.uid()
    AND is_read = FALSE;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'count', v_updated
  );
END;
$$;

-- 3.4 Get Unread Count for Authenticated User
CREATE OR REPLACE FUNCTION public.get_unread_notifications_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.notifications
  WHERE recipient_user_id = auth.uid()
    AND is_read = FALSE;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Proactive Reminder & State Evaluator (Idempotent Cron / Evaluator RPC)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id UUID;
  v_count INTEGER := 0;
  v_task RECORD;
  v_action RECORD;
  v_meeting RECORD;
  v_participant RECORD;
  v_proj RECORD;
  v_today_str TEXT := TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');
BEGIN
  -- Get Owner User ID
  SELECT id INTO v_owner_id
  FROM public.profiles
  WHERE global_role = 'owner'
  LIMIT 1;

  -- 1. Evaluate Overdue Staff Tasks (due_date < CURRENT_DATE)
  FOR v_task IN
    SELECT t.id, t.title, t.priority, t.due_date, t.project_id, t.organization_id,
           t.assignee_user_id, p.name AS project_name, p.responsible_pm_id
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.status != 'done'
      AND t.responsibility_type = 'team'
      AND t.due_date IS NOT NULL
      AND t.due_date < CURRENT_DATE
  LOOP
    -- Notify Assignee
    IF v_task.assignee_user_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        v_task.assignee_user_id,
        NULL,
        v_task.organization_id,
        v_task.project_id,
        'task_overdue',
        CASE WHEN v_task.priority = 'urgent' THEN 'critical' ELSE 'warning' END,
        'Прострочена задача',
        'Задача «' || v_task.title || '» прострочена (' || v_task.project_name || ')',
        'task',
        v_task.id,
        '#/portal/projects/' || v_task.project_id,
        'task_overdue:' || v_task.id || ':' || v_task.assignee_user_id || ':' || v_today_str
      );
      v_count := v_count + 1;
    END IF;

    -- If urgent, also notify PM and Owner
    IF v_task.priority = 'urgent' THEN
      IF v_task.responsible_pm_id IS NOT NULL AND v_task.responsible_pm_id != v_task.assignee_user_id THEN
        PERFORM public.create_internal_notification(
          v_task.responsible_pm_id,
          NULL,
          v_task.organization_id,
          v_task.project_id,
          'task_overdue',
          'critical',
          'Критична прострочена задача',
          'Критична задача «' || v_task.title || '» потребує термінової уваги',
          'task',
          v_task.id,
          '#/portal/projects/' || v_task.project_id,
          'task_overdue_pm:' || v_task.id || ':' || v_task.responsible_pm_id || ':' || v_today_str
        );
        v_count := v_count + 1;
      END IF;

      IF v_owner_id IS NOT NULL AND v_owner_id != v_task.assignee_user_id AND v_owner_id != v_task.responsible_pm_id THEN
        PERFORM public.create_internal_notification(
          v_owner_id,
          NULL,
          v_task.organization_id,
          v_task.project_id,
          'task_overdue',
          'critical',
          'Критична прострочена задача',
          'У проєкті «' || v_task.project_name || '» прострочено критичну задачу',
          'task',
          v_task.id,
          '#/portal/projects/' || v_task.project_id,
          'task_overdue_owner:' || v_task.id || ':' || v_today_str
        );
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- 2. Evaluate Due Soon Staff Tasks (due_date = CURRENT_DATE or <= 24 hours)
  FOR v_task IN
    SELECT t.id, t.title, t.priority, t.project_id, t.organization_id,
           t.assignee_user_id, p.name AS project_name
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.status != 'done'
      AND t.responsibility_type = 'team'
      AND t.assignee_user_id IS NOT NULL
      AND t.due_date = CURRENT_DATE
  LOOP
    PERFORM public.create_internal_notification(
      v_task.assignee_user_id,
      NULL,
      v_task.organization_id,
      v_task.project_id,
      'task_due_soon',
      'warning',
      'Дедлайн сьогодні',
      'Строк виконання задачі «' || v_task.title || '» спливає сьогодні',
      'task',
      v_task.id,
      '#/portal/projects/' || v_task.project_id,
      'task_due_soon:' || v_task.id || ':' || v_today_str
    );
    v_count := v_count + 1;
  END LOOP;

  -- 3. Evaluate Overdue Client Actions
  FOR v_action IN
    SELECT t.id, t.title, t.due_date, t.project_id, t.organization_id,
           p.name AS project_name, p.responsible_pm_id, o.name AS client_name
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    JOIN public.organizations o ON o.id = t.organization_id
    WHERE t.status != 'done'
      AND t.responsibility_type = 'client'
      AND t.due_date IS NOT NULL
      AND t.due_date < CURRENT_DATE
  LOOP
    -- Notify PM
    IF v_action.responsible_pm_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        v_action.responsible_pm_id,
        NULL,
        v_action.organization_id,
        v_action.project_id,
        'client_action_overdue',
        'critical',
        'Прострочена дія клієнта',
        'Клієнт ' || v_action.client_name || ' затримує дію «' || v_action.title || '»',
        'task',
        v_action.id,
        '#/portal/projects/' || v_action.project_id,
        'client_action_overdue:' || v_action.id || ':' || v_action.responsible_pm_id || ':' || v_today_str
      );
      v_count := v_count + 1;
    END IF;

    -- Notify Owner
    IF v_owner_id IS NOT NULL AND v_owner_id != v_action.responsible_pm_id THEN
      PERFORM public.create_internal_notification(
        v_owner_id,
        NULL,
        v_action.organization_id,
        v_action.project_id,
        'client_action_overdue',
        'critical',
        'Прострочена дія клієнта',
        'Клієнт ' || v_action.client_name || ' затримує дію «' || v_action.title || '»',
        'task',
        v_action.id,
        '#/portal/projects/' || v_action.project_id,
        'client_action_overdue_owner:' || v_action.id || ':' || v_today_str
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- 4. Evaluate Meetings Starting Soon (within 30 minutes)
  FOR v_meeting IN
    SELECT m.id, m.title, m.start_at, m.project_id, m.organization_id,
           m.organizer_user_id, p.name AS project_name
    FROM public.meetings m
    LEFT JOIN public.projects p ON p.id = m.project_id
    WHERE m.status = 'scheduled'
      AND m.start_at BETWEEN NOW() AND (NOW() + INTERVAL '30 minutes')
  LOOP
    -- Notify Organizer
    IF v_meeting.organizer_user_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        v_meeting.organizer_user_id,
        NULL,
        v_meeting.organization_id,
        v_meeting.project_id,
        'meeting_starting_soon',
        'warning',
        'Зустріч розпочнеться незабаром',
        'Зустріч «' || v_meeting.title || '» запланована о ' || TO_CHAR(v_meeting.start_at AT TIME ZONE 'Europe/Kyiv', 'HH24:MI'),
        'meeting',
        v_meeting.id,
        '#/portal/meetings/' || v_meeting.id,
        'meeting_soon:' || v_meeting.id || ':' || v_meeting.organizer_user_id || ':' || TO_CHAR(v_meeting.start_at, 'YYYY-MM-DD-HH24-MI')
      );
      v_count := v_count + 1;
    END IF;

    -- Notify Registered Internal Participants
    FOR v_participant IN
      SELECT user_id
      FROM public.meeting_participants
      WHERE meeting_id = v_meeting.id
        AND user_id IS NOT NULL
        AND user_id != COALESCE(v_meeting.organizer_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    LOOP
      PERFORM public.create_internal_notification(
        v_participant.user_id,
        NULL,
        v_meeting.organization_id,
        v_meeting.project_id,
        'meeting_starting_soon',
        'warning',
        'Зустріч розпочнеться незабаром',
        'Зустріч «' || v_meeting.title || '» запланована о ' || TO_CHAR(v_meeting.start_at AT TIME ZONE 'Europe/Kyiv', 'HH24:MI'),
        'meeting',
        v_meeting.id,
        '#/portal/meetings/' || v_meeting.id,
        'meeting_soon:' || v_meeting.id || ':' || v_participant.user_id || ':' || TO_CHAR(v_meeting.start_at, 'YYYY-MM-DD-HH24-MI')
      );
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  -- 5. Evaluate Project Target Date Approaching (within 7 days)
  FOR v_proj IN
    SELECT p.id, p.name, p.target_date, p.organization_id, p.responsible_pm_id
    FROM public.projects p
    WHERE p.status NOT IN ('completed', 'archived', 'paused')
      AND p.target_date IS NOT NULL
      AND p.target_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
  LOOP
    IF v_proj.responsible_pm_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        v_proj.responsible_pm_id,
        NULL,
        v_proj.organization_id,
        v_proj.id,
        'project_target_date_approaching',
        'warning',
        'Наближається дедлайн проєкту',
        'Цільова дата завершення проєкту «' || v_proj.name || '» — ' || TO_CHAR(v_proj.target_date, 'DD.MM.YYYY'),
        'project',
        v_proj.id,
        '#/portal/projects/' || v_proj.id,
        'proj_target_soon:' || v_proj.id || ':' || v_proj.responsible_pm_id || ':' || v_today_str
      );
      v_count := v_count + 1;
    END IF;

    IF v_owner_id IS NOT NULL AND v_owner_id != v_proj.responsible_pm_id THEN
      PERFORM public.create_internal_notification(
        v_owner_id,
        NULL,
        v_proj.organization_id,
        v_proj.id,
        'project_target_date_approaching',
        'warning',
        'Наближається дедлайн проєкту',
        'Цільова дата завершення проєкту «' || v_proj.name || '» — ' || TO_CHAR(v_proj.target_date, 'DD.MM.YYYY'),
        'project',
        v_proj.id,
        '#/portal/projects/' || v_proj.id,
        'proj_target_soon_owner:' || v_proj.id || ':' || v_today_str
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- 6. Evaluate Projects with Health Issues (delayed, blocked, at_risk)
  FOR v_proj IN
    SELECT p.id, p.name, p.health, p.organization_id, p.responsible_pm_id
    FROM public.projects p
    WHERE p.status NOT IN ('completed', 'archived', 'paused')
      AND p.health IN ('at_risk', 'delayed', 'blocked')
  LOOP
    IF v_proj.responsible_pm_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        v_proj.responsible_pm_id,
        NULL,
        v_proj.organization_id,
        v_proj.id,
        'project_health_changed',
        CASE WHEN v_proj.health IN ('delayed', 'blocked') THEN 'critical' ELSE 'warning' END,
        CASE WHEN v_proj.health = 'blocked' THEN 'Проєкт заблоковано'
             WHEN v_proj.health = 'delayed' THEN 'Затримка проєкту'
             ELSE 'Проєкт у зоні ризику' END,
        'Стан здоров''я проєкту «' || v_proj.name || '» змінено на ' || v_proj.health,
        'project',
        v_proj.id,
        '#/portal/projects/' || v_proj.id,
        'proj_health_issue:' || v_proj.id || ':' || v_proj.health || ':' || v_proj.responsible_pm_id || ':' || v_today_str
      );
      v_count := v_count + 1;
    END IF;

    IF v_owner_id IS NOT NULL AND v_owner_id != v_proj.responsible_pm_id THEN
      PERFORM public.create_internal_notification(
        v_owner_id,
        NULL,
        v_proj.organization_id,
        v_proj.id,
        'project_health_changed',
        CASE WHEN v_proj.health IN ('delayed', 'blocked') THEN 'critical' ELSE 'warning' END,
        CASE WHEN v_proj.health = 'blocked' THEN 'Проєкт заблоковано'
             WHEN v_proj.health = 'delayed' THEN 'Затримка проєкту'
             ELSE 'Проєкт у зоні ризику' END,
        'Проєкт «' || v_proj.name || '» потребує уваги (статус здоров''я: ' || v_proj.health || ')',
        'project',
        v_proj.id,
        '#/portal/projects/' || v_proj.id,
        'proj_health_issue_owner:' || v_proj.id || ':' || v_proj.health || ':' || v_today_str
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'evaluated_count', v_count,
    'date', v_today_str
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Trigger-Based Automatic Notifications for Immediate DB Mutations
-- -----------------------------------------------------------------------------

-- 5.1 Tasks Mutation Trigger
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
    -- Notify Assignee
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

    -- Notify PM
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

  -- 3. Client Action Completed by Client
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

    -- Notify Owner
    IF v_owner_id IS NOT NULL AND v_owner_id != v_proj.responsible_pm_id THEN
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

DROP TRIGGER IF EXISTS trigger_task_mutation_notifications ON public.tasks;
CREATE TRIGGER trigger_task_mutation_notifications
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_mutation_notifications();

-- 5.2 Projects Mutation Trigger (PM Assignment & Health Transitions)
CREATE OR REPLACE FUNCTION public.handle_project_mutation_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT id INTO v_owner_id
  FROM public.profiles
  WHERE global_role = 'owner'
  LIMIT 1;

  -- 1. Project Assigned to PM
  IF NEW.responsible_pm_id IS NOT NULL AND (
    TG_OP = 'INSERT' OR 
    (TG_OP = 'UPDATE' AND OLD.responsible_pm_id IS DISTINCT FROM NEW.responsible_pm_id)
  ) THEN
    PERFORM public.create_internal_notification(
      NEW.responsible_pm_id,
      auth.uid(),
      NEW.organization_id,
      NEW.id,
      'responsibility_assigned',
      'info',
      'Вас призначено PM проєкту',
      'Вам передано управління проєктом «' || NEW.name || '»',
      'project',
      NEW.id,
      '#/portal/projects/' || NEW.id,
      'proj_pm_assigned:' || NEW.id || ':' || NEW.responsible_pm_id
    );
  END IF;

  -- 2. Immediate Health Transition to Delayed / Blocked
  IF (NEW.health IN ('delayed', 'blocked')) AND (
    TG_OP = 'UPDATE' AND OLD.health IS DISTINCT FROM NEW.health
  ) THEN
    IF NEW.responsible_pm_id IS NOT NULL THEN
      PERFORM public.create_internal_notification(
        NEW.responsible_pm_id,
        auth.uid(),
        NEW.organization_id,
        NEW.id,
        'project_health_changed',
        'critical',
        CASE WHEN NEW.health = 'blocked' THEN 'Проєкт заблоковано' ELSE 'Затримка проєкту' END,
        'Статус проєкту «' || NEW.name || '» змінено на ' || NEW.health,
        'project',
        NEW.id,
        '#/portal/projects/' || NEW.id,
        'proj_health_trans:' || NEW.id || ':' || NEW.health || ':' || TO_CHAR(NOW(), 'YYYY-MM-DD-HH24-MI')
      );
    END IF;

    IF v_owner_id IS NOT NULL AND v_owner_id != NEW.responsible_pm_id THEN
      PERFORM public.create_internal_notification(
        v_owner_id,
        auth.uid(),
        NEW.organization_id,
        NEW.id,
        'project_health_changed',
        'critical',
        CASE WHEN NEW.health = 'blocked' THEN 'Проєкт заблоковано' ELSE 'Затримка проєкту' END,
        'Проєкт «' || NEW.name || '» перейшов у стан ' || NEW.health,
        'project',
        NEW.id,
        '#/portal/projects/' || NEW.id,
        'proj_health_trans_owner:' || NEW.id || ':' || NEW.health || ':' || TO_CHAR(NOW(), 'YYYY-MM-DD-HH24-MI')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_project_mutation_notifications ON public.projects;
CREATE TRIGGER trigger_project_mutation_notifications
  AFTER INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_project_mutation_notifications();

-- -----------------------------------------------------------------------------
-- 6. Update Document Approval & Change Request RPCs with Notification Generation
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_document_version(
  p_document_id UUID,
  p_version_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_doc RECORD;
  v_version RECORD;
  v_latest_published_ver RECORD;
  v_contact_id UUID;
  v_event_id UUID;
  v_pm_id UUID;
  v_owner_id UUID;
BEGIN
  -- 1. Check document accessibility
  SELECT id, organization_id, project_id, title, status, is_client_visible, internal_access_scope
  INTO v_doc
  FROM public.documents
  WHERE id = p_document_id AND archived_at IS NULL;

  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'Document not found or archived.';
  END IF;

  IF NOT (v_doc.is_client_visible = TRUE AND v_doc.internal_access_scope = 'project_team') THEN
    RAISE EXCEPTION 'Document is not visible to client.';
  END IF;

  -- 2. Check client access to project
  IF NOT public.can_client_access_project(v_doc.project_id) THEN
    RAISE EXCEPTION 'Unauthorized: You do not have access to this project.';
  END IF;

  -- 3. Check version belongs to document and is published
  SELECT id, document_id, version_number, is_client_visible
  INTO v_version
  FROM public.document_versions
  WHERE id = p_version_id AND document_id = p_document_id;

  IF v_version.id IS NULL THEN
    RAISE EXCEPTION 'Document version not found.';
  END IF;

  IF v_version.is_client_visible <> TRUE THEN
    RAISE EXCEPTION 'This version has not been published to client.';
  END IF;

  -- 4. Stale-Approval Check: must be the latest published version
  SELECT id, version_number
  INTO v_latest_published_ver
  FROM public.document_versions
  WHERE document_id = p_document_id
    AND is_client_visible = TRUE
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_latest_published_ver.id <> p_version_id THEN
    RAISE EXCEPTION 'Stale version approval is not allowed. A newer version (v%) has already been published.', v_latest_published_ver.version_number;
  END IF;

  -- 5. Get reviewer contact ID
  v_contact_id := public.get_client_contact_id_for_user(v_doc.organization_id);

  -- 6. Insert immutable review event
  INSERT INTO public.document_review_events (
    organization_id,
    project_id,
    document_id,
    document_version_id,
    reviewer_user_id,
    reviewer_contact_id,
    action,
    comment,
    created_at
  ) VALUES (
    v_doc.organization_id,
    v_doc.project_id,
    p_document_id,
    p_version_id,
    auth.uid(),
    v_contact_id,
    'approved',
    NULL,
    NOW()
  ) RETURNING id INTO v_event_id;

  -- 7. Update document status to approved
  UPDATE public.documents
  SET status = 'approved',
      updated_at = NOW()
  WHERE id = p_document_id;

  -- 8. Proactively Notify Responsible PM and Owner
  SELECT responsible_pm_id INTO v_pm_id
  FROM public.projects
  WHERE id = v_doc.project_id;

  SELECT id INTO v_owner_id
  FROM public.profiles
  WHERE global_role = 'owner'
  LIMIT 1;

  IF v_pm_id IS NOT NULL THEN
    PERFORM public.create_internal_notification(
      v_pm_id,
      auth.uid(),
      v_doc.organization_id,
      v_doc.project_id,
      'document_approved',
      'success',
      'Документ погоджено клієнтом',
      'Клієнт погодив документ «' || v_doc.title || '» (v' || v_version.version_number || ')',
      'document',
      p_document_id,
      '#/portal/documents/' || p_document_id,
      'doc_appr_pm:' || p_document_id || ':' || p_version_id || ':' || v_pm_id
    );
  END IF;

  IF v_owner_id IS NOT NULL AND v_owner_id != v_pm_id THEN
    PERFORM public.create_internal_notification(
      v_owner_id,
      auth.uid(),
      v_doc.organization_id,
      v_doc.project_id,
      'document_approved',
      'success',
      'Документ погоджено клієнтом',
      'Клієнт погодив документ «' || v_doc.title || '» (v' || v_version.version_number || ')',
      'document',
      p_document_id,
      '#/portal/documents/' || p_document_id,
      'doc_appr_owner:' || p_document_id || ':' || p_version_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'document_id', p_document_id,
    'version_id', p_version_id,
    'status', 'approved'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_document_changes(
  p_document_id UUID,
  p_version_id UUID,
  p_comment TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_doc RECORD;
  v_version RECORD;
  v_latest_published_ver RECORD;
  v_contact_id UUID;
  v_event_id UUID;
  v_pm_id UUID;
  v_owner_id UUID;
BEGIN
  -- Validate non-empty comment
  IF p_comment IS NULL OR TRIM(p_comment) = '' THEN
    RAISE EXCEPTION 'A comment explaining requested changes is required.';
  END IF;

  -- 1. Check document accessibility
  SELECT id, organization_id, project_id, title, status, is_client_visible, internal_access_scope
  INTO v_doc
  FROM public.documents
  WHERE id = p_document_id AND archived_at IS NULL;

  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'Document not found or archived.';
  END IF;

  IF NOT (v_doc.is_client_visible = TRUE AND v_doc.internal_access_scope = 'project_team') THEN
    RAISE EXCEPTION 'Document is not visible to client.';
  END IF;

  -- 2. Check client access to project
  IF NOT public.can_client_access_project(v_doc.project_id) THEN
    RAISE EXCEPTION 'Unauthorized: You do not have access to this project.';
  END IF;

  -- 3. Check version belongs to document and is published
  SELECT id, document_id, version_number, is_client_visible
  INTO v_version
  FROM public.document_versions
  WHERE id = p_version_id AND document_id = p_document_id;

  IF v_version.id IS NULL THEN
    RAISE EXCEPTION 'Document version not found.';
  END IF;

  IF v_version.is_client_visible <> TRUE THEN
    RAISE EXCEPTION 'This version has not been published to client.';
  END IF;

  -- 4. Stale-Approval Check: must be the latest published version
  SELECT id, version_number
  INTO v_latest_published_ver
  FROM public.document_versions
  WHERE document_id = p_document_id
    AND is_client_visible = TRUE
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_latest_published_ver.id <> p_version_id THEN
    RAISE EXCEPTION 'Stale version rejection is not allowed. A newer version (v%) has already been published.', v_latest_published_ver.version_number;
  END IF;

  -- 5. Get reviewer contact ID
  v_contact_id := public.get_client_contact_id_for_user(v_doc.organization_id);

  -- 6. Insert immutable review event with comment
  INSERT INTO public.document_review_events (
    organization_id,
    project_id,
    document_id,
    document_version_id,
    reviewer_user_id,
    reviewer_contact_id,
    action,
    comment,
    created_at
  ) VALUES (
    v_doc.organization_id,
    v_doc.project_id,
    p_document_id,
    p_version_id,
    auth.uid(),
    v_contact_id,
    'changes_requested',
    TRIM(p_comment),
    NOW()
  ) RETURNING id INTO v_event_id;

  -- 7. Update document status to changes_requested
  UPDATE public.documents
  SET status = 'changes_requested',
      updated_at = NOW()
  WHERE id = p_document_id;

  -- 8. Proactively Notify Responsible PM and Owner
  SELECT responsible_pm_id INTO v_pm_id
  FROM public.projects
  WHERE id = v_doc.project_id;

  SELECT id INTO v_owner_id
  FROM public.profiles
  WHERE global_role = 'owner'
  LIMIT 1;

  IF v_pm_id IS NOT NULL THEN
    PERFORM public.create_internal_notification(
      v_pm_id,
      auth.uid(),
      v_doc.organization_id,
      v_doc.project_id,
      'document_changes_requested',
      'warning',
      'Запитано правки до документа',
      'Клієнт запросив правки до «' || v_doc.title || '»: "' || SUBSTRING(TRIM(p_comment) FROM 1 FOR 80) || '..."',
      'document',
      p_document_id,
      '#/portal/documents/' || p_document_id,
      'doc_chg_pm:' || p_document_id || ':' || p_version_id || ':' || v_pm_id
    );
  END IF;

  IF v_owner_id IS NOT NULL AND v_owner_id != v_pm_id THEN
    PERFORM public.create_internal_notification(
      v_owner_id,
      auth.uid(),
      v_doc.organization_id,
      v_doc.project_id,
      'document_changes_requested',
      'warning',
      'Запитано правки до документа',
      'Клієнт запросив правки до «' || v_doc.title || '»',
      'document',
      p_document_id,
      '#/portal/documents/' || p_document_id,
      'doc_chg_owner:' || p_document_id || ':' || p_version_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'document_id', p_document_id,
    'version_id', p_version_id,
    'status', 'changes_requested'
  );
END;
$$;
