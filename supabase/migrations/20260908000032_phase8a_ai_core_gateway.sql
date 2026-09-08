-- ====================================================================
-- Migration: 20260908000032_phase8a_ai_core_gateway.sql
-- Description: Phase 8A: Core AI Gateway, Quotas, Logs & Schema Templates
-- Author: FIRSTWIN Architecture Team
-- ====================================================================

-- 1. AI Usage Quotas Table (Per-Organization Cost & Token Guard)
CREATE TABLE IF NOT EXISTS public.ai_usage_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    daily_token_limit INT NOT NULL DEFAULT 250000,
    used_tokens_today INT NOT NULL DEFAULT 0,
    quota_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ai_quota_org UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_quotas_org ON public.ai_usage_quotas(organization_id);

-- 2. AI Prompt Templates Table (Deterministic Prompts & Schemas)
CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT NOT NULL,
    expected_schema JSONB NOT NULL,
    temperature NUMERIC(3,2) NOT NULL DEFAULT 0.20,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_templates_key ON public.ai_prompt_templates(template_key);

-- 3. AI Generation Logs (Append-Only Audit Trail)
CREATE TABLE IF NOT EXISTS public.ai_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    feature_name TEXT NOT NULL,
    template_key TEXT REFERENCES public.ai_prompt_templates(template_key) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    latency_ms INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'quota_exceeded', 'schema_invalid')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_org ON public.ai_generation_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_proj ON public.ai_generation_logs(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON public.ai_generation_logs(user_id) WHERE user_id IS NOT NULL;

-- 4. Enable RLS on all AI tables
ALTER TABLE public.ai_usage_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: ai_usage_quotas
-- Owner has full access; Org Admin can read quota for their organization
DROP POLICY IF EXISTS "Owner full access to ai quotas" ON public.ai_usage_quotas;
CREATE POLICY "Owner full access to ai quotas"
ON public.ai_usage_quotas FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.global_role = 'owner'
    )
);

DROP POLICY IF EXISTS "Org members view own ai quota" ON public.ai_usage_quotas;
CREATE POLICY "Org members view own ai quota"
ON public.ai_usage_quotas FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_memberships m
        WHERE m.user_id = auth.uid()
          AND m.organization_id = ai_usage_quotas.organization_id
          AND m.org_role IN ('owner', 'admin')
          AND m.is_active = true
    )
);

-- 6. RLS Policies: ai_prompt_templates
-- Authenticated users can read active templates; Owner can manage templates
DROP POLICY IF EXISTS "Authenticated users view active templates" ON public.ai_prompt_templates;
CREATE POLICY "Authenticated users view active templates"
ON public.ai_prompt_templates FOR SELECT
TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Owner manage templates" ON public.ai_prompt_templates;
CREATE POLICY "Owner manage templates"
ON public.ai_prompt_templates FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.global_role = 'owner'
    )
);

-- 7. RLS Policies: ai_generation_logs
-- Owner can view all logs; PM can view logs for their organizations
DROP POLICY IF EXISTS "Owner view all ai logs" ON public.ai_generation_logs;
CREATE POLICY "Owner view all ai logs"
ON public.ai_generation_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.global_role = 'owner'
    )
);

DROP POLICY IF EXISTS "PM view org ai logs" ON public.ai_generation_logs;
CREATE POLICY "PM view org ai logs"
ON public.ai_generation_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_memberships m
        WHERE m.user_id = auth.uid()
          AND m.organization_id = ai_generation_logs.organization_id
          AND m.org_role IN ('owner', 'admin')
          AND m.is_active = true
    )
);

-- Direct client INSERT/UPDATE/DELETE on logs is strictly denied
REVOKE INSERT, UPDATE, DELETE ON public.ai_generation_logs FROM PUBLIC, anon, authenticated;

