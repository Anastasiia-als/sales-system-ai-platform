# Architecture Decision Records (ADR)

## ADR-005: Phase 5C.2 — Invoicing, Billing Engine & Accounts Receivable

### Context
In Phase 5C.1 / 5C.1.1, FIRSTWIN established project commercial terms, payment schedules, and cash tracking. To operationalize payment collection into a full delivery cycle (`Commercial Terms -> Schedule -> Invoice -> Client Request -> Payment -> AR -> Paid`), we require canonical billing, invoice numbering, immutable document snapshots, client payment requests, and accounts receivable tracking.

### Decisions

#### 1. Integer Minor Monetary Units
- All monetary amounts across invoices, items, and payments are strictly stored and computed as integer minor units (`amount_minor`, `total_minor`, `paid_minor`, `outstanding_minor`) in `BIGINT`.
- Floating-point calculations for fiat money are prohibited.

#### 2. Concurrency-Safe Sequential Numbering (`FW-YYYY-NNNNNN`)
- Draft invoices do not consume sequence numbers (`invoice_number` is `NULL`).
- Upon calling `issue_invoice(invoice_id)`, an atomic row-lock sequence increment is performed in table `invoice_sequences` for the current calendar year.
- Assigned format: `FW-2026-000001`. A unique constraint enforces uniqueness.

#### 3. Immutable Invoice Snapshots
- Upon issuance, `seller_snapshot`, `buyer_snapshot`, and `items_snapshot` are permanently frozen into `JSONB` columns on the `invoices` row.
- Future changes to company addresses, client names, or legal entities do not alter historical invoices.
- Database trigger `enforce_invoice_immutability()` prohibits modifications to line items or invoice financials once the status transitions from `draft`.

#### 4. Anti-Overpayment Guard
- Database trigger `handle_payment_mutation` computes `paid_minor + new_payment` against `total_minor`. If the payment amount exceeds the invoice outstanding balance, the transaction is rejected with error `23514`.

#### 5. Strict Currency Isolation for AR & Aging Buckets
- Multi-currency aggregations are isolated into separate currency cards (`CZK`, `EUR`, `UAH`).
- Receivables are classified into 6 aging buckets (`Not Due`, `1–7d`, `8–30d`, `31–60d`, `61–90d`, `90+d`) without cross-currency summing.

#### 6. Client Payment Request Widget vs. Tasks Separation
- Client payment requests are rendered as a dedicated **«Очікується оплата»** card on the client dashboard (`#/client/dashboard`) and listed in `#/client/billing`.
- Payment requests are not duplicated into the delivery `tasks` table.

### Consequences
- Reliable, audit-compliant financial and invoicing workflows.
- Zero risk of floating-point calculation errors or broken historical invoice data.
- Clear separation between delivery tasks and billing/payment requests.

---

## ADR-006: Phase 5D — Analytics, Reporting & Executive Insights Architecture

### Context
To support executive oversight without manual spreadsheet aggregation, FIRSTWIN required an integrated analytics and management reporting module (`#/portal/analytics` and `#/portal/reports`).

### Decisions

#### 1. Single-Pass High Performance RPC (`get_portfolio_analytics_data`)
- Instead of dozens of independent client queries, a single database RPC calculates executive KPIs, lifecycle funnel counts, deterministic performance rates, multi-currency financials, team workload, and period trend deltas in one unified query.

#### 2. Deterministic KPI Formulas (Canonical Semantic Model & Strict Nulls)
- **Global Null Policy**: Absence of required denominator/sample strictly returns `NULL` in the database RPC/API and is rendered as `«—»` or `«Недостатньо даних»` in the UI and blank cells in exports. Missing samples are NEVER converted into misleading `0%`, `100%`, `NaN`, or `Infinity`.
- **Milestone Completion Rate**: `(completed_milestones / total_milestones) * 100` (`NULL` if total milestones = 0)
- **Tasks Completion Rate**: `(completed_tasks / total_tasks) * 100` (`NULL` if total tasks = 0)
- **Overdue Task Rate**: `(overdue_tasks / open_tasks) * 100` (`NULL` if open tasks = 0)
  *Semantic clarification: `open_tasks` is defined as `status != 'done'`. Since `overdue_tasks` is `status != 'done' AND due_date < CURRENT_DATE`, it is a strict subset of `open_tasks`.*
- **Client Action Completion Rate**: `(completed_client_actions / total_client_actions) * 100` (`NULL` if total actions = 0)
- **On-Time Delivery Rate**: `(on_time_completed_projects / total_completed_projects) * 100` (`NULL` if total completed projects = 0)
- **Project Completion Rate**: `(completed_projects / total_projects) * 100` (`NULL` if total projects = 0)
- **Average Completion Delay (days)**: `AVG(GREATEST(completed_at - target_date, 0))` for projects with `status = 'completed' AND target_date IS NOT NULL` (`NULL` if no valid completed projects)
- **Forecast Margin %**: `((Contract Value - Planned Costs) / Contract Value) * 100` (`NULL` if Contract Value <= 0)

#### 3. Strict Role-Based Scope Enforced in Database Engine
- Owner: platform-wide access.
- PM: scoped strictly to authorized organizations (`organization_id = ANY(v_allowed_org_ids)`).
- Specialist: denied access (42501 Access Denied).
- Client: denied access (42501 Access Denied).

#### 4. Personal Saved Views (`public.analytics_saved_views`)
- Filters presets are stored per-user (`user_id = auth.uid()`) with strict RLS isolation preventing unauthorized viewing or modification.

#### 5. True Binary OOXML XLSX Export with Typed Dates & Multi-Format Reporting
- Produces valid Microsoft Excel `.xlsx` / Open Packaging Convention ZIP workbooks containing 5 structured sheets:
  1. `Summary`
  2. `Projects`
  3. `Tasks`
  4. `Client Actions`
  5. `Finance`
- Preserves native numeric types (`t: 'n'`), native Excel Date types (`t: 'd'` with number format `yyyy-mm-dd`), and strict currency separation (UAH, CZK, EUR).
- Reports Center (`#/portal/reports`) generates 7 canonical reports: `Portfolio Summary`, `Client Report`, `Project Status Report`, `Delivery Performance`, `Finance Summary`, `Accounts Receivable`, and `PM Workload Report`.

