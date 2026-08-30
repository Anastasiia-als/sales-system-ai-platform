
-- 1. Modify Existing Tables to add Workflow Fields

-- Update Project Stages enum constraint
ALTER TABLE public.project_stages DROP CONSTRAINT IF EXISTS project_stages_status_check;
ALTER TABLE public.project_stages ADD CONSTRAINT project_stages_status_check 
    CHECK (status IN ('not_started', 'ready', 'in_progress', 'waiting_client', 'blocked', 'completed', 'skipped'));

-- Add fields to project_stages
ALTER TABLE public.project_stages 
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS block_reason TEXT,
    ADD COLUMN IF NOT EXISTS automation_status TEXT DEFAULT 'manual' CHECK (automation_status IN ('manual', 'rule_engine')),
    ADD COLUMN IF NOT EXISTS transition_source TEXT DEFAULT 'manual';

-- Add fields to milestones
ALTER TABLE public.milestones 
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS block_reason TEXT,
    ADD COLUMN IF NOT EXISTS automation_status TEXT DEFAULT 'manual' CHECK (automation_status IN ('manual', 'rule_engine')),
    ADD COLUMN IF NOT EXISTS transition_source TEXT DEFAULT 'manual';

-- Add fields to tasks
ALTER TABLE public.tasks 
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS block_reason TEXT,
    ADD COLUMN IF NOT EXISTS automation_status TEXT DEFAULT 'manual' CHECK (automation_status IN ('manual', 'rule_engine')),
    ADD COLUMN IF NOT EXISTS transition_source TEXT DEFAULT 'manual';

-- Add fields to documents
ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS automation_status TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS transition_source TEXT DEFAULT 'manual';

-- Add fields to projects
ALTER TABLE public.projects 
    ADD COLUMN IF NOT EXISTS derived_health_status TEXT DEFAULT 'on_track' 
        CHECK (derived_health_status IN ('on_track', 'attention', 'at_risk', 'delayed', 'blocked')),
    ADD COLUMN IF NOT EXISTS derived_health_reasons JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Prague';

-- 2. Dependencies Table
CREATE TABLE IF NOT EXISTS public.project_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    
    source_type TEXT NOT NULL CHECK (source_type IN ('task', 'milestone', 'stage', 'document', 'client_action', 'payment', 'meeting')),
    source_id UUID NOT NULL,
    
    target_type TEXT NOT NULL CHECK (target_type IN ('task', 'milestone', 'stage')),
    target_id UUID NOT NULL,
    
    dependency_type TEXT NOT NULL CHECK (dependency_type IN ('blocks', 'requires', 'unlocks', 'informational')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Blockers Table
CREATE TABLE IF NOT EXISTS public.project_blockers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES public.project_stages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    source_type TEXT NOT NULL,
    source_id UUID,
    responsible_user_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'waiting', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_note TEXT
);

-- 4. Automation Rules Table
CREATE TABLE IF NOT EXISTS public.automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.project_templates(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    trigger_event TEXT NOT NULL,
    conditions JSONB DEFAULT '[]'::jsonb,
    actions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 5. Execution Log
CREATE TABLE IF NOT EXISTS public.automation_execution_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES public.automation_rules(id) ON DELETE SET NULL,
    trigger_event TEXT NOT NULL,
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    result TEXT NOT NULL CHECK (result IN ('success', 'failed', 'condition_not_met')),
    matched_conditions JSONB,
    actions_attempted JSONB,
    actions_completed JSONB,
    actions_failed JSONB,
    actor_id UUID REFERENCES auth.users(id),
    error_summary TEXT,
    idempotency_key TEXT UNIQUE
);

