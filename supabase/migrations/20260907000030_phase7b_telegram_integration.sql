-- Migration: 20260907000030_phase7b_telegram_integration.sql
-- Description: Phase 7B - Telegram Notifications Integration: Dedicated Outbox Channel, Vault-backed Bot Tokens, Hardened Deletion Guard, and Deduplication

-- 1. Telegram Destinations Table
-- 1. Telegram Destinations Table
CREATE TABLE IF NOT EXISTS public.telegram_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    bot_id BIGINT NOT NULL,
    bot_username TEXT NOT NULL,
    bot_token_vault_id UUID NOT NULL,
    chat_id TEXT NOT NULL,
    thread_id BIGINT,
    chat_title TEXT,
    chat_type TEXT NOT NULL DEFAULT 'group',
    event_types TEXT[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT chk_tg_dest_event_types CHECK (
        event_types <@ ARRAY['task.completed', 'stage.completed', 'document.approved', 'client_action.completed']::text[]
        AND array_length(event_types, 1) > 0
    ),
    CONSTRAINT chk_tg_dest_chat_type CHECK (
        chat_type IN ('private', 'group', 'supergroup', 'channel')
    )
);

ALTER TABLE public.telegram_destinations ADD COLUMN IF NOT EXISTS description TEXT;

-- Drop previous overloaded signatures to avoid ambiguity
DROP FUNCTION IF EXISTS public.create_telegram_destination(UUID, TEXT, TEXT, BIGINT, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT[]);
DROP FUNCTION IF EXISTS public.create_telegram_destination(UUID, TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT, TEXT, TEXT, TEXT, TEXT[]);

-- 6. Management RPCs (Owner & Org Admin only)
CREATE OR REPLACE FUNCTION public.create_telegram_destination(
    p_organization_id UUID,
    p_name TEXT,
    p_bot_token TEXT,
    p_chat_id TEXT,
    p_description TEXT DEFAULT NULL,
    p_thread_id BIGINT DEFAULT NULL,
    p_bot_id BIGINT DEFAULT NULL,
    p_bot_username TEXT DEFAULT NULL,
    p_chat_title TEXT DEFAULT NULL,
    p_chat_type TEXT DEFAULT 'group',
    p_event_types TEXT[] DEFAULT ARRAY['*']::TEXT[]
)
RETURNS JSONB AS $$
DECLARE
    v_is_owner BOOLEAN := FALSE;
    v_is_org_admin BOOLEAN := FALSE;
    v_jwt_role TEXT;
    v_clean_token TEXT;
    v_vault_id UUID;
    v_dest_id UUID;
    v_expanded_events TEXT[];
    v_allowed_events CONSTANT TEXT[] := ARRAY['task.completed', 'stage.completed', 'document.approved', 'client_action.completed'];
    v_resolved_bot_id BIGINT;
    v_resolved_username TEXT;
    v_resolved_chat_title TEXT;