-- Enforce append-only immutability at database trigger level (Error 23514)
CREATE OR REPLACE FUNCTION public.prevent_ai_logs_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF current_setting('session_replication_role', true) = 'replica' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'ai_generation_logs is an append-only audit trail and cannot be modified or deleted'
        USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_ai_logs_mutation ON public.ai_generation_logs;
CREATE TRIGGER trg_prevent_ai_logs_mutation
BEFORE UPDATE OR DELETE ON public.ai_generation_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_ai_logs_mutation();

-- 8. Protected Helper RPCs

-- Check and consume quota atomically
CREATE OR REPLACE FUNCTION public.check_and_consume_ai_quota(
    p_organization_id UUID,
    p_estimated_tokens INT DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_quota RECORD;
    v_today DATE := CURRENT_DATE;
    v_new_used INT;
BEGIN
    -- Ensure quota row exists
    INSERT INTO public.ai_usage_quotas (organization_id, daily_token_limit, used_tokens_today, quota_reset_date)
    VALUES (p_organization_id, 250000, 0, v_today)
    ON CONFLICT (organization_id) DO NOTHING;

    -- Lock quota row for update
    SELECT * INTO v_quota
    FROM public.ai_usage_quotas
    WHERE organization_id = p_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'quota_not_configured');
    END IF;

    IF NOT v_quota.is_enabled THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'ai_disabled_for_organization');
    END IF;

    -- Reset if new day
    IF v_quota.quota_reset_date < v_today THEN
        v_quota.used_tokens_today := 0;
        v_quota.quota_reset_date := v_today;
    END IF;

    -- Check limit
    IF (v_quota.used_tokens_today + p_estimated_tokens) > v_quota.daily_token_limit THEN
        -- Still update date if needed
        UPDATE public.ai_usage_quotas
        SET quota_reset_date = v_today,
            updated_at = NOW()
        WHERE id = v_quota.id;

        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'daily_limit_exceeded',
            'daily_limit', v_quota.daily_token_limit,
            'used_today', v_quota.used_tokens_today,
            'requested', p_estimated_tokens
        );
    END IF;

    -- Update usage
    UPDATE public.ai_usage_quotas
    SET used_tokens_today = v_quota.used_tokens_today + p_estimated_tokens,
        quota_reset_date = v_today,
        updated_at = NOW()
    WHERE id = v_quota.id;

    RETURN jsonb_build_object(
        'allowed', true,
        'daily_limit', v_quota.daily_token_limit,
        'used_today', v_quota.used_tokens_today + p_estimated_tokens,
        'remaining', v_quota.daily_token_limit - (v_quota.used_tokens_today + p_estimated_tokens)
    );
END;
$$;

