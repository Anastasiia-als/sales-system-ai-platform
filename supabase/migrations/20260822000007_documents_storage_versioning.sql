-- FIRSTWIN Client Portal — Phase 3A: Documents, Secure File Storage & Versioning Migration
-- Target: PostgreSQL / Supabase with Row-Level Security (RLS) & Private Storage

-- -----------------------------------------------------------------------------
-- 1. Documents Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.project_stages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'internal_review', 'client_review', 'changes_requested', 'approved', 'final')),
  owner_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  internal_access_scope TEXT NOT NULL DEFAULT 'project_team'
    CHECK (internal_access_scope IN ('management', 'project_team')),
  is_client_visible BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS set_documents_updated_at ON public.documents;
CREATE TRIGGER set_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_documents_project ON public.documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_stage ON public.documents(stage_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_archived ON public.documents(archived_at);

-- -----------------------------------------------------------------------------
-- 2. Document Versions Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_doc_version UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON public.document_versions(document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_doc_versions_project ON public.document_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_org ON public.document_versions(organization_id);

-- -----------------------------------------------------------------------------
-- 3. Document Consistency & Security Trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_document_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_proj_org_id UUID;
  v_stage_proj_id UUID;
  v_stage_org_id UUID;
BEGIN
  -- 1. Validate project belongs to organization
  SELECT organization_id INTO v_proj_org_id
  FROM public.projects
  WHERE id = NEW.project_id;

  IF v_proj_org_id IS NULL THEN
    RAISE EXCEPTION 'Target project does not exist';
  END IF;

  IF v_proj_org_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'Project belongs to a different organization';
  END IF;

  -- 2. Validate stage alignment if provided
  IF NEW.stage_id IS NOT NULL THEN
    SELECT project_id, organization_id INTO v_stage_proj_id, v_stage_org_id
    FROM public.project_stages
    WHERE id = NEW.stage_id;

    IF v_stage_proj_id IS NULL THEN
      RAISE EXCEPTION 'Target project stage does not exist';
    END IF;

    IF v_stage_proj_id <> NEW.project_id OR v_stage_org_id <> NEW.organization_id THEN
      RAISE EXCEPTION 'Stage belongs to a different project or organization';
    END IF;
  END IF;

  -- 3. Security check: Management-only confidential document cannot be client visible
  IF NEW.internal_access_scope = 'management' THEN
    NEW.is_client_visible = FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_document_consistency ON public.documents;
CREATE TRIGGER trg_validate_document_consistency
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_document_consistency();

-- -----------------------------------------------------------------------------
-- 4. Document Version Consistency & Auto-Versioning Trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_document_version_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_doc_org_id UUID;
  v_doc_proj_id UUID;
  v_next_version INTEGER;
BEGIN
  -- 1. Verify parent document exists and match organization/project
  SELECT organization_id, project_id INTO v_doc_org_id, v_doc_proj_id
  FROM public.documents
  WHERE id = NEW.document_id;

  IF v_doc_org_id IS NULL THEN
    RAISE EXCEPTION 'Parent document does not exist';
  END IF;

  NEW.organization_id = v_doc_org_id;
  NEW.project_id = v_doc_proj_id;

  -- 2. Deterministically assign next version number if not provided or invalid
  IF NEW.version_number IS NULL OR NEW.version_number <= 0 THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM public.document_versions
    WHERE document_id = NEW.document_id;

    NEW.version_number = v_next_version;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_document_version_consistency ON public.document_versions;
CREATE TRIGGER trg_validate_document_version_consistency
  BEFORE INSERT OR UPDATE ON public.document_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_document_version_consistency();

-- -----------------------------------------------------------------------------
-- 5. Touch Document updated_at on New Version Trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_document_version_inserted()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.documents
  SET updated_at = NOW()
  WHERE id = NEW.document_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_document_version_inserted ON public.document_versions;
CREATE TRIGGER trg_document_version_inserted
  AFTER INSERT ON public.document_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_document_version_inserted();

-- -----------------------------------------------------------------------------
-- 6. Storage Bucket Configuration (Private)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-documents',
  'project-documents',
  false,
  52428800, -- 50 MB
  NULL
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 52428800;

-- -----------------------------------------------------------------------------
-- 7. Database Row-Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- 7.1 Documents RLS
DROP POLICY IF EXISTS "Documents viewable by authorized members" ON public.documents;
CREATE POLICY "Documents viewable by authorized members" ON public.documents
  FOR SELECT USING (
    public.is_global_owner()
    OR public.is_org_admin(organization_id)
    OR (
      public.is_project_member(project_id)
      AND internal_access_scope = 'project_team'
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'client'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = documents.organization_id
          AND user_id = auth.uid()
          AND org_role = 'client'
          AND is_active = TRUE
      )
    )
  );

DROP POLICY IF EXISTS "Documents insertable by org admin or global owner" ON public.documents;
CREATE POLICY "Documents insertable by org admin or global owner" ON public.documents
  FOR INSERT WITH CHECK (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Documents updatable by org admin or global owner" ON public.documents;
CREATE POLICY "Documents updatable by org admin or global owner" ON public.documents
  FOR UPDATE USING (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Documents deletable by org admin or global owner" ON public.documents;
CREATE POLICY "Documents deletable by org admin or global owner" ON public.documents
  FOR DELETE USING (
    public.is_org_admin(organization_id)
  );

-- 7.2 Document Versions RLS
DROP POLICY IF EXISTS "Document versions viewable by authorized members" ON public.document_versions;
CREATE POLICY "Document versions viewable by authorized members" ON public.document_versions
  FOR SELECT USING (
    public.is_global_owner()
    OR public.is_org_admin(organization_id)
    OR (
      public.is_project_member(project_id)
      AND EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_versions.document_id
          AND d.internal_access_scope = 'project_team'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'client'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = document_versions.organization_id
          AND user_id = auth.uid()
          AND org_role = 'client'
          AND is_active = TRUE
      )
    )
  );

DROP POLICY IF EXISTS "Document versions insertable by org admin or global owner" ON public.document_versions;
CREATE POLICY "Document versions insertable by org admin or global owner" ON public.document_versions
  FOR INSERT WITH CHECK (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Document versions updatable by org admin or global owner" ON public.document_versions;
CREATE POLICY "Document versions updatable by org admin or global owner" ON public.document_versions
  FOR UPDATE USING (
    public.is_org_admin(organization_id)
  );

DROP POLICY IF EXISTS "Document versions deletable by org admin or global owner" ON public.document_versions;
CREATE POLICY "Document versions deletable by org admin or global owner" ON public.document_versions
  FOR DELETE USING (
    public.is_org_admin(organization_id)
  );

-- -----------------------------------------------------------------------------
-- 8. Storage Row-Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated read of project-documents" ON storage.objects;
CREATE POLICY "Allow authenticated read of project-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND (
      public.is_global_owner()
      OR (
        (storage.foldername(name))[1] IS NOT NULL
        AND public.is_org_admin(((storage.foldername(name))[1])::uuid)
      )
      OR (
        (storage.foldername(name))[2] IS NOT NULL
        AND (storage.foldername(name))[3] IS NOT NULL
        AND public.is_project_member(((storage.foldername(name))[2])::uuid)
        AND EXISTS (
          SELECT 1 FROM public.documents d
          WHERE d.id = ((storage.foldername(name))[3])::uuid
            AND d.internal_access_scope = 'project_team'
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'client'
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.organization_memberships
          WHERE organization_id = ((storage.foldername(name))[1])::uuid
            AND user_id = auth.uid()
            AND org_role = 'client'
            AND is_active = TRUE
        )
      )
    )
  );

DROP POLICY IF EXISTS "Allow authenticated upload of project-documents" ON storage.objects;
CREATE POLICY "Allow authenticated upload of project-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (
      public.is_global_owner()
      OR public.is_org_admin(((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS "Allow authenticated update of project-documents" ON storage.objects;
CREATE POLICY "Allow authenticated update of project-documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (
      public.is_global_owner()
      OR public.is_org_admin(((storage.foldername(name))[1])::uuid)
    )
  );

DROP POLICY IF EXISTS "Allow authenticated delete of project-documents" ON storage.objects;
CREATE POLICY "Allow authenticated delete of project-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (
      public.is_global_owner()
      OR public.is_org_admin(((storage.foldername(name))[1])::uuid)
    )
  );
