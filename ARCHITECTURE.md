# FIRSTWIN Architecture & Technical Design

## 1. System Overview
FIRSTWIN is an end-to-end Client & Project Delivery Platform with integrated Multi-Currency Financial Management, Invoicing, and Accounts Receivable.

The platform is structured into two main workspaces:
- **Internal Portal (`#/portal`)**: Used by Owners, Project Managers, and Specialists to oversee delivery pipelines, project finances, billing profiles, invoices, and receivables.
- **Client Workspace (`#/client`)**: Used by external client users to monitor project progress, act on pending client actions, view issued invoices, copy payment credentials, and access shared project documents.

---

## 2. Multi-Currency Financial Architecture

### 2.1 Integer Minor Units
- All monetary amounts are stored in **integer minor units** (e.g., cents, groszy, kopecks, hellers) as `BIGINT` in the database (`amount_minor`, `total_minor`, `paid_minor`, `outstanding_minor`).
- Floating-point arithmetic is strictly prohibited for monetary calculations across database triggers, RPCs, and JavaScript frontends.
- Minor units format mapping: `100 units = 1.00 standard fiat currency`.

### 2.2 Strict Multi-Currency Isolation
- Supported ISO currencies: `CZK` (Czech Koruna), `EUR` (Euro), `UAH` (Ukrainian Hryvnia), `USD`, `PLN`.
- Automatic cross-currency summing or conversions are prohibited. Aggregations, KPIs, and aging buckets are grouped strictly per currency.

---

## 3. Invoicing & Billing Engine (Phase 5C.2)

### 3.1 Core Workflow
$$\text{Commercial Terms} \longrightarrow \text{Payment Schedule} \longrightarrow \text{Invoice Draft} \longrightarrow \text{Issue (Snapshot \& Number)} \longrightarrow \text{Sent/Viewed} \longrightarrow \text{Payment} \longrightarrow \text{Paid}$$

### 3.2 Key Components
1. **Billing Profiles (`billing_profiles`)**: Stores seller entity data (legal name, company ID, VAT, bank name, account, IBAN, SWIFT, payment instructions).
2. **Sequential Numbering (`invoice_sequences`)**: Concurrency-safe atomic generation formatted as `FW-YYYY-NNNNNN`. Numbers are assigned only upon issuing an invoice (`draft` status does not consume sequence numbers).
3. **Immutable Snapshots**:
   - `seller_snapshot` (JSONB): Issuer details at the moment of issuance.
   - `buyer_snapshot` (JSONB): Organization and contact details.
   - `items_snapshot` (JSONB): Line items, unit prices, quantities, taxes, and totals.
   - Historical invoices render from immutable snapshots to ensure that future changes to client names or bank details never alter issued documents.
4. **Anti-Overpayment Guard**:
   - Database trigger checks incoming payments against `outstanding_minor`.
   - Any payment exceeding the invoice balance due is rejected with an exception (`23514`).
5. **Accounts Receivable (AR) & Aging Buckets**:
   - Computes receivables across 6 aging tiers:
     - `Not Due`: `due_date >= CURRENT_DATE`
     - `1–7 days overdue`
     - `8–30 days overdue`
     - `31–60 days overdue`
     - `61–90 days overdue`
     - `90+ days overdue`
6. **Append-Only Audit Log (`invoice_audit_events`)**:
   - Immutable audit trail capturing creation, issuance, status changes, and payments.
   - Direct `UPDATE` is strictly prohibited by database triggers.
