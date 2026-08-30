-- Phase 6C: Advanced Workflow Engine (Dependencies, SLA, Health)

-- 1. Ensure dependency table has correct structure
-- The original table has source_type / source_id and target_type / target_id.
-- Let's say:
-- target_type / target_id = The entity that is BLOCKED (the one that depends on something)
-- source_type / source_id = The entity that MUST COMPLETE FIRST (the dependency)

ALTER TABLE public.project_dependencies 
    ADD COLUMN IF NOT EXISTS dependency_type TEXT NOT NULL DEFAULT 'finish_to_start' CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Clean up the incorrectly added columns from my previous iteration if they exist
ALTER TABLE public.project_dependencies DROP COLUMN IF EXISTS depends_on_type;
ALTER TABLE public.project_dependencies DROP COLUMN IF EXISTS depends_on_id;

-- 2. Cycle Detection Trigger Function
CREATE OR REPLACE FUNCTION public.check_dependency_cycles()
RETURNS TRIGGER AS $$
DECLARE
    v_visited UUID[] := ARRAY[NEW.target_id];
    v_current UUID := NEW.source_id;
BEGIN
    -- Basic cycle detection (limit depth to 20 for safety)
    FOR i IN 1..20 LOOP
        IF v_current = ANY(v_visited) THEN
            RAISE EXCEPTION 'Circular dependency detected (cycle).';
        END IF;
        
        v_visited := array_append(v_visited, v_current);
        
        -- Get next dependency up the chain
        -- Target = the one blocked, Source = the one blocking
        -- So if v_current is now the blocked one, what is it waiting for?
        SELECT source_id INTO v_current
        FROM public.project_dependencies
        WHERE target_id = v_current 
          AND target_type = NEW.target_type 
          AND source_type = NEW.source_type
        LIMIT 1;

        IF NOT FOUND THEN
            EXIT;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_dependency_cycles ON public.project_dependencies;
CREATE TRIGGER trg_check_dependency_cycles
BEFORE INSERT OR UPDATE ON public.project_dependencies
FOR EACH ROW EXECUTE FUNCTION public.check_dependency_cycles();

-- 3. Workflow Transition RPC
CREATE OR REPLACE FUNCTION public.workflow_transition_stage(p_stage_id UUID, p_new_status TEXT)
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
        completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE NULL END
    WHERE id = p_stage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