-- 6. SLA Policies Table
CREATE TABLE IF NOT EXISTS public.sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.project_templates(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id UUID,
    sla_duration_hours NUMERIC NOT NULL,
    is_business_time BOOLEAN DEFAULT true,
    timezone TEXT DEFAULT 'Europe/Prague',
    warning_threshold_percent NUMERIC DEFAULT 80,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all new tables
ALTER TABLE public.project_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_execution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;

-- PL/pgSQL Automation Engine

-- 1. Helper function for Business Days (SLA)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.add_business_days(start_date TIMESTAMP WITH TIME ZONE, days INT, tz TEXT DEFAULT 'Europe/Prague')
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    v_current_date TIMESTAMP WITH TIME ZONE := start_date;
    days_added INT := 0;
BEGIN
    WHILE days_added < days LOOP
        v_current_date := v_current_date + INTERVAL '1 day';
        IF EXTRACT(ISODOW FROM v_current_date AT TIME ZONE tz) < 6 THEN
            days_added := days_added + 1;
        END IF;
    END LOOP;
    RETURN v_current_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Core Automation Evaluator
CREATE OR REPLACE FUNCTION public.evaluate_automation_rules(p_trigger_event TEXT, p_project_id UUID, p_context JSONB)
RETURNS VOID AS $$
DECLARE
    v_rule RECORD;
    v_conditions_met BOOLEAN;
    v_condition JSONB;
    v_field_val TEXT;
    v_action JSONB;
    v_error_msg TEXT;
    v_idempotency_key TEXT;
    v_action_attempted JSONB := '[]'::jsonb;
    v_action_completed JSONB := '[]'::jsonb;
    v_depth INT;
BEGIN
    SELECT pg_trigger_depth() INTO v_depth;
    IF v_depth > 5 THEN
        RAISE WARNING 'Automation loop detected. Execution depth exceeded.';
        RETURN;
    END IF;

    FOR v_rule IN (SELECT * FROM public.automation_rules WHERE project_id = p_project_id AND is_active = true AND trigger_event = p_trigger_event) LOOP
        v_conditions_met := true;
        
        FOR v_condition IN SELECT * FROM jsonb_array_elements(v_rule.conditions) LOOP
            v_field_val := p_context->>(v_condition->>'field');
            IF v_condition->>'operator' = 'eq' AND v_field_val != (v_condition->>'value') THEN
                v_conditions_met := false;
            ELSIF v_condition->>'operator' = 'neq' AND v_field_val = (v_condition->>'value') THEN
                v_conditions_met := false;
            END IF;
        END LOOP;
        
        IF NOT v_conditions_met THEN
            INSERT INTO public.automation_execution_events (
                organization_id, project_id, rule_id, trigger_event, result, matched_conditions
            ) VALUES (
                v_rule.organization_id, p_project_id, v_rule.id, p_trigger_event, 'condition_not_met', p_context
            );
            CONTINUE;
        END IF;

        v_idempotency_key := encode(digest(v_rule.id::TEXT || p_trigger_event || p_context::TEXT, 'sha256'), 'hex');

        IF EXISTS (SELECT 1 FROM public.automation_execution_events WHERE idempotency_key = v_idempotency_key AND result = 'success') THEN
            CONTINUE;
        END IF;

        BEGIN
            v_action_attempted := '[]'::jsonb;
            v_action_completed := '[]'::jsonb;
            FOR v_action IN SELECT * FROM jsonb_array_elements(v_rule.actions) LOOP
                v_action_attempted := v_action_attempted || v_action;
                
                IF v_action->>'type' = 'complete_milestone' THEN
                    UPDATE public.milestones SET status = 'completed', completed_at = NOW(), automation_status = 'rule_engine', transition_source = 'rule'
                    WHERE project_id = p_project_id AND name = v_action->>'target_name';
                ELSIF v_action->>'type' = 'start_stage' THEN
                    UPDATE public.project_stages SET status = 'in_progress', started_at = NOW(), automation_status = 'rule_engine', transition_source = 'rule'
                    WHERE project_id = p_project_id AND name = v_action->>'target_name';
                ELSIF v_action->>'type' = 'create_task' THEN
                    INSERT INTO public.tasks (organization_id, project_id, title, status, is_client_visible, responsibility_type)
                    VALUES (v_rule.organization_id, p_project_id, v_action->>'title', 'todo', true, COALESCE(v_action->>'responsibility_type', 'internal'));
                END IF;
                
                v_action_completed := v_action_completed || v_action;
            END LOOP;

            INSERT INTO public.automation_execution_events (
                organization_id, project_id, rule_id, trigger_event, result, matched_conditions, 
                actions_attempted, actions_completed, idempotency_key, actor_id
            ) VALUES (
                v_rule.organization_id, p_project_id, v_rule.id, p_trigger_event, 'success', p_context,
                v_action_attempted, v_action_completed, v_idempotency_key, auth.uid()
            );

        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.automation_execution_events (
                organization_id, project_id, rule_id, trigger_event, result, matched_conditions, 
                actions_attempted, actions_completed, error_summary, idempotency_key, actor_id
            ) VALUES (
                v_rule.organization_id, p_project_id, v_rule.id, p_trigger_event, 'failed', p_context,
                v_action_attempted, v_action_completed, SQLERRM, v_idempotency_key, auth.uid()
            );
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Health Engine
CREATE OR REPLACE FUNCTION public.update_project_health(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
    v_overdue_tasks INT;
    v_open_blockers INT;
    v_new_health TEXT := 'on_track';
    v_reasons JSONB := '[]'::jsonb;
BEGIN
    -- Check overdue tasks
    SELECT COUNT(*) INTO v_overdue_tasks
    FROM public.tasks
    WHERE project_id = p_project_id AND status != 'done' AND due_date < NOW();

    IF v_overdue_tasks > 0 THEN
        v_new_health := 'delayed';
        v_reasons := v_reasons || jsonb_build_object('type', 'overdue_tasks', 'count', v_overdue_tasks, 'message', v_overdue_tasks || ' tasks are overdue');
    END IF;

    -- Check open blockers
    SELECT COUNT(*) INTO v_open_blockers
    FROM public.project_blockers
    WHERE project_id = p_project_id AND status IN ('open', 'investigating', 'waiting');

    IF v_open_blockers > 0 THEN
        v_new_health := 'blocked';
        v_reasons := v_reasons || jsonb_build_object('type', 'open_blockers', 'count', v_open_blockers, 'message', v_open_blockers || ' active blockers');
    END IF;

    UPDATE public.projects 
    SET derived_health_status = v_new_health, derived_health_reasons = v_reasons
    WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Triggers to catch state changes

-- Project Stages
CREATE OR REPLACE FUNCTION public.trg_stage_workflow()
RETURNS TRIGGER AS $$
DECLARE
    v_open_blockers INT;
    v_is_owner BOOLEAN;
BEGIN
    -- Only evaluate on status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        
        -- Exit Condition: check blockers if completing manually
        IF NEW.status = 'completed' AND NEW.automation_status = 'manual' THEN
            SELECT COUNT(*) INTO v_open_blockers FROM public.project_blockers WHERE stage_id = NEW.id AND status IN ('open', 'investigating');
            
            -- Owner override check (auth.users role or profile role can be checked, assuming simple profile check)
            SELECT (global_role = 'owner') INTO v_is_owner FROM public.profiles WHERE id = auth.uid();
            
            IF v_open_blockers > 0 AND NOT COALESCE(v_is_owner, false) THEN
                RAISE EXCEPTION 'Cannot complete stage with open blockers' USING ERRCODE = 'P0003';
            END IF;
            
            NEW.completed_at := NOW();
        END IF;

        IF NEW.status = 'in_progress' THEN
            NEW.started_at := NOW();
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_stage_workflow_before ON public.project_stages;
CREATE TRIGGER trg_stage_workflow_before
BEFORE UPDATE ON public.project_stages
FOR EACH ROW EXECUTE FUNCTION public.trg_stage_workflow();

CREATE OR REPLACE FUNCTION public.trg_stage_automation_after()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NEW.status = 'completed' THEN
            PERFORM public.evaluate_automation_rules('stage_completed', NEW.project_id, jsonb_build_object('stage_id', NEW.id, 'name', NEW.name));
            PERFORM public.update_project_health(NEW.project_id);
        ELSIF NEW.status = 'in_progress' THEN
            PERFORM public.evaluate_automation_rules('stage_started', NEW.project_id, jsonb_build_object('stage_id', NEW.id, 'name', NEW.name));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_stage_automation_after_trg ON public.project_stages;
CREATE TRIGGER trg_stage_automation_after_trg
AFTER UPDATE ON public.project_stages
FOR EACH ROW EXECUTE FUNCTION public.trg_stage_automation_after();

-- Documents Trigger
CREATE OR REPLACE FUNCTION public.trg_document_automation_after()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NEW.status = 'approved' THEN
            PERFORM public.evaluate_automation_rules('document_approved', NEW.project_id, jsonb_build_object('document_id', NEW.id, 'category', NEW.category));
        ELSIF NEW.status = 'changes_requested' THEN
            PERFORM public.evaluate_automation_rules('document_changes_requested', NEW.project_id, jsonb_build_object('document_id', NEW.id, 'category', NEW.category));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_document_automation_after_trg ON public.documents;
CREATE TRIGGER trg_document_automation_after_trg
AFTER UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.trg_document_automation_after();

-- Tasks Trigger
CREATE OR REPLACE FUNCTION public.trg_task_automation_after()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NEW.status = 'done' THEN
            PERFORM public.evaluate_automation_rules('task_completed', NEW.project_id, jsonb_build_object('task_id', NEW.id, 'responsibility_type', NEW.responsibility_type));
            PERFORM public.update_project_health(NEW.project_id);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_task_automation_after_trg ON public.tasks;
CREATE TRIGGER trg_task_automation_after_trg
AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.trg_task_automation_after();

-- 5. RLS Policies for New Tables

-- Project Dependencies
CREATE POLICY "Owner full access dependencies" ON public.project_dependencies
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner'));

CREATE POLICY "PM full access dependencies org" ON public.project_dependencies
FOR ALL USING (EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = auth.uid() AND organization_id = project_dependencies.organization_id AND org_role IN ('owner', 'admin', 'pm')));

CREATE POLICY "Specialist read dependencies" ON public.project_dependencies
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.project_memberships pm 
        WHERE pm.project_id = project_dependencies.project_id AND pm.user_id = auth.uid()
    )
);

