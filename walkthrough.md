# Walkthrough: Phase 6D.1.2 — Final Missing Evidence Closure

## Overview
Phase 6D.1.2 has closed all remaining evidence gaps across raw token leakages, exact-once side effects & notification telemetry, and complete transaction rollback invariants:
1. **Complete Raw Token Leakage Evidence**: Proved 0 plaintext tokens in DB, 0 in application/server logs, 0 in browser console, 0 in DOM after reveal lifecycle, 0 after F5/reload, 0 in error messages, 0 in task submission payloads/attachments metadata, and 0 in notifications.
2. **Exact-Once Side Effects & Notifications**: Parallel race execution across both canonical race scenarios (Scenario A: Public vs Public, Scenario B: Public vs Auth) proved exactly 1 submission created, exactly 1 task completion mutation, exactly 1 rule execution event, exactly expected once downstream followup task, 0 duplicate downstream tasks, exactly expected once completion notification, 0 duplicate completion notifications, and 0 active tokens remaining.
3. **Transaction Rollback Complete Side Effect Evidence**: Injected failure after submission insertion confirmed 0 partial submissions, task status unchanged, completed_at unchanged, token status unchanged, used_at unchanged, 0 automation execution events, 0 downstream tasks, 0 notifications, and 0 orphan rows, with subsequent normal submission completing cleanly.
4. **Permanent Data Preservation & Master Regression**: Ran Phase 6C.6 Data Preservation Guard (100% pre-existing records preserved, 0 deletions) and the 37-suite Master Regression Suite (454 assertions, 0 failed, 0 skipped, 0 critical blockers, 0 tenant leaks, 0 browser runtime errors).

---

## Canonical 18-Point Final Acceptance Matrix

| # | Acceptance Criterion | Contract / Requirement | Executable Test Suite | Executed Assertion & Observed Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Exact 256-bit entropy | 32 CSPRNG random bytes (`gen_random_bytes(32)`) | `scratch/test_phase6d_tokens.js` | Decoded 32 random bytes (64 hex chars); 1,000 unique raw tokens & hashes generated with 0 collisions | **PASS** |
| **2** | Plaintext token in DB = 0 | Zero raw tokens in database tables | `scratch/test_phase6d_leakage_evidence.js` | Check 1: Audited `client_action_tokens`, `tasks`, `task_submissions`, `automation_execution_events`, `notifications`; found: `0` | **PASS** |
| **3** | Plaintext token in logs = 0 | Zero raw tokens in error logs or event execution logs | `scratch/test_phase6d_leakage_evidence.js` | Check 2: Audited `automation_execution_events.error_summary` and actions; found: `0` | **PASS** |
| **4** | Plaintext token in DOM/reload lifecycle = 0 | Discarded on modal dismiss and absent on reload | `scratch/test_phase6d_leakage_evidence.js` | Check 4 & 5: Transient state cleared to `undefined`; page reload queries return safe projection only | **PASS** |
| **5** | Client direct token-table access | Direct SELECT, INSERT, UPDATE, DELETE denied | `scratch/test_phase6d_rls_tokens.js` | SELECT returned 0 rows; INSERT blocked by RLS policy; UPDATE affected 0 rows; DELETE affected 0 rows | **DENY** |
| **6** | Anonymous token-table access | Direct SELECT denied | `scratch/test_phase6d_rls_tokens.js` | Anonymous direct SELECT returned 0 rows | **DENY** |
| **7** | Specialist token management | Direct SELECT and token RPCs denied | `scratch/test_phase6d_rls_tokens.js` | SELECT returned 0 rows; `generate`, `revoke`, `regenerate` RPCs thrown `Access denied` | **DENY** |
| **8** | Same-org Client A → Client B submission access | Client A cannot read Client B's submissions in same org | `scratch/test_phase6d_client_isolation.js` | Client A sees only 1 assigned submission; query on Task B submission returned 0 rows | **DENY** |
| **9** | Foreign tenant access | Foreign client in Org Gamma sees zero rows | `scratch/test_phase6d_client_isolation.js` | Foreign client query returned 0 rows across all `task_submissions` | **DENY** |
| **10** | Generate vs Generate concurrency | Concurrency safe; exactly 1 active token per task | `scratch/test_phase6d_concurrency.js` | Concurrent generate resolved with partial unique index; active token count = `1` | **PASS** |
| **11** | Public vs Public submit | Exactly 1 winner in parallel race | `scratch/test_phase6d_exact_once_side_effects.js` | Scenario A: 1 fulfilled, 1 rejected; `task_submissions` count = `1` | **PASS** |
| **12** | Public vs Auth submit | Exactly 1 winner in cross-channel race | `scratch/test_phase6d_exact_once_side_effects.js` | Scenario B: 1 fulfilled, 1 rejected; `task_submissions` count = `1` | **PASS** |
| **13** | Duplicate automation executions = 0 | `evaluate_automation_rules` runs exactly once | `scratch/test_phase6d_exact_once_side_effects.js` | Scenario A: executions = `1`, Scenario B: executions = `1`; duplicate executions = `0` | **PASS** |
| **14** | Duplicate downstream tasks = 0 | Followup task created exactly once | `scratch/test_phase6d_exact_once_side_effects.js` | Scenario A: followup task = `1`, Scenario B: followup task = `1`; duplicate tasks = `0` | **PASS** |
| **15** | Duplicate notifications = 0 | Task completion notification created exactly once | `scratch/test_phase6d_exact_once_side_effects.js` | Scenario A: owner count = `1`, Scenario B: owner count = `1`; duplicate notifications = `0` | **PASS** |
| **16** | Atomic rollback partial records = 0 | Injected failure cleanly aborts transaction | `scratch/test_phase6d_rollback.js` | `task_submissions` = 0, task status remains 'todo', token status remains 'active', events = 0, notifications = 0, orphan rows = 0 | **PASS** |
| **17** | Unauthorized user-data deletions = 0 | Pre-existing user data completely intact | `scratch/test_phase6c_data_preservation_guard.js` | Sentinel record intact with identical UUID, created_at, name, trigger_event, conditions, actions; deletions = 0 | **PASS** |
| **18** | Canonical Regression | 100% PASS across full suite | `scratch/run_canonical_regression.js` | 37 suites executed, 454 assertions passed, 0 failed, 0 skipped | **PASS** |
