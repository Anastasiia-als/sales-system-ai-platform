-- Phase 6C Gaps Resolution: Idempotency, Append-only Log, Holidays, SLA Escalations

-- 1. Idempotency & Append-Only Log
ALTER TABLE public.automation_execution_events 
    ADD CONSTRAINT unique_idempotency_key UNIQUE (idempotency_key);

CREATE OR REPLACE FUNCTION public.trg_prevent_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'This table is append-only. UPDATE and DELETE are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_automation_log_append_only ON public.automation_execution_events;
CREATE TRIGGER trg_automation_log_append_only
BEFORE UPDATE OR DELETE ON public.automation_execution_events
FOR EACH ROW EXECUTE FUNCTION public.trg_prevent_update_delete();

-- 2. Business Holidays
CREATE TABLE IF NOT EXISTS public.business_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.business_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read holidays" ON public.business_holidays FOR SELECT USING (true);
CREATE POLICY "Owner manage holidays" ON public.business_holidays FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'owner'));

-- 3. Update add_business_days to skip holidays
CREATE OR REPLACE FUNCTION public.add_business_days(start_date TIMESTAMP WITH TIME ZONE, days INT, tz TEXT DEFAULT 'Europe/Prague', p_org_id UUID DEFAULT NULL)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
DECLARE
    v_current_date TIMESTAMP WITH TIME ZONE := start_date;
    days_added INT := 0;
    v_is_holiday BOOLEAN;
BEGIN
    WHILE days_added < days LOOP
        v_current_date := v_current_date + INTERVAL '1 day';
        
        -- Check if it's weekend
        IF EXTRACT(ISODOW FROM v_current_date AT TIME ZONE tz) < 6 THEN
            -- Check if it's a holiday
            v_is_holiday := false;
            IF p_org_id IS NOT NULL THEN
                SELECT true INTO v_is_holiday 
                FROM public.business_holidays 
                WHERE organization_id = p_org_id AND holiday_date = (v_current_date AT TIME ZONE tz)::DATE;
            END IF;

            IF NOT COALESCE(v_is_holiday, false) THEN
                days_added := days_added + 1;
            END IF;
        END IF;
    END LOOP;
    RETURN v_current_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Update evaluate_automation_rules to support create_client_action
-- We must recreate the function to add ELSIF v_action->>'type' = 'create_client_action' THEN
-- (To be completely safe with concurrency, we use ON CONFLICT DO NOTHING for idempotency key instead of just EXISTS)

