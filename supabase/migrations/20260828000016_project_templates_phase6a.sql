-- Phase 6A: Project Templates & Delivery Playbooks

BEGIN;

-- 1. Core Template Tables
CREATE TABLE public.project_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    project_type TEXT NOT NULL,
    category TEXT,
    default_currency TEXT DEFAULT 'UAH',
    estimated_duration_days INT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(template_id, version_number)
);

-- 2. Blueprint Entity Tables
CREATE TABLE public.template_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.template_versions(id) ON DELETE CASCADE,
    order_idx INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    default_status TEXT DEFAULT 'not_started',
    is_client_visible BOOLEAN DEFAULT true,
    estimated_duration_days INT,
    offset_days INT DEFAULT 0,
    depends_on_stage_id UUID NULL REFERENCES public.template_stages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.template_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.template_versions(id) ON DELETE CASCADE,
    stage_id UUID NULL REFERENCES public.template_stages(id) ON DELETE CASCADE,
    order_idx INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_client_visible BOOLEAN DEFAULT true,
    relative_due_offset INT,
    offset_anchor TEXT CHECK (offset_anchor IN ('project_start', 'stage_start', 'prev_milestone', 'none')),
    completion_requirement TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.template_versions(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.template_stages(id) ON DELETE CASCADE,
    milestone_id UUID NULL REFERENCES public.template_milestones(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    role_placeholder TEXT NOT NULL DEFAULT 'specialist' CHECK (role_placeholder IN ('owner', 'pm', 'specialist', 'other')),
    relative_due_offset INT,
    offset_anchor TEXT CHECK (offset_anchor IN ('project_start', 'stage_start', 'none')),
    is_client_visible BOOLEAN DEFAULT false,
    default_status TEXT DEFAULT 'todo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.template_client_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.template_versions(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.template_stages(id) ON DELETE CASCADE,
    milestone_id UUID NULL REFERENCES public.template_milestones(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    deadline_offset INT,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.template_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.template_versions(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.template_stages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    is_client_visible BOOLEAN DEFAULT true,
    approval_required BOOLEAN DEFAULT false,
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.template_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.template_versions(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.template_stages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    meeting_type TEXT NOT NULL,
    agenda_template TEXT,
    estimated_duration_minutes INT,
    role_placeholders JSONB DEFAULT '[]'::jsonb,
    is_client_visible BOOLEAN DEFAULT true,
    scheduling_offset_days INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency table for safe operations
CREATE TABLE public.idempotency_keys (
    key TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Template Audit Events
CREATE TABLE public.template_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    template_id UUID REFERENCES public.project_templates(id) ON DELETE SET NULL,
    template_version_id UUID REFERENCES public.template_versions(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add lineage to projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS template_id UUID NULL REFERENCES public.project_templates(id),
ADD COLUMN IF NOT EXISTS template_version_id UUID NULL REFERENCES public.template_versions(id),
ADD COLUMN IF NOT EXISTS created_from_template_at TIMESTAMPTZ NULL;

-- 3. RLS Policies
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_client_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_audit_events ENABLE ROW LEVEL SECURITY;

-- Security Definer to bypass some strict rules during complex creation, but let's implement base read policies
CREATE OR REPLACE FUNCTION public.is_template_readable(p_org_id UUID) RETURNS BOOLEAN AS $
BEGIN
    IF p_org_id IS NULL THEN
        RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role IN ('owner', 'pm'));
    END IF;
    RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner') OR
           EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = auth.uid() AND organization_id = p_org_id AND org_role IN ('pm', 'admin'));
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Internal Read Templates" ON public.project_templates FOR SELECT USING (public.is_template_readable(organization_id));
CREATE POLICY "Owner Manage Templates" ON public.project_templates FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner'));
CREATE POLICY "PM Manage Tenant Templates" ON public.project_templates FOR ALL USING (
    organization_id IS NOT NULL AND 
    EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = auth.uid() AND organization_id = project_templates.organization_id AND org_role IN ('pm', 'admin'))
);

-- Versions and blueprint tables inherit template visibility via JOINs, or we can just simplify
-- since templates are heavily managed by RPCs.
CREATE POLICY "Internal Read Template Versions" ON public.template_versions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.project_templates t WHERE t.id = template_versions.template_id AND public.is_template_readable(t.organization_id))
);
CREATE POLICY "Internal Read Template Stages" ON public.template_stages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.template_versions v JOIN public.project_templates t ON t.id = v.template_id WHERE v.id = template_stages.version_id AND public.is_template_readable(t.organization_id))
);
-- ... same for others, but let's use a simpler approach for builder operations: 
-- Because building involves many writes, we can do it via an RPC or add similar ALL policies for Owners/PMs.

