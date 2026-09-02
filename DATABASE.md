# FIRSTWIN Database Schema Reference

## Invoicing & Billing Tables (Phase 5C.2)

### 1. `public.billing_profiles`
Stores legal billing entities for issuing invoices.
- `id` (UUID PK)
- `name` (TEXT)
- `legal_name` (TEXT NOT NULL)
- `country` (TEXT NOT NULL)
- `registration_number` (TEXT)
- `tax_id` (TEXT)
- `vat_number` (TEXT)
- `legal_address` (TEXT NOT NULL)
- `billing_email` (TEXT)
- `phone` (TEXT)
- `bank_name` (TEXT NOT NULL)
- `bank_account` (TEXT NOT NULL)
- `iban` (TEXT NOT NULL)
- `swift` (TEXT NOT NULL)
- `default_currency` (TEXT NOT NULL DEFAULT 'CZK')
- `payment_instructions` (TEXT)
- `is_active` (BOOLEAN NOT NULL DEFAULT TRUE)

### 2. `public.invoice_sequences`
Atomic sequence counter for concurrency-safe numbering.
- `year` (INTEGER PRIMARY KEY)
- `current_val` (BIGINT NOT NULL DEFAULT 0)
- `updated_at` (TIMESTAMPTZ)

### 3. `public.invoices`
Canonical invoice records.
- `id` (UUID PK)
- `invoice_number` (TEXT UNIQUE)
- `organization_id` (UUID FK -> organizations)
- `project_id` (UUID FK -> projects)
- `billing_profile_id` (UUID FK -> billing_profiles)
- `payment_schedule_id` (UUID FK -> project_payment_schedule)
- `commercial_terms_id` (UUID FK -> project_commercial_terms)
- `currency` (TEXT CHECK CZK/EUR/UAH/USD/PLN)
- `status` (TEXT CHECK draft/issued/sent/viewed/partially_paid/paid/overdue/cancelled)
- `issue_date` (DATE NOT NULL)
- `due_date` (DATE NOT NULL)
- `subtotal_minor` (BIGINT NOT NULL DEFAULT 0)
- `tax_minor` (BIGINT NOT NULL DEFAULT 0)
- `total_minor` (BIGINT NOT NULL DEFAULT 0)
- `paid_minor` (BIGINT NOT NULL DEFAULT 0)
- `outstanding_minor` (BIGINT NOT NULL DEFAULT 0)
- `seller_snapshot` (JSONB)
- `buyer_snapshot` (JSONB)
- `items_snapshot` (JSONB)
- `sent_at`, `viewed_at`, `paid_at`, `cancelled_at` (TIMESTAMPTZ)
- `created_by` (UUID FK -> auth.users)

### 4. `public.invoice_items`
Line items belonging to an invoice.
- `id` (UUID PK)
- `invoice_id` (UUID FK -> invoices)
- `description` (TEXT NOT NULL)
- `quantity` (NUMERIC NOT NULL DEFAULT 1)
- `unit_price_minor` (BIGINT NOT NULL)
- `tax_rate` (NUMERIC NOT NULL DEFAULT 0)
- `subtotal_minor` (BIGINT NOT NULL)
- `tax_minor` (BIGINT NOT NULL DEFAULT 0)
- `total_minor` (BIGINT NOT NULL)
- `sort_order` (INTEGER NOT NULL DEFAULT 1)

### 5. `public.project_payments` (Extended)
- `invoice_id` (UUID FK -> invoices ON DELETE SET NULL)
- Trigger `handle_payment_mutation` updates `paid_minor`, `outstanding_minor`, `status`, and enforces the anti-overpayment guard.

### 6. `public.invoice_audit_events`
Strictly append-only audit trail.
- `id` (UUID PK)
- `organization_id` (UUID FK)
- `project_id` (UUID FK)
- `invoice_id` (UUID FK)
- `action` (TEXT NOT NULL)
- `actor_user_id` (UUID)
- `old_values` (JSONB)
- `new_values` (JSONB)
- `metadata` (JSONB)
- `created_at` (TIMESTAMPTZ)

---

## Analytics & Reporting Schema (Phase 5D)

### 7. `public.analytics_saved_views`
Stores user-specific filter presets for Analytics and Reports.
- `id` (UUID PK)
- `user_id` (UUID FK -> auth.users NOT NULL DEFAULT auth.uid())
- `name` (TEXT NOT NULL)
- `view_type` (TEXT CHECK analytics/reports/projects NOT NULL DEFAULT 'analytics')
- `filters` (JSONB NOT NULL DEFAULT '{}')
- `is_default` (BOOLEAN NOT NULL DEFAULT FALSE)
- `created_at`, `updated_at` (TIMESTAMPTZ)
- **RLS**: Strict personal ownership (`auth.uid() = user_id`).

