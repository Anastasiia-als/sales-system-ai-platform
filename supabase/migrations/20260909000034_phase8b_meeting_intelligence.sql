-- =============================================================================
-- Migration: 20260909000034_phase8b_meeting_intelligence.sql
-- Description: Phase 8B - Meeting Intelligence & Action Item Extraction
-- Tables: public.meeting_ai_artifacts
-- RPC: public.apply_meeting_intelligence_items
-- =============================================================================

-- 1. Create meeting_ai_artifacts table
CREATE TABLE IF NOT EXISTS public.meeting_ai_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    generation_log_id UUID REFERENCES public.ai_generation_logs(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'applied', 'discarded')),
    raw_input_hash TEXT NOT NULL,
    summary TEXT,
    decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
    candidate_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    applied_decisions_count INTEGER NOT NULL DEFAULT 0,
    applied_tasks_count INTEGER NOT NULL DEFAULT 0,
    created_task_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    applied_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Trigger for updated_at
DROP TRIGGER IF EXISTS set_meeting_ai_artifacts_updated_at ON public.meeting_ai_artifacts;
CREATE TRIGGER set_meeting_ai_artifacts_updated_at
    BEFORE UPDATE ON public.meeting_ai_artifacts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_meeting_ai_artifacts_meeting ON public.meeting_ai_artifacts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_ai_artifacts_org ON public.meeting_ai_artifacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_meeting_ai_artifacts_project ON public.meeting_ai_artifacts(project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_ai_artifacts_status ON public.meeting_ai_artifacts(status);

-- 4. RLS Policies
ALTER TABLE public.meeting_ai_artifacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.meeting_ai_artifacts FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.meeting_ai_artifacts TO authenticated;
GRANT ALL ON TABLE public.meeting_ai_artifacts TO service_role;

DROP POLICY IF EXISTS "Internal members view meeting artifacts" ON public.meeting_ai_artifacts;
CREATE POLICY "Internal members view meeting artifacts"
ON public.meeting_ai_artifacts FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_memberships om
        WHERE om.organization_id = meeting_ai_artifacts.organization_id
          AND om.user_id = auth.uid()
          AND om.is_active = TRUE
          AND om.org_role IN ('owner', 'admin', 'pm', 'member')
    ) OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.global_role = 'owner'
    )
);

DROP POLICY IF EXISTS "Internal members manage meeting artifacts" ON public.meeting_ai_artifacts;
CREATE POLICY "Internal members manage meeting artifacts"
ON public.meeting_ai_artifacts FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_memberships om
        WHERE om.organization_id = meeting_ai_artifacts.organization_id
          AND om.user_id = auth.uid()
          AND om.is_active = TRUE
          AND om.org_role IN ('admin', 'owner', 'pm')
    ) OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.global_role = 'owner'
    )
);