-- Project Blockers
CREATE POLICY "Owner full access blockers" ON public.project_blockers
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner'));

CREATE POLICY "PM full access blockers org" ON public.project_blockers
FOR ALL USING (EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = auth.uid() AND organization_id = project_blockers.organization_id AND org_role IN ('owner', 'admin', 'pm')));

CREATE POLICY "Specialist read blockers" ON public.project_blockers
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.project_memberships pm 
        WHERE pm.project_id = project_blockers.project_id AND pm.user_id = auth.uid()
    )
);

-- Automation Rules
CREATE POLICY "Owner full access rules" ON public.automation_rules
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner'));

CREATE POLICY "PM full access rules org" ON public.automation_rules
FOR ALL USING (EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = auth.uid() AND organization_id = automation_rules.organization_id AND org_role IN ('owner', 'admin', 'pm')));

-- Execution Events
CREATE POLICY "Owner full access execution events" ON public.automation_execution_events
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner'));

CREATE POLICY "PM full access execution events org" ON public.automation_execution_events
FOR ALL USING (EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = auth.uid() AND organization_id = automation_execution_events.organization_id AND org_role IN ('owner', 'admin', 'pm')));

-- SLA Policies
CREATE POLICY "Owner full access sla" ON public.sla_policies
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner'));