-- Record generation log and adjust actual tokens
CREATE OR REPLACE FUNCTION public.record_ai_generation_log(
    p_organization_id UUID,
    p_project_id UUID,
    p_user_id UUID,
    p_feature_name TEXT,
    p_template_key TEXT,
    p_provider TEXT,
    p_model TEXT,
    p_prompt_tokens INT,
    p_completion_tokens INT,
    p_latency_ms INT,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL,
    p_estimated_tokens INT DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_log_id UUID;
    v_total_tokens INT := COALESCE(p_prompt_tokens, 0) + COALESCE(p_completion_tokens, 0);
    v_diff INT;
BEGIN
    INSERT INTO public.ai_generation_logs (
        organization_id, project_id, user_id, feature_name, template_key,
        provider, model, prompt_tokens, completion_tokens, total_tokens,
        latency_ms, status, error_message
    ) VALUES (
        p_organization_id, p_project_id, p_user_id, p_feature_name, p_template_key,
        p_provider, p_model, COALESCE(p_prompt_tokens, 0), COALESCE(p_completion_tokens, 0), v_total_tokens,
        p_latency_ms, p_status, p_error_message
    ) RETURNING id INTO v_log_id;

    -- Reconcile estimated vs actual tokens in quota
    IF p_estimated_tokens > 0 THEN
        v_diff := v_total_tokens - p_estimated_tokens;
        IF v_diff != 0 THEN
            UPDATE public.ai_usage_quotas
            SET used_tokens_today = GREATEST(0, used_tokens_today + v_diff),
                updated_at = NOW()
            WHERE organization_id = p_organization_id;
        END IF;
    END IF;

    RETURN v_log_id;
END;
$$;

-- Seed canonical initial prompt templates for Phase 8
INSERT INTO public.ai_prompt_templates (
    template_key, title, description, system_prompt, user_prompt_template, expected_schema, temperature
) VALUES
(
    'meeting_intelligence_v1',
    'Meeting Intelligence & Action Items Extractor',
    'Transforms raw meeting notes and transcripts into structured protocols with candidate tasks and client actions',
    'Ти — досвідчений PM та технічний секретар делівері-платформи FIRSTWIN. Твоє завдання — проаналізувати сирі нотатки або транскрипт зустрічі та сформувати чіткий структурований протокол.
Ти повинен витягнути:
1. summary: Коротке резюме зустрічі (до 3 речень).
2. decisions: Список зафіксованих рішень.
3. candidate_actions: Список конкретних дій / завдань із чіткою назвою, описом, зоною відповідальності (responsibility: "internal" або "client") та орієнтовним пріоритетом ("low", "medium", "high").
Відповідай виключно у форматі JSON згідно з наданою схемою. Жодного тексту до або після JSON.',
    'Проєкт: {{project_name}}
Організація: {{organization_name}}
Учасники: {{participants}}
Нотатки зустрічі:
{{raw_notes}}',
    '{
        "type": "object",
        "required": ["summary", "decisions", "candidate_actions"],
        "properties": {
            "summary": { "type": "string" },
            "decisions": {
                "type": "array",
                "items": { "type": "string" }
            },
            "candidate_actions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["title", "description", "responsibility", "priority"],
                    "properties": {
                        "title": { "type": "string" },
                        "description": { "type": "string" },
                        "responsibility": { "type": "string", "enum": ["internal", "client"] },
                        "priority": { "type": "string", "enum": ["low", "medium", "high"] }
                    }
                }
            }
        }
    }'::jsonb,
    0.20
),
(
    'project_health_analysis_v1',
    'Project Delivery Health & Risk Analysis',
    'Analyzes stage milestones, overdue tasks, and client action bottlenecks to generate actionable risks and executive digest',
    'Ти — головний операційний директор та аналітик делівері агентства FIRSTWIN. Проаналізуй метрики проєкту та сформуй об''єктивну оцінку ризиків і рекомендовані коригуючі дії.
Відповідай виключно у форматі JSON згідно з наданою схемою. Жодного зайвого тексту.',
    'Проєкт: {{project_name}}
Поточний статус: {{status}}
Прогрес етапів: {{stage_progress_pct}}%
Прострочені завдання: {{overdue_tasks_count}}
Очікуємо від клієнта (затримка): {{blocked_client_actions_count}}
Контекст:
{{context_notes}}',
    '{
        "type": "object",
        "required": ["health_verdict", "risk_factors", "recommended_interventions", "executive_summary"],
        "properties": {
            "health_verdict": { "type": "string", "enum": ["on_track", "at_risk", "delayed"] },
            "executive_summary": { "type": "string" },
            "risk_factors": {
                "type": "array",
                "items": { "type": "string" }
            },
            "recommended_interventions": {
                "type": "array",
                "items": { "type": "string" }
            }
        }
    }'::jsonb,
    0.15
)
ON CONFLICT (template_key) DO UPDATE SET
    system_prompt = EXCLUDED.system_prompt,
    user_prompt_template = EXCLUDED.user_prompt_template,
    expected_schema = EXCLUDED.expected_schema,
    temperature = EXCLUDED.temperature,
    updated_at = NOW();

-- Revoke direct permissions to public and anon
REVOKE ALL ON FUNCTION public.check_and_consume_ai_quota FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ai_generation_log FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_consume_ai_quota TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_ai_generation_log TO authenticated, service_role;
