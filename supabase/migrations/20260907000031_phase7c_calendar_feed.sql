-- 20260907000031_phase7c_calendar_feed.sql
-- Phase 7C: Calendar Read-Only Feed (RFC 5545 iCalendar Subscription Engine)
--
-- Security & Data Architecture:
-- 1. Hash-Only Token Architecture: Raw token is 256-bit crypto hex; DB stores only sha256(raw_token)
-- 2. Strictly Read-Only: No mutation of business entities allowed through calendar feeds
-- 3. Scopes: 'personal', 'project', 'organization', 'client'
-- 4. RBAC & Tenant Isolation: Hardened RLS and SECURITY DEFINER RPCs

-- 1. Create table public.calendar_feed_subscriptions
CREATE TABLE IF NOT EXISTS public.calendar_feed_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                                 -- User-facing feed name (e.g. "My Delivery Schedule")
    feed_scope TEXT NOT NULL,                           -- 'personal', 'project', 'organization', 'client'
    token_hash TEXT NOT NULL UNIQUE,                    -- SHA-256 hash of subscription token (raw token NEVER stored)
    token_preview TEXT NOT NULL,                        -- First 6 characters of raw token for UI identification
    is_active BOOLEAN NOT NULL DEFAULT true,            -- Soft enable / disable
    last_accessed_at TIMESTAMPTZ,                       -- Last poll timestamp by external calendar client
    access_count BIGINT NOT NULL DEFAULT 0,             -- Total poll requests
    expires_at TIMESTAMPTZ,                             -- Optional expiry timestamp (NULL = indefinite)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Integrity constraints
    CONSTRAINT chk_calendar_feed_scope CHECK (
        feed_scope IN ('personal', 'project', 'organization', 'client')
    ),
    CONSTRAINT chk_calendar_feed_project_scope CHECK (
        (feed_scope IN ('project', 'client') AND project_id IS NOT NULL)
        OR (feed_scope IN ('personal', 'organization'))
    )
);

-- Indexes for performant lookup and tenant isolation
CREATE INDEX IF NOT EXISTS idx_calendar_feed_lookup ON public.calendar_feed_subscriptions(token_hash) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_calendar_feed_org ON public.calendar_feed_subscriptions(organization_id, created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_feed_project ON public.calendar_feed_subscriptions(project_id) WHERE project_id IS NOT NULL;

-- 2. Enable Row Level Security
ALTER TABLE public.calendar_feed_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies: Tenant Isolation & Role Hierarchy
-- Drop existing policies if any
DROP POLICY IF EXISTS "calendar_feed_select_policy" ON public.calendar_feed_subscriptions;
DROP POLICY IF EXISTS "calendar_feed_insert_policy" ON public.calendar_feed_subscriptions;
DROP POLICY IF EXISTS "calendar_feed_update_policy" ON public.calendar_feed_subscriptions;
DROP POLICY IF EXISTS "calendar_feed_delete_policy" ON public.calendar_feed_subscriptions;

-- SELECT: Owner/Admin sees all feeds in their org; regular users see feeds they created in their org
CREATE POLICY "calendar_feed_select_policy" ON public.calendar_feed_subscriptions
FOR SELECT TO authenticated
USING (
    organization_id IN (
        SELECT m.organization_id FROM public.organization_memberships m
        WHERE m.user_id = auth.uid()
          AND (
              (m.org_role IN ('owner', 'admin') AND m.is_active = true)
              OR calendar_feed_subscriptions.created_by = auth.uid()
          )
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.global_role = 'owner'
    )
);

-- INSERT: Allowed only for members of the organization
CREATE POLICY "calendar_feed_insert_policy" ON public.calendar_feed_subscriptions
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = created_by
    AND (
        organization_id IN (
            SELECT m.organization_id FROM public.organization_memberships m
            WHERE m.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.global_role = 'owner'
        )
    )
);

-- UPDATE: Owner/Admin or feed creator can update their feed
CREATE POLICY "calendar_feed_update_policy" ON public.calendar_feed_subscriptions
FOR UPDATE TO authenticated
USING (
    organization_id IN (
        SELECT m.organization_id FROM public.organization_memberships m
        WHERE m.user_id = auth.uid()
          AND (
              (m.org_role IN ('owner', 'admin') AND m.is_active = true)
              OR calendar_feed_subscriptions.created_by = auth.uid()
          )
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.global_role = 'owner'
    )
)
WITH CHECK (
    organization_id IN (
        SELECT m.organization_id FROM public.organization_memberships m
        WHERE m.user_id = auth.uid()
          AND (
              (m.org_role IN ('owner', 'admin') AND m.is_active = true)
              OR calendar_feed_subscriptions.created_by = auth.uid()
          )
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.global_role = 'owner'
    )
);

