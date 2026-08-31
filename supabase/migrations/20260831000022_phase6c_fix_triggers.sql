CREATE OR REPLACE FUNCTION public.trg_notify_automation_issues()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.result = 'running' AND NEW.result = 'failed' THEN
        INSERT INTO public.notifications (organization_id, project_id, recipient_user_id, title, message, event_type, severity, deep_link)
        SELECT NEW.organization_id, NEW.project_id, p.id, 'Automation Rule Failed', 'Rule ' || NEW.rule_id || ' failed: ' || NEW.error_summary, 'automation_error', 'critical', '/project/' || NEW.project_id || '?tab=automation'
        FROM public.project_memberships pm
        JOIN public.profiles p ON pm.user_id = p.id
        WHERE pm.project_id = NEW.project_id AND pm.project_role IN ('pm', 'owner');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_notify_blockers()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status IN ('open', 'critical') THEN
        INSERT INTO public.notifications (organization_id, project_id, recipient_user_id, title, message, event_type, severity, deep_link)
        SELECT NEW.organization_id, NEW.project_id, pm.user_id, 'Project Blocked', 'Blocker: ' || NEW.title, 'blocker_created', 'critical', '/project/' || NEW.project_id
        FROM public.project_memberships pm
        WHERE pm.project_id = NEW.project_id AND pm.project_role IN ('pm', 'owner');
        
        PERFORM public.update_project_health(NEW.project_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
