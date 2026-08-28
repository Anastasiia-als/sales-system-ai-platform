-- Patch for get_portfolio_analytics_data and get_reports_data

CREATE OR REPLACE FUNCTION public.get_portfolio_analytics_data(
  p_period_type TEXT DEFAULT '30d',
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_org_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_pm_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_is_owner BOOLEAN;
  v_is_pm BOOLEAN;
  v_allowed_org_ids UUID[];
  v_period_start DATE;
  v_period_end DATE;
  v_prev_start DATE;
  v_prev_end DATE;
  v_period_days INTEGER;
  
  v_exec_kpis JSONB;
  v_delivery_funnel JSONB;
  v_delivery_rates JSONB;
  v_client_analytics JSONB;
  v_team_workload JSONB;
  v_financial_analytics JSONB;
  v_trends JSONB;
  v_projects_data JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_is_owner := public.is_global_owner();
  
  SELECT ARRAY_AGG(DISTINCT organization_id) INTO v_allowed_org_ids
  FROM public.organization_memberships
  WHERE user_id = v_user_id AND org_role IN ('owner', 'admin', 'pm') AND is_active = true;

  v_is_pm := (v_allowed_org_ids IS NOT NULL AND array_length(v_allowed_org_ids, 1) > 0);

  IF NOT v_is_owner AND NOT v_is_pm THEN
    RAISE EXCEPTION 'Access Denied: Analytics Center is available only to Owner and PM roles.' USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_owner THEN
    IF p_org_id IS NOT NULL AND NOT (p_org_id = ANY(v_allowed_org_ids)) THEN
      RAISE EXCEPTION 'Access Denied: You do not have permissions for this organization.' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_period_end := COALESCE(p_end_date, CURRENT_DATE);
  
  IF p_period_type = '7d' THEN
    v_period_start := v_period_end - INTERVAL '7 days';
    v_period_days := 7;
  ELSIF p_period_type = '30d' THEN
    v_period_start := v_period_end - INTERVAL '30 days';
    v_period_days := 30;
  ELSIF p_period_type = '90d' THEN
    v_period_start := v_period_end - INTERVAL '90 days';
    v_period_days := 90;
  ELSIF p_period_type = 'this_month' THEN
    v_period_start := date_trunc('month', v_period_end)::DATE;
    v_period_days := (v_period_end - v_period_start) + 1;
  ELSIF p_period_type = 'last_month' THEN
    v_period_start := (date_trunc('month', v_period_end) - INTERVAL '1 month')::DATE;
    v_period_end := (date_trunc('month', v_period_end) - INTERVAL '1 day')::DATE;
    v_period_days := (v_period_end - v_period_start) + 1;
  ELSIF p_period_type = 'this_quarter' THEN
    v_period_start := date_trunc('quarter', v_period_end)::DATE;
    v_period_days := (v_period_end - v_period_start) + 1;
  ELSE
    v_period_start := COALESCE(p_start_date, v_period_end - INTERVAL '30 days');
    v_period_days := GREATEST((v_period_end - v_period_start), 1);
  END IF;

  v_prev_end := v_period_start - INTERVAL '1 day';
  v_prev_start := v_prev_end - (v_period_days || ' days')::INTERVAL;

  -- 3. Executive KPIs Aggregation
  WITH scoped_projects AS (
    SELECT p.*, o.name AS org_name
    FROM public.projects p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE (v_is_owner OR p.organization_id = ANY(v_allowed_org_ids))
      AND (p_org_id IS NULL OR p.organization_id = p_org_id)
      AND (p_project_id IS NULL OR p.id = p_project_id)
      AND (p_pm_id IS NULL OR p.responsible_pm_id = p_pm_id)
  ),
  scoped_orgs AS (
    SELECT o.*
    FROM public.organizations o
    WHERE (v_is_owner OR o.id = ANY(v_allowed_org_ids))
      AND (p_org_id IS NULL OR o.id = p_org_id)
  ),
  scoped_tasks AS (
    SELECT t.*
    FROM public.tasks t
    JOIN scoped_projects sp ON sp.id = t.project_id
  ),
  scoped_milestones AS (
    SELECT m.*
    FROM public.milestones m
    JOIN scoped_projects sp ON sp.id = m.project_id
  ),
  scoped_docs AS (
    SELECT d.*
    FROM public.documents d
    JOIN scoped_projects sp ON sp.id = d.project_id
  ),
  scoped_invoices AS (
    SELECT i.*
    FROM public.invoices i
    JOIN scoped_projects sp ON sp.id = i.project_id
  )
  SELECT jsonb_build_object(
    'total_clients', (SELECT COUNT(*) FROM scoped_orgs),
    'active_clients', (SELECT COUNT(DISTINCT organization_id) FROM scoped_projects WHERE status IN ('in_progress', 'discovery', 'onboarding', 'waiting_client', 'client_review')),
    'total_projects', (SELECT COUNT(*) FROM scoped_projects),
    'active_projects', (SELECT COUNT(*) FROM scoped_projects WHERE status IN ('in_progress', 'discovery', 'onboarding', 'waiting_client', 'client_review')),
    'at_risk_projects', (SELECT COUNT(*) FROM scoped_projects WHERE health IN ('at_risk', 'critical') OR status = 'blocked'),
    'completed_projects', (SELECT COUNT(*) FROM scoped_projects WHERE status = 'completed'),
    'total_tasks', (SELECT COUNT(*) FROM scoped_tasks),
    'open_tasks', (SELECT COUNT(*) FROM scoped_tasks WHERE status != 'done'),
    'overdue_tasks', (SELECT COUNT(*) FROM scoped_tasks WHERE status != 'done' AND due_date < CURRENT_DATE),
    'open_client_actions', (SELECT COUNT(*) FROM scoped_tasks WHERE responsibility_type = 'client' AND status != 'done'),
    'overdue_client_actions', (SELECT COUNT(*) FROM scoped_tasks WHERE responsibility_type = 'client' AND status != 'done' AND due_date < CURRENT_DATE),
    'completed_milestones', (SELECT COUNT(*) FROM scoped_milestones WHERE status = 'completed'),
    'total_milestones', (SELECT COUNT(*) FROM scoped_milestones),
    'docs_awaiting_approval', (SELECT COUNT(*) FROM scoped_docs WHERE status IN ('internal_review', 'client_review')),
    'overdue_invoices_count', (SELECT COUNT(*) FROM scoped_invoices WHERE status = 'overdue' OR (status IN ('issued', 'sent', 'viewed', 'partially_paid') AND due_date < CURRENT_DATE AND outstanding_minor > 0))
  ) INTO v_exec_kpis;

  -- 4. Delivery Funnel
  WITH scoped_projects AS (
    SELECT p.*
    FROM public.projects p
    WHERE (v_is_owner OR p.organization_id = ANY(v_allowed_org_ids))
      AND (p_org_id IS NULL OR p.organization_id = p_org_id)
      AND (p_project_id IS NULL OR p.id = p_project_id)
      AND (p_pm_id IS NULL OR p.responsible_pm_id = p_pm_id)
  ),
  funnel_counts AS (
    SELECT
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE status = 'discovery') AS discovery_count,
      COUNT(*) FILTER (WHERE status IN ('onboarding', 'in_progress')) AS in_progress_count,
      COUNT(*) FILTER (WHERE status = 'waiting_client') AS waiting_client_count,
      COUNT(*) FILTER (WHERE health = 'at_risk' AND status != 'completed') AS at_risk_count,
      COUNT(*) FILTER (WHERE status = 'blocked' OR health = 'critical') AS blocked_count,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
      COUNT(*) FILTER (WHERE status = 'archived') AS archived_count,
      COUNT(*) FILTER (WHERE COALESCE(target_date, target_end_date) < CURRENT_DATE AND status != 'completed') AS overdue_projects_count
    FROM scoped_projects
  )
  SELECT jsonb_build_object(
    'total', total_count,
    'discovery', discovery_count,
    'in_progress', in_progress_count,
    'waiting_client', waiting_client_count,
    'at_risk', at_risk_count,
    'blocked', blocked_count,
    'completed', completed_count,
    'archived', archived_count,
    'overdue_projects', overdue_projects_count,
    'discovery_pct', CASE WHEN total_count > 0 THEN ROUND((discovery_count * 100.0) / total_count, 1) ELSE NULL END,
    'in_progress_pct', CASE WHEN total_count > 0 THEN ROUND((in_progress_count * 100.0) / total_count, 1) ELSE NULL END,
    'waiting_client_pct', CASE WHEN total_count > 0 THEN ROUND((waiting_client_count * 100.0) / total_count, 1) ELSE NULL END,
    'at_risk_pct', CASE WHEN total_count > 0 THEN ROUND((at_risk_count * 100.0) / total_count, 1) ELSE NULL END,
    'completed_pct', CASE WHEN total_count > 0 THEN ROUND((completed_count * 100.0) / total_count, 1) ELSE NULL END
  ) INTO v_delivery_funnel
  FROM funnel_counts;

  -- 5. Delivery Performance Rates
  WITH scoped_projects AS (
    SELECT p.*
    FROM public.projects p
    WHERE (v_is_owner OR p.organization_id = ANY(v_allowed_org_ids))
      AND (p_org_id IS NULL OR p.organization_id = p_org_id)
      AND (p_project_id IS NULL OR p.id = p_project_id)
      AND (p_pm_id IS NULL OR p.responsible_pm_id = p_pm_id)
  ),
  scoped_tasks AS (
    SELECT t.*
    FROM public.tasks t
    JOIN scoped_projects sp ON sp.id = t.project_id
  ),
  scoped_milestones AS (
    SELECT m.*
    FROM public.milestones m
    JOIN scoped_projects sp ON sp.id = m.project_id
  )
  SELECT jsonb_build_object(
    'milestone_completion_rate', 
      CASE WHEN (SELECT COUNT(*) FROM scoped_milestones) > 0 THEN ROUND(((SELECT COUNT(*) FROM scoped_milestones WHERE status = 'completed') * 100.0) / (SELECT COUNT(*) FROM scoped_milestones), 1) ELSE NULL END,
    'tasks_completion_rate',
      CASE WHEN (SELECT COUNT(*) FROM scoped_tasks) > 0 THEN ROUND(((SELECT COUNT(*) FROM scoped_tasks WHERE status = 'done') * 100.0) / (SELECT COUNT(*) FROM scoped_tasks), 1) ELSE NULL END,
    'overdue_task_rate',
      CASE WHEN (SELECT COUNT(*) FROM scoped_tasks WHERE status != 'done') > 0 THEN ROUND(((SELECT COUNT(*) FROM scoped_tasks WHERE status != 'done' AND due_date < CURRENT_DATE) * 100.0) / (SELECT COUNT(*) FROM scoped_tasks WHERE status != 'done'), 1) ELSE NULL END,
    'client_action_completion_rate',
      CASE WHEN (SELECT COUNT(*) FROM scoped_tasks WHERE responsibility_type = 'client') > 0 THEN ROUND(((SELECT COUNT(*) FROM scoped_tasks WHERE responsibility_type = 'client' AND status = 'done') * 100.0) / (SELECT COUNT(*) FROM scoped_tasks WHERE responsibility_type = 'client'), 1) ELSE NULL END,
    'on_time_delivery_rate',
      CASE WHEN (SELECT COUNT(*) FROM scoped_projects WHERE status = 'completed') > 0 THEN 
        ROUND(((SELECT COUNT(*) FROM scoped_projects WHERE status = 'completed' AND (COALESCE(target_date, target_end_date) IS NULL OR updated_at::DATE <= COALESCE(target_date, target_end_date))) * 100.0) / (SELECT COUNT(*) FROM scoped_projects WHERE status = 'completed'), 1)
      ELSE NULL END,
    'project_completion_rate',
      CASE WHEN (SELECT COUNT(*) FROM scoped_projects) > 0 THEN 
        ROUND(((SELECT COUNT(*) FROM scoped_projects WHERE status = 'completed') * 100.0) / (SELECT COUNT(*) FROM scoped_projects), 1)
      ELSE NULL END,
    'avg_completion_delay_days',
      CASE WHEN (SELECT COUNT(*) FROM scoped_projects WHERE status = 'completed' AND COALESCE(target_date, target_end_date) IS NOT NULL) > 0 THEN
        (SELECT ROUND(AVG(GREATEST(updated_at::DATE - COALESCE(target_date, target_end_date), 0)), 1)
         FROM scoped_projects
         WHERE status = 'completed' AND COALESCE(target_date, target_end_date) IS NOT NULL)
      ELSE NULL END
  ) INTO v_delivery_rates;

  -- 6. Projects Performance Table Records
  SELECT COALESCE(jsonb_agg(p_row ORDER BY p_row->>'health_rank' DESC, p_row->>'target_date' ASC), '[]'::jsonb)
  INTO v_projects_data
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'project_type', p.project_type,
      'status', p.status,
      'health', p.health,
      'health_rank', CASE p.health WHEN 'critical' THEN 4 WHEN 'at_risk' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END,
      'start_date', p.start_date,
      'target_date', COALESCE(p.target_date, p.target_end_date),
      'days_remaining', CASE WHEN COALESCE(p.target_date, p.target_end_date) IS NOT NULL THEN COALESCE(p.target_date, p.target_end_date) - CURRENT_DATE ELSE NULL END,
      'organization_id', o.id,
      'organization_name', o.name,
      'pm_id', pm.id,
      'pm_name', pm.full_name,
      'pm_email', pm.email,
      'progress_percent', (
        SELECT CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'completed') * 100.0) / COUNT(*), 0) ELSE 0 END
        FROM public.milestones WHERE project_id = p.id
      ),
      'completed_milestones', (SELECT COUNT(*) FROM public.milestones WHERE project_id = p.id AND status = 'completed'),
      'total_milestones', (SELECT COUNT(*) FROM public.milestones WHERE project_id = p.id),
      'open_tasks', (SELECT COUNT(*) FROM public.tasks WHERE project_id = p.id AND status != 'done'),
      'overdue_tasks', (SELECT COUNT(*) FROM public.tasks WHERE project_id = p.id AND status != 'done' AND due_date < CURRENT_DATE),
      'client_actions_total', (SELECT COUNT(*) FROM public.tasks WHERE project_id = p.id AND responsibility_type = 'client'),
      'client_actions_overdue', (SELECT COUNT(*) FROM public.tasks WHERE project_id = p.id AND responsibility_type = 'client' AND status != 'done' AND due_date < CURRENT_DATE),
      'docs_awaiting_approval', (SELECT COUNT(*) FROM public.documents WHERE project_id = p.id AND status IN ('internal_review', 'client_review')),
      'next_meeting_date', (
        SELECT MIN(start_at) FROM public.meetings 
        WHERE project_id = p.id AND start_at >= NOW() AND status = 'scheduled'
      ),
      'financial_status', (
        SELECT CASE 
          WHEN EXISTS (SELECT 1 FROM public.invoices WHERE project_id = p.id AND (status = 'overdue' OR (due_date < CURRENT_DATE AND outstanding_minor > 0))) THEN 'overdue'
          WHEN EXISTS (SELECT 1 FROM public.invoices WHERE project_id = p.id AND outstanding_minor > 0) THEN 'pending_payment'
          WHEN EXISTS (SELECT 1 FROM public.invoices WHERE project_id = p.id AND status = 'paid') THEN 'paid'
          ELSE 'no_invoices'
        END
      ),
      'contract_currency', (SELECT currency FROM public.project_commercial_terms WHERE project_id = p.id LIMIT 1),
      'contract_value_minor', (SELECT contract_value_minor FROM public.project_commercial_terms WHERE project_id = p.id LIMIT 1)
    ) AS p_row
    FROM public.projects p
    JOIN public.organizations o ON o.id = p.organization_id
    LEFT JOIN public.profiles pm ON pm.id = p.responsible_pm_id
    WHERE (v_is_owner OR p.organization_id = ANY(v_allowed_org_ids))
      AND (p_org_id IS NULL OR p.organization_id = p_org_id)
      AND (p_project_id IS NULL OR p.id = p_project_id)
      AND (p_pm_id IS NULL OR p.responsible_pm_id = p_pm_id)
  ) sub;

  -- 7. Client Analytics Breakdown
  WITH scoped_projects AS (
    SELECT p.*
    FROM public.projects p
    WHERE (v_is_owner OR p.organization_id = ANY(v_allowed_org_ids))
      AND (p_org_id IS NULL OR p.organization_id = p_org_id)
      AND (p_project_id IS NULL OR p.id = p_project_id)
      AND (p_pm_id IS NULL OR p.responsible_pm_id = p_pm_id)
  )
  SELECT COALESCE(jsonb_agg(c_row ORDER BY c_row->>'active_projects_count' DESC, c_row->>'name' ASC), '[]'::jsonb)
  INTO v_client_analytics
  FROM (
    SELECT jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'slug', o.slug,
      'status', o.status,
      'total_projects_count', (SELECT COUNT(*) FROM scoped_projects WHERE organization_id = o.id),
      'active_projects_count', (SELECT COUNT(*) FROM scoped_projects WHERE organization_id = o.id AND status IN ('in_progress', 'discovery', 'onboarding', 'waiting_client', 'client_review')),
      'completed_projects_count', (SELECT COUNT(*) FROM scoped_projects WHERE organization_id = o.id AND status = 'completed'),
      'overdue_tasks_count', (
        SELECT COUNT(*) FROM public.tasks t 
        JOIN scoped_projects p ON p.id = t.project_id 
        WHERE p.organization_id = o.id AND t.status != 'done' AND t.due_date < CURRENT_DATE
      ),
      'client_actions_pending', (
        SELECT COUNT(*) FROM public.tasks t 
        JOIN scoped_projects p ON p.id = t.project_id 
        WHERE p.organization_id = o.id AND t.responsibility_type = 'client' AND t.status != 'done'
      ),
      'docs_awaiting_approval', (
        SELECT COUNT(*) FROM public.documents d 
        JOIN scoped_projects p ON p.id = d.project_id 
        WHERE p.organization_id = o.id AND d.status IN ('internal_review', 'client_review')
      ),
      'next_meeting_date', (
        SELECT MIN(m.start_at) FROM public.meetings m 
        JOIN scoped_projects p ON p.id = m.project_id 
        WHERE p.organization_id = o.id AND m.start_at >= NOW() AND m.status = 'scheduled'
      ),
      'finances_by_currency', (
        SELECT COALESCE(jsonb_object_agg(
          curr.currency,
          jsonb_build_object(
            'currency', curr.currency,
            'contract_value_minor', COALESCE(curr.contract_val, 0),
            'invoiced_minor', COALESCE(curr.invoiced_val, 0),
            'paid_minor', COALESCE(curr.paid_val, 0),
            'outstanding_minor', GREATEST(COALESCE(curr.invoiced_val, 0) - COALESCE(curr.paid_val, 0), 0),
            'overdue_minor', COALESCE(curr.overdue_val, 0)
          )
        ), '{}'::jsonb)
        FROM (
          SELECT 
            c.currency,
            (SELECT SUM(ct.contract_value_minor) FROM public.project_commercial_terms ct JOIN scoped_projects p ON p.id = ct.project_id WHERE p.organization_id = o.id AND ct.currency = c.currency) AS contract_val,
            (SELECT SUM(i.total_minor) FROM public.invoices i JOIN scoped_projects p ON p.id = i.project_id WHERE p.organization_id = o.id AND i.currency = c.currency AND i.status != 'cancelled') AS invoiced_val,
            COALESCE((SELECT SUM(py.amount_minor) FROM public.project_payments py JOIN scoped_projects p ON p.id = py.project_id WHERE p.organization_id = o.id AND py.currency = c.currency), (SELECT SUM(i.paid_minor) FROM public.invoices i JOIN scoped_projects p ON p.id = i.project_id WHERE p.organization_id = o.id AND i.currency = c.currency AND i.status != 'cancelled'), 0) AS paid_val,
            (SELECT SUM(CASE WHEN i.status = 'overdue' OR (i.due_date < CURRENT_DATE AND i.outstanding_minor > 0) THEN i.outstanding_minor ELSE 0 END) FROM public.invoices i JOIN scoped_projects p ON p.id = i.project_id WHERE p.organization_id = o.id AND i.currency = c.currency AND i.status != 'cancelled') AS overdue_val
          FROM (
             SELECT currency FROM public.project_commercial_terms ct JOIN scoped_projects p ON p.id = ct.project_id WHERE p.organization_id = o.id
             UNION
             SELECT currency FROM public.invoices i JOIN scoped_projects p ON p.id = i.project_id WHERE p.organization_id = o.id AND i.status != 'cancelled'
          ) c WHERE c.currency IS NOT NULL
        ) curr
      )
    ) AS c_row
    FROM public.organizations o
    WHERE (v_is_owner OR o.id = ANY(v_allowed_org_ids))
      AND (p_org_id IS NULL OR o.id = p_org_id)
      AND EXISTS (SELECT 1 FROM scoped_projects WHERE organization_id = o.id)
  ) sub;

  -- 8. Team & PM Operational Workload
  SELECT COALESCE(jsonb_agg(w_row ORDER BY w_row->>'active_projects' DESC, w_row->>'open_tasks' DESC), '[]'::jsonb)
  INTO v_team_workload
  FROM (
    SELECT jsonb_build_object(
      'user_id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'global_role', p.global_role,
      'active_projects', (
        SELECT COUNT(*) FROM public.projects pr 
        WHERE pr.responsible_pm_id = p.id AND pr.status NOT IN ('completed', 'archived', 'cancelled')
      ),
      'open_tasks', (
        SELECT COUNT(*) FROM public.tasks t 
        WHERE t.assignee_user_id = p.id AND t.status != 'done'
      ),
      'overdue_tasks', (
        SELECT COUNT(*) FROM public.tasks t 
        WHERE t.assignee_user_id = p.id AND t.status != 'done' AND t.due_date < CURRENT_DATE
      ),
      'high_priority_tasks', (
        SELECT COUNT(*) FROM public.tasks t 
        WHERE t.assignee_user_id = p.id AND t.status != 'done' AND t.priority IN ('high', 'urgent', 'critical')
      ),
      'upcoming_deadlines_7d', (
        SELECT COUNT(*) FROM public.tasks t 
        WHERE t.assignee_user_id = p.id AND t.status != 'done' AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      )
    ) AS w_row
    FROM public.profiles p
    WHERE p.global_role IN ('owner', 'admin', 'pm', 'specialist')
  ) sub;

  -- 9. Multi-Currency Financial Analytics & AR Aging
  WITH scoped_projects AS (
    SELECT p.id, p.organization_id
    FROM public.projects p
    WHERE (v_is_owner OR p.organization_id = ANY(v_allowed_org_ids))
      AND (p_org_id IS NULL OR p.organization_id = p_org_id)
      AND (p_project_id IS NULL OR p.id = p_project_id)
      AND (p_pm_id IS NULL OR p.responsible_pm_id = p_pm_id)
  ),
  scoped_terms AS (
    SELECT ct.*
    FROM public.project_commercial_terms ct
    JOIN scoped_projects sp ON sp.id = ct.project_id
  ),
  scoped_invoices AS (
    SELECT i.*
    FROM public.invoices i
    JOIN scoped_projects sp ON sp.id = i.project_id
    WHERE i.status != 'cancelled'
  ),
  scoped_costs AS (
    SELECT c.*
    FROM public.project_costs c
    JOIN scoped_projects sp ON sp.id = c.project_id
  ),
  scoped_payments AS (
    SELECT py.*
    FROM public.project_payments py
    JOIN scoped_projects sp ON sp.id = py.project_id
  ),
  currencies AS (
    SELECT DISTINCT currency FROM (
      SELECT currency FROM scoped_terms
      UNION
      SELECT currency FROM scoped_invoices
      UNION
      SELECT currency FROM scoped_costs
      UNION
      SELECT currency FROM scoped_payments
    ) all_c WHERE currency IS NOT NULL
  )
  SELECT jsonb_object_agg(
    c.currency,
    jsonb_build_object(
      'currency', c.currency,
      'contract_value_minor', COALESCE((SELECT SUM(contract_value_minor) FROM scoped_terms WHERE currency = c.currency), 0),
      'invoiced_minor', COALESCE((SELECT SUM(total_minor) FROM scoped_invoices WHERE currency = c.currency), 0),
      'received_minor', COALESCE((SELECT SUM(amount_minor) FROM scoped_payments WHERE currency = c.currency), (SELECT SUM(paid_minor) FROM scoped_invoices WHERE currency = c.currency), 0),
      'outstanding_minor', GREATEST(COALESCE((SELECT SUM(total_minor) FROM scoped_invoices WHERE currency = c.currency), 0) - COALESCE((SELECT SUM(amount_minor) FROM scoped_payments WHERE currency = c.currency), (SELECT SUM(paid_minor) FROM scoped_invoices WHERE currency = c.currency), 0), 0),
      'overdue_minor', COALESCE((SELECT SUM(outstanding_minor) FROM scoped_invoices WHERE currency = c.currency AND (status = 'overdue' OR (due_date < CURRENT_DATE AND outstanding_minor > 0))), 0),
      'planned_costs_minor', COALESCE((SELECT SUM(amount_minor) FROM scoped_costs WHERE currency = c.currency AND cost_type = 'planned'), 0),
      'actual_costs_minor', COALESCE((SELECT SUM(amount_minor) FROM scoped_costs WHERE currency = c.currency AND cost_type = 'actual'), 0),
      'forecast_result_minor', 
        COALESCE((SELECT SUM(contract_value_minor) FROM scoped_terms WHERE currency = c.currency), 0) -
        COALESCE((SELECT SUM(amount_minor) FROM scoped_costs WHERE currency = c.currency AND cost_type = 'planned'), 0),
      'forecast_margin_pct', 
        CASE WHEN COALESCE((SELECT SUM(contract_value_minor) FROM scoped_terms WHERE currency = c.currency), 0) > 0 THEN
          ROUND(
            ((COALESCE((SELECT SUM(contract_value_minor) FROM scoped_terms WHERE currency = c.currency), 0) -
              COALESCE((SELECT SUM(amount_minor) FROM scoped_costs WHERE currency = c.currency AND cost_type = 'planned'), 0)) * 100.0) /
             (SELECT SUM(contract_value_minor) FROM scoped_terms WHERE currency = c.currency), 1
          )
        ELSE NULL END,
      'ar_aging', (
        SELECT jsonb_build_object(
          'not_due_minor', COALESCE(SUM(outstanding_minor) FILTER (WHERE due_date >= CURRENT_DATE), 0),
          'days_1_7_minor', COALESCE(SUM(outstanding_minor) FILTER (WHERE CURRENT_DATE - due_date BETWEEN 1 AND 7), 0),
          'days_8_30_minor', COALESCE(SUM(outstanding_minor) FILTER (WHERE CURRENT_DATE - due_date BETWEEN 8 AND 30), 0),
          'days_31_60_minor', COALESCE(SUM(outstanding_minor) FILTER (WHERE CURRENT_DATE - due_date BETWEEN 31 AND 60), 0),
          'days_61_90_minor', COALESCE(SUM(outstanding_minor) FILTER (WHERE CURRENT_DATE - due_date BETWEEN 61 AND 90), 0),
          'days_90_plus_minor', COALESCE(SUM(outstanding_minor) FILTER (WHERE CURRENT_DATE - due_date > 90), 0)
        )
        FROM scoped_invoices
        WHERE currency = c.currency AND outstanding_minor > 0
      )
    )
  ) INTO v_financial_analytics
  FROM currencies c;

  -- 10. Trends & Deltas (Period vs Previous Period)
  WITH scoped_projects AS (
    SELECT p.id, p.organization_id
    FROM public.projects p
    WHERE (v_is_owner OR p.organization_id = ANY(v_allowed_org_ids))
      AND (p_org_id IS NULL OR p.organization_id = p_org_id)
      AND (p_project_id IS NULL OR p.id = p_project_id)
      AND (p_pm_id IS NULL OR p.responsible_pm_id = p_pm_id)
  )
  SELECT jsonb_build_object(
    'period_type', p_period_type,
    'start_date', v_period_start,
    'end_date', v_period_end,
    'new_clients', (SELECT COUNT(*) FROM public.organizations WHERE created_at::DATE BETWEEN v_period_start AND v_period_end),
    'prev_new_clients', (SELECT COUNT(*) FROM public.organizations WHERE created_at::DATE BETWEEN v_prev_start AND v_prev_end),
    'new_projects', (SELECT COUNT(*) FROM public.projects WHERE created_at::DATE BETWEEN v_period_start AND v_period_end),
    'prev_new_projects', (SELECT COUNT(*) FROM public.projects WHERE created_at::DATE BETWEEN v_prev_start AND v_prev_end),
    'completed_projects', (SELECT COUNT(*) FROM public.projects WHERE status = 'completed' AND updated_at::DATE BETWEEN v_period_start AND v_period_end),
    'completed_milestones', (SELECT COUNT(*) FROM public.milestones WHERE status = 'completed' AND updated_at::DATE BETWEEN v_period_start AND v_period_end),
    'completed_tasks', (SELECT COUNT(*) FROM public.tasks WHERE status = 'done' AND updated_at::DATE BETWEEN v_period_start AND v_period_end),
    'invoices_issued', (SELECT COUNT(*) FROM public.invoices WHERE status != 'draft' AND issue_date BETWEEN v_period_start AND v_period_end),
    'payments_count', (SELECT COUNT(*) FROM public.project_payments WHERE paid_at::DATE BETWEEN v_period_start AND v_period_end)
  ) INTO v_trends;

  RETURN jsonb_build_object(
    'success', true,
    'period', jsonb_build_object(
      'type', p_period_type,
      'start_date', v_period_start,
      'end_date', v_period_end,
      'days', v_period_days
    ),
    'executive_kpis', COALESCE(v_exec_kpis, '{}'::jsonb),
    'delivery_funnel', COALESCE(v_delivery_funnel, '{}'::jsonb),
    'delivery_rates', COALESCE(v_delivery_rates, '{}'::jsonb),
    'projects', COALESCE(v_projects_data, '[]'::jsonb),
    'clients', COALESCE(v_client_analytics, '[]'::jsonb),
    'team_workload', COALESCE(v_team_workload, '[]'::jsonb),
    'financial_analytics', COALESCE(v_financial_analytics, '{}'::jsonb),
    'trends', COALESCE(v_trends, '{}'::jsonb)
  );
END;
$$;