-- DELETE: Owner/Admin or feed creator can delete
CREATE POLICY "calendar_feed_delete_policy" ON public.calendar_feed_subscriptions
FOR DELETE TO authenticated
USING (
    organization_id IN (
        SELECT m.organization_id FROM public.organization_memberships m
        WHERE m.user_id = auth.uid()
          AND (
              (m.org_role IN ('owner', 'admin') AND m.is_active = true)
              OR calendar_feed_subscriptions.created_by = auth.uid()
          )
    )
    OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.global_role = 'owner'
    )
);

-- 4. SECURITY DEFINER RPCs for Calendar Subscriptions

-- 4.1. create_calendar_feed_subscription
CREATE OR REPLACE FUNCTION public.create_calendar_feed_subscription(
    p_organization_id UUID,
    p_name TEXT,
    p_feed_scope TEXT,
    p_project_id UUID DEFAULT NULL,
    p_token_hash TEXT DEFAULT NULL,
    p_token_preview TEXT DEFAULT NULL,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_is_owner BOOLEAN;
    v_is_org_admin BOOLEAN;
    v_is_member BOOLEAN;
    v_clean_name TEXT;
    v_sub_id UUID;
    v_created_at TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    -- Validate parameters
    v_clean_name := trim(COALESCE(p_name, ''));
    IF length(v_clean_name) < 2 THEN
        RAISE EXCEPTION 'Feed name must be at least 2 characters' USING ERRCODE = '22023';
    END IF;

    IF p_feed_scope NOT IN ('personal', 'project', 'organization', 'client') THEN
        RAISE EXCEPTION 'Invalid feed scope: %', p_feed_scope USING ERRCODE = '22023';
    END IF;

    IF p_feed_scope IN ('project', 'client') AND p_project_id IS NULL THEN
        RAISE EXCEPTION 'Project ID is required for project/client scoped feeds' USING ERRCODE = '22023';
    END IF;

    IF p_token_hash IS NULL OR length(p_token_hash) <> 64 THEN
        RAISE EXCEPTION 'Invalid token hash (must be 64-char hex SHA-256)' USING ERRCODE = '22023';
    END IF;

    -- Verify caller authorization
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND global_role = 'owner')
    INTO v_is_owner;

    SELECT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE user_id = v_user_id AND organization_id = p_organization_id AND org_role IN ('owner', 'admin') AND is_active = true
    ) INTO v_is_org_admin;

    SELECT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE user_id = v_user_id AND organization_id = p_organization_id AND is_active = true
    ) INTO v_is_member;

    IF NOT (v_is_owner OR v_is_member) THEN
        RAISE EXCEPTION 'Access denied: caller is not a member of the organization' USING ERRCODE = '42501';
    END IF;

    -- Only Owner or Org Admin can create organization-wide feeds
    IF p_feed_scope = 'organization' AND NOT (v_is_owner OR v_is_org_admin) THEN
        RAISE EXCEPTION 'Access denied: Only Owner or Org Admin can create organization-wide calendar feeds' USING ERRCODE = '42501';
    END IF;

    -- Verify project belongs to organization if specified
    IF p_project_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND organization_id = p_organization_id) THEN
            RAISE EXCEPTION 'Project % does not belong to organization %', p_project_id, p_organization_id USING ERRCODE = 'P0002';
        END IF;
    END IF;

    -- Insert record
    INSERT INTO public.calendar_feed_subscriptions (
        organization_id,
        created_by,
        project_id,
        name,
        feed_scope,
        token_hash,
        token_preview,
        is_active,
        expires_at
    ) VALUES (
        p_organization_id,
        v_user_id,
        p_project_id,
        v_clean_name,
        p_feed_scope,
        p_token_hash,
        COALESCE(p_token_preview, substring(p_token_hash from 1 for 6)),
        true,
        p_expires_at
    ) RETURNING id, created_at INTO v_sub_id, v_created_at;

    RETURN jsonb_build_object(
        'id', v_sub_id,
        'organization_id', p_organization_id,
        'name', v_clean_name,
        'feed_scope', p_feed_scope,
        'project_id', p_project_id,
        'token_preview', COALESCE(p_token_preview, substring(p_token_hash from 1 for 6)),
        'is_active', true,
        'created_at', v_created_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4.2. get_calendar_feed_subscriptions
CREATE OR REPLACE FUNCTION public.get_calendar_feed_subscriptions(
    p_organization_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_is_owner BOOLEAN;
    v_is_org_admin BOOLEAN;
    v_is_member BOOLEAN;
    v_result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND global_role = 'owner')
    INTO v_is_owner;

    SELECT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE user_id = v_user_id AND organization_id = p_organization_id AND org_role IN ('owner', 'admin') AND is_active = true
    ) INTO v_is_org_admin;

    SELECT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE user_id = v_user_id AND organization_id = p_organization_id AND is_active = true
    ) INTO v_is_member;

    IF NOT (v_is_owner OR v_is_member) THEN
        RAISE EXCEPTION 'Access denied: caller is not a member of the organization' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'organization_id', s.organization_id,
            'project_id', s.project_id,
            'project_name', p.name,
            'name', s.name,
            'feed_scope', s.feed_scope,
            'token_preview', s.token_preview,
            'is_active', s.is_active,
            'last_accessed_at', s.last_accessed_at,
            'access_count', s.access_count,
            'expires_at', s.expires_at,
            'created_at', s.created_at,
            'created_by', s.created_by,
            'creator_name', COALESCE(pr.full_name, pr.email, 'Користувач')
        ) ORDER BY s.created_at DESC
    ), '[]'::jsonb)
    INTO v_result
    FROM public.calendar_feed_subscriptions s
    LEFT JOIN public.projects p ON s.project_id = p.id
    LEFT JOIN public.profiles pr ON s.created_by = pr.id
    WHERE s.organization_id = p_organization_id
      AND (
          v_is_owner 
          OR v_is_org_admin 
          OR s.created_by = v_user_id
      );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4.3. revoke_calendar_feed_subscription