CREATE POLICY "PM full access sla org" ON public.sla_policies
FOR ALL USING (EXISTS (SELECT 1 FROM public.organization_memberships WHERE user_id = auth.uid() AND organization_id = sla_policies.organization_id AND org_role IN ('owner', 'admin', 'pm')));

CREATE POLICY "Specialist read sla" ON public.sla_policies
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.project_memberships pm 
        WHERE pm.project_id = sla_policies.project_id AND pm.user_id = auth.uid()
    )
);


-- 6. Update create_project_from_template to materialize rules and SLAs

CREATE OR REPLACE FUNCTION public.create_project_from_template(
    p_template_version_id UUID,
    p_organization_id UUID,
    p_name TEXT,
    p_project_type TEXT,
    p_start_date DATE,
    p_target_date DATE,
    p_team_assignments JSONB, 
    p_commercials JSONB,
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
    v_rule RECORD;
    v_sla RECORD;
    v_stage_map JSONB := '{}'::jsonb;
    v_milestone_map JSONB := '{}'::jsonb;
    v_new_stage_id UUID;
    v_new_milestone_id UUID;
    v_source_template RECORD;
BEGIN
    -- 1. Idempotency Check
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.idempotency_keys WHERE key = p_idempotency_key) THEN
            RAISE EXCEPTION 'Idempotency key already used.' USING ERRCODE = '23505';
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

    -- 11. Materialize Automation Rules
    FOR v_rule IN (SELECT * FROM public.automation_rules WHERE template_id = v_template_id AND is_active = true) LOOP
        INSERT INTO public.automation_rules (
            organization_id, project_id, name, description, trigger_event, conditions, actions, created_by
        ) VALUES (
            p_organization_id, v_project_id, v_rule.name, v_rule.description, v_rule.trigger_event, v_rule.conditions, v_rule.actions, auth.uid()
        );
    END LOOP;

    -- 12. Materialize SLAs
    FOR v_sla IN (SELECT * FROM public.sla_policies WHERE template_id = v_template_id) LOOP
        INSERT INTO public.sla_policies (
            organization_id, project_id, target_type, target_id, sla_duration_hours, is_business_time, timezone, warning_threshold_percent
        ) VALUES (
            p_organization_id, v_project_id, v_sla.target_type, NULL, v_sla.sla_duration_hours, v_sla.is_business_time, v_sla.timezone, v_sla.warning_threshold_percent
        );
    END LOOP;

    -- 13. Audit Log
    INSERT INTO public.template_audit_events (
        event_type, actor_id, template_id, template_version_id, project_id, organization_id, metadata
    ) VALUES (
        'project_created_from_template', auth.uid(), v_template_id, p_template_version_id, v_project_id, p_organization_id, 
        jsonb_build_object()
    );

    RETURN jsonb_build_object('success', true, 'project_id', v_project_id);
END;
$$;
