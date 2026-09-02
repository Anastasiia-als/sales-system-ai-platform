# Walkthrough: Phase 6D.1.1 — Final Security & Evidence Gap Closure

## Overview
Phase 6D.1.1 has resolved all security, cryptographic, and data isolation requirements for Phase 6D.1:
1. **Strict 256-Bit Entropy Contract**: Random component generated strictly with `gen_random_bytes(32)` (32 bytes = 256 bits CSPRNG entropy).
2. **Direct Token Table Default Deny**: `client_action_tokens` is inaccessible via direct SELECT/INSERT/UPDATE/DELETE to Authenticated Clients, Specialists, and Anonymous callers. Specialist RPC access is denied.
3. **Client-to-Client Same-Org Isolation**: Client A and Client B inside the same organization cannot query or view each other's submissions unless assigned to them.
4. **Zero Raw Token Leakage**: Zero raw tokens stored in DB, zero in application logs, zero in error messages, zero in submission payloads, and zero in notification telemetry.
5. **Exact-Once Side Effects**: Full concurrent race tests with active Phase 6C rules proved exactly 1 submission created, exactly 1 task marked done, exactly 1 rule execution event, exactly 1 downstream followup task (zero duplicates), and 0 active tokens remaining.
6. **Clean Transaction Rollback Invariant**: Injected failure after submission insertion proved complete clean rollback with 0 partial rows and subsequent normal submission capability.
7. **Canonical Regression**: All 36 test suites (432 assertions) passed with 100% data preservation and 0 deletions.

---

## Final Acceptance Matrix

| # | Acceptance Metric | Contract / Invariant Target | Executable Test Proof | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Token Randomness Source | `gen_random_bytes(32)` (32 CSPRNG bytes = 256 bits entropy) | `test_phase6d_tokens.js` (decoded 32 random bytes) | **PASS** |
| **2** | Token Random Uniqueness Audit | 1,000 unique raw tokens & 1,000 unique SHA-256 hashes generated | `test_phase6d_tokens.js` (1,000-token SQL loop audit) | **PASS** |
| **3** | Zero Plaintext Token Storage | 0 plaintext tokens in database; SHA-256 hash storage only | `test_phase6d_tokens.js` | **PASS** |
| **4** | Safe Token Lookup Projection | Zero raw tokens returned on lookup; strict allowlist only | `test_phase6d_tokens.js`, `test_phase6d_data_minimization.js` | **PASS** |
| **5** | Authenticated Client Direct Token Table Access | `SELECT`, `INSERT`, `UPDATE`, `DELETE` strictly DENIED by RLS | `test_phase6d_rls_tokens.js` | **PASS** |
| **6** | Anonymous Direct Token Table Access | Direct `SELECT` strictly DENIED by RLS | `test_phase6d_rls_tokens.js` | **PASS** |
| **7** | Specialist Direct Token Table Access & RPCs | Direct `SELECT` DENIED; `generate`, `revoke`, `regenerate` RPCs throw `Access denied` | `test_phase6d_rls_tokens.js` | **PASS** |
| **8** | Client-to-Client Same-Org Isolation | Client A cannot read Client B's submissions in same org; direct query returns 0 rows | `test_phase6d_client_isolation.js` | **PASS** |
| **9** | Cross-Tenant Submission Default Deny | Foreign client in Org Gamma cannot query or read any Org Alpha submissions (0 rows) | `test_phase6d_client_isolation.js` | **PASS** |
| **10** | Server-Derived Tenant Guard | `organization_id` derived from parent task; client-supplied tenant mismatch rejected | `test_phase6d_tenant_invariant.js` | **PASS** |
| **11** | Zero Raw Token In Leakage Vectors | Zero raw tokens in DB, logs, error messages, payloads, and notifications | `test_phase6d_data_minimization.js`, `test_phase6d_tokens.js` | **PASS** |
| **12** | Concurrent Public Race Exact-Once | `Promise.all([public, public])` results in 1 success, 1 rejection, 1 submission record | `test_phase6d_exact_once_side_effects.js` | **PASS** |
| **13** | Cross-Channel Race Exact-Once | `Promise.all([public, auth])` results in 1 success, 1 rejection, 1 submission record | `test_phase6d_exact_once_side_effects.js` | **PASS** |
| **14** | Exact-Once Automation Rule Execution | `evaluate_automation_rules` executes exactly once per submission | `test_phase6d_exact_once_side_effects.js` | **PASS** |
| **15** | Downstream Automation Task Creation | Exactly 1 followup task created; 0 duplicate tasks | `test_phase6d_exact_once_side_effects.js` | **PASS** |
| **16** | Active Token Invalidation | Active tokens after submission = 0 | `test_phase6d_exact_once_side_effects.js`, `test_phase6d_lifecycle.js` | **PASS** |
| **17** | Transaction Rollback Cleanliness | Injected failure cleanly aborts; 0 partial rows, task remains `todo`, tokens active | `test_phase6d_rollback.js` | **PASS** |
| **18** | Canonical Regression & Data Preservation | 36 suites, 432 assertions passed; 0 pre-existing rules deleted; 0 leaked fixtures | `run_canonical_regression.js` | **PASS** |
