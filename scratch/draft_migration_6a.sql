-- Phase 6A: Project Templates & Delivery Playbooks

BEGIN;

-- 1. Core Template Tables
CREATE TABLE public.project_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    project_type TEXT NOT NULL,
    category TEXT,
    default_currency TEXT DEFAULT 'UAH',
    estimated_duration_days INT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(template_id, version_number)
);

-- 2. Blueprint Entity Tables
CREATE TABLE public.template_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.template_versions(id) ON DELETE CASCADE,
    order_idx INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    default_status TEXT DEFAULT 'not_started',
    is_client_visible BOOLEAN DEFAULT true,
    estimated_duration_days INT,
    offset_days INT DEFAULT 0,
    depends_on_stage_id UUID NULL REFERENCES public.template_stages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.template_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.template_versions(id) ON DELETE CASCADE,
    stage_id UUID NULL REFERENCES public.template_stages(id) ON DELETE CASCADE,
    order_idx INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_client_visible BOOLEAN DEFAULT true,
    relative_due_offset INT,
    offset_anchor TEXT CHECK (offset_anchor IN ('project_start', 'stage_start', 'prev_milestone', 'none')),
    completion_requirement TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.template_versions(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.template_stages(id) ON DELETE CASCADE,
    milestone_id UUID NULL REFERENCES public.template_milestones(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    role_placeholder TEXT NOT NULL DEFAULT 'specialist' CHECK (role_placeholder IN ('owner', 'pm', 'specialist', 'other')),
    relative_due_offset INT,
    offset_anchor TEXT CHECK (offset_anchor IN ('project_start', 'stage_start', 'none')),
    is_client_visible BOOLEAN DEFAULT false,
    default_status TEXT DEFAULT 'todo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.template_client_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.template_versions(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.template_stages(id) ON DELETE CASCADE,
    milestone_id UUID NULL REFERENCES public.template_milestones(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    deadline_offset INT,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.template_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.template_versions(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.template_stages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    is_client_visible BOOLEAN DEFAULT true,
    approval_required BOOLEAN DEFAULT false,
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.template_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.template_versions(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES public.template_stages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    meeting_type TEXT NOT NULL,
    agenda_template TEXT,
    estimated_duration_minutes INT,
    role_placeholders JSONB DEFAULT '[]'::jsonb,
    is_client_visible BOOLEAN DEFAULT true,
    scheduling_offset_days INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency table for safe operations
CREATE TABLE public.idempotency_keys (
    key TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Template Audit Events
CREATE TABLE public.template_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    template_id UUID REFERENCES public.project_templates(id) ON DELETE SET NULL,
    template_version_id UUID REFERENCES public.template_versions(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add lineage to projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS template_id UUID NULL REFERENCES public.project_templates(id),
ADD COLUMN IF NOT EXISTS template_version_id UUID NULL REFERENCES public.template_versions(id),
ADD COLUMN IF NOT EXISTS created_from_template_at TIMESTAMPTZ NULL;

-- 3. RLS Policies
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_client_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_audit_events ENABLE ROW LEVEL SECURITY;

-- Security Definer to bypass some strict rules during complex creation, but let's implement base read policies
CREATE OR REPLACE FUNCTION public.is_template_readable(p_org_id UUID) RETURNS BOOLEAN AS $$
BEGIN
    -- If global template (org_id is null), everyone internal can read it
    IF p_org_id IS NULL THEN
        RETURN EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'pm'));
    END IF;
    -- If tenant template, only owner or PM of that org can read
    RETURN EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner') OR
           EXISTS (SELECT 1 FROM organization_members WHERE user_id = auth.uid() AND organization_id = p_org_id AND role = 'pm');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Internal Read Templates" ON public.project_templates FOR SELECT USING (public.is_template_readable(organization_id));
CREATE POLICY "Owner Manage Templates" ON public.project_templates FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));
CREATE POLICY "PM Manage Tenant Templates" ON public.project_templates FOR ALL USING (
    organization_id IS NOT NULL AND 
    EXISTS (SELECT 1 FROM organization_members WHERE user_id = auth.uid() AND organization_id = project_templates.organization_id AND role = 'pm')
);

-- Versions and blueprint tables inherit template visibility via JOINs, or we can just simplify
-- since templates are heavily managed by RPCs.
CREATE POLICY "Internal Read Template Versions" ON public.template_versions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.project_templates t WHERE t.id = template_versions.template_id AND public.is_template_readable(t.organization_id))
);
CREATE POLICY "Internal Read Template Stages" ON public.template_stages FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.template_versions v JOIN public.project_templates t ON t.id = v.template_id WHERE v.id = template_stages.version_id AND public.is_template_readable(t.organization_id))
);
-- ... same for others, but let's use a simpler approach for builder operations: 
-- Because building involves many writes, we can do it via an RPC or add similar ALL policies for Owners/PMs.

COMMIT;
