CREATE OR REPLACE FUNCTION public.workflow_transition_stage(p_stage_id UUID, p_new_status TEXT, p_transition_source TEXT DEFAULT 'manual')
RETURNS VOID AS $$
DECLARE
    v_stage RECORD;
    v_unmet_deps INT;
BEGIN
    SELECT * INTO v_stage FROM public.project_stages WHERE id = p_stage_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stage not found'; END IF;

    -- If moving to in_progress or completed, check dependencies
    IF p_new_status IN ('in_progress', 'completed') THEN
        -- We are transitioning the target (p_stage_id). We must check its sources.
        SELECT COUNT(*) INTO v_unmet_deps
        FROM public.project_dependencies pd
        JOIN public.project_stages ps ON pd.source_id = ps.id
        WHERE pd.target_id = p_stage_id 
          AND pd.target_type = 'stage'
          AND pd.source_type = 'stage'
          AND ps.status != 'completed'
          AND pd.dependency_type = 'requires';

        IF v_unmet_deps > 0 THEN
            RAISE EXCEPTION 'Cannot transition: unmet dependencies exist.';
        END IF;
    END IF;

    -- Strict exit condition: A stage cannot be completed if it has incomplete tasks
    IF p_new_status = 'completed' THEN
        SELECT COUNT(*) INTO v_unmet_deps
        FROM public.tasks
        WHERE project_id = v_stage.project_id 
          AND stage_id = p_stage_id
          AND status != 'done';

        IF v_unmet_deps > 0 THEN
            RAISE EXCEPTION 'Cannot complete stage: % incomplete tasks remain.', v_unmet_deps;
        END IF;
    END IF;

    UPDATE public.project_stages 
    SET 
        status = p_new_status,
        started_at = CASE WHEN p_new_status = 'in_progress' AND started_at IS NULL THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE NULL END,
        automation_status = CASE WHEN p_transition_source = 'automation' THEN 'rule_engine' ELSE automation_status END,
        transition_source = p_transition_source
    WHERE id = p_stage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
