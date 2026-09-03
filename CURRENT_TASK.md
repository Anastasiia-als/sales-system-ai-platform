# Current Task: Phase 6D — Client Action Portal & Public Submissions

## Active Step: Phase 6D.3 ACCEPTED / CLOSED — Ready for Phase 6D.4 Scope & DoD

### Phase 6D.3 Status:
- **Status**: **ACCEPTED / CLOSED** (Manual Acceptance Passed on 2026-09-03).
- **Deliverables Verified**:
  1. Integrated PM Client Action management into existing UI surfaces (`#client-action-management-container` in Task Modal) with zero duplicate task surfaces.
  2. Server-derived PM authorization enforced authoritatively across all roles.
  3. Strict 5-state badge display («Не згенеровано», «Активне», «Прострочено», «Відкликано», «Виконано») with reactive transitions.
  4. One-time raw-token reveal modal with transient memory wiping (`transientToken = null`), clipboard copy, and zero persistent storage in DB/localStorage/cookies/DOM attributes.
  5. Submission Review component displaying multi-iteration history, channel attribution (`public_link` vs `authenticated_portal`), XSS escaping, and secure short-lived signed URLs for attachment downloads.
  6. Reopen canonical sequence (`Виконано → Reopen → Не згенеровано → Generate → Активне`) strictly enforced, resetting `status = 'todo'` and `completed_at = NULL` while preserving 100% of historic submissions.
  7. Dev-server resilience and error architecture hardened against stream errors, client aborts, and socket closures during rapid F5 reloads, with fatal programming exceptions remaining strictly visible (no blanket swallowing).
  8. Exhaustive test matrix (Tests A–T) executed with 100% pass rate.
  9. Permanent Data Preservation Guard: **100% PASS (0 deletions, 0 data loss)**.
  10. Canonical Master Regression: **50 suites, 952 assertions, 0 failures (100% PASS)**.

### Next Subphase:
- **Phase 6D.4: Client Portal Integration & Authenticated Actions** (Proposal / Scope / Definition of Done submitted; awaiting user approval before implementation).
