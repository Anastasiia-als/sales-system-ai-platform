# FIRSTWIN Permissions & Row-Level Security (RLS)

## Role-Based Access Control Matrix

| Role | Billing Profiles | Invoices (Drafts) | Invoices (Issued) | Record Payments | Cancel Invoices | Audit Log | Analytics & Reports | Client Action Tokens | Task Submissions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Owner** | Full CRUD | Full CRUD | Full Read / Manage | Full Insert/Edit | Full Access | Full Read (No Mutations) | Global Platform | Full Manage | Full Manage |
| **Project Manager (PM)** | Read Active | Create/Edit Scoped | Read Scoped | Record Scoped | Scoped Access | Read Scoped | Scoped Org/Projects | Scoped Generate/Revoke | Scoped Read/Manage |
| **Specialist** | Denied | Denied | Denied | Denied | Denied | Denied | Denied | Denied | Denied |
| **Client** | Denied | Denied | Read Own Issued | Denied | Denied | Denied | Denied | Read Own Org | Read/Submit Own Org |
| **Anonymous (Public Link)** | Denied | Denied | Denied | Denied | Denied | Denied | Denied | Direct Table Denied (RPC Hash Only) | Direct Table Denied (RPC Submission Only) |

---

## Security Policies
1. **Draft Invoices Isolation**: Client users cannot view draft invoices under any circumstances (`status != 'draft'`).
2. **Internal Cost & Margin Protection**: Client workspace never receives or renders internal costs, margins, or private notes.
3. **Audit Log Protection**: Direct `UPDATE` or unauthorized `DELETE` operations on `invoice_audit_events` are strictly rejected by the `block_invoice_audit_mutation()` trigger.
4. **Anti-Overpayment Guard**: Trigger `handle_payment_mutation` prevents payment insertions exceeding the invoice outstanding balance.
5. **Analytics & Reports Access Guard**: Executive analytics and report generators are restricted to `Owner` and `PM`. Specialists and Clients receive 42501 Access Denied. PM scope is constrained to permitted organization IDs.
6. **Saved Views Personal Isolation**: Policies on `analytics_saved_views` enforce `auth.uid() = user_id` for SELECT, INSERT, UPDATE, and DELETE.
7. **Client Action Tokens & Submissions Security (Phase 6D)**:
   - Direct anonymous access to `client_action_tokens` and `task_submissions` is strictly Denied by RLS.
   - Public access operates exclusively through Security Definer RPCs (`get_public_client_action`, `submit_public_client_action`) with SHA-256 hash lookup.
   - Cross-Tenant default deny: Triggers `trg_client_action_tokens_tenant_guard` and `trg_task_submissions_tenant_guard` enforce server-derived `organization_id` matching the parent task.