### 8. RPC Functions
- `public.get_portfolio_analytics_data(p_period_type, p_start_date, p_end_date, p_org_id, p_project_id, p_pm_id)`:
  Unified high-performance analytics payload with executive KPIs, delivery funnel, delivery rates, client analytics, team workload, isolated multi-currency summaries, 6 AR aging buckets, and period trend deltas.
- `public.get_reports_data(p_report_type, p_period_type, p_start_date, p_end_date, p_org_id, p_project_id, p_pm_id, p_currency, p_status)`:
  Predefined report payload generator for Portfolio Summary, Project Status, AR Aging, and Delivery Performance.

---

## Workflow Engine & Automations (Phase 6C)

### 9. `public.automation_rules`
Defines project-scoped event-driven automated workflows.
- `id` (UUID PK)
- `organization_id` (UUID FK -> organizations)
- `project_id` (UUID FK -> projects)
- `name` (TEXT NOT NULL)
- `event_type` (TEXT NOT NULL CHECK stage_transition/document_approved/client_action_completed/sla_breached)
- `conditions` (JSONB NOT NULL DEFAULT '{}')
- `actions` (JSONB NOT NULL DEFAULT '[]')
- `is_active` (BOOLEAN NOT NULL DEFAULT TRUE)

### 10. `public.automation_execution_events`
Append-only execution telemetry for automation workflows.
- `id` (UUID PK)
- `rule_id` (UUID FK -> automation_rules)
- `event_type` (TEXT NOT NULL)
- `status` (TEXT NOT NULL CHECK success/failed/skipped)
- `context_snapshot` (JSONB)
- `executed_actions` (JSONB)
- `created_at` (TIMESTAMPTZ)

---

## Client Action Portal & Public Submissions (Phase 6D)

### 11. `public.client_action_tokens`
Cryptographically secure action tokens with SHA-256 hash-only storage.
- `id` (UUID PK)
- `organization_id` (UUID NOT NULL FK -> organizations)
- `task_id` (UUID NOT NULL FK -> tasks)
- `token_hash` (VARCHAR(64) NOT NULL UNIQUE)
- `status` (TEXT NOT NULL DEFAULT 'active' CHECK active/revoked/used)
- `expires_at` (TIMESTAMPTZ NOT NULL)
- `used_at` (TIMESTAMPTZ NULL)
- `revoked_at` (TIMESTAMPTZ NULL)
- `created_by` (UUID FK -> auth.users)
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- **Indexes**:
  - `uq_client_action_single_active_token` UNIQUE ON `(task_id) WHERE (status = 'active' AND used_at IS NULL)`
  - `idx_client_action_tokens_hash` ON `token_hash`
  - `idx_client_action_tokens_task_id` ON `task_id`
- **Triggers**: `trg_client_action_tokens_tenant_guard` enforces `organization_id = tasks.organization_id`.

### 12. `public.task_submissions`
Permanent, append-only client action submissions from public links and authenticated portal.
- `id` (UUID PK)
- `organization_id` (UUID NOT NULL FK -> organizations)
- `task_id` (UUID NOT NULL FK -> tasks)
- `token_id` (UUID NULL UNIQUE FK -> client_action_tokens)
- `submitted_by_contact_id` (UUID NULL FK -> contacts)
- `submitted_by_user_id` (UUID NULL FK -> auth.users)
- `submission_type` (TEXT NOT NULL CHECK public_link/authenticated_portal)
- `payload` (JSONB NOT NULL DEFAULT '{}')
- `attachments` (JSONB NOT NULL DEFAULT '[]')
- `created_at` (TIMESTAMPTZ NOT NULL DEFAULT NOW())
- **Indexes**: `idx_task_submissions_task_id` ON `task_id`
- **Triggers**: `trg_task_submissions_tenant_guard` enforces `organization_id = tasks.organization_id`.

### 13. Phase 6D Core RPCs
- `generate_action_token(p_task_id)`: Generates 256-bit raw token, stores SHA-256 hash only, revokes prior active tokens, returns raw URL once.
- `revoke_action_token(p_task_id, p_token_id)`: Atomically sets token status to 'revoked'.
- `regenerate_action_token(p_task_id)`: Revokes existing token and generates a new one.
- `get_public_client_action(p_raw_token)`: Hashes raw token, returns safe projection with zero internal leakages and differentiated privacy status (`active`, `expired`, `revoked`, `already_used`, `not_found`).
- `submit_public_client_action(p_raw_token, p_payload)`: Validates token and invokes atomic submission core.
- `submit_authenticated_client_action(p_task_id, p_payload)`: Validates client user permissions and invokes atomic submission core.
- `_execute_client_action_submission_core(...)`: Shared internal core; row locks task FOR UPDATE; marks task done; invalidates active tokens; creates submission record; fires automation engine exactly once.
- `reopen_client_action(p_task_id)`: Resets task to todo without resurrecting old tokens.
