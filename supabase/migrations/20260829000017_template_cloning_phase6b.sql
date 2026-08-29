-- Phase 6B: Template Cloning & Advanced Delivery Orchestration

BEGIN;

-- RPC 1: Create a Draft from a Published Version
CREATE OR REPLACE FUNCTION public.create_template_draft(
    p_template_id UUID,
    p_idempotency_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_source_template RECORD;
    v_published_version_id UUID;
    v_published_version_num INT;
    v_new_version_id UUID;
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

    -- 2. Verify Template Access (SECURITY DEFINER requires manual check)
    SELECT * INTO v_source_template FROM public.project_templates WHERE id = p_template_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Template not found.');
    END IF;

    IF NOT public.is_template_readable(v_source_template.organization_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied.');
    END IF;

    -- 3. Check for existing draft
    IF EXISTS (SELECT 1 FROM public.template_versions WHERE template_id = p_template_id AND status = 'draft') THEN
        RETURN jsonb_build_object('success', false, 'error', 'A draft version already exists for this template.');
    END IF;

    -- 4. Find the latest published version
    SELECT id, version_number INTO v_published_version_id, v_published_version_num
    FROM public.template_versions
    WHERE template_id = p_template_id AND status = 'published'
    ORDER BY version_number DESC LIMIT 1;

    IF v_published_version_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No published version found to draft from.');
    END IF;

    -- 5. Create new draft version
    INSERT INTO public.template_versions (
        template_id, version_number, status, is_locked, created_by
    ) VALUES (
        p_template_id, v_published_version_num + 1, 'draft', false, auth.uid()
    ) RETURNING id INTO v_new_version_id;

    -- 6. Clone Stages
    FOR v_stage IN (SELECT * FROM public.template_stages WHERE version_id = v_published_version_id ORDER BY order_idx) LOOP
        v_new_stage_id := gen_random_uuid();
        v_stage_map := jsonb_set(v_stage_map, ARRAY[v_stage.id::TEXT], to_jsonb(v_new_stage_id));
        
        INSERT INTO public.template_stages (
            id, version_id, order_idx, title, description, default_status, is_client_visible, estimated_duration_days, offset_days, depends_on_stage_id
        ) VALUES (
            v_new_stage_id, v_new_version_id, v_stage.order_idx, v_stage.title, v_stage.description, v_stage.default_status, v_stage.is_client_visible, v_stage.estimated_duration_days, v_stage.offset_days, 
            -- Self-referencing depends_on_stage_id mapping:
            CASE WHEN v_stage.depends_on_stage_id IS NOT NULL THEN (v_stage_map->>(v_stage.depends_on_stage_id::TEXT))::UUID ELSE NULL END
        );
    END LOOP;

    -- 7. Clone Milestones
    FOR v_milestone IN (SELECT * FROM public.template_milestones WHERE version_id = v_published_version_id ORDER BY order_idx) LOOP
        v_new_milestone_id := gen_random_uuid();
        v_milestone_map := jsonb_set(v_milestone_map, ARRAY[v_milestone.id::TEXT], to_jsonb(v_new_milestone_id));
        
        INSERT INTO public.template_milestones (
            id, version_id, stage_id, order_idx, title, description, is_client_visible, relative_due_offset, offset_anchor, completion_requirement
        ) VALUES (
            v_new_milestone_id, v_new_version_id, 
            CASE WHEN v_milestone.stage_id IS NOT NULL THEN (v_stage_map->>(v_milestone.stage_id::TEXT))::UUID ELSE NULL END, 
            v_milestone.order_idx, v_milestone.title, v_milestone.description, v_milestone.is_client_visible, v_milestone.relative_due_offset, v_milestone.offset_anchor, v_milestone.completion_requirement
        );
    END LOOP;

    -- 8. Clone Tasks
    FOR v_task IN (SELECT * FROM public.template_tasks WHERE version_id = v_published_version_id) LOOP
        INSERT INTO public.template_tasks (
            version_id, stage_id, milestone_id, title, description, priority, role_placeholder, relative_due_offset, offset_anchor, is_client_visible, default_status
        ) VALUES (
            v_new_version_id, 
            (v_stage_map->>(v_task.stage_id::TEXT))::UUID, 
            CASE WHEN v_task.milestone_id IS NOT NULL THEN (v_milestone_map->>(v_task.milestone_id::TEXT))::UUID ELSE NULL END,
            v_task.title, v_task.description, v_task.priority, v_task.role_placeholder, v_task.relative_due_offset, v_task.offset_anchor, v_task.is_client_visible, v_task.default_status
        );
    END LOOP;

    -- 9. Clone Client Actions
    FOR v_action IN (SELECT * FROM public.template_client_actions WHERE version_id = v_published_version_id) LOOP
        INSERT INTO public.template_client_actions (
            version_id, stage_id, milestone_id, title, description, priority, deadline_offset, is_required
        ) VALUES (
            v_new_version_id, 
            (v_stage_map->>(v_action.stage_id::TEXT))::UUID, 
            CASE WHEN v_action.milestone_id IS NOT NULL THEN (v_milestone_map->>(v_action.milestone_id::TEXT))::UUID ELSE NULL END,
            v_action.title, v_action.description, v_action.priority, v_action.deadline_offset, v_action.is_required
        );
    END LOOP;

    -- 10. Clone Documents
    FOR v_doc IN (SELECT * FROM public.template_documents WHERE version_id = v_published_version_id) LOOP
        INSERT INTO public.template_documents (
            version_id, stage_id, title, category, is_client_visible, approval_required, instructions
        ) VALUES (
            v_new_version_id, 
            (v_stage_map->>(v_doc.stage_id::TEXT))::UUID, 
            v_doc.title, v_doc.category, v_doc.is_client_visible, v_doc.approval_required, v_doc.instructions
        );
    END LOOP;

    -- 11. Clone Meetings
    FOR v_meeting IN (SELECT * FROM public.template_meetings WHERE version_id = v_published_version_id) LOOP
        INSERT INTO public.template_meetings (
            version_id, stage_id, title, meeting_type, agenda_template, estimated_duration_minutes, role_placeholders, is_client_visible, scheduling_offset_days
        ) VALUES (
            v_new_version_id, 
            (v_stage_map->>(v_meeting.stage_id::TEXT))::UUID, 
            v_meeting.title, v_meeting.meeting_type, v_meeting.agenda_template, v_meeting.estimated_duration_minutes, v_meeting.role_placeholders, v_meeting.is_client_visible, v_meeting.scheduling_offset_days
        );
    END LOOP;

    -- 12. Audit Event
    INSERT INTO public.template_audit_events (
        event_type, actor_id, template_id, template_version_id, organization_id, metadata
    ) VALUES (
        'draft_created_from_published', auth.uid(), p_template_id, v_new_version_id, v_source_template.organization_id,
        jsonb_build_object('source_version_id', v_published_version_id)
    );

    RETURN jsonb_build_object('success', true, 'template_id', p_template_id, 'new_version_id', v_new_version_id);
END;
$$;


-- RPC 2: Clone Entire Project Template
CREATE OR REPLACE FUNCTION public.clone_project_template(
    p_template_id UUID,
    p_new_name TEXT,
    p_idempotency_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_source_template RECORD;
    v_source_version_id UUID;
    v_new_template_id UUID;
    v_new_version_id UUID;
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

    -- 2. Verify Template Access
    SELECT * INTO v_source_template FROM public.project_templates WHERE id = p_template_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Source template not found.');
    END IF;

    IF NOT public.is_template_readable(v_source_template.organization_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied.');
    END IF;

    -- 3. Find the version to clone (prefer latest published, otherwise latest draft)
    SELECT id INTO v_source_version_id
    FROM public.template_versions
    WHERE template_id = p_template_id
    ORDER BY (status = 'published') DESC, version_number DESC
    LIMIT 1;

    IF v_source_version_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Source template has no versions to clone.');
    END IF;

    -- 4. Create new template (Clone maintains same organization_id)
    INSERT INTO public.project_templates (
        organization_id, name, description, project_type, category, default_currency, estimated_duration_days, status, created_by
    ) VALUES (
        v_source_template.organization_id, p_new_name, v_source_template.description, v_source_template.project_type, v_source_template.category, v_source_template.default_currency, v_source_template.estimated_duration_days, 'draft', auth.uid()
    ) RETURNING id INTO v_new_template_id;

    -- 5. Create draft version for new template
    INSERT INTO public.template_versions (
        template_id, version_number, status, is_locked, created_by
    ) VALUES (
        v_new_template_id, 1, 'draft', false, auth.uid()
    ) RETURNING id INTO v_new_version_id;

    -- 6. Clone Stages
    FOR v_stage IN (SELECT * FROM public.template_stages WHERE version_id = v_source_version_id ORDER BY order_idx) LOOP
        v_new_stage_id := gen_random_uuid();
        v_stage_map := jsonb_set(v_stage_map, ARRAY[v_stage.id::TEXT], to_jsonb(v_new_stage_id));
        
        INSERT INTO public.template_stages (
            id, version_id, order_idx, title, description, default_status, is_client_visible, estimated_duration_days, offset_days, depends_on_stage_id
        ) VALUES (
            v_new_stage_id, v_new_version_id, v_stage.order_idx, v_stage.title, v_stage.description, v_stage.default_status, v_stage.is_client_visible, v_stage.estimated_duration_days, v_stage.offset_days, 
            CASE WHEN v_stage.depends_on_stage_id IS NOT NULL THEN (v_stage_map->>(v_stage.depends_on_stage_id::TEXT))::UUID ELSE NULL END
        );
    END LOOP;

    -- 7. Clone Milestones
    FOR v_milestone IN (SELECT * FROM public.template_milestones WHERE version_id = v_source_version_id ORDER BY order_idx) LOOP
        v_new_milestone_id := gen_random_uuid();
        v_milestone_map := jsonb_set(v_milestone_map, ARRAY[v_milestone.id::TEXT], to_jsonb(v_new_milestone_id));
        
        INSERT INTO public.template_milestones (
            id, version_id, stage_id, order_idx, title, description, is_client_visible, relative_due_offset, offset_anchor, completion_requirement
        ) VALUES (
            v_new_milestone_id, v_new_version_id, 
            CASE WHEN v_milestone.stage_id IS NOT NULL THEN (v_stage_map->>(v_milestone.stage_id::TEXT))::UUID ELSE NULL END, 
            v_milestone.order_idx, v_milestone.title, v_milestone.description, v_milestone.is_client_visible, v_milestone.relative_due_offset, v_milestone.offset_anchor, v_milestone.completion_requirement
        );
    END LOOP;

    -- 8. Clone Tasks
    FOR v_task IN (SELECT * FROM public.template_tasks WHERE version_id = v_source_version_id) LOOP
        INSERT INTO public.template_tasks (
            version_id, stage_id, milestone_id, title, description, priority, role_placeholder, relative_due_offset, offset_anchor, is_client_visible, default_status
        ) VALUES (
            v_new_version_id, 
            (v_stage_map->>(v_task.stage_id::TEXT))::UUID, 
            CASE WHEN v_task.milestone_id IS NOT NULL THEN (v_milestone_map->>(v_task.milestone_id::TEXT))::UUID ELSE NULL END,
            v_task.title, v_task.description, v_task.priority, v_task.role_placeholder, v_task.relative_due_offset, v_task.offset_anchor, v_task.is_client_visible, v_task.default_status
        );
    END LOOP;

    -- 9. Clone Client Actions
    FOR v_action IN (SELECT * FROM public.template_client_actions WHERE version_id = v_source_version_id) LOOP
        INSERT INTO public.template_client_actions (
            version_id, stage_id, milestone_id, title, description, priority, deadline_offset, is_required
        ) VALUES (
            v_new_version_id, 
            (v_stage_map->>(v_action.stage_id::TEXT))::UUID, 
            CASE WHEN v_action.milestone_id IS NOT NULL THEN (v_milestone_map->>(v_action.milestone_id::TEXT))::UUID ELSE NULL END,
            v_action.title, v_action.description, v_action.priority, v_action.deadline_offset, v_action.is_required
        );
    END LOOP;

    -- 10. Clone Documents
    FOR v_doc IN (SELECT * FROM public.template_documents WHERE version_id = v_source_version_id) LOOP
        INSERT INTO public.template_documents (
            version_id, stage_id, title, category, is_client_visible, approval_required, instructions
        ) VALUES (
            v_new_version_id, 
            (v_stage_map->>(v_doc.stage_id::TEXT))::UUID, 
            v_doc.title, v_doc.category, v_doc.is_client_visible, v_doc.approval_required, v_doc.instructions
        );
    END LOOP;

    -- 11. Clone Meetings
    FOR v_meeting IN (SELECT * FROM public.template_meetings WHERE version_id = v_source_version_id) LOOP
        INSERT INTO public.template_meetings (
            version_id, stage_id, title, meeting_type, agenda_template, estimated_duration_minutes, role_placeholders, is_client_visible, scheduling_offset_days
        ) VALUES (
            v_new_version_id, 
            (v_stage_map->>(v_meeting.stage_id::TEXT))::UUID, 
            v_meeting.title, v_meeting.meeting_type, v_meeting.agenda_template, v_meeting.estimated_duration_minutes, v_meeting.role_placeholders, v_meeting.is_client_visible, v_meeting.scheduling_offset_days
        );
    END LOOP;

    -- 12. Audit Event
    INSERT INTO public.template_audit_events (
        event_type, actor_id, template_id, template_version_id, organization_id, metadata
    ) VALUES (
        'template_cloned', auth.uid(), v_new_template_id, v_new_version_id, v_source_template.organization_id,
        jsonb_build_object('source_template_id', p_template_id, 'source_version_id', v_source_version_id)
    );

    RETURN jsonb_build_object('success', true, 'new_template_id', v_new_template_id, 'new_version_id', v_new_version_id);
END;
$$;

COMMIT;
