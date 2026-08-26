-- =============================================================================
-- FIRSTWIN Client Portal — Phase 4B Migration
-- Version-Level Publication, Immutable Document Review Events, Stale-Review Protection & Client Workspace RLS
-- Target: PostgreSQL / Supabase with Row-Level Security (RLS)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Version-Level Publication Model on `document_versions`
-- -----------------------------------------------------------------------------
ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS is_client_visible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_to_client_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_doc_versions_client_visible 
  ON public.document_versions(document_id, is_client_visible);

-- -----------------------------------------------------------------------------
-- 2. Document Review Events Table (Audit-Safe & Immutable)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  document_version_id UUID NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  reviewer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('approved', 'changes_requested')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for review events
CREATE INDEX IF NOT EXISTS idx_dre_doc_id ON public.document_review_events(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dre_version_id ON public.document_review_events(document_version_id);
CREATE INDEX IF NOT EXISTS idx_dre_org_id ON public.document_review_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_dre_proj_id ON public.document_review_events(project_id);

-- Enable RLS on document_review_events
ALTER TABLE public.document_review_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. Hardened RLS Policies for Document Review Events
-- -----------------------------------------------------------------------------
-- Internal staff (Owner / PM / Project Members) can view review events in accessible projects
DROP POLICY IF EXISTS "dre_staff_select" ON public.document_review_events;
CREATE POLICY "dre_staff_select"
  ON public.document_review_events
  FOR SELECT
  USING (
    public.is_global_owner() OR
    public.is_org_admin(organization_id) OR
    public.is_project_member(project_id)
  );

-- Clients can view review events for client-accessible documents
DROP POLICY IF EXISTS "dre_client_select" ON public.document_review_events;
CREATE POLICY "dre_client_select"
  ON public.document_review_events
  FOR SELECT
  USING (
    public.can_client_access_document(document_id)
  );

-- Direct client INSERT / UPDATE / DELETE are strictly BLOCKED by omitting client write policies.
-- Review events can ONLY be inserted via SECURITY DEFINER controlled RPC functions.

-- -----------------------------------------------------------------------------
-- 4. Update RLS Policies for `document_versions` and Storage
-- -----------------------------------------------------------------------------

-- 4.1 Document Versions: client can ONLY select versions with is_client_visible = TRUE
DROP POLICY IF EXISTS "doc_versions_client_select" ON public.document_versions;
CREATE POLICY "doc_versions_client_select"
  ON public.document_versions
  FOR SELECT
  USING (
    is_client_visible = TRUE AND
    public.can_client_access_document(document_id)
  );

-- 4.2 Storage Objects: client download restricted to published versions of accessible documents
DROP POLICY IF EXISTS "client_download_project_documents" ON storage.objects;
CREATE POLICY "client_download_project_documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'project-documents' AND
    EXISTS (
      SELECT 1
      FROM public.document_versions dv
      JOIN public.documents d ON d.id = dv.document_id
      WHERE dv.storage_path = name
        AND dv.is_client_visible = TRUE
        AND public.can_client_access_document(d.id)
    )
  );

-- 4.3 Meeting Documents: client can only see attached documents that are client-visible
DROP POLICY IF EXISTS "meeting_documents_client_select" ON public.meeting_documents;
CREATE POLICY "meeting_documents_client_select"
  ON public.meeting_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.meetings m
      WHERE m.id = meeting_id
        AND m.is_client_visible = TRUE
        AND public.can_client_access_project(m.project_id)
    )
    AND public.can_client_access_document(document_id)
  );

-- -----------------------------------------------------------------------------
-- 5. Controlled RPC Functions for Document Publication & Review
-- -----------------------------------------------------------------------------

