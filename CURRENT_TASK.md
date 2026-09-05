# Current Task: Phase 6D — Client Action Portal & Public Submissions

## Active Step: Phase 6D.4 CLOSED & ACCEPTED — STOPPED FOR PHASE 6D.5 SCOPE APPROVAL

### Phase 6D.4 Acceptance Summary:
- **Status**: **PASSED, ACCEPTED & CLOSED**
- **User Acceptance Confirmation**:
  - Reopened submission through Public Magic Link strictly preserved as **Iteration 1**.
  - Subsequent submission through Client Portal successfully created as **Iteration 2**.
  - Prior submission text and metadata not overwritten and not deleted (100% data preservation).
  - Both iterations clearly rendered in chronological order within **Submission History**.
  - Final task status: **«Виконано»** (completed).
  - **Reopen** action remains available and operational for PM/Admin.
- **Deliverables Verified**:
  1. **Strict Same-Org Client A vs Client B Contact Isolation**: Hardened `tasks_client_select` RLS and `submit_authenticated_client_action` RPC to ensure `tasks.client_contact_id` matches caller's contact ID derived from `client_portal_access`. Client B from the same organization receives `Access denied` and 0 rows on SELECT.
  2. **Cross-Tenant & Cross-Project Default Deny**: Foreign tenants receive immediate `Access denied to this project.`
  3. **Server-Derived Identity & Anti-Spoofing**: Organization, project, and contact IDs in submissions are derived authoritatively server-side (`auth.uid()`, `v_task.organization_id`, `v_contact_id`); client payload overrides are strictly ignored.
  4. **Cross-Channel Token Revocation**: Authenticated portal submission strictly sets active Magic Link tokens to `status = 'revoked'`, `revoked_at = NOW()`, with `used_at = NULL`. Zero tokens are marked `used`.
  5. **Authoritative Private Storage Architecture**: All attachments stored in canonical private bucket `project-documents` under `client-actions/{org_id}/{proj_id}/{task_id}/{file_uuid}_{sanitized_name}` generated server-side via `generate_client_action_storage_path`.
  6. **Storage RLS Policies & Filename Validation**: Upload/read policies on `storage.objects` verify task ownership and membership with UUID regex validation. Rejects spoofed task namespaces and unpermitted extensions.
  7. **Exact Notification Cardinality**:
     - `PM != Owner`: Exactly 2 persisted rows (1 PM + 1 Owner).
     - `PM == Owner`: Exactly 1 persisted row (Owner).
     - `PM IS NULL`: Exactly 1 persisted row (Owner, using `IS DISTINCT FROM`).
     - Retries / duplicate submit: Exactly 0 duplicate notifications.
     - PM Reopen: Exactly 1 notification persisted for the assigned client user.
  8. **Client Action Center UI Upgrades**: Drag-and-drop file upload with 8 allowlisted extensions, 25 MB / 5 file limit, responsive modal, submission review with signed download URLs and Reopen capability.
  9. **Exhaustive Automated Regression**: 56 suites, 1073 assertions, 0 failures (100% PASS).
  10. **Data Preservation Guard**: 100% PASS (0 deletions, 0 data loss). User's manual acceptance data preserved across iterations.

### Next Step:
- **Phase 6D.5**: Production Hardening, Edge-Case Auditing & Full E2E Verification.
- **Current State**: STOPPED. Awaiting user review and approval of the Phase 6D.5 Proposal, Scope, and Definition of Done before any implementation.
