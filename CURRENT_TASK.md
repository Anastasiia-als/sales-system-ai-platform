# Current Task: Phase 6D — Client Action Portal & Public Submissions

## Active Step: Phase 6D.1 Completed — Awaiting Gate Approval for Phase 6D.2

### Accomplishments in Phase 6D.1:
1. **Database Schema & Data Model**:
   - Created `public.client_action_tokens` with SHA-256 `token_hash VARCHAR(64) UNIQUE`.
   - Created partial unique index `uq_client_action_single_active_token` for strictly 1 active token per task.
   - Created `public.task_submissions` append-only audit and response storage.
   - Created `enforce_task_tenant_consistency()` triggers guaranteeing tenant ownership cannot be spoofed.
2. **Unified Atomic Submission Core & RPCs**:
   - `generate_action_token(p_task_id)`: 256-bit entropy token generation, SHA-256 hash insert, single active token guarantee.
   - `revoke_action_token`, `regenerate_action_token`.
   - `get_public_client_action(p_raw_token)`: Safe projection with strict allowlist and zero internal leaks.
   - `_execute_client_action_submission_core`: Pessimistic locking (`FOR UPDATE`), task status transition, token invalidation, single automation event dispatch.
   - `submit_public_client_action` and `submit_authenticated_client_action`.
   - `reopen_client_action`: Preserves submission audit logs without resurrecting dead tokens.
3. **Automated Verification**:
   - 6 new automated test suites in `scratch/`:
     - `test_phase6d_tokens.js` (15/15 PASS)
     - `test_phase6d_lifecycle.js` (21/21 PASS)
     - `test_phase6d_concurrency.js` (8/8 PASS)
     - `test_phase6d_cross_channel.js` (12/12 PASS)
     - `test_phase6d_data_minimization.js` (34/34 PASS)
     - `test_phase6d_tenant_invariant.js` (10/10 PASS)
   - Canonical Master Regression: **32 suites, 371 assertions, 0 failures (100% PASS)**.
4. **Documentation**:
   - Updated `DATABASE.md`, `PERMISSIONS.md`, `DECISIONS.md` (ADR-008), `ROADMAP.md`, `CURRENT_TASK.md`, `walkthrough.md`.

### Next Gate:
- Await user review and approval before proceeding to **Phase 6D.2: Public Action UI (`#/action/:token`)**.
