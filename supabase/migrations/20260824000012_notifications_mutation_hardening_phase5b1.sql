-- FIRSTWIN Client Portal — Phase 5B.1: Notification Mutation Hardening
-- Enforce strict column-level immutability for notifications table on UPDATE operations

CREATE OR REPLACE FUNCTION public.prevent_notification_unauthorized_modifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Check for unauthorized modifications of immutable fields
  IF (
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id OR
    NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id OR
    NEW.organization_id IS DISTINCT FROM OLD.organization_id OR
    NEW.project_id IS DISTINCT FROM OLD.project_id OR
    NEW.event_type IS DISTINCT FROM OLD.event_type OR
    NEW.severity IS DISTINCT FROM OLD.severity OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.message IS DISTINCT FROM OLD.message OR
    NEW.entity_type IS DISTINCT FROM OLD.entity_type OR
    NEW.entity_id IS DISTINCT FROM OLD.entity_id OR
    NEW.deep_link IS DISTINCT FROM OLD.deep_link OR
    NEW.dedupe_key IS DISTINCT FROM OLD.dedupe_key OR
    NEW.metadata IS DISTINCT FROM OLD.metadata OR
    NEW.created_at IS DISTINCT FROM OLD.created_at OR
    NEW.expires_at IS DISTINCT FROM OLD.expires_at
  ) THEN
    RAISE EXCEPTION 'Unauthorized modification of notification immutable fields. Only is_read and read_at can be modified.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Automatically synchronize read_at timestamp based on is_read transition
  IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
    NEW.read_at := COALESCE(NEW.read_at, NOW());
  ELSIF NEW.is_read = FALSE AND OLD.is_read = TRUE THEN
    NEW.read_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_notification_unauthorized_modifications ON public.notifications;
CREATE TRIGGER trg_prevent_notification_unauthorized_modifications
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_notification_unauthorized_modifications();