BEGIN
    v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');

    -- 1. Authorization: Owner or Org Admin
    IF v_jwt_role = 'service_role' OR auth.uid() IS NULL THEN
        -- Service role or internal superuser allowed
    ELSE
        SELECT (global_role = 'owner') INTO v_is_owner
        FROM public.profiles 
        WHERE id = auth.uid();

        IF NOT COALESCE(v_is_owner, FALSE) THEN
            SELECT EXISTS (
                SELECT 1 FROM public.organization_memberships
                WHERE organization_id = p_organization_id
                  AND user_id = auth.uid()
                  AND org_role IN ('admin', 'owner')
            ) INTO v_is_org_admin;

            IF NOT COALESCE(v_is_org_admin, FALSE) THEN
                RAISE EXCEPTION 'Access denied: Only Owner or Org Admin can manage Telegram destinations'
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    -- 2. Validate input
    v_clean_token := btrim(COALESCE(p_bot_token, ''));
    IF length(v_clean_token) < 15 OR v_clean_token !~ '^[0-9]+:[A-Za-z0-9_-]+$' THEN
        RAISE EXCEPTION 'Invalid Telegram Bot Token format' USING ERRCODE = '22023';
    END IF;

    IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
        RAISE EXCEPTION 'Destination name is required' USING ERRCODE = '22023';
    END IF;

    IF p_chat_id IS NULL OR length(btrim(p_chat_id)) = 0 THEN
        RAISE EXCEPTION 'Chat ID is required' USING ERRCODE = '22023';
    END IF;

    IF p_chat_type NOT IN ('private', 'group', 'supergroup', 'channel') THEN
        RAISE EXCEPTION 'Invalid chat type' USING ERRCODE = '22023';
    END IF;

    -- Resolve bot_id automatically from token prefix if not provided
    IF p_bot_id IS NOT NULL THEN
        v_resolved_bot_id := p_bot_id;
    ELSE
        v_resolved_bot_id := split_part(v_clean_token, ':', 1)::BIGINT;
    END IF;

    v_resolved_username := COALESCE(NULLIF(btrim(p_bot_username), ''), 'bot_' || v_resolved_bot_id);
    v_resolved_chat_title := COALESCE(NULLIF(btrim(p_chat_title), ''), p_name);

    -- 3. Expand Event Types (Wildcard '*' expands strictly to the 4 approved events)
    IF p_event_types IS NULL OR array_length(p_event_types, 1) IS NULL OR '*' = ANY(p_event_types) THEN
        v_expanded_events := v_allowed_events;
    ELSE
        -- Intersect requested events with allowed list
        SELECT ARRAY_AGG(evt) INTO v_expanded_events
        FROM unnest(p_event_types) AS evt
        WHERE evt = ANY(v_allowed_events);

        IF v_expanded_events IS NULL OR array_length(v_expanded_events, 1) = 0 THEN
            RAISE EXCEPTION 'No valid events specified in allowlist' USING ERRCODE = '22023';
        END IF;
    END IF;

    -- 4. Store Bot Token in Supabase Vault
    v_vault_id := vault.create_secret(
        v_clean_token,
        'tg_bot_token_' || gen_random_uuid(),
        'Telegram bot token for destination: ' || p_name
    );

    -- 5. Insert into persistent application table (Zero token in public table)
    INSERT INTO public.telegram_destinations (
        organization_id,
        name,
        description,
        bot_id,
        bot_username,
        bot_token_vault_id,
        chat_id,
        thread_id,
        chat_title,
        chat_type,
        event_types,
        is_active,
        created_by
    ) VALUES (
        p_organization_id,
        btrim(p_name),
        btrim(p_description),
        v_resolved_bot_id,
        v_resolved_username,
        v_vault_id,
        btrim(p_chat_id),
        p_thread_id,
        v_resolved_chat_title,
        p_chat_type,
        v_expanded_events,
        true,
        auth.uid()
    ) RETURNING id INTO v_dest_id;

    RETURN jsonb_build_object(
        'id', v_dest_id,
        'organization_id', p_organization_id,
        'name', btrim(p_name),
        'bot_id', v_resolved_bot_id,
        'bot_username', v_resolved_username,
        'chat_id', btrim(p_chat_id),
        'thread_id', p_thread_id,
        'chat_title', v_resolved_chat_title,
        'chat_type', p_chat_type,
        'event_types', v_expanded_events,
        'is_active', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, pg_temp;

-- 2. Indexes and Deduplication Invariant
-- Unique partial index enforcing canonical destination identity for active rows
CREATE UNIQUE INDEX IF NOT EXISTS uq_telegram_dest_active_endpoint 
    ON public.telegram_destinations (organization_id, bot_id, chat_id, COALESCE(thread_id, 0))
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_telegram_destinations_org_active 
    ON public.telegram_destinations (organization_id, is_active);

-- 3. Row Level Security (RLS)
ALTER TABLE public.telegram_destinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telegram_destinations_select ON public.telegram_destinations;
CREATE POLICY telegram_destinations_select ON public.telegram_destinations
FOR SELECT USING (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) = 'owner'
    OR
    EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = telegram_destinations.organization_id
          AND user_id = auth.uid()
          AND org_role IN ('admin', 'owner')
    )
);

DROP POLICY IF EXISTS telegram_destinations_update ON public.telegram_destinations;
CREATE POLICY telegram_destinations_update ON public.telegram_destinations
FOR UPDATE USING (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) = 'owner'
    OR
    EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = telegram_destinations.organization_id
          AND user_id = auth.uid()
          AND org_role IN ('admin', 'owner')
    )
) WITH CHECK (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) = 'owner'
    OR
    EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = telegram_destinations.organization_id
          AND user_id = auth.uid()
          AND org_role IN ('admin', 'owner')
    )
);

DROP POLICY IF EXISTS telegram_destinations_delete ON public.telegram_destinations;
CREATE POLICY telegram_destinations_delete ON public.telegram_destinations
FOR DELETE USING (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) = 'owner'
    OR
    EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = telegram_destinations.organization_id
          AND user_id = auth.uid()
          AND org_role IN ('admin', 'owner')
    )
);

