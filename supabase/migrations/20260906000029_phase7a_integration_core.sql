-- Migration: 20260906000029_phase7a_integration_core.sql
-- Description: Phase 7A - Integration Core, Transactional Outbox, Vault-Backed Endpoints, and Hardened Event Emitter

-- 1. Integration Events (Immutable Append-Only Log)
CREATE TABLE IF NOT EXISTS public.integration_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutability Guard Trigger: Reject any direct UPDATE or DELETE on integration_events
CREATE OR REPLACE FUNCTION public._set_integration_cascade_allowed()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM set_config('integration.cascade_delete_allowed', 'on', true);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_integration_cascade_allowed_proj ON public.projects;
CREATE TRIGGER trg_set_integration_cascade_allowed_proj
BEFORE DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public._set_integration_cascade_allowed();

DROP TRIGGER IF EXISTS trg_set_integration_cascade_allowed_org ON public.organizations;
CREATE TRIGGER trg_set_integration_cascade_allowed_org
BEFORE DELETE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public._set_integration_cascade_allowed();

CREATE OR REPLACE FUNCTION public.prevent_integration_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('integration.allow_cleanup', true) = 'on' 
       OR current_setting('integration.cascade_delete_allowed', true) = 'on'
       OR current_setting('session_replication_role', true) = 'replica' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'integration_events is immutable and cannot be modified or deleted'
        USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_integration_events_mutation ON public.integration_events;
CREATE TRIGGER trg_prevent_integration_events_mutation
BEFORE UPDATE OR DELETE ON public.integration_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_integration_events_mutation();

-- Indexes for querying and tenant scoping
CREATE INDEX IF NOT EXISTS idx_integration_events_org_created 
    ON public.integration_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_events_type 
    ON public.integration_events (event_type);

-- RLS: Default Deny. Owner and Org Admin can SELECT only. No client INSERT/UPDATE/DELETE.
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_events_select_policy ON public.integration_events;
CREATE POLICY integration_events_select_policy ON public.integration_events
FOR SELECT USING (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) = 'owner'
    OR
    EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = integration_events.organization_id
          AND user_id = auth.uid()
          AND org_role IN ('admin', 'owner')
    )
);

-- 2. Webhook Endpoints Table (Vault-backed URLs and secrets)
CREATE TABLE IF NOT EXISTS public.integration_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    url_secret_id UUID NOT NULL,
    signing_secret_id UUID NOT NULL,
    url_hostname TEXT NOT NULL,
    url_masked TEXT NOT NULL,
    event_types TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_endpoints_org_active 
    ON public.integration_endpoints (organization_id, is_active);

-- RLS for integration_endpoints
ALTER TABLE public.integration_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_endpoints_select ON public.integration_endpoints;
CREATE POLICY integration_endpoints_select ON public.integration_endpoints
FOR SELECT USING (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) = 'owner'
    OR
    EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = integration_endpoints.organization_id
          AND user_id = auth.uid()
          AND org_role IN ('admin', 'owner')
    )
);

DROP POLICY IF EXISTS integration_endpoints_update ON public.integration_endpoints;
CREATE POLICY integration_endpoints_update ON public.integration_endpoints
FOR UPDATE USING (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) = 'owner'
    OR
    EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = integration_endpoints.organization_id
          AND user_id = auth.uid()
          AND org_role IN ('admin', 'owner')
    )
) WITH CHECK (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) = 'owner'
    OR
    EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = integration_endpoints.organization_id
          AND user_id = auth.uid()
          AND org_role IN ('admin', 'owner')
    )
);

DROP POLICY IF EXISTS integration_endpoints_delete ON public.integration_endpoints;
CREATE POLICY integration_endpoints_delete ON public.integration_endpoints
FOR DELETE USING (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) = 'owner'
    OR
    EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = integration_endpoints.organization_id
          AND user_id = auth.uid()
          AND org_role IN ('admin', 'owner')
    )
);