-- 5.1 Publish / Unpublish Document Version (Owner / Org Admin / PM only)
CREATE OR REPLACE FUNCTION public.publish_document_version(
  p_version_id UUID,
  p_publish BOOLEAN
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version RECORD;
BEGIN
  -- Check version exists
  SELECT id, organization_id, project_id, document_id, version_number
  INTO v_version
  FROM public.document_versions
  WHERE id = p_version_id;

  IF v_version.id IS NULL THEN
    RAISE EXCEPTION 'Document version not found.';
  END IF;

  -- Authorization check: Owner or Org Admin / PM
  IF NOT (public.is_global_owner() OR public.is_org_admin(v_version.organization_id)) THEN
    RAISE EXCEPTION 'Unauthorized: Only an organization admin or project manager can publish versions.';
  END IF;

  -- Update version publication status
  UPDATE public.document_versions
  SET is_client_visible = p_publish,
      published_to_client_at = CASE WHEN p_publish THEN NOW() ELSE NULL END,
      published_by = CASE WHEN p_publish THEN auth.uid() ELSE NULL END
  WHERE id = p_version_id;

  -- If publishing, ensure document is client-visible and set status to client_review if in draft/internal_review
  IF p_publish THEN
    UPDATE public.documents
    SET is_client_visible = TRUE,
        status = CASE 
          WHEN status IN ('draft', 'internal_review', 'changes_requested') THEN 'client_review'
          ELSE status 
        END,
        updated_at = NOW()
    WHERE id = v_version.document_id
      AND internal_access_scope = 'project_team';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'version_id', p_version_id,
    'is_client_visible', p_publish,
    'published_at', CASE WHEN p_publish THEN NOW() ELSE NULL END
  );
END;
$$;

-- 5.2 Approve Document Version (Client only, Stale-Approval Protected)
CREATE OR REPLACE FUNCTION public.approve_document_version(
  p_document_id UUID,
  p_version_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_doc RECORD;
  v_version RECORD;
  v_latest_published_ver RECORD;
  v_contact_id UUID;
  v_event_id UUID;
BEGIN
  -- 1. Check document accessibility
  SELECT id, organization_id, project_id, title, status, is_client_visible, internal_access_scope
  INTO v_doc
  FROM public.documents
  WHERE id = p_document_id AND archived_at IS NULL;

  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'Document not found or archived.';
  END IF;

  IF NOT (v_doc.is_client_visible = TRUE AND v_doc.internal_access_scope = 'project_team') THEN
    RAISE EXCEPTION 'Document is not visible to client.';
  END IF;

  -- 2. Check client access to project
  IF NOT public.can_client_access_project(v_doc.project_id) THEN
    RAISE EXCEPTION 'Unauthorized: You do not have access to this project.';
  END IF;

  -- 3. Check version belongs to document and is published
  SELECT id, document_id, version_number, is_client_visible
  INTO v_version
  FROM public.document_versions
  WHERE id = p_version_id AND document_id = p_document_id;

  IF v_version.id IS NULL THEN
    RAISE EXCEPTION 'Document version not found.';
  END IF;

  IF v_version.is_client_visible <> TRUE THEN
    RAISE EXCEPTION 'This version has not been published to client.';
  END IF;

  -- 4. Stale-Approval Check: must be the latest published version
  SELECT id, version_number
  INTO v_latest_published_ver
  FROM public.document_versions
  WHERE document_id = p_document_id
    AND is_client_visible = TRUE
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_latest_published_ver.id <> p_version_id THEN
    RAISE EXCEPTION 'Stale version approval is not allowed. A newer version (v%) has already been published.', v_latest_published_ver.version_number;
  END IF;

  -- 5. Get reviewer contact ID
  v_contact_id := public.get_client_contact_id_for_user(v_doc.organization_id);

  -- 6. Insert immutable review event
  INSERT INTO public.document_review_events (
    organization_id,
    project_id,
    document_id,
    document_version_id,
    reviewer_user_id,
    reviewer_contact_id,
    action,
    comment,
    created_at
  ) VALUES (
    v_doc.organization_id,
    v_doc.project_id,
    p_document_id,
    p_version_id,
    auth.uid(),
    v_contact_id,
    'approved',
    NULL,
    NOW()
  ) RETURNING id INTO v_event_id;

  -- 7. Update document status to approved
  UPDATE public.documents
  SET status = 'approved',
      updated_at = NOW()
  WHERE id = p_document_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'document_id', p_document_id,
    'version_id', p_version_id,
    'status', 'approved',
    'approved_at', NOW()
  );