-- 4. Hard Delete Protection Trigger (Referential Integrity 23001 RESTRICT_VIOLATION)
CREATE OR REPLACE FUNCTION public._check_telegram_destination_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_outbox_count INT;
BEGIN
    SELECT COUNT(*) INTO v_outbox_count
    FROM public.integration_outbox
    WHERE destination_id = OLD.id AND channel_type = 'telegram';

    IF v_outbox_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete Telegram destination with existing delivery history. Deactivate with is_active = false instead.'
            USING ERRCODE = '23001';
    END IF;

    -- If historical count is 0, clean up secret from Supabase Vault
    IF OLD.bot_token_vault_id IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE id = OLD.bot_token_vault_id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_check_telegram_destination_delete ON public.telegram_destinations;
CREATE TRIGGER trg_check_telegram_destination_delete
BEFORE DELETE ON public.telegram_destinations
FOR EACH ROW EXECUTE FUNCTION public._check_telegram_destination_delete();

-- 5. Updated At Trigger
CREATE OR REPLACE FUNCTION public._trg_set_telegram_dest_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_telegram_dest_updated_at ON public.telegram_destinations;
CREATE TRIGGER trg_set_telegram_dest_updated_at
BEFORE UPDATE ON public.telegram_destinations
FOR EACH ROW EXECUTE FUNCTION public._trg_set_telegram_dest_updated_at();

-- 6. Management RPCs (Owner & Org Admin only)

-- Query destinations RPC
CREATE OR REPLACE FUNCTION public.get_telegram_destinations(p_organization_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_is_owner BOOLEAN := FALSE;
    v_is_org_admin BOOLEAN := FALSE;
    v_jwt_role TEXT;
    v_result JSONB;
BEGIN
    v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');

    IF v_jwt_role = 'service_role' OR auth.uid() IS NULL THEN
        -- Service role allowed
    ELSE
        SELECT (global_role = 'owner') INTO v_is_owner
        FROM public.profiles 
        WHERE id = auth.uid();

        IF NOT COALESCE(v_is_owner, FALSE) THEN
            SELECT EXISTS (
                SELECT 1 FROM public.organization_memberships
                WHERE organization_id = p_organization_id
                  AND user_id = auth.uid()
                  AND org_role IN ('admin', 'owner')
            ) INTO v_is_org_admin;

            IF NOT COALESCE(v_is_org_admin, FALSE) THEN
                RAISE EXCEPTION 'Access denied: Only Owner or Org Admin can view Telegram destinations'
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', id,
            'organization_id', organization_id,
            'name', name,
            'description', description,
            'bot_id', bot_id,
            'bot_username', bot_username,
            'chat_id', chat_id,
            'thread_id', thread_id,
            'chat_title', chat_title,
            'chat_type', chat_type,
            'event_types', event_types,
            'is_active', is_active,
            'created_at', created_at,
            'updated_at', updated_at
        ) ORDER BY created_at DESC
    ), '[]'::jsonb) INTO v_result
    FROM public.telegram_destinations
    WHERE organization_id = p_organization_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Toggle active RPC
