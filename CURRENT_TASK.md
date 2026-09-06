# Current Task: Phase 7 — External Integrations & Outbound Delivery Engine

## Active Step: Phase 7 Architecture Approval Gate — PASSED & FROZEN

### Architecture Approval Summary
- **Status**: **APPROVED & FROZEN** (Formally approved by user)
- **Implementation Status**: **ZERO CODE IMPLEMENTED IN CURRENT CHAT** (Clean architectural checkpoint preserved)
- **Next Step**: Phase 7A implementation ready to begin in a fresh chat session.

---

## 1. Approved Phase 7 Structure

| Sub-Phase | Component | Priority | Status | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 7A** | Integration Core & Outbound Webhooks | **Mandatory** | **APPROVED / READY** | Transactional Outbox, Vault-backed URL/secret storage, SSRF protection (no 3xx follow, DNS rebinding guard), exact-byte HMAC-SHA256, payload allowlists, hardened `SECURITY DEFINER` RPCs, referential integrity triggers. |
| **Phase 7B** | Telegram Notifications Integration | **Mandatory** | **APPROVED** | Dedicated Outbox channel `channel_type='telegram'`, Vault bot token, MarkdownV2 parser, 429 `retry_after` backoff handling. |
| **Phase 7C** | Calendar Read-Only Feed (iCalendar) | **Mandatory** | **APPROVED** | One-way RFC 5545 `.ics` subscription feed, Hash-only token architecture (`sha256(raw_token)`), zero write-back. |
| **Phase 7D** | Additional Communication (Slack) | **Optional** | **DEFERRED** | Optional / deferred until validated business requirement. |

---

## 2. Frozen Architectural Invariants

1. **Transactional Outbox Delivery Identity**:
   - Composite unique identity: `(event_id, channel_type, destination_id)`.
   - Dedicated row per destination, eliminating multi-target collision and preserving deterministic retry states.
2. **Hardened `SECURITY DEFINER` Functions**:
   - `public._emit_integration_event` execution strictly revoked from `PUBLIC`, `anon`, and `authenticated`.
   - Only `service_role` and internal triggers have access.
   - Strict `SET search_path = public, pg_temp` and schema-qualified SQL objects.
   - Context (`organization_id`, `project_id`) derived server-side from authoritative database rows.
   - Client direct RPC invocation returns `42501 permission denied`.
3. **Destination Referential Integrity & Deletion Semantics**:
   - `destination_id UUID NOT NULL` in `integration_outbox`.
   - Hard deletion (`DELETE`) of endpoints or Telegram destinations is strictly **forbidden** if any historical Outbox row references them (across all statuses: `pending`, `processing`, `retrying`, `delivered`, `failed`, `dead_letter`, `rejected_ssrf`).
   - Lifecycle management enforced via `is_active = false`.
   - `BEFORE DELETE` triggers on `public.integration_endpoints` and `public.telegram_destinations` raise error `23001 RESTRICT_VIOLATION`.
   - Hard delete allowed only if historical Outbox count is exactly 0.
4. **Server-Side Routing & Validation**:
   - `_enqueue_integration_outbox_deliveries(p_event_id UUID)` takes zero client routing arguments.
   - Validates destination existence, `channel_type` match, tenant ownership (`organization_id`), and active state (`is_active = true`).
   - 0 rows created for non-existent, cross-channel, cross-tenant, or inactive destinations. No fallback.
5. **Secret Storage in Supabase Vault**:
   - Complete webhook URLs (including secret paths/tokens) and signing secrets stored in `vault.secrets`.
   - Client UI receives only masked metadata and vault reference UUIDs. Zero secrets in plain application tables.
6. **SSRF & Network Security**:
   - Webhook dispatcher validates destination IPs against IANA private/loopback/link-local ranges before socket connection.
   - HTTP 3xx redirects are strictly rejected as delivery failures (`rejected_ssrf`).
   - DNS resolved immediately before fetch to prevent DNS rebinding attacks.
7. **Exact-Byte HMAC-SHA256 Signing**:
   - Signature computed over the exact byte sequence of the serialized JSON HTTP request body.
   - Header: `X-Firstwin-Signature-256: sha256=<hex>`.
8. **Payload Minimization & Security**:
   - Strict event-specific allowlists in `payload_json`.
   - PII and internal access tokens strictly excluded.

---

## 3. Immediate Action Plan for Next Chat (Phase 7A Kickoff)
1. Initialize Phase 7A database migrations:
   - `integration_events` table with immutable RLS.
   - `integration_endpoints` table with Vault secret reference columns and `BEFORE DELETE` trigger.
   - `integration_outbox` table with `(event_id, channel_type, destination_id)` uniqueness.
   - Hardened `public._emit_integration_event` and `public._enqueue_integration_outbox_deliveries`.
2. Implement Edge Function dispatcher with SSRF and exact-byte HMAC signing.
3. Execute negative security and referential-integrity test suites.