-- 3. Transactional Integration Outbox Table
CREATE TABLE IF NOT EXISTS public.integration_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.integration_events(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL CHECK (channel_type IN ('webhook', 'telegram')),
    destination_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'retrying', 'delivered', 'failed', 'dead_letter', 'rejected_ssrf')),
    attempts_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    next_retry_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    last_http_status INT,
    last_error TEXT,
    response_body_preview TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_integration_outbox_delivery UNIQUE (event_id, channel_type, destination_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_outbox_poll 
    ON public.integration_outbox (status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_integration_outbox_destination 
    ON public.integration_outbox (destination_id, channel_type);
CREATE INDEX IF NOT EXISTS idx_integration_outbox_org 
    ON public.integration_outbox (organization_id, created_at DESC);

-- RLS on integration_outbox
ALTER TABLE public.integration_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_outbox_select ON public.integration_outbox;
CREATE POLICY integration_outbox_select ON public.integration_outbox
FOR SELECT USING (
    (SELECT global_role FROM public.profiles WHERE id = auth.uid()) = 'owner'
    OR
    EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = integration_outbox.organization_id
          AND user_id = auth.uid()
          AND org_role IN ('admin', 'owner')
    )
);

-- 4. Destination Lifecycle & Referential Integrity Guard
-- Prohibits hard deletion if ANY historical outbox row references the destination.
CREATE OR REPLACE FUNCTION public._check_integration_endpoint_delete()
RETURNS TRIGGER AS $$
DECLARE
    v_outbox_count INT;
BEGIN
    SELECT COUNT(*) INTO v_outbox_count
    FROM public.integration_outbox
    WHERE destination_id = OLD.id AND channel_type = 'webhook';

    IF v_outbox_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete endpoint with existing delivery history. Deactivate with is_active = false instead.'
            USING ERRCODE = '23001';
    END IF;

    -- If historical count is 0, clean up associated secrets from Vault
    IF OLD.url_secret_id IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE id = OLD.url_secret_id;
    END IF;
    IF OLD.signing_secret_id IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE id = OLD.signing_secret_id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_check_integration_endpoint_delete ON public.integration_endpoints;
CREATE TRIGGER trg_check_integration_endpoint_delete
BEFORE DELETE ON public.integration_endpoints
FOR EACH ROW EXECUTE FUNCTION public._check_integration_endpoint_delete();

-- 5. Server-Side Outbox Router
-- Takes ZERO client routing parameters. Queries active destinations for tenant and enqueues deliveries.
CREATE OR REPLACE FUNCTION public._enqueue_integration_outbox_deliveries(p_event_id UUID)
RETURNS INT AS $$
DECLARE
    v_event RECORD;
    v_inserted INT := 0;
BEGIN
    SELECT * INTO v_event 
    FROM public.integration_events 
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

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

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke execution from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public._enqueue_integration_outbox_deliveries(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._enqueue_integration_outbox_deliveries(UUID) TO service_role, postgres;

-- 6. Hardened Event Emission Engine
-- Authoritative server-side emission with payload allowlists and permission denial for browser clients.
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
    -- Security guard: Deny direct invocation by anon and authenticated roles
    v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
    IF v_jwt_role IN ('anon', 'authenticated') THEN
        RAISE EXCEPTION 'Permission denied: direct invocation of _emit_integration_event is prohibited'
            USING ERRCODE = '42501';
    END IF;

    -- Authoritative context resolution and strict payload allowlists
    IF p_entity_type = 'task' OR p_entity_type = 'client_action' THEN
        SELECT t.id, t.title, t.status, t.completed_at, t.responsibility_type, 
               t.organization_id, t.project_id, p.name AS project_name
        INTO v_task
        FROM public.tasks t
        JOIN public.projects p ON p.id = t.project_id
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
            'project_name', v_task.project_name
        );

    ELSIF p_entity_type = 'stage' THEN
        SELECT s.id, s.name, s.status, s.sort_order, s.started_at, s.completed_at,
               s.organization_id, s.project_id, p.name AS project_name
        INTO v_stage
        FROM public.project_stages s
        JOIN public.projects p ON p.id = s.project_id
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
            'project_name', v_stage.project_name
        );

    ELSIF p_entity_type = 'document' THEN
        SELECT d.id, d.title, d.category, d.status, d.organization_id, d.project_id, p.name AS project_name
        INTO v_doc
        FROM public.documents d
        JOIN public.projects p ON p.id = d.project_id
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
            'project_name', v_doc.project_name
        );

    ELSIF p_entity_type = 'project' THEN
        SELECT p.id, p.name, p.status, p.organization_id, p.created_at
        INTO v_project
        FROM public.projects p
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
            'created_at', v_project.created_at
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