CREATE OR REPLACE FUNCTION public.toggle_telegram_destination_active(
    p_destination_id UUID,
    p_is_active BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_dest RECORD;
    v_is_owner BOOLEAN := FALSE;
    v_is_org_admin BOOLEAN := FALSE;
    v_jwt_role TEXT;
BEGIN
    SELECT * INTO v_dest
    FROM public.telegram_destinations
    WHERE id = p_destination_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Telegram destination not found' USING ERRCODE = 'P0002';
    END IF;

    v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
    IF v_jwt_role = 'service_role' OR auth.uid() IS NULL THEN
        -- Service role allowed
    ELSE
        SELECT (global_role = 'owner') INTO v_is_owner
        FROM public.profiles WHERE id = auth.uid();

        IF NOT COALESCE(v_is_owner, FALSE) THEN
            SELECT EXISTS (
                SELECT 1 FROM public.organization_memberships
                WHERE organization_id = v_dest.organization_id
                  AND user_id = auth.uid()
                  AND org_role IN ('admin', 'owner')
            ) INTO v_is_org_admin;

            IF NOT COALESCE(v_is_org_admin, FALSE) THEN
                RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    UPDATE public.telegram_destinations
    SET is_active = p_is_active,
        updated_at = NOW()
    WHERE id = p_destination_id;

    RETURN jsonb_build_object('id', p_destination_id, 'is_active', p_is_active);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Delete destination RPC
CREATE OR REPLACE FUNCTION public.delete_telegram_destination(p_destination_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_dest RECORD;
    v_is_owner BOOLEAN := FALSE;
    v_is_org_admin BOOLEAN := FALSE;
    v_jwt_role TEXT;
BEGIN
    SELECT * INTO v_dest
    FROM public.telegram_destinations
    WHERE id = p_destination_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Telegram destination not found' USING ERRCODE = 'P0002';
    END IF;

    v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
    IF v_jwt_role = 'service_role' OR auth.uid() IS NULL THEN
        -- Service role allowed
    ELSE
        SELECT (global_role = 'owner') INTO v_is_owner
        FROM public.profiles WHERE id = auth.uid();

        IF NOT COALESCE(v_is_owner, FALSE) THEN
            SELECT EXISTS (
                SELECT 1 FROM public.organization_memberships
                WHERE organization_id = v_dest.organization_id
                  AND user_id = auth.uid()
                  AND org_role IN ('admin', 'owner')
            ) INTO v_is_org_admin;

            IF NOT COALESCE(v_is_org_admin, FALSE) THEN
                RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    -- Deletion triggers _check_telegram_destination_delete(), raising 23001 if outbox records exist
    DELETE FROM public.telegram_destinations
    WHERE id = p_destination_id;

    RETURN jsonb_build_object('id', p_destination_id, 'deleted', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7. Internal Helper to retrieve decrypted bot token for dispatcher
CREATE OR REPLACE FUNCTION public.get_telegram_destination_secret_internal(
    p_destination_id UUID,
    p_organization_id UUID
)
RETURNS TABLE (
    decrypted_bot_token TEXT,
    chat_id TEXT,
    thread_id BIGINT,
    chat_type TEXT,
    destination_name TEXT
) AS $$
DECLARE
    v_jwt_role TEXT;
    v_dest RECORD;
BEGIN
    v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
    IF v_jwt_role IN ('anon', 'authenticated') THEN
        RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_dest
    FROM public.telegram_destinations
    WHERE id = p_destination_id
      AND organization_id = p_organization_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = v_dest.bot_token_vault_id) AS decrypted_bot_token,
        v_dest.chat_id,
        v_dest.thread_id,
        v_dest.chat_type,
        v_dest.name AS destination_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, pg_temp;

REVOKE ALL ON FUNCTION public.get_telegram_destination_secret_internal(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_telegram_destination_secret_internal(UUID, UUID) TO service_role, postgres;

-- 7b. Enhanced get_integration_deliveries (multi-channel support for UI)
CREATE OR REPLACE FUNCTION public.get_integration_deliveries(
    p_organization_id UUID,
    p_limit INT DEFAULT 50
)
RETURNS JSONB AS $$
DECLARE
    v_is_owner BOOLEAN := FALSE;
    v_is_org_admin BOOLEAN := FALSE;
    v_jwt_role TEXT;
    v_result JSONB;
BEGIN
    v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');

    -- Authorization
    IF v_jwt_role = 'service_role' OR auth.uid() IS NULL THEN
        -- Service role allowed
    ELSE
        SELECT (global_role = 'owner') INTO v_is_owner
        FROM public.profiles 
        WHERE id = auth.uid();

        IF NOT COALESCE(v_is_owner, FALSE) THEN
            SELECT EXISTS (
                SELECT 1 FROM public.organization_memberships
                WHERE organization_id = p_organization_id
                  AND user_id = auth.uid()
                  AND org_role IN ('admin', 'owner')
            ) INTO v_is_org_admin;

            IF NOT COALESCE(v_is_org_admin, FALSE) THEN
                RAISE EXCEPTION 'Access denied: Only Owner or Org Admin can view deliveries'
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', o.id,
            'event_id', o.event_id,
            'event_type', e.event_type,
            'channel_type', o.channel_type,
            'destination_id', o.destination_id,
            'destination_name', COALESCE(ep.name, td.name),
            'url_masked', ep.url_masked,
            'chat_id', td.chat_id,
            'bot_username', td.bot_username,
            'status', o.status,
            'attempts_count', o.attempts_count,
            'max_attempts', o.max_attempts,
            'next_retry_at', o.next_retry_at,
            'last_attempt_at', o.last_attempt_at,
            'delivered_at', o.delivered_at,
            'last_http_status', o.last_http_status,
            'last_error', o.last_error,
            'created_at', o.created_at
        ) ORDER BY o.created_at DESC
    ), '[]'::jsonb) INTO v_result
    FROM (
        SELECT * FROM public.integration_outbox
        WHERE organization_id = p_organization_id
        ORDER BY created_at DESC
        LIMIT LEAST(GREATEST(p_limit, 1), 200)
    ) o
    JOIN public.integration_events e ON e.id = o.event_id
    LEFT JOIN public.integration_endpoints ep ON ep.id = o.destination_id AND o.channel_type = 'webhook'
    LEFT JOIN public.telegram_destinations td ON td.id = o.destination_id AND o.channel_type = 'telegram';

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.get_integration_deliveries(UUID, INT) TO authenticated;

