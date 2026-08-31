-- SLA Escalation Rule Evaluation
CREATE OR REPLACE FUNCTION public.evaluate_sla_breaches()
RETURNS VOID AS $$
DECLARE
    v_policy RECORD;
    v_project_started TIMESTAMP WITH TIME ZONE;
    v_stage_started TIMESTAMP WITH TIME ZONE;
    v_deadline TIMESTAMP WITH TIME ZONE;
    v_breach_level TEXT;
    v_is_breached BOOLEAN;
BEGIN
    -- Evaluate all project SLAs (target_type = 'project')
    FOR v_policy IN SELECT * FROM public.sla_policies WHERE target_type = 'project' LOOP
        -- Get project start date
        SELECT created_at INTO v_project_started FROM public.projects WHERE id = v_policy.project_id AND status != 'completed';
        
        IF v_project_started IS NOT NULL THEN
            IF v_policy.is_business_time THEN
                v_deadline := public.add_business_days(v_project_started, (v_policy.sla_duration_hours / 24)::INT, v_policy.timezone, v_policy.organization_id);
            ELSE
                v_deadline := v_project_started + (v_policy.sla_duration_hours || ' hours')::INTERVAL;
            END IF;

            IF NOW() > v_deadline THEN
                v_is_breached := true;
                v_breach_level := 'breach';
            ELSIF NOW() > (v_project_started + (v_deadline - v_project_started) * (v_policy.warning_threshold_percent / 100.0)) THEN
                v_is_breached := true;
                v_breach_level := 'warning';
            ELSE
                v_is_breached := false;
            END IF;

            IF v_is_breached THEN
                -- Insert notification if not already notified today for this project
                INSERT INTO public.notifications (organization_id, project_id, recipient_user_id, title, message, event_type, severity, deep_link)
                SELECT v_policy.organization_id, v_policy.project_id, pm.user_id, 'SLA ' || v_breach_level, 'Project SLA is in ' || v_breach_level || ' state. Deadline: ' || v_deadline, 'sla_breach', CASE WHEN v_breach_level = 'breach' THEN 'critical' ELSE 'warning' END, '/project/' || v_policy.project_id
                FROM public.project_memberships pm
                WHERE pm.project_id = v_policy.project_id AND pm.project_role IN ('pm', 'owner')
                  AND NOT EXISTS (
                      SELECT 1 FROM public.notifications n 
                      WHERE n.project_id = v_policy.project_id AND n.title = 'SLA ' || v_breach_level AND n.created_at::DATE = NOW()::DATE
                  );
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
