# FIRSTWIN Permissions & Row-Level Security (RLS)

## Role-Based Access Control Matrix

| Role | Billing Profiles | Invoices (Drafts) | Invoices (Issued) | Record Payments | Cancel Invoices | Audit Log | Analytics & Reports | Saved Views |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Owner** | Full CRUD | Full CRUD | Full Read / Manage | Full Insert/Edit | Full Access | Full Read (No Mutations) | Global Platform | Personal CRUD |
| **Project Manager (PM)** | Read Active | Create/Edit Scoped | Read Scoped | Record Scoped | Scoped Access | Read Scoped | Scoped Org/Projects | Personal CRUD |
| **Specialist** | Denied | Denied | Denied | Denied | Denied | Denied | Denied | Denied |
| **Client** | Denied | Denied | Read Own Issued | Denied | Denied | Denied | Denied | Denied |

---

## Security Policies
1. **Draft Invoices Isolation**: Client users cannot view draft invoices under any circumstances (`status != 'draft'`).
2. **Internal Cost & Margin Protection**: Client workspace never receives or renders internal costs, margins, or private notes.
3. **Audit Log Protection**: Direct `UPDATE` or unauthorized `DELETE` operations on `invoice_audit_events` are strictly rejected by the `block_invoice_audit_mutation()` trigger.
4. **Anti-Overpayment Guard**: Trigger `handle_payment_mutation` prevents payment insertions exceeding the invoice outstanding balance.
5. **Analytics & Reports Access Guard**: Executive analytics and report generators are restricted to `Owner` and `PM`. Specialists and Clients receive 42501 Access Denied. PM scope is constrained to permitted organization IDs.
6. **Saved Views Personal Isolation**: Policies on `analytics_saved_views` enforce `auth.uid() = user_id` for SELECT, INSERT, UPDATE, and DELETE.
