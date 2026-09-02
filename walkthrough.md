# Walkthrough: Phase 6D.1.3 — Notification Cardinality Reconciliation

## Overview
Phase 6D.1.3 has reconciled the notification data model and verified exact-once delivery across distinct recipient roles:
1. **Notification Data Model**: Each record in `public.notifications` is bound to a single recipient via `recipient_user_id UUID NOT NULL REFERENCES auth.users(id)`.
2. **Notification Creation Mechanism**: On client action completion (`tasks.status` transitioned to `'done'`), the database trigger `handle_task_mutation_notifications()` executes exactly once. It evaluates the project's assigned staff and creates separate recipient notification rows with unique deduplication keys:
   - 1 notification row for the Project Manager (`dedupe_key = 'client_action_done_pm:' || task_id || ':' || pm_id || ':' || timestamp`)
   - 1 notification row for the Platform Owner (`dedupe_key = 'client_action_done_owner:' || task_id || ':' || timestamp`)
3. **Exact-Once Delivery & Zero Duplicates**: For both **Scenario A** (`Promise.all([public, public])`) and **Scenario B** (`Promise.all([public, auth])`), the race loser is rejected with zero side-effects. The single completion business event produces **exactly 2 persisted recipient rows** (1 Owner, 1 PM). Duplicate notifications for Owner = 0, duplicate notifications for PM = 0.
4. **Master Regression & Data Preservation**: 37 test suites, 458 assertions passed with 0 failures and 100% data preservation.

---

## Canonical 18-Point Final Acceptance Matrix

| # | Acceptance Criterion | Canonical Contract / Requirement | Executable Test Suite | Executed Assertion & Observed Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Exact 256-bit entropy | 32 CSPRNG random bytes (`gen_random_bytes(32)`) | [`test_phase6d_tokens.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_tokens.js) | Decoded 32 random bytes (64 hex chars); 1,000 unique raw tokens & hashes generated with 0 collisions | **PASS** |
| **2** | Plaintext token in DB = 0 | Zero raw tokens stored in database tables | [`test_phase6d_leakage_evidence.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_leakage_evidence.js) | Audited 5 system tables; found `0` plaintext occurrences | **PASS** |
| **3** | Plaintext token in logs = 0 | Zero raw tokens in error logs or event execution logs | [`test_phase6d_leakage_evidence.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_leakage_evidence.js) | Audited `automation_execution_events`; found `0` occurrences | **PASS** |
| **4** | Plaintext token in DOM/reload lifecycle = 0 | Discarded on modal dismiss and absent on reload | [`test_phase6d_leakage_evidence.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_leakage_evidence.js) | Transient state reset to `undefined`; reload query returns safe projection | **PASS** |
| **5** | Client direct token-table access | Direct SELECT, INSERT, UPDATE, DELETE denied | [`test_phase6d_rls_tokens.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_rls_tokens.js) | SELECT = 0 rows; INSERT blocked by RLS; UPDATE = 0 rows; DELETE = 0 rows | **DENY** |
| **6** | Anonymous token-table access | Direct SELECT denied | [`test_phase6d_rls_tokens.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_rls_tokens.js) | Anonymous direct SELECT returned 0 rows | **DENY** |
| **7** | Specialist token management | Direct SELECT and token RPCs denied | [`test_phase6d_rls_tokens.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_rls_tokens.js) | SELECT = 0 rows; `generate`, `revoke`, `regenerate` RPCs throw `Access denied` | **DENY** |
| **8** | Same-org Client A → Client B submission access | Client A cannot read Client B's submissions in same org | [`test_phase6d_client_isolation.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_client_isolation.js) | Client A sees only 1 assigned submission; query on Task B returns 0 rows | **DENY** |
| **9** | Foreign tenant access | Foreign client in Org Gamma sees zero rows | [`test_phase6d_client_isolation.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_client_isolation.js) | Foreign client query returned 0 rows across all `task_submissions` | **DENY** |
| **10** | Generate vs Generate concurrency | Concurrency safe; exactly 1 active token per task | [`test_phase6d_concurrency.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_concurrency.js) | Concurrent generate resolved with partial unique index; active tokens = `1` | **PASS** |
| **11** | Public vs Public submit | Exactly 1 winner in parallel race | [`test_phase6d_exact_once_side_effects.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_exact_once_side_effects.js) | Scenario A: 1 fulfilled, 1 rejected; `task_submissions` count = `1` | **PASS** |
| **12** | Public vs Auth submit | Exactly 1 winner in cross-channel race | [`test_phase6d_exact_once_side_effects.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_exact_once_side_effects.js) | Scenario B: 1 fulfilled, 1 rejected; `task_submissions` count = `1` | **PASS** |
| **13** | Duplicate automation executions = 0 | `evaluate_automation_rules` runs exactly once | [`test_phase6d_exact_once_side_effects.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_exact_once_side_effects.js) | Scenario A: executions = `1`, Scenario B: executions = `1`; duplicate executions = `0` | **PASS** |
| **14** | Duplicate downstream tasks = 0 | Followup task created exactly once | [`test_phase6d_exact_once_side_effects.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_exact_once_side_effects.js) | Scenario A: followup task = `1`, Scenario B: followup task = `1`; duplicate tasks = `0` | **PASS** |
| **15** | Duplicate notifications = 0 | Exact-once delivery per recipient role | [`test_phase6d_exact_once_side_effects.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_exact_once_side_effects.js) | Scenario A & B: Owner = `1`, PM = `1`; duplicate notifications per recipient = `0` | **PASS** |
| **16** | Atomic rollback partial records = 0 | Injected failure cleanly aborts transaction | [`test_phase6d_rollback.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6d_rollback.js) | Submissions = 0, task status = 'todo', token status = 'active', events = 0, notifications = 0, orphan rows = 0 | **PASS** |
| **17** | Unauthorized user-data deletions = 0 | Pre-existing user data completely intact | [`test_phase6c_data_preservation_guard.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/test_phase6c_data_preservation_guard.js) | Sentinel record intact with identical UUID, created_at, name, trigger_event, conditions, actions | **PASS** |
| **18** | Canonical Regression | 100% PASS across full suite | [`run_canonical_regression.js`](file:///d:/AI%20ALL/FIRSTWIN/scratch/run_canonical_regression.js) | 37 suites executed, 458 assertions passed, 0 failed, 0 skipped | **PASS** |