CREATE OR REPLACE FUNCTION public.revoke_calendar_feed_subscription(
    p_subscription_id UUID,
    p_organization_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_is_owner BOOLEAN;
    v_is_org_admin BOOLEAN;
    v_sub RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_sub
    FROM public.calendar_feed_subscriptions
    WHERE id = p_subscription_id AND organization_id = p_organization_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Calendar subscription not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND global_role = 'owner')
    INTO v_is_owner;

    SELECT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE user_id = v_user_id AND organization_id = p_organization_id AND org_role IN ('owner', 'admin') AND is_active = true
    ) INTO v_is_org_admin;

    IF NOT (v_is_owner OR v_is_org_admin OR v_sub.created_by = v_user_id) THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions to revoke this subscription' USING ERRCODE = '42501';
    END IF;

    UPDATE public.calendar_feed_subscriptions
    SET is_active = NOT is_active, updated_at = now()
    WHERE id = p_subscription_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4.4. rotate_calendar_feed_subscription
CREATE OR REPLACE FUNCTION public.rotate_calendar_feed_subscription(
    p_subscription_id UUID,
    p_organization_id UUID,
    p_new_token_hash TEXT,
    p_new_token_preview TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_is_owner BOOLEAN;
    v_is_org_admin BOOLEAN;
    v_sub RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF p_new_token_hash IS NULL OR length(p_new_token_hash) <> 64 THEN
        RAISE EXCEPTION 'Invalid token hash' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_sub
    FROM public.calendar_feed_subscriptions
    WHERE id = p_subscription_id AND organization_id = p_organization_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Calendar subscription not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND global_role = 'owner')
    INTO v_is_owner;

    SELECT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE user_id = v_user_id AND organization_id = p_organization_id AND org_role IN ('owner', 'admin') AND is_active = true
    ) INTO v_is_org_admin;

    IF NOT (v_is_owner OR v_is_org_admin OR v_sub.created_by = v_user_id) THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions to rotate this subscription' USING ERRCODE = '42501';
    END IF;

    UPDATE public.calendar_feed_subscriptions
    SET token_hash = p_new_token_hash,
        token_preview = p_new_token_preview,
        is_active = true,
        updated_at = now()
    WHERE id = p_subscription_id;

    RETURN jsonb_build_object(
        'id', p_subscription_id,
        'token_preview', p_new_token_preview,
        'rotated_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4.5. delete_calendar_feed_subscription
CREATE OR REPLACE FUNCTION public.delete_calendar_feed_subscription(
    p_subscription_id UUID,
    p_organization_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
    v_is_owner BOOLEAN;
    v_is_org_admin BOOLEAN;
    v_sub RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_sub
    FROM public.calendar_feed_subscriptions
    WHERE id = p_subscription_id AND organization_id = p_organization_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Calendar subscription not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND global_role = 'owner')
    INTO v_is_owner;

    SELECT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE user_id = v_user_id AND organization_id = p_organization_id AND org_role IN ('owner', 'admin') AND is_active = true
    ) INTO v_is_org_admin;

    IF NOT (v_is_owner OR v_is_org_admin OR v_sub.created_by = v_user_id) THEN
        RAISE EXCEPTION 'Access denied: insufficient permissions to delete this subscription' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.calendar_feed_subscriptions WHERE id = p_subscription_id;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4.6. Internal read function for public calendar HTTP endpoint: get_calendar_feed_data_by_hash