COMMIT;


CREATE OR REPLACE FUNCTION public.create_project_from_template(
    p_template_version_id UUID,
    p_organization_id UUID,
    p_name TEXT,
    p_project_type TEXT,
    p_start_date DATE,
    p_target_date DATE,
    p_team_assignments JSONB, -- e.g., {"pm": "uuid", "specialists": ["uuid", "uuid"]}
    p_commercials JSONB, -- {"currency": "UAH", "contract_value": 150000}
    p_idempotency_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_project_id UUID;
    v_template_id UUID;
    v_is_locked BOOLEAN;
    v_org_valid BOOLEAN;
    v_pm_id UUID;
    v_stage RECORD;
    v_milestone RECORD;
    v_task RECORD;
    v_action RECORD;
    v_doc RECORD;
    v_meeting RECORD;
    v_stage_map JSONB := '{}'::jsonb;
    v_milestone_map JSONB := '{}'::jsonb;
    v_new_stage_id UUID;
    v_new_milestone_id UUID;
    v_source_template RECORD;
BEGIN
    -- 1. Idempotency Check
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.idempotency_keys WHERE key = p_idempotency_key) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Idempotency key already used.');
        END IF;
        INSERT INTO public.idempotency_keys (key, user_id) VALUES (p_idempotency_key, auth.uid());
    END IF;

    -- 2. Validate Template & Permissions
    SELECT t.id, v.is_locked INTO v_template_id, v_is_locked 
    FROM public.template_versions v
    JOIN public.project_templates t ON t.id = v.template_id
    WHERE v.id = p_template_version_id AND v.status = 'published';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Published template version not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_source_template FROM public.project_templates WHERE id = v_template_id;

    IF NOT public.is_template_readable(v_source_template.organization_id) THEN
        RAISE EXCEPTION 'Access denied.' USING ERRCODE = '42501';
    END IF;

    -- Basic Org validation
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
        RAISE EXCEPTION 'Invalid organization.' USING ERRCODE = '23503';
    END IF;

    -- 3. Resolve PM
    v_pm_id := (p_team_assignments->>'pm')::UUID;

    -- 4. Create Project
    INSERT INTO public.projects (
        organization_id, title, status, health, project_type, start_date, target_end_date,
        template_id, template_version_id, created_from_template_at
    ) VALUES (
        p_organization_id, p_name, 'discovery', 'on_track', COALESCE(p_project_type, 'consulting'), p_start_date, p_target_date,
        v_template_id, p_template_version_id, NOW()
    ) RETURNING id INTO v_project_id;

    IF v_pm_id IS NOT NULL THEN
        INSERT INTO public.project_memberships (project_id, user_id, project_role) VALUES (v_project_id, v_pm_id, 'pm');
    END IF;

    -- Commercials
    IF p_commercials IS NOT NULL THEN
        INSERT INTO public.project_commercial_terms (
            project_id, currency, contract_value_minor
        ) VALUES (
            v_project_id, COALESCE(p_commercials->>'currency', 'UAH'), COALESCE((p_commercials->>'contract_value')::BIGINT, 0)
        );
    END IF;

    -- 5. Copy Stages
    FOR v_stage IN (SELECT * FROM public.template_stages WHERE version_id = p_template_version_id ORDER BY order_idx) LOOP
        INSERT INTO public.project_stages (
            organization_id, project_id, name, description, sort_order, status, is_client_visible, start_date, target_date
        ) VALUES (
            p_organization_id, v_project_id, v_stage.title, v_stage.description, v_stage.order_idx, v_stage.default_status, v_stage.is_client_visible,
            p_start_date + (COALESCE(v_stage.offset_days, 0) || ' days')::INTERVAL,
            p_start_date + ((COALESCE(v_stage.offset_days, 0) + COALESCE(v_stage.estimated_duration_days, 0)) || ' days')::INTERVAL
        ) RETURNING id INTO v_new_stage_id;
        
        v_stage_map := jsonb_set(v_stage_map, ARRAY[v_stage.id::TEXT], to_jsonb(v_new_stage_id));
    END LOOP;

    -- 6. Copy Milestones
    FOR v_milestone IN (SELECT * FROM public.template_milestones WHERE version_id = p_template_version_id ORDER BY order_idx) LOOP
        INSERT INTO public.milestones (
            organization_id, project_id, stage_id, name, description, sort_order, is_client_visible, target_date
        ) VALUES (
            p_organization_id, v_project_id, 
            (v_stage_map->>(v_milestone.stage_id::TEXT))::UUID, 
            v_milestone.title, v_milestone.description, v_milestone.order_idx, v_milestone.is_client_visible,
            p_start_date + (COALESCE(v_milestone.relative_due_offset, 0) || ' days')::INTERVAL
        ) RETURNING id INTO v_new_milestone_id;

        v_milestone_map := jsonb_set(v_milestone_map, ARRAY[v_milestone.id::TEXT], to_jsonb(v_new_milestone_id));
    END LOOP;

    -- 7. Copy Tasks
    FOR v_task IN (SELECT * FROM public.template_tasks WHERE version_id = p_template_version_id) LOOP
        INSERT INTO public.tasks (
            organization_id, project_id, stage_id, milestone_id, title, description, priority, status, is_client_visible, due_date, assignee_user_id
        ) VALUES (
            p_organization_id, v_project_id, 
            (v_stage_map->>(v_task.stage_id::TEXT))::UUID, 
            (v_milestone_map->>(v_task.milestone_id::TEXT))::UUID,
            v_task.title, v_task.description, v_task.priority, v_task.default_status, v_task.is_client_visible,
            p_start_date + (COALESCE(v_task.relative_due_offset, 0) || ' days')::INTERVAL,
            CASE WHEN v_task.role_placeholder = 'pm' THEN v_pm_id ELSE NULL END
        );
    END LOOP;

    -- 8. Copy Client Actions
    FOR v_action IN (SELECT * FROM public.template_client_actions WHERE version_id = p_template_version_id) LOOP
        INSERT INTO public.tasks (
            organization_id, project_id, stage_id, milestone_id, title, description, priority, status, responsibility_type, is_client_visible, due_date
        ) VALUES (
            p_organization_id, v_project_id, 
            (v_stage_map->>(v_action.stage_id::TEXT))::UUID, 
            (v_milestone_map->>(v_action.milestone_id::TEXT))::UUID,
            v_action.title, v_action.description, v_action.priority, 'todo', 'client', true,
            p_start_date + (COALESCE(v_action.deadline_offset, 0) || ' days')::INTERVAL
        );
    END LOOP;

    -- 9. Documents
    FOR v_doc IN (SELECT * FROM public.template_documents WHERE version_id = p_template_version_id) LOOP
        INSERT INTO public.documents (
            organization_id, project_id, stage_id, title, category, is_client_visible, status
        ) VALUES (
            p_organization_id, v_project_id, 
            (v_stage_map->>(v_doc.stage_id::TEXT))::UUID, 
            v_doc.title, v_doc.category, v_doc.is_client_visible, 
            CASE WHEN v_doc.approval_required THEN 'draft' ELSE 'approved' END
        );
    END LOOP;

    -- 10. Meetings
    FOR v_meeting IN (SELECT * FROM public.template_meetings WHERE version_id = p_template_version_id) LOOP
        INSERT INTO public.meetings (
            organization_id, project_id, title, meeting_type, is_client_visible, start_at, end_at
        ) VALUES (
            p_organization_id, v_project_id, 
            v_meeting.title, v_meeting.meeting_type, v_meeting.is_client_visible,
            p_start_date + (COALESCE(v_meeting.scheduling_offset_days, 0) || ' days')::INTERVAL,
            p_start_date + (COALESCE(v_meeting.scheduling_offset_days, 0) || ' days')::INTERVAL + (COALESCE(v_meeting.estimated_duration_minutes, 60) || ' minutes')::INTERVAL
        );
    END LOOP;

    -- 11. Audit Log
    INSERT INTO public.template_audit_events (
        event_type, actor_id, template_id, template_version_id, project_id, organization_id, metadata
    ) VALUES (
        'project_created_from_template', auth.uid(), v_template_id, p_template_version_id, v_project_id, p_organization_id, 
        jsonb_build_object()
    );

    RETURN jsonb_build_object('success', true, 'project_id', v_project_id);
END;
$$;