END;
$$;

-- 5.3 Request Document Changes (Client only, Comment Required, Stale-Review Protected)
CREATE OR REPLACE FUNCTION public.request_document_changes(
  p_document_id UUID,
  p_version_id UUID,
  p_comment TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_doc RECORD;
  v_version RECORD;
  v_latest_published_ver RECORD;
  v_contact_id UUID;
  v_event_id UUID;
  v_trimmed_comment TEXT;
BEGIN
  -- 1. Validate comment
  v_trimmed_comment := TRIM(COALESCE(p_comment, ''));
  IF v_trimmed_comment = '' THEN
    RAISE EXCEPTION 'A comment explaining requested changes is required.';
  END IF;

  -- 2. Check document accessibility
  SELECT id, organization_id, project_id, title, status, is_client_visible, internal_access_scope
  INTO v_doc
  FROM public.documents
  WHERE id = p_document_id AND archived_at IS NULL;

  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'Document not found or archived.';
  END IF;

  IF NOT (v_doc.is_client_visible = TRUE AND v_doc.internal_access_scope = 'project_team') THEN
    RAISE EXCEPTION 'Document is not visible to client.';
  END IF;

  -- 3. Check client access to project
  IF NOT public.can_client_access_project(v_doc.project_id) THEN
    RAISE EXCEPTION 'Unauthorized: You do not have access to this project.';
  END IF;

  -- 4. Check version belongs to document and is published
  SELECT id, document_id, version_number, is_client_visible
  INTO v_version
  FROM public.document_versions
  WHERE id = p_version_id AND document_id = p_document_id;

  IF v_version.id IS NULL THEN
    RAISE EXCEPTION 'Document version not found.';
  END IF;

  IF v_version.is_client_visible <> TRUE THEN
    RAISE EXCEPTION 'This version has not been published to client.';
  END IF;

  -- 5. Stale-Review Check: must be the latest published version
  SELECT id, version_number
  INTO v_latest_published_ver
  FROM public.document_versions
  WHERE document_id = p_document_id
    AND is_client_visible = TRUE
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_latest_published_ver.id <> p_version_id THEN
    RAISE EXCEPTION 'Stale version review is not allowed. A newer version (v%) has already been published.', v_latest_published_ver.version_number;
  END IF;

  -- 6. Get reviewer contact ID
  v_contact_id := public.get_client_contact_id_for_user(v_doc.organization_id);

  -- 7. Insert immutable review event
  INSERT INTO public.document_review_events (
    organization_id,
    project_id,
    document_id,
    document_version_id,
    reviewer_user_id,
    reviewer_contact_id,
    action,
    comment,
    created_at
  ) VALUES (
    v_doc.organization_id,
    v_doc.project_id,
    p_document_id,
    p_version_id,
    auth.uid(),
    v_contact_id,
    'changes_requested',
    v_trimmed_comment,
    NOW()
  ) RETURNING id INTO v_event_id;

  -- 8. Update document status to changes_requested
  UPDATE public.documents
  SET status = 'changes_requested',
      updated_at = NOW()
  WHERE id = p_document_id;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'document_id', p_document_id,
    'version_id', p_version_id,
    'status', 'changes_requested',
    'comment', v_trimmed_comment,
    'created_at', NOW()
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Conservative Data Backfill for Existing Canonical Test/Demo Records
-- -----------------------------------------------------------------------------
-- Publish latest version of existing client-visible documents in project_team scope
WITH latest_versions AS (
  SELECT DISTINCT ON (dv.document_id) dv.id
  FROM public.document_versions dv
  JOIN public.documents d ON d.id = dv.document_id
  WHERE d.is_client_visible = TRUE
    AND d.internal_access_scope = 'project_team'
  ORDER BY dv.document_id, dv.version_number DESC
)
UPDATE public.document_versions
SET is_client_visible = TRUE,
    published_to_client_at = NOW()
WHERE id IN (SELECT id FROM latest_versions);
