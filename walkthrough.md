# Walkthrough: Phase 6D.3 — PM Management UI & Magic Link Lifecycle

> [!NOTE]
> **Status**: **ACCEPTED / CLOSED** (Manual Acceptance Passed on 2026-09-03).
> All contract requirements, RBAC matrices, token lifecycles, cross-channel submission reviews, reopen semantics, server resilience, and Chromium browser verifications are 100% verified.

---

## Overview

Phase 6D.3 delivers the PM management interface for Client Actions and Magic Links directly integrated into existing surfaces (**Project Passport**, **Tasks & Client Actions View**, and the existing **Task Modal**) without creating any parallel task managers or duplicate surfaces.

It implements the full lifecycle:
- Token generation with 256-bit CSPRNG entropy (`fwa_` + 32 bytes)
- Exact one-time raw-token reveal with instant transient memory wiping
- Server-derived PM authorization matrix (Owner, Org Admin, Responsible PM, Project PM Member)
- Canonical order-of-precedence status resolution
- Multi-iteration submission review with XSS sanitization and short-lived signed download URLs
- Strict Reopen semantics: `Виконано → Reopen → Не згенеровано → Generate → Активне` with 100% preservation of historic submissions

---

## Key Deliverables & Implemented Architecture

### 1. Database Architecture & RPC Layer
- **Migration**: [`supabase/migrations/20260903000027_phase6d3_pm_management_and_lifecycle.sql`](file:///d:/AI%20ALL/FIRSTWIN/supabase/migrations/20260903000027_phase6d3_pm_management_and_lifecycle.sql).
- **`public._is_authorized_pm_for_task(UUID)`**:
  - Global Owner (`profiles.global_role = 'owner'`) -> **ALLOW**
  - Org Admin / Org PM (`organization_memberships.org_role IN ('admin', 'pm', 'owner')`) -> **ALLOW**
  - Responsible PM (`projects.responsible_pm_id = auth.uid()`) -> **ALLOW**
  - Project PM Member (`project_memberships.project_role = 'pm'`) -> **ALLOW**
  - Ordinary project member (`'member'`, `'specialist'`, `'viewer'`) -> strictly **DENIED**
  - Unrelated PM in same org -> strictly **DENIED**
  - Specialists / Clients / Foreign tenants -> strictly **DENIED**
- **`public.generate_action_token(UUID)`**:
  - 256-bit CSPRNG token (`fwa_` + 32 random bytes = 64 hex characters)
  - Raw token returned exactly once; DB stores exclusively SHA-256 hash (`encode(digest(...), 'hex')`)
  - 14-day validity (`expires_at = NOW() + interval '14 days'`)
  - Atomic revocation of any prior active unused tokens for the task
- **`public.revoke_action_token(UUID, UUID)`**:
  - Atomically marks active token as `status = 'revoked'`, `revoked_at = NOW()`
- **`public.regenerate_action_token(UUID)`**:
  - Atomically revokes existing active token and issues fresh 14-day token
- **`public.reopen_client_action(UUID)`**:
  - Resets task `status = 'todo'` and `completed_at = NULL`
  - 100% preserves historic `task_submissions`
  - Historic used/revoked tokens remain permanently dead
- **`public.get_client_action_token_status(UUID)`**:
  - Canonical order of precedence:
    1. `task.status = 'done'` + submission exists -> **`done` («Виконано»)**
    2. New or reopened task with no active token -> **`none` («Не згенеровано»)**
    3. Active token + `expires_at > NOW()` -> **`active` («Активне»)**
    4. Active token + `expires_at <= NOW()` -> **`expired` («Прострочено»)**
    5. Token revoked without reopen -> **`revoked` («Відкликано»)**
- **`public.get_task_submissions(UUID)`**:
  - Securely joins `task_submissions` with `contacts` and `profiles`
  - Returns complete iteration history, channel attribution (`public_link` vs `authenticated_portal`), payloads, and attachment arrays
- **`public.prevent_task_unauthorized_modifications()`**:
  - Trigger updated to recognize project-scoped PMs (`responsible_pm_id` or `project_memberships.project_role = 'pm'`)

### 2. Frontend Integration in Existing Surfaces
- **No Duplicate Task Surfaces**: Integrated directly into [`js/portal/ui/portal-project-tasks-view.js`](file:///d:/AI%20ALL/FIRSTWIN/js/portal/ui/portal-project-tasks-view.js) via `#client-action-management-container` inside the existing Task Modal.
- **Client Action Status Badge**:
  - Dynamic badge rendered with canonical styling and Ukrainian labels:
    - `none`: `Не згенеровано` (Neutral grey)
    - `active`: `Активне` (Emerald green)
    - `expired`: `Прострочено` (Amber warning)
    - `revoked`: `Відкликано` (Red danger)
    - `done`: `Виконано` (Blue primary)
- **One-Time Raw-Token Reveal Modal (`#modal-one-time-reveal`)**:
  - Displays full magic link URL (`https://<origin>/index.html#/action/fwa_<token>`)
  - Copy to clipboard button with inline feedback
  - Security warning notice: link cannot be viewed again once dismissed
  - Immediate memory wiping (`transientToken = null`) and DOM deletion upon Close, Esc, backdrop click, or route change
  - Strict zero-persistence invariant: 0 stored in `localStorage`, `sessionStorage`, `cookies`, or DOM `data-*` attributes
- **Submission Review Component**:
  - Chronological iteration cards displaying:
    - Submission iteration index (#1, #2, ...)
    - Channel source badge (`Публічне посилання` vs `Клієнтський портал`)
    - Submitter name/email (or anonymous indicator) and formatted timestamp
    - XSS-escaped client text response
    - Attachment list with file size formatting and secure short-lived Signed URL download buttons (`DataClient.getClientActionAttachmentUrl`)
- **Action Toolbar & Confirmations**:
  - «Згенерувати Magic Link»
  - «Перевипустити посилання» (with confirmation)
  - «Відкликати посилання» (with confirmation)
  - «Повернути в роботу (Reopen)» (with confirmation)

---

## Test Execution Matrix (Tests A–T)

All tests passed with 100% assertions:

| Test Group | Description | Assertions | Result |
| :--- | :--- | :--- | :--- |
| **Tests A–D** | Authorized PM RBAC: Global Owner, Org Admin, Responsible PM, Project PM Member | 24 | **PASS** |
| **Tests E–H** | Denied Roles RBAC: Unrelated PM, Ordinary Member, Specialist, Client, Foreign Tenant | 20 | **PASS** |
| **Test I** | Initial State Precedence: `status = 'none'`, `is_completed = false` | 2 | **PASS** |
| **Test J** | Generation & Concurrency Lock: 256-bit CSPRNG, single active token guarantee | 9 | **PASS** |
| **Test K** | Revocation Lifecycle: explicit revoke, reactive transition to `revoked` | 3 | **PASS** |
| **Test L** | Expiry Lifecycle: past timestamp evaluated deterministically as `expired` | 2 | **PASS** |
| **Test M** | Regenerate: replaces expired/revoked with fresh 14-day active token | 4 | **PASS** |
| **Test N** | Public Link Submission: task completed, `public_link` channel attributed | 5 | **PASS** |
| **Test O** | Authenticated Portal Submission: task completed, `authenticated_portal` attributed | 4 | **PASS** |
| **Test P** | PM Submissions Review Retrieval: complete history metadata & contact attribution | 6 | **PASS** |
| **Test Q** | Reopen Action: resets `todo` & `completed_at = NULL`, 0 submission deletions, status strictly `none` | 14 | **PASS** |
| **Test R** | Submissions Audit & Lifecycle Continuation: multi-iteration preservation (#1 and #2) | 8 | **PASS** |
| **Test S** | Security Review: 0 plaintext tokens in DB, XSS escaping, signed storage URLs | 14 | **PASS** |
| **Test T** | Real Chromium E2E: Desktop (1920×1080) & Mobile (375×812) full lifecycle | 25 | **PASS** |

---

## Master Regression & Data Preservation Guard

- **Permanent Data Preservation Guard**: **100% PASS** (0 deletions, 0 unauthorized modifications, 0 leaked fixtures).
- **Master Canonical Regression (`scratch/run_canonical_regression.js`)**:
  - **Total Suites**: **48 suites**
  - **Executed Assertions**: **921 assertions**
  - **Passed Assertions**: **921 passed**
  - **Failed Suites**: **0 failed**
  - **Skipped Required**: **0 skipped**

---

## Acceptance Gate Checklist

- [x] Scope lock strictly adhered to (zero duplicate task managers or parallel UI surfaces).
- [x] Database migration applied and verified (`supabase/migrations/20260903000027_phase6d3_pm_management_and_lifecycle.sql`).
- [x] Server-derived PM authorization enforced across all 8 roles.
- [x] Reopen canonical lifecycle verified: `Виконано → Reopen → Не згенеровано → Generate → Активне`.
- [x] Zero raw-token leakage confirmed in DB, logs, localStorage, sessionStorage, cookies, and DOM.
- [x] Real Chromium browser verification executed on Desktop (1920×1080) and Mobile (375×812).
- [x] 48-suite regression passing with 921/921 assertions.
- [x] Data Preservation Guard passing with 100% survival.
- [x] Standing at Manual Acceptance Gate and STOPPED.
