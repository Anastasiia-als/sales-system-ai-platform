-- FIRSTWIN Client Portal — Phase 3B: Meetings, Recurring Meetings, Notes & Decisions Migration
-- Target: PostgreSQL / Supabase with Row-Level Security (RLS) & Cross-Tenant Integrity

-- -----------------------------------------------------------------------------
-- 1. Meeting Series Table (Recurring Meetings)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meeting_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_type TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  interval INTEGER NOT NULL DEFAULT 1,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  timezone TEXT NOT NULL DEFAULT 'Europe/Kyiv',
  start_date DATE NOT NULL,
  end_date DATE,
  location_type TEXT NOT NULL DEFAULT 'online' CHECK (location_type IN ('online', 'in_person', 'phone', 'other')),
  meeting_url TEXT,
  location_text TEXT,
  agenda TEXT,
  is_client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_meeting_series_updated_at ON public.meeting_series;
CREATE TRIGGER set_meeting_series_updated_at
  BEFORE UPDATE ON public.meeting_series
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_meeting_series_project ON public.meeting_series(project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_series_org ON public.meeting_series(organization_id);

-- -----------------------------------------------------------------------------
-- 2. Meetings Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Kyiv',
  location_type TEXT NOT NULL DEFAULT 'online'
    CHECK (location_type IN ('online', 'in_person', 'phone', 'other')),
  meeting_url TEXT,
  location_text TEXT,
  agenda TEXT,
  organizer_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  recurrence_series_id UUID REFERENCES public.meeting_series(id) ON DELETE SET NULL,
  recording_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS set_meetings_updated_at ON public.meetings;
CREATE TRIGGER set_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_meetings_project ON public.meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_org ON public.meetings(organization_id);
CREATE INDEX IF NOT EXISTS idx_meetings_start_at ON public.meetings(start_at);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON public.meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_recurrence ON public.meetings(recurrence_series_id);

-- -----------------------------------------------------------------------------
-- 3. Meeting Participants Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('user', 'contact')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  attendance_status TEXT NOT NULL DEFAULT 'invited'
    CHECK (attendance_status IN ('invited', 'confirmed', 'attended', 'absent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_participant_target CHECK (
    (participant_type = 'user' AND user_id IS NOT NULL AND contact_id IS NULL) OR
    (participant_type = 'contact' AND contact_id IS NOT NULL AND user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON public.meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user ON public.meeting_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_contact ON public.meeting_participants(contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_participant_user ON public.meeting_participants(meeting_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_participant_contact ON public.meeting_participants(meeting_id, contact_id) WHERE contact_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Meeting Notes Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL DEFAULT 'general'
    CHECK (note_type IN ('general', 'internal', 'next_step', 'summary')),
  body TEXT NOT NULL,
  is_client_visible BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_meeting_notes_updated_at ON public.meeting_notes;
CREATE TRIGGER set_meeting_notes_updated_at
  BEFORE UPDATE ON public.meeting_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_meeting_notes_meeting ON public.meeting_notes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_project ON public.meeting_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_type ON public.meeting_notes(note_type);

-- -----------------------------------------------------------------------------
-- 5. Meeting Decisions Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meeting_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  decision_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_meeting_decisions_updated_at ON public.meeting_decisions;
CREATE TRIGGER set_meeting_decisions_updated_at
  BEFORE UPDATE ON public.meeting_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_meeting_decisions_meeting ON public.meeting_decisions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_decisions_project ON public.meeting_decisions(project_id);

-- -----------------------------------------------------------------------------
-- 6. Meeting Documents Junction Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meeting_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'material'
    CHECK (relation_type IN ('agenda_material', 'presentation', 'final_report', 'meeting_deliverable', 'material')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_meeting_document UNIQUE (meeting_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_documents_meeting ON public.meeting_documents(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_documents_doc ON public.meeting_documents(document_id);

-- -----------------------------------------------------------------------------
-- 7. Add source_meeting_id to Tasks Table
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'source_meeting_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN source_meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_source_meeting ON public.tasks(source_meeting_id);

-- -----------------------------------------------------------------------------
-- 8. Consistency & Security Triggers
-- -----------------------------------------------------------------------------

-- 8.1 Meeting Consistency
CREATE OR REPLACE FUNCTION public.validate_meeting_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_proj_org_id UUID;
BEGIN
  -- 1. Validate project exists and belongs to organization
  SELECT organization_id INTO v_proj_org_id
  FROM public.projects
  WHERE id = NEW.project_id;

  IF v_proj_org_id IS NULL THEN
    RAISE EXCEPTION 'Target project does not exist';
  END IF;

  IF v_proj_org_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'Project belongs to a different organization';
  END IF;

  -- 2. Validate time interval
  IF NEW.end_at < NEW.start_at THEN
    RAISE EXCEPTION 'Meeting end time cannot be earlier than start time';
  END IF;

  -- 3. Manage cancelled_at
  IF NEW.status = 'cancelled' AND (OLD IS NULL OR OLD.status <> 'cancelled') AND NEW.cancelled_at IS NULL THEN
    NEW.cancelled_at = NOW();
  ELSIF NEW.status <> 'cancelled' THEN
    NEW.cancelled_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_meeting_consistency ON public.meetings;
CREATE TRIGGER trg_validate_meeting_consistency
  BEFORE INSERT OR UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_meeting_consistency();

-- 8.2 Meeting Series Consistency
CREATE OR REPLACE FUNCTION public.validate_meeting_series_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_proj_org_id UUID;
BEGIN
  SELECT organization_id INTO v_proj_org_id
  FROM public.projects
  WHERE id = NEW.project_id;

  IF v_proj_org_id IS NULL THEN
    RAISE EXCEPTION 'Target project does not exist';
  END IF;

  IF v_proj_org_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'Project belongs to a different organization';
  END IF;

  IF NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'Series end date cannot be earlier than start date';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_meeting_series_consistency ON public.meeting_series;
CREATE TRIGGER trg_validate_meeting_series_consistency
  BEFORE INSERT OR UPDATE ON public.meeting_series
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_meeting_series_consistency();

-- 8.3 Meeting Participant Consistency
CREATE OR REPLACE FUNCTION public.validate_meeting_participant_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_meet_org_id UUID;
  v_meet_proj_id UUID;
  v_contact_org_id UUID;
BEGIN
  SELECT organization_id, project_id INTO v_meet_org_id, v_meet_proj_id
  FROM public.meetings
  WHERE id = NEW.meeting_id;

  IF v_meet_org_id IS NULL THEN
    RAISE EXCEPTION 'Target meeting does not exist';
  END IF;

  NEW.organization_id = v_meet_org_id;
  NEW.project_id = v_meet_proj_id;

  -- Validate contact belongs to same organization
  IF NEW.participant_type = 'contact' AND NEW.contact_id IS NOT NULL THEN
    SELECT organization_id INTO v_contact_org_id
    FROM public.contacts
    WHERE id = NEW.contact_id;

    IF v_contact_org_id IS NULL THEN
      RAISE EXCEPTION 'Target contact does not exist';
    END IF;

    IF v_contact_org_id <> NEW.organization_id THEN
      RAISE EXCEPTION 'Contact belongs to a different organization';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_meeting_participant_consistency ON public.meeting_participants;
CREATE TRIGGER trg_validate_meeting_participant_consistency
  BEFORE INSERT OR UPDATE ON public.meeting_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_meeting_participant_consistency();

-- 8.4 Meeting Note & Decision & Document Consistency
CREATE OR REPLACE FUNCTION public.validate_meeting_child_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_meet_org_id UUID;
  v_meet_proj_id UUID;
BEGIN
  SELECT organization_id, project_id INTO v_meet_org_id, v_meet_proj_id
  FROM public.meetings
  WHERE id = NEW.meeting_id;

  IF v_meet_org_id IS NULL THEN
    RAISE EXCEPTION 'Target meeting does not exist';
  END IF;

  NEW.organization_id = v_meet_org_id;
  NEW.project_id = v_meet_proj_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_meeting_note_consistency ON public.meeting_notes;
CREATE TRIGGER trg_validate_meeting_note_consistency
  BEFORE INSERT OR UPDATE ON public.meeting_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_meeting_child_consistency();

DROP TRIGGER IF EXISTS trg_validate_meeting_decision_consistency ON public.meeting_decisions;
CREATE TRIGGER trg_validate_meeting_decision_consistency
  BEFORE INSERT OR UPDATE ON public.meeting_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_meeting_child_consistency();

DROP TRIGGER IF EXISTS trg_validate_meeting_document_consistency ON public.meeting_documents;
CREATE TRIGGER trg_validate_meeting_document_consistency
  BEFORE INSERT OR UPDATE ON public.meeting_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_meeting_child_consistency();

-- 8.5 Task Meeting Consistency (Ensure task's source_meeting belongs to same project)
CREATE OR REPLACE FUNCTION public.validate_task_meeting_consistency()
RETURNS TRIGGER AS $$
DECLARE
  v_meet_org_id UUID;
  v_meet_proj_id UUID;
BEGIN
  IF NEW.source_meeting_id IS NOT NULL THEN
    SELECT organization_id, project_id INTO v_meet_org_id, v_meet_proj_id
    FROM public.meetings
    WHERE id = NEW.source_meeting_id;

    IF v_meet_org_id IS NULL THEN
      RAISE EXCEPTION 'Source meeting does not exist';
    END IF;

    IF v_meet_org_id <> NEW.organization_id OR v_meet_proj_id <> NEW.project_id THEN
      RAISE EXCEPTION 'Source meeting belongs to a different project or organization';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_task_meeting_consistency ON public.tasks;
CREATE TRIGGER trg_validate_task_meeting_consistency
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_meeting_consistency();

-- -----------------------------------------------------------------------------
-- 9. Row-Level Security (RLS) Policies
-- -----------------------------------------------------------------------------
ALTER TABLE public.meeting_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_documents ENABLE ROW LEVEL SECURITY;

-- 9.1 Meeting Series RLS
DROP POLICY IF EXISTS "Meeting series viewable by authorized members" ON public.meeting_series;
CREATE POLICY "Meeting series viewable by authorized members" ON public.meeting_series
  FOR SELECT USING (
    public.is_global_owner()
    OR public.is_org_admin(organization_id)
    OR (
      public.is_project_member(project_id)
      AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'client')
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = meeting_series.organization_id
          AND user_id = auth.uid() AND org_role = 'client' AND is_active = TRUE
      )
    )
  );

DROP POLICY IF EXISTS "Meeting series insertable by org admin or owner" ON public.meeting_series;
CREATE POLICY "Meeting series insertable by org admin or owner" ON public.meeting_series
  FOR INSERT WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Meeting series updatable by org admin or owner" ON public.meeting_series;
CREATE POLICY "Meeting series updatable by org admin or owner" ON public.meeting_series
  FOR UPDATE USING (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Meeting series deletable by org admin or owner" ON public.meeting_series;
CREATE POLICY "Meeting series deletable by org admin or owner" ON public.meeting_series
  FOR DELETE USING (public.is_org_admin(organization_id));

-- 9.2 Meetings RLS
DROP POLICY IF EXISTS "Meetings viewable by authorized members" ON public.meetings;
CREATE POLICY "Meetings viewable by authorized members" ON public.meetings
  FOR SELECT USING (
    public.is_global_owner()
    OR public.is_org_admin(organization_id)
    OR (
      public.is_project_member(project_id)
      AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'client')
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = meetings.organization_id
          AND user_id = auth.uid() AND org_role = 'client' AND is_active = TRUE
      )
    )
  );

DROP POLICY IF EXISTS "Meetings insertable by org admin or owner" ON public.meetings;
CREATE POLICY "Meetings insertable by org admin or owner" ON public.meetings
  FOR INSERT WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Meetings updatable by org admin or owner" ON public.meetings;
CREATE POLICY "Meetings updatable by org admin or owner" ON public.meetings
  FOR UPDATE USING (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Meetings deletable by org admin or owner" ON public.meetings;
CREATE POLICY "Meetings deletable by org admin or owner" ON public.meetings
  FOR DELETE USING (public.is_org_admin(organization_id));

-- 9.3 Meeting Participants RLS
DROP POLICY IF EXISTS "Meeting participants viewable by authorized members" ON public.meeting_participants;
CREATE POLICY "Meeting participants viewable by authorized members" ON public.meeting_participants
  FOR SELECT USING (
    public.is_global_owner()
    OR public.is_org_admin(organization_id)
    OR (
      public.is_project_member(project_id)
      AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'client')
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = meeting_participants.organization_id
          AND user_id = auth.uid() AND org_role = 'client' AND is_active = TRUE
      )
    )
  );

DROP POLICY IF EXISTS "Meeting participants insertable by org admin or owner" ON public.meeting_participants;
CREATE POLICY "Meeting participants insertable by org admin or owner" ON public.meeting_participants
  FOR INSERT WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Meeting participants updatable by org admin or owner" ON public.meeting_participants;
CREATE POLICY "Meeting participants updatable by org admin or owner" ON public.meeting_participants
  FOR UPDATE USING (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Meeting participants deletable by org admin or owner" ON public.meeting_participants;
CREATE POLICY "Meeting participants deletable by org admin or owner" ON public.meeting_participants
  FOR DELETE USING (public.is_org_admin(organization_id));

-- 9.4 Meeting Notes RLS (Specialists cannot see internal management notes)
DROP POLICY IF EXISTS "Meeting notes viewable by authorized members" ON public.meeting_notes;
CREATE POLICY "Meeting notes viewable by authorized members" ON public.meeting_notes
  FOR SELECT USING (
    public.is_global_owner()
    OR public.is_org_admin(organization_id)
    OR (
      public.is_project_member(project_id)
      AND (is_client_visible = TRUE OR note_type <> 'internal')
      AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'client')
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = meeting_notes.organization_id
          AND user_id = auth.uid() AND org_role = 'client' AND is_active = TRUE
      )
    )
  );

DROP POLICY IF EXISTS "Meeting notes insertable by org admin or owner" ON public.meeting_notes;
CREATE POLICY "Meeting notes insertable by org admin or owner" ON public.meeting_notes
  FOR INSERT WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Meeting notes updatable by org admin or owner" ON public.meeting_notes;
CREATE POLICY "Meeting notes updatable by org admin or owner" ON public.meeting_notes
  FOR UPDATE USING (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Meeting notes deletable by org admin or owner" ON public.meeting_notes;
CREATE POLICY "Meeting notes deletable by org admin or owner" ON public.meeting_notes
  FOR DELETE USING (public.is_org_admin(organization_id));

-- 9.5 Meeting Decisions RLS
DROP POLICY IF EXISTS "Meeting decisions viewable by authorized members" ON public.meeting_decisions;
CREATE POLICY "Meeting decisions viewable by authorized members" ON public.meeting_decisions
  FOR SELECT USING (
    public.is_global_owner()
    OR public.is_org_admin(organization_id)
    OR (
      public.is_project_member(project_id)
      AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'client')
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = meeting_decisions.organization_id
          AND user_id = auth.uid() AND org_role = 'client' AND is_active = TRUE
      )
    )
  );

DROP POLICY IF EXISTS "Meeting decisions insertable by org admin or owner" ON public.meeting_decisions;
CREATE POLICY "Meeting decisions insertable by org admin or owner" ON public.meeting_decisions
  FOR INSERT WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Meeting decisions updatable by org admin or owner" ON public.meeting_decisions;
CREATE POLICY "Meeting decisions updatable by org admin or owner" ON public.meeting_decisions
  FOR UPDATE USING (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Meeting decisions deletable by org admin or owner" ON public.meeting_decisions;
CREATE POLICY "Meeting decisions deletable by org admin or owner" ON public.meeting_decisions
  FOR DELETE USING (public.is_org_admin(organization_id));

-- 9.6 Meeting Documents RLS
DROP POLICY IF EXISTS "Meeting documents viewable by authorized members" ON public.meeting_documents;
CREATE POLICY "Meeting documents viewable by authorized members" ON public.meeting_documents
  FOR SELECT USING (
    public.is_global_owner()
    OR public.is_org_admin(organization_id)
    OR (
      public.is_project_member(project_id)
      AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role = 'client')
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE organization_id = meeting_documents.organization_id
          AND user_id = auth.uid() AND org_role = 'client' AND is_active = TRUE
      )
    )
  );

DROP POLICY IF EXISTS "Meeting documents insertable by org admin or owner" ON public.meeting_documents;
CREATE POLICY "Meeting documents insertable by org admin or owner" ON public.meeting_documents
  FOR INSERT WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Meeting documents updatable by org admin or owner" ON public.meeting_documents;
CREATE POLICY "Meeting documents updatable by org admin or owner" ON public.meeting_documents
  FOR UPDATE USING (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Meeting documents deletable by org admin or owner" ON public.meeting_documents;
CREATE POLICY "Meeting documents deletable by org admin or owner" ON public.meeting_documents
  FOR DELETE USING (public.is_org_admin(organization_id));
