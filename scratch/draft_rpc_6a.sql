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
        RETURN jsonb_build_object('success', false, 'error', 'Published template version not found.');
    END IF;

    -- Basic Org validation
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid organization.');
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