CREATE OR REPLACE FUNCTION public.get_calendar_feed_data_by_hash(
    p_token_hash TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_sub RECORD;
    v_org_active BOOLEAN;
    v_user_active BOOLEAN;
    v_stages JSONB;
    v_tasks JSONB;
    v_max_updated TIMESTAMPTZ;
BEGIN
    -- 1. Find subscription by exact SHA-256 hash
    SELECT * INTO v_sub
    FROM public.calendar_feed_subscriptions
    WHERE token_hash = p_token_hash
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now());

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'not_found_or_expired');
    END IF;

    -- 2. Validate organization and user membership status
    SELECT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE user_id = v_sub.created_by AND organization_id = v_sub.organization_id AND is_active = true
    ) INTO v_user_active;

    IF NOT v_user_active THEN
        -- Check if creator is platform owner
        SELECT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = v_sub.created_by AND global_role = 'owner'
        ) INTO v_user_active;
    END IF;

    IF NOT v_user_active THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'creator_membership_revoked');
    END IF;

    -- 3. Query Stages according to scope
    IF v_sub.feed_scope = 'organization' THEN
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', s.id,
                'name', s.name,
                'description', s.description,
                'status', s.status,
                'start_date', s.start_date,
                'target_date', s.target_date,
                'project_id', s.project_id,
                'project_name', p.name,
                'updated_at', s.updated_at
            ) ORDER BY s.target_date ASC NULLS LAST
        ), '[]'::jsonb), MAX(s.updated_at)
        INTO v_stages, v_max_updated
        FROM public.project_stages s
        JOIN public.projects p ON s.project_id = p.id
        WHERE s.organization_id = v_sub.organization_id
          AND p.status = 'active';

    ELSIF v_sub.feed_scope = 'project' THEN
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', s.id,
                'name', s.name,
                'description', s.description,
                'status', s.status,
                'start_date', s.start_date,
                'target_date', s.target_date,
                'project_id', s.project_id,
                'project_name', p.name,
                'updated_at', s.updated_at
            ) ORDER BY s.target_date ASC NULLS LAST
        ), '[]'::jsonb), MAX(s.updated_at)
        INTO v_stages, v_max_updated
        FROM public.project_stages s
        JOIN public.projects p ON s.project_id = p.id
        WHERE s.project_id = v_sub.project_id;

    ELSIF v_sub.feed_scope = 'client' THEN
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', s.id,
                'name', s.name,
                'description', s.description,
                'status', s.status,
                'start_date', s.start_date,
                'target_date', s.target_date,
                'project_id', s.project_id,
                'project_name', p.name,
                'updated_at', s.updated_at
            ) ORDER BY s.target_date ASC NULLS LAST
        ), '[]'::jsonb), MAX(s.updated_at)
        INTO v_stages, v_max_updated
        FROM public.project_stages s
        JOIN public.projects p ON s.project_id = p.id
        WHERE s.project_id = v_sub.project_id
          AND s.is_client_visible = true;

    ELSE -- 'personal'
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', s.id,
                'name', s.name,
                'description', s.description,
                'status', s.status,
                'start_date', s.start_date,
                'target_date', s.target_date,
                'project_id', s.project_id,
                'project_name', p.name,
                'updated_at', s.updated_at
            ) ORDER BY s.target_date ASC NULLS LAST
        ), '[]'::jsonb), MAX(s.updated_at)
        INTO v_stages, v_max_updated
        FROM public.project_stages s
        JOIN public.projects p ON s.project_id = p.id
        WHERE s.organization_id = v_sub.organization_id
          AND s.responsible_user_id = v_sub.created_by
          AND p.status = 'active';
    END IF;

    -- 4. Query Tasks according to scope
    IF v_sub.feed_scope = 'organization' THEN
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'title', t.title,
                'description', t.description,
                'status', t.status,
                'priority', t.priority,
                'start_date', t.start_date,
                'due_date', t.due_date,
                'responsibility_type', t.responsibility_type,
                'project_id', t.project_id,
                'project_name', p.name,
                'updated_at', t.updated_at
            ) ORDER BY t.due_date ASC NULLS LAST
        ), '[]'::jsonb), GREATEST(v_max_updated, MAX(t.updated_at))
        INTO v_tasks, v_max_updated
        FROM public.tasks t
        JOIN public.projects p ON t.project_id = p.id
        WHERE t.organization_id = v_sub.organization_id
          AND p.status = 'active';

    ELSIF v_sub.feed_scope = 'project' THEN
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'title', t.title,
                'description', t.description,
                'status', t.status,
                'priority', t.priority,
                'start_date', t.start_date,
                'due_date', t.due_date,
                'responsibility_type', t.responsibility_type,
                'project_id', t.project_id,
                'project_name', p.name,
                'updated_at', t.updated_at
            ) ORDER BY t.due_date ASC NULLS LAST
        ), '[]'::jsonb), GREATEST(v_max_updated, MAX(t.updated_at))
        INTO v_tasks, v_max_updated
        FROM public.tasks t
        JOIN public.projects p ON t.project_id = p.id
        WHERE t.project_id = v_sub.project_id;

    ELSIF v_sub.feed_scope = 'client' THEN
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'title', t.title,
                'description', t.description,
                'status', t.status,
                'priority', t.priority,
                'start_date', t.start_date,
                'due_date', t.due_date,
                'responsibility_type', t.responsibility_type,
                'project_id', t.project_id,
                'project_name', p.name,
                'updated_at', t.updated_at
            ) ORDER BY t.due_date ASC NULLS LAST
        ), '[]'::jsonb), GREATEST(v_max_updated, MAX(t.updated_at))
        INTO v_tasks, v_max_updated
        FROM public.tasks t
        JOIN public.projects p ON t.project_id = p.id
        WHERE t.project_id = v_sub.project_id
          AND (t.is_client_visible = true OR t.responsibility_type = 'client');

    ELSE -- 'personal'
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'title', t.title,
                'description', t.description,
                'status', t.status,
                'priority', t.priority,
                'start_date', t.start_date,
                'due_date', t.due_date,
                'responsibility_type', t.responsibility_type,
                'project_id', t.project_id,
                'project_name', p.name,
                'updated_at', t.updated_at
            ) ORDER BY t.due_date ASC NULLS LAST
        ), '[]'::jsonb), GREATEST(v_max_updated, MAX(t.updated_at))
        INTO v_tasks, v_max_updated
        FROM public.tasks t
        JOIN public.projects p ON t.project_id = p.id
        WHERE t.organization_id = v_sub.organization_id
          AND t.assignee_user_id = v_sub.created_by
          AND p.status = 'active';
    END IF;

    -- Return full dataset for iCal generation
    RETURN jsonb_build_object(
        'ok', true,
        'subscription', jsonb_build_object(
            'id', v_sub.id,
            'name', v_sub.name,
            'feed_scope', v_sub.feed_scope,
            'organization_id', v_sub.organization_id,
            'project_id', v_sub.project_id,
            'created_at', v_sub.created_at,
            'updated_at', v_sub.updated_at
        ),
        'stages', COALESCE(v_stages, '[]'::jsonb),
        'tasks', COALESCE(v_tasks, '[]'::jsonb),
        'max_updated_at', COALESCE(v_max_updated, v_sub.updated_at)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke all permissions on internal query function from public / client roles
REVOKE ALL ON FUNCTION public.get_calendar_feed_data_by_hash(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_feed_data_by_hash(TEXT) TO service_role, postgres;

-- Grant execute on public subscription management RPCs to authenticated
GRANT EXECUTE ON FUNCTION public.create_calendar_feed_subscription(UUID, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_calendar_feed_subscriptions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_calendar_feed_subscription(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_calendar_feed_subscription(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_calendar_feed_subscription(UUID, UUID) TO authenticated;