-- 5. Transactional RPC: apply_meeting_intelligence_items
CREATE OR REPLACE FUNCTION public.apply_meeting_intelligence_items(
    p_artifact_id UUID,
    p_apply_summary BOOLEAN,
    p_summary_text TEXT,
    p_decisions JSONB,
    p_action_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_is_owner BOOLEAN := FALSE;
    v_has_org_access BOOLEAN := FALSE;
    v_artifact RECORD;
    v_meeting RECORD;
    v_dec RECORD;
    v_act RECORD;
    v_new_task_id UUID;
    v_created_task_ids UUID[] := '{}'::uuid[];
    v_dec_count INTEGER := 0;
    v_summary_text TEXT;
    v_dec_text TEXT;
    v_dec_client_vis BOOLEAN;
    v_title TEXT;
    v_desc TEXT;
    v_resp_type TEXT;
    v_prio TEXT;
    v_due DATE;
    v_assignee_user UUID;
    v_contact_id UUID;
    v_client_vis BOOLEAN;
BEGIN
    -- 1. Authenticate caller
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION '401: Unauthorized';
    END IF;

    -- 2. Lock and retrieve artifact
    SELECT * INTO v_artifact
    FROM public.meeting_ai_artifacts
    WHERE id = p_artifact_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404: Meeting AI artifact not found';
    END IF;

    -- Check caller authority (Owner or Org Admin/Manager)
    SELECT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = v_caller_id AND global_role = 'owner'
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
        SELECT EXISTS (
            SELECT 1 FROM public.organization_memberships
            WHERE organization_id = v_artifact.organization_id
              AND user_id = v_caller_id
              AND is_active = TRUE
              AND org_role IN ('admin', 'owner', 'pm')
        ) INTO v_has_org_access;

        IF NOT v_has_org_access THEN
            RAISE EXCEPTION '403: Forbidden - insufficient privileges to apply meeting intelligence';
        END IF;
    END IF;

    -- Invariant: artifact cannot be re-applied
    IF v_artifact.status = 'applied' THEN
        RAISE EXCEPTION '409: Meeting AI artifact has already been applied';
    END IF;

    -- 3. Retrieve meeting context
    SELECT * INTO v_meeting
    FROM public.meetings
    WHERE id = v_artifact.meeting_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION '404: Referenced meeting not found';
    END IF;

    -- 4. Apply Summary if requested
    IF p_apply_summary IS TRUE THEN
        v_summary_text := TRIM(COALESCE(p_summary_text, ''));
        IF LENGTH(v_summary_text) > 0 THEN
            INSERT INTO public.meeting_notes (
                meeting_id,
                organization_id,
                project_id,
                note_type,
                body,
                is_client_visible,
                created_by
            ) VALUES (
                v_meeting.id,
                v_meeting.organization_id,
                v_meeting.project_id,
                'summary',
                v_summary_text,
                FALSE,
                v_caller_id
            );
        END IF;
    END IF;

    -- 5. Apply Decisions
    IF p_decisions IS NOT NULL AND jsonb_typeof(p_decisions) = 'array' THEN
        FOR v_dec IN SELECT * FROM jsonb_to_recordset(p_decisions) AS (
            decision_text TEXT,
            is_client_visible BOOLEAN
        )
        LOOP
            v_dec_text := TRIM(COALESCE(v_dec.decision_text, ''));
            IF LENGTH(v_dec_text) > 0 THEN
                v_dec_client_vis := COALESCE(v_dec.is_client_visible, TRUE);
                INSERT INTO public.meeting_decisions (
                    meeting_id,
                    organization_id,
                    project_id,
                    decision_text,
                    is_client_visible,
                    created_by
                ) VALUES (
                    v_meeting.id,
                    v_meeting.organization_id,
                    v_meeting.project_id,
                    v_dec_text,
                    v_dec_client_vis,
                    v_caller_id
                );
                v_dec_count := v_dec_count + 1;
            END IF;
        END LOOP;
    END IF;

    -- 6. Apply Candidate Action Items into tasks
    IF p_action_items IS NOT NULL AND jsonb_typeof(p_action_items) = 'array' THEN
        FOR v_act IN SELECT * FROM jsonb_to_recordset(p_action_items) AS (
            title TEXT,
            description TEXT,
            responsibility_type TEXT,
            priority TEXT,
            due_date TEXT,
            assignee_user_id UUID,
            client_contact_id UUID,
            is_client_visible BOOLEAN
        )
        LOOP
            v_title := TRIM(COALESCE(v_act.title, ''));
            IF LENGTH(v_title) > 0 THEN
                v_desc := COALESCE(v_act.description, '');
                v_resp_type := CASE 
                    WHEN LOWER(COALESCE(v_act.responsibility_type, '')) = 'client' THEN 'client'
                    ELSE 'internal'
                END;
                v_prio := CASE 
                    WHEN LOWER(COALESCE(v_act.priority, '')) IN ('low', 'medium', 'high') THEN LOWER(v_act.priority)
                    ELSE 'medium'
                END;
                v_client_vis := CASE
                    WHEN v_resp_type = 'client' THEN TRUE
                    ELSE COALESCE(v_act.is_client_visible, FALSE)
                END;

                -- Safely parse due date
                v_due := NULL;
                IF v_act.due_date IS NOT NULL AND TRIM(v_act.due_date) != '' THEN
                    BEGIN
                        v_due := v_act.due_date::DATE;
                    EXCEPTION WHEN OTHERS THEN
                        v_due := NULL;
                    END;
                END IF;

                v_assignee_user := CASE WHEN v_resp_type = 'internal' THEN v_act.assignee_user_id ELSE NULL END;
                v_contact_id := CASE WHEN v_resp_type = 'client' THEN v_act.client_contact_id ELSE NULL END;

                INSERT INTO public.tasks (
                    organization_id,
                    project_id,
                    source_meeting_id,
                    title,
                    description,
                    responsibility_type,
                    priority,
                    due_date,
                    assignee_user_id,
                    client_contact_id,
                    is_client_visible,
                    status,
                    created_by
                ) VALUES (
                    v_meeting.organization_id,
                    v_meeting.project_id,
                    v_meeting.id,
                    v_title,
                    v_desc,
                    v_resp_type,
                    v_prio,
                    v_due,
                    v_assignee_user,
                    v_contact_id,
                    v_client_vis,
                    'todo',
                    v_caller_id
                ) RETURNING id INTO v_new_task_id;

                v_created_task_ids := array_append(v_created_task_ids, v_new_task_id);
            END IF;
        END LOOP;
    END IF;

    -- 7. Update Artifact to 'applied'
    UPDATE public.meeting_ai_artifacts
    SET status = 'applied',
        applied_decisions_count = v_dec_count,
        applied_tasks_count = COALESCE(array_length(v_created_task_ids, 1), 0),
        created_task_ids = v_created_task_ids,
        applied_by = v_caller_id,
        applied_at = NOW(),
        updated_at = NOW()
    WHERE id = p_artifact_id;

    RETURN jsonb_build_object(
        'ok', true,
        'artifact_id', p_artifact_id,
        'created_tasks_count', COALESCE(array_length(v_created_task_ids, 1), 0),
        'created_decisions_count', v_dec_count,
        'created_task_ids', to_jsonb(v_created_task_ids)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_meeting_intelligence_items FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_meeting_intelligence_items TO authenticated, service_role;