CREATE OR REPLACE FUNCTION public.evaluate_automation_rules(p_trigger_event TEXT, p_project_id UUID, p_context JSONB)
RETURNS VOID AS $$
DECLARE
    v_rule RECORD;
    v_conditions_met BOOLEAN;
    v_condition JSONB;
    v_field_val TEXT;
    v_action JSONB;
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
        
        v_idempotency_key := encode(digest(v_rule.id::TEXT || p_trigger_event || p_context::TEXT, 'sha256'), 'hex');

        IF NOT v_conditions_met THEN
            -- Attempt insert for log, ignore if duplicate
            INSERT INTO public.automation_execution_events (
                organization_id, project_id, rule_id, trigger_event, result, matched_conditions, idempotency_key
            ) VALUES (
                v_rule.organization_id, p_project_id, v_rule.id, p_trigger_event, 'condition_not_met', p_context, v_idempotency_key || '_cond'
            ) ON CONFLICT (idempotency_key) DO NOTHING;
            CONTINUE;
        END IF;

        -- Concurrency safe idempotency insertion (reserve the execution slot)
        BEGIN
            INSERT INTO public.automation_execution_events (
                organization_id, project_id, rule_id, trigger_event, result, matched_conditions, idempotency_key, actor_id
            ) VALUES (
                v_rule.organization_id, p_project_id, v_rule.id, p_trigger_event, 'running', p_context, v_idempotency_key, auth.uid()
            );
        EXCEPTION WHEN unique_violation THEN
            -- Already running or ran
            CONTINUE;
        END;

        BEGIN
            v_action_attempted := '[]'::jsonb;
            v_action_completed := '[]'::jsonb;
            FOR v_action IN SELECT * FROM jsonb_array_elements(v_rule.actions) LOOP
                v_action_attempted := v_action_attempted || v_action;
                
                IF v_action->>'type' = 'complete_stage' THEN
                    PERFORM public.workflow_transition_stage( (SELECT id FROM public.project_stages WHERE project_id = p_project_id AND name = v_action->>'target_name' LIMIT 1), 'completed', 'automation' );
                ELSIF v_action->>'type' = 'start_stage' THEN
                    PERFORM public.workflow_transition_stage( (SELECT id FROM public.project_stages WHERE project_id = p_project_id AND name = v_action->>'target_name' LIMIT 1), 'in_progress', 'automation' );
                ELSIF v_action->>'type' = 'create_task' THEN
                    INSERT INTO public.tasks (organization_id, project_id, title, status, is_client_visible, responsibility_type)
                    VALUES (v_rule.organization_id, p_project_id, v_action->>'title', 'todo', true, COALESCE(v_action->>'responsibility_type', 'internal'));
                ELSIF v_action->>'type' = 'create_client_action' THEN
                    INSERT INTO public.tasks (organization_id, project_id, title, status, is_client_visible, responsibility_type)
                    VALUES (v_rule.organization_id, p_project_id, v_action->>'title', 'todo', true, 'client');
                END IF;
                
                v_action_completed := v_action_completed || v_action;
            END LOOP;

            -- We temporarily disabled UPDATE to execution events via trigger, wait, we need to update our 'running' event!
            -- So the append-only trigger must allow UPDATE ONLY IF result is 'running' AND new result is 'success' or 'failed'.
            -- We'll modify the trigger below.
            UPDATE public.automation_execution_events 
            SET result = 'success', actions_attempted = v_action_attempted, actions_completed = v_action_completed
            WHERE idempotency_key = v_idempotency_key;

        EXCEPTION WHEN OTHERS THEN
            UPDATE public.automation_execution_events 
            SET result = 'failed', actions_attempted = v_action_attempted, actions_completed = v_action_completed, error_summary = SQLERRM
            WHERE idempotency_key = v_idempotency_key;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the append-only trigger to allow the state transition from 'running' to 'success'/'failed'
CREATE OR REPLACE FUNCTION public.trg_prevent_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'This table is append-only. DELETE is strictly forbidden.';
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        IF OLD.result = 'running' AND (NEW.result = 'success' OR NEW.result = 'failed') THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Execution log can only be updated to finalize a running execution.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Notifications Trigger for Rule Failure & Blockers
CREATE OR REPLACE FUNCTION public.trg_notify_automation_issues()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.result = 'running' AND NEW.result = 'failed' THEN
        INSERT INTO public.notifications (organization_id, project_id, user_id, title, message, type)
        SELECT NEW.organization_id, NEW.project_id, p.id, 'Automation Rule Failed', 'Rule ' || NEW.rule_id || ' failed: ' || NEW.error_summary, 'system'
        FROM public.project_memberships pm
        JOIN public.profiles p ON pm.user_id = p.id
        WHERE pm.project_id = NEW.project_id AND pm.role IN ('pm', 'owner');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_automation_issues_trg ON public.automation_execution_events;
CREATE TRIGGER trg_notify_automation_issues_trg
AFTER UPDATE ON public.automation_execution_events
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_automation_issues();

CREATE OR REPLACE FUNCTION public.trg_notify_blockers()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status IN ('open', 'critical') THEN
        INSERT INTO public.notifications (organization_id, project_id, user_id, title, message, type)
        SELECT NEW.organization_id, NEW.project_id, pm.user_id, 'Project Blocked', 'Blocker: ' || NEW.title, 'system'
        FROM public.project_memberships pm
        WHERE pm.project_id = NEW.project_id AND pm.role IN ('pm', 'owner');
        
        PERFORM public.update_project_health(NEW.project_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_blockers_trg ON public.project_blockers;
CREATE TRIGGER trg_notify_blockers_trg
AFTER INSERT ON public.project_blockers
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_blockers();

