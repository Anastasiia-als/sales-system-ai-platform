# FIRSTWIN Permissions & Row-Level Security (RLS)

## Role-Based Access Control Matrix

| Role | Billing Profiles | Invoices (Drafts) | Invoices (Issued) | Record Payments | Cancel Invoices | Audit Log |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Owner** | Full CRUD | Full CRUD | Full Read / Manage | Full Insert/Edit | Full Access | Full Read (No Mutations) |
| **Project Manager (PM)** | Read Active | Create/Edit Scoped | Read Scoped | Record Scoped | Scoped Access | Read Scoped |
| **Specialist** | Denied | Denied | Denied | Denied | Denied | Denied |
| **Client** | Denied | Denied | Read Own Issued | Denied | Denied | Denied |

---

## Security Policies
1. **Draft Invoices Isolation**: Client users cannot view draft invoices under any circumstances (`status != 'draft'`).
2. **Internal Cost & Margin Protection**: Client workspace never receives or renders internal costs, margins, or private notes.
3. **Audit Log Protection**: Direct `UPDATE` or unauthorized `DELETE` operations on `invoice_audit_events` are strictly rejected by the `block_invoice_audit_mutation()` trigger.
4. **Anti-Overpayment Guard**: Trigger `handle_payment_mutation` prevents payment insertions exceeding the invoice outstanding balance.
