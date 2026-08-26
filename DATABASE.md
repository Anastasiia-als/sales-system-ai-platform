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
