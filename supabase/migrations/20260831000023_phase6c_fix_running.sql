ALTER TABLE public.automation_execution_events DROP CONSTRAINT automation_execution_events_result_check;
ALTER TABLE public.automation_execution_events ADD CONSTRAINT automation_execution_events_result_check 
    CHECK (result = ANY (ARRAY['success'::text, 'failed'::text, 'condition_not_met'::text, 'running'::text]));