-- 8. Enhanced Server-Side Outbox Router (Multi-Channel: Webhooks + Telegram)
CREATE OR REPLACE FUNCTION public._enqueue_integration_outbox_deliveries(p_event_id UUID)
RETURNS INT AS $$
DECLARE
    v_event RECORD;
    v_webhook_inserted INT := 0;
    v_telegram_inserted INT := 0;
BEGIN
    SELECT * INTO v_event 
    FROM public.integration_events 
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Channel 1: Webhook Endpoints
    INSERT INTO public.integration_outbox (
        organization_id,
        event_id,
        channel_type,
        destination_id,
        status,
        attempts_count,
        max_attempts,
        next_retry_at
    )
    SELECT
        v_event.organization_id,
        v_event.id,
        'webhook',
        ep.id,
        'pending',
        0,
        5,
        NOW()
    FROM public.integration_endpoints ep
    WHERE ep.organization_id = v_event.organization_id
      AND ep.is_active = true
      AND (
          ep.event_types = '{}' 
          OR '*' = ANY(ep.event_types) 
          OR v_event.event_type = ANY(ep.event_types)
      )
    ON CONFLICT (event_id, channel_type, destination_id) DO NOTHING;

    GET DIAGNOSTICS v_webhook_inserted = ROW_COUNT;

    -- Channel 2: Telegram Destinations (Phase 7B)
    INSERT INTO public.integration_outbox (
        organization_id,
        event_id,
        channel_type,
        destination_id,
        status,
        attempts_count,
        max_attempts,
        next_retry_at
    )
    SELECT
        v_event.organization_id,
        v_event.id,
        'telegram',
        td.id,
        'pending',
        0,
        5,
        NOW()
    FROM public.telegram_destinations td
    WHERE td.organization_id = v_event.organization_id
      AND td.is_active = true
      AND v_event.event_type = ANY(td.event_types)
    ON CONFLICT (event_id, channel_type, destination_id) DO NOTHING;

    GET DIAGNOSTICS v_telegram_inserted = ROW_COUNT;

    RETURN v_webhook_inserted + v_telegram_inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public._enqueue_integration_outbox_deliveries(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._enqueue_integration_outbox_deliveries(UUID) TO service_role, postgres;

-- 8b. Refined _emit_integration_event (Allowing trigger-based execution under authenticated sessions while strictly revoking direct client execution)
CREATE OR REPLACE FUNCTION public._emit_integration_event(
    p_entity_type TEXT,
    p_entity_id UUID,
    p_event_type TEXT,
    p_custom_payload JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_jwt_role TEXT;
    v_org_id UUID;
    v_project_id UUID;
    v_task RECORD;
    v_stage RECORD;
    v_doc RECORD;
    v_project RECORD;
    v_payload JSONB;
    v_event_id UUID;
BEGIN
    -- Security guard: Deny direct invocation by anon and authenticated roles (allow when executing within a trigger)
    v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
    IF v_jwt_role IN ('anon', 'authenticated') AND pg_trigger_depth() = 0 THEN
        RAISE EXCEPTION 'Permission denied: direct invocation of _emit_integration_event is prohibited'
            USING ERRCODE = '42501';
    END IF;

    -- Authoritative context resolution and strict payload allowlists
    IF p_entity_type = 'task' OR p_entity_type = 'client_action' THEN
        SELECT t.id, t.title, t.status, t.completed_at, t.responsibility_type, 
               t.organization_id, t.project_id, p.name AS project_name, o.name AS organization_name
        INTO v_task
        FROM public.tasks t
        JOIN public.projects p ON p.id = t.project_id
        JOIN public.organizations o ON o.id = t.organization_id
        WHERE t.id = p_entity_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Task entity not found: %', p_entity_id USING ERRCODE = 'P0002';
        END IF;

        v_org_id := v_task.organization_id;
        v_project_id := v_task.project_id;

        v_payload := jsonb_build_object(
            'task_id', v_task.id,
            'title', v_task.title,
            'status', v_task.status,
            'completed_at', v_task.completed_at,
            'responsibility_type', v_task.responsibility_type,
            'project_id', v_task.project_id,
            'project_name', v_task.project_name,
            'organization_name', v_task.organization_name
        );

    ELSIF p_entity_type = 'stage' THEN
        SELECT s.id, s.name, s.status, s.sort_order, s.started_at, s.completed_at,
               s.organization_id, s.project_id, p.name AS project_name, o.name AS organization_name
        INTO v_stage
        FROM public.project_stages s
        JOIN public.projects p ON p.id = s.project_id
        JOIN public.organizations o ON o.id = s.organization_id
        WHERE s.id = p_entity_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Stage entity not found: %', p_entity_id USING ERRCODE = 'P0002';
        END IF;

        v_org_id := v_stage.organization_id;
        v_project_id := v_stage.project_id;

        v_payload := jsonb_build_object(
            'stage_id', v_stage.id,
            'name', v_stage.name,
            'status', v_stage.status,
            'sort_order', v_stage.sort_order,
            'started_at', v_stage.started_at,
            'completed_at', v_stage.completed_at,
            'project_id', v_stage.project_id,
            'project_name', v_stage.project_name,
            'organization_name', v_stage.organization_name
        );

    ELSIF p_entity_type = 'document' THEN
        SELECT d.id, d.title, d.category, d.status, d.organization_id, d.project_id, p.name AS project_name, o.name AS organization_name
        INTO v_doc
        FROM public.documents d
        JOIN public.projects p ON p.id = d.project_id
        JOIN public.organizations o ON o.id = d.organization_id
        WHERE d.id = p_entity_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Document entity not found: %', p_entity_id USING ERRCODE = 'P0002';
        END IF;

        v_org_id := v_doc.organization_id;
        v_project_id := v_doc.project_id;

        v_payload := jsonb_build_object(
            'document_id', v_doc.id,
            'title', v_doc.title,
            'category', v_doc.category,
            'status', v_doc.status,
            'project_id', v_doc.project_id,
            'project_name', v_doc.project_name,
            'organization_name', v_doc.organization_name
        );

    ELSIF p_entity_type = 'project' THEN
        SELECT p.id, p.name, p.status, p.organization_id, p.created_at, o.name AS organization_name
        INTO v_project
        FROM public.projects p
        JOIN public.organizations o ON o.id = p.organization_id
        WHERE p.id = p_entity_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Project entity not found: %', p_entity_id USING ERRCODE = 'P0002';
        END IF;

        v_org_id := v_project.organization_id;
        v_project_id := v_project.id;

        v_payload := jsonb_build_object(
            'project_id', v_project.id,
            'name', v_project.name,
            'status', v_project.status,
            'created_at', v_project.created_at,
            'organization_name', v_project.organization_name
        );

    ELSE
        RAISE EXCEPTION 'Unsupported integration entity type: %', p_entity_type USING ERRCODE = '22023';
    END IF;

    -- If custom payload was provided by internal caller, merge only non-sensitive safe keys
    IF p_custom_payload IS NOT NULL AND p_custom_payload <> '{}'::jsonb THEN
        -- Strip any prohibited keys
        p_custom_payload := p_custom_payload - ARRAY[
            'token', 'raw_token', 'password', 'secret', 'signing_secret', 
            'bot_token', 'api_key', 'authorization', 'cookie', 'jwt', 
            'key', 'url', 'target_url', 'attachment_url', 'file_content'
        ];
        v_payload := v_payload || p_custom_payload;
    END IF;

    -- Transactional Insert into integration_events
    INSERT INTO public.integration_events (
        organization_id,
        project_id,
        event_type,
        entity_type,
        entity_id,
        payload_json
    ) VALUES (
        v_org_id,
        v_project_id,
        p_event_type,
        p_entity_type,
        p_entity_id,
        v_payload
    ) RETURNING id INTO v_event_id;

    -- Transactional enqueue into Outbox
    PERFORM public._enqueue_integration_outbox_deliveries(v_event_id);

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public._emit_integration_event(TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._emit_integration_event(TEXT, UUID, TEXT, JSONB) TO service_role, postgres;

-- 9. Table and RPC Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_destinations TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_telegram_destination TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_telegram_destinations TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_telegram_destination_active TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_telegram_destination TO authenticated;