-- Revoke execution from PUBLIC, anon, and authenticated
REVOKE ALL ON FUNCTION public._emit_integration_event(TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._emit_integration_event(TEXT, UUID, TEXT, JSONB) TO service_role, postgres;

-- 7. Webhook Endpoint Management RPCs (Owner & Org Admin only)

CREATE OR REPLACE FUNCTION public.create_integration_endpoint(
    p_organization_id UUID,
    p_name TEXT,
    p_description TEXT,
    p_target_url TEXT,
    p_event_types TEXT[] DEFAULT ARRAY['*']::TEXT[]
)
RETURNS JSONB AS $$
DECLARE
    v_is_owner BOOLEAN := FALSE;
    v_is_org_admin BOOLEAN := FALSE;
    v_jwt_role TEXT;
    v_hostname TEXT;
    v_masked TEXT;
    v_raw_signing_secret TEXT;
    v_url_secret_id UUID;
    v_signing_secret_id UUID;
    v_endpoint_id UUID;
BEGIN
    v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');

    -- 1. Authorization: Owner, Org Admin, or internal service_role
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
                RAISE EXCEPTION 'Access denied: Only Owner or Org Admin can manage webhook endpoints'
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    -- 2. Validate Target URL
    -- Reject userinfo (e.g. user:pass@host)
    IF p_target_url ~* '^https?://[^/]+@' THEN
        RAISE EXCEPTION 'URL userinfo is strictly forbidden' USING ERRCODE = '22023';
    END IF;

    -- Must start with https:// (http:// allowed only if localhost or test loopback)
    IF NOT (p_target_url ~* '^https://' OR p_target_url ~* '^http://localhost(:[0-9]+)?/' OR p_target_url ~* '^http://127\.0\.0\.1(:[0-9]+)?/') THEN
        RAISE EXCEPTION 'Webhook target URL must use HTTPS protocol' USING ERRCODE = '22023';
    END IF;

    -- Extract hostname
    v_hostname := substring(p_target_url from '^https?://([^/:]+)');
    IF v_hostname IS NULL OR length(v_hostname) = 0 THEN
        RAISE EXCEPTION 'Invalid URL: unable to determine hostname' USING ERRCODE = '22023';
    END IF;

    -- Build masked preview (only show protocol, hostname, and path prefix, never tokens/queries)
    v_masked := 'https://' || v_hostname || '/***';

    -- Generate CSPRNG signing secret
    v_raw_signing_secret := 'fws_' || encode(extensions.gen_random_bytes(32), 'hex');

    -- Store URL in Supabase Vault
    v_url_secret_id := vault.create_secret(
        p_target_url,
        'endpoint_url_' || gen_random_uuid(),
        'Target URL for webhook endpoint: ' || p_name
    );

    -- Store Signing Secret in Supabase Vault
    v_signing_secret_id := vault.create_secret(
        v_raw_signing_secret,
        'endpoint_signing_secret_' || gen_random_uuid(),
        'Signing secret for webhook endpoint: ' || p_name
    );

    -- Insert into persistent application table (Zero secrets in table)
    INSERT INTO public.integration_endpoints (
        organization_id,
        name,
        description,
        url_secret_id,
        signing_secret_id,
        url_hostname,
        url_masked,
        event_types,
        is_active,
        created_by
    ) VALUES (
        p_organization_id,
        p_name,
        p_description,
        v_url_secret_id,
        v_signing_secret_id,
        v_hostname,
        v_masked,
        COALESCE(p_event_types, ARRAY['*']::TEXT[]),
        true,
        auth.uid()
    ) RETURNING id INTO v_endpoint_id;

    -- Return endpoint metadata and the raw signing secret once
    RETURN jsonb_build_object(
        'id', v_endpoint_id,
        'organization_id', p_organization_id,
        'name', p_name,
        'description', p_description,
        'url_hostname', v_hostname,
        'url_masked', v_masked,
        'event_types', COALESCE(p_event_types, ARRAY['*']::TEXT[]),
        'is_active', true,
        'signing_secret', v_raw_signing_secret
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Secret rotation RPC
CREATE OR REPLACE FUNCTION public.rotate_integration_endpoint_secret(p_endpoint_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_ep RECORD;
    v_is_owner BOOLEAN := FALSE;
    v_is_org_admin BOOLEAN := FALSE;
    v_jwt_role TEXT;
    v_raw_signing_secret TEXT;
BEGIN
    SELECT * INTO v_ep
    FROM public.integration_endpoints
    WHERE id = p_endpoint_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Endpoint not found' USING ERRCODE = 'P0002';
    END IF;

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
                WHERE organization_id = v_ep.organization_id
                  AND user_id = auth.uid()
                  AND org_role IN ('admin', 'owner')
            ) INTO v_is_org_admin;

            IF NOT COALESCE(v_is_org_admin, FALSE) THEN
                RAISE EXCEPTION 'Access denied: Only Owner or Org Admin can rotate secrets'
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    -- Generate fresh secret
    v_raw_signing_secret := 'fws_' || encode(extensions.gen_random_bytes(32), 'hex');

    -- Update secret in Vault
    PERFORM vault.update_secret(v_ep.signing_secret_id, v_raw_signing_secret);

    UPDATE public.integration_endpoints
    SET updated_at = NOW()
    WHERE id = p_endpoint_id;

    RETURN jsonb_build_object(
        'id', p_endpoint_id,
        'signing_secret', v_raw_signing_secret
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Safe endpoint listing RPC (Returns zero secrets)
CREATE OR REPLACE FUNCTION public.get_integration_endpoints(p_organization_id UUID)
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
                RAISE EXCEPTION 'Access denied: Only Owner or Org Admin can view endpoints'
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
            'url_hostname', url_hostname,
            'url_masked', url_masked,
            'event_types', event_types,
            'is_active', is_active,
            'created_at', created_at,
            'updated_at', updated_at
        ) ORDER BY created_at DESC
    ), '[]'::jsonb) INTO v_result
    FROM public.integration_endpoints
    WHERE organization_id = p_organization_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Recent deliveries RPC for Webhook Administration UI
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
            'destination_name', ep.name,
            'url_masked', ep.url_masked,
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
    LEFT JOIN public.integration_endpoints ep ON ep.id = o.destination_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 8. Integration with Triggers: Emit events on core lifecycle milestones
-- Automatic emission on task completion
CREATE OR REPLACE FUNCTION public._trg_integration_task_completed()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status <> 'done' AND NEW.status = 'done') THEN
        PERFORM public._emit_integration_event('task', NEW.id, 'task.completed');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_integration_task_completed ON public.tasks;
CREATE TRIGGER trg_integration_task_completed
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public._trg_integration_task_completed();

-- Automatic emission on stage completion
CREATE OR REPLACE FUNCTION public._trg_integration_stage_completed()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status <> 'completed' AND NEW.status = 'completed') THEN
        PERFORM public._emit_integration_event('stage', NEW.id, 'stage.completed');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_integration_stage_completed ON public.project_stages;
CREATE TRIGGER trg_integration_stage_completed
AFTER UPDATE OF status ON public.project_stages
FOR EACH ROW EXECUTE FUNCTION public._trg_integration_stage_completed();

-- Automatic emission on document approval
CREATE OR REPLACE FUNCTION public._trg_integration_document_approved()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status <> 'approved' AND NEW.status = 'approved') THEN
        PERFORM public._emit_integration_event('document', NEW.id, 'document.approved');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_integration_document_approved ON public.documents;
CREATE TRIGGER trg_integration_document_approved
AFTER UPDATE OF status ON public.documents
FOR EACH ROW EXECUTE FUNCTION public._trg_integration_document_approved();

-- 9. Internal helper to retrieve decrypted secrets for dispatcher
CREATE OR REPLACE FUNCTION public.get_endpoint_secrets_internal(
    p_url_secret_id UUID,
    p_signing_secret_id UUID
)
RETURNS TABLE (
    decrypted_url TEXT,
    decrypted_signing_secret TEXT
) AS $$
DECLARE
    v_jwt_role TEXT;
BEGIN
    v_jwt_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
    IF v_jwt_role IN ('anon', 'authenticated') THEN
        RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT 
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = p_url_secret_id) AS decrypted_url,
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = p_signing_secret_id) AS decrypted_signing_secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, pg_temp;

REVOKE ALL ON FUNCTION public.get_endpoint_secrets_internal(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_endpoint_secrets_internal(UUID, UUID) TO service_role, postgres;

-- 10. Table Grants for RLS Enforcement
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.integration_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_endpoints TO authenticated;
GRANT SELECT ON public.integration_outbox TO authenticated;


