/* test_migration_local.js — local verification of migration 20260901000025
   on an embedded PostgreSQL (PGlite, in-memory, WASM). Nothing touches production.

   Simulates the Supabase runtime contract:
   - auth schema + auth.uid() reading request.jwt.claim.sub GUC
   - anon / authenticated roles with Supabase-style table grants (RLS is the guard)
   - request.headers GUC for client IP (rate limiting)

   Covers: table creation, RLS, RPCs, owner/anon roles, mandatory disqual reason,
   event_id dedup, UTM/click ID storage, first/last-touch, status transitions,
   third-party access denial, rate limiting, honeypot, validation, rollback. */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const MIGRATION = fs.readFileSync(path.join(__dirname, "supabase/migrations/20260901000025_marketing_leads_attribution.sql"), "utf8");
const ROLLBACK = fs.readFileSync(path.join(__dirname, "supabase/rollbacks/20260901000025_down.sql"), "utf8");

const OWNER_ID = "11111111-1111-1111-1111-111111111111";
const CLIENT_ID = "22222222-2222-2222-2222-222222222222";

let passed = 0, failed = 0;
function assert(name, cond, extra) {
    if (cond) { passed++; console.log("  PASS: " + name); }
    else { failed++; console.log("  FAIL: " + name + (extra !== undefined ? " — " + JSON.stringify(extra).slice(0, 300) : "")); }
}

async function q(db, sql, params) {
    return db.query(sql, params);
}

/* Runs fn as the given role with the given auth uid and client IP, then resets. */
async function asRole(db, role, uid, ip, fn) {
    await q(db, `SELECT set_config('request.jwt.claim.sub', '${uid || ""}', false)`);
    await q(db, `SELECT set_config('request.headers', '${ip ? JSON.stringify({ "x-forwarded-for": ip }) : ""}', false)`);
    await q(db, `SET ROLE ${role}`);
    try {
        return await fn();
    } finally {
        await q(db, "RESET ROLE");
    }
}

async function expectError(promise) {
    try { await promise; return null; } catch (e) { return e.message || String(e); }
}

async function setupBase(db) {
    // --- Supabase runtime shims ---
    await db.exec(`
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
        LANGUAGE sql STABLE AS
        'SELECT NULLIF(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';

        CREATE ROLE anon NOLOGIN;
        CREATE ROLE authenticated NOLOGIN;
        GRANT USAGE ON SCHEMA public TO anon, authenticated;
    `);

    // --- Verbatim pieces of the foundation migration that 25 depends on ---
    await db.exec(`
        CREATE OR REPLACE FUNCTION public.handle_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

        CREATE TABLE IF NOT EXISTS public.profiles (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          email TEXT UNIQUE NOT NULL,
          full_name TEXT NOT NULL DEFAULT '',
          global_role TEXT NOT NULL DEFAULT 'client' CHECK (global_role IN ('owner', 'pm', 'specialist', 'client')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE OR REPLACE FUNCTION public.is_global_owner()
        RETURNS BOOLEAN AS $$
          SELECT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND global_role = 'owner'
          );
        $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
    `);

    // --- Seed users: the owner and an unrelated authenticated client ---
    await db.exec(`
        INSERT INTO auth.users (id, email) VALUES
          ('${OWNER_ID}', 'owner@test.local'),
          ('${CLIENT_ID}', 'client@test.local');
        INSERT INTO public.profiles (id, email, global_role) VALUES
          ('${OWNER_ID}', 'owner@test.local', 'owner'),
          ('${CLIENT_ID}', 'client@test.local', 'client');
    `);
}

async function applyGrants(db) {
    // Supabase grants broad table privileges to anon/authenticated by default
    // and relies on RLS. Reproduce that so RLS (not missing grants) is what we test.
    await db.exec(`
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
    `);
}

function leadPayload(overrides) {
    return JSON.stringify(Object.assign({
        name: "Тест Лід",
        email: "lead@test.local",
        phone: "+380971112233",
        problem: "тестова проблема",
        form_id: "consultation",
        offer_id: "consult",
        event_id: null,
        utm_source: "meta",
        utm_medium: "paid_social",
        utm_campaign: "META_UA_UK_AIAUTO_COLD_SMBOWNER_202610",
        utm_content: "AIAUTO-PAIN-01",
        utm_term: "broad",
        gclid: null, fbclid: "FB.1.test", ttclid: null,
        first_touch: { ts: "2026-09-01T10:00:00Z", utm_source: "gads", utm_campaign: "FIRST_CAMP", tagged: true },
        last_touch: { ts: "2026-09-01T12:00:00Z", utm_source: "meta", utm_campaign: "META_UA_UK_AIAUTO_COLD_SMBOWNER_202610", tagged: true },
        landing_page: "http://localhost/",
        referrer: "https://facebook.com/",
        consent_analytics: true,
        consent_marketing: false
    }, overrides || {}));
}

async function submit(db, role, uid, ip, payloadOverrides) {
    return asRole(db, role, uid, ip, async () => {
        const r = await q(db, "SELECT public.submit_marketing_lead($1::jsonb) AS res", [leadPayload(payloadOverrides)]);
        return r.rows[0].res;
    });
}

(async () => {
    const db = new PGlite();
    await setupBase(db);

    console.log("\n[1] Migration applies cleanly");
    let err = await expectError(db.exec(MIGRATION));
    assert("migration executes without errors", err === null, err);
    await applyGrants(db);

    console.log("\n[2] Objects created");
    for (const t of ["marketing_leads", "marketing_lead_events", "marketing_submission_log"]) {
        const r = await q(db, `SELECT to_regclass('public.${t}') IS NOT NULL AS ok`);
        assert(`table ${t} exists`, r.rows[0].ok);
    }
    for (const f of ["submit_marketing_lead", "update_marketing_lead_status", "marketing_client_ip_hash"]) {
        const r = await q(db, `SELECT COUNT(*)::int AS n FROM pg_proc WHERE proname = '${f}'`);
        assert(`function ${f} exists`, r.rows[0].n === 1);
    }

    console.log("\n[3] RLS enabled on every new table");
    const rls = await q(db, `SELECT relname, relrowsecurity FROM pg_class
        WHERE relname IN ('marketing_leads','marketing_lead_events','marketing_submission_log')`);
    for (const row of rls.rows) assert(`RLS enabled: ${row.relname}`, row.relrowsecurity === true);

    console.log("\n[4] anon cannot touch tables directly");
    let r = await asRole(db, "anon", null, "9.9.9.9", () => q(db, "SELECT COUNT(*)::int AS n FROM public.marketing_leads"));
    assert("anon SELECT marketing_leads → 0 rows visible", r.rows[0].n === 0);
    err = await asRole(db, "anon", null, "9.9.9.9", () =>
        expectError(q(db, "INSERT INTO public.marketing_leads (name, form_id, event_id) VALUES ('hack', 'other', gen_random_uuid())")));
    assert("anon direct INSERT rejected by RLS", err !== null && /row-level security|violates/i.test(err), err);
    err = await asRole(db, "anon", null, "9.9.9.9", () =>
        expectError(q(db, "INSERT INTO public.marketing_lead_events (lead_id, event_type) VALUES (gen_random_uuid(), 'note')")));
    assert("anon cannot mass-create events", err !== null, err);
    r = await asRole(db, "anon", null, "9.9.9.9", () => q(db, "SELECT COUNT(*)::int AS n FROM public.marketing_submission_log"));
    assert("anon cannot read submission log", r.rows[0].n === 0);

    console.log("\n[5] Lead submission via RPC (anon)");
    let res = await submit(db, "anon", null, "1.1.1.1");
    assert("submit ok", res.ok === true && res.duplicate === false, res);
    assert("lead_id returned", !!res.lead_id);
    const leadId = res.lead_id;
    const eventId = res.event_id;

    console.log("\n[6] Stored data: UTM, click IDs, first/last touch, normalization");
    const lead = (await q(db, "SELECT * FROM public.marketing_leads WHERE id = $1", [leadId])).rows[0];
    assert("utm_source stored", lead.utm_source === "meta");
    assert("utm_content stored", lead.utm_content === "AIAUTO-PAIN-01");
    assert("utm_term stored", lead.utm_term === "broad");
    assert("fbclid stored", lead.fbclid === "FB.1.test");
    assert("first_touch JSONB stored with original campaign", lead.first_touch && lead.first_touch.utm_campaign === "FIRST_CAMP");
    assert("last_touch JSONB stored", lead.last_touch && lead.last_touch.utm_source === "meta");
    assert("email normalized to lowercase", lead.email === "lead@test.local");
    assert("phone normalized (digits and + only)", lead.phone === "+380971112233");
    assert("status defaults to new", lead.status === "new");
    const ev = (await q(db, "SELECT * FROM public.marketing_lead_events WHERE lead_id = $1", [leadId])).rows;
    assert("generate_lead event logged exactly once", ev.length === 1 && ev[0].event_type === "generate_lead");

    console.log("\n[7] event_id dedup");
    res = await submit(db, "anon", null, "1.1.1.1", { event_id: eventId, email: "other@test.local", phone: "+380000000001" });
    assert("same event_id → duplicate:true, same lead", res.ok === true && res.duplicate === true && res.lead_id === leadId, res);
    r = await q(db, "SELECT COUNT(*)::int AS n FROM public.marketing_leads");
    assert("no second row created", r.rows[0].n === 1);

    console.log("\n[8] content dedup (same contact, same form, 10 min)");
    res = await submit(db, "anon", null, "1.1.1.1", { event_id: null });
    assert("same email re-submit → duplicate:true", res.ok === true && res.duplicate === true && res.lead_id === leadId, res);

    console.log("\n[9] honeypot");
    res = await submit(db, "anon", null, "2.2.2.2", { website_hp: "spam", email: "bot@test.local", phone: "+380000000002" });
    assert("honeypot → fake success, no lead_id", res.ok === true && res.lead_id === null, res);
    r = await q(db, "SELECT COUNT(*)::int AS n FROM public.marketing_leads");
    assert("honeypot created no lead row", r.rows[0].n === 1);

    console.log("\n[10] validation");
    res = await submit(db, "anon", null, "3.3.3.3", { name: "  " });
    assert("missing name → validation error", res.ok === false && res.error === "validation" && res.field === "name", res);
    res = await submit(db, "anon", null, "3.3.3.3", { email: "", phone: "", telegram: "" });
    assert("no contact channel → validation error", res.ok === false && res.field === "contact", res);
    res = await submit(db, "anon", null, "3.3.3.3", { email: "not-an-email", phone: "", telegram: "" });
    assert("malformed email as only contact → validation error", res.ok === false && res.field === "contact", res);

    console.log("\n[11] rate limiting (5/hour per IP)");
    let limited = null;
    for (let i = 0; i < 6; i++) {
        res = await submit(db, "anon", null, "5.5.5.5", {
            event_id: null, email: `rl${i}@test.local`, phone: `+38097000010${i}`
        });
        if (res.ok === false && res.error === "rate_limited") { limited = i; break; }
    }
    assert("6th submission from same IP rate-limited (5 created)", limited === 5, { limitedAt: limited });
    res = await submit(db, "anon", null, "6.6.6.6", { event_id: null, email: "fresh@test.local", phone: "+380970001999" });
    assert("different IP still allowed", res.ok === true, res);
    r = await q(db, "SELECT outcome, COUNT(*)::int AS n FROM public.marketing_submission_log GROUP BY outcome ORDER BY outcome");
    console.log("    submission log:", r.rows.map(x => `${x.outcome}=${x.n}`).join(", "));
    const logCols = (await q(db, `SELECT column_name FROM information_schema.columns WHERE table_name='marketing_submission_log'`)).rows.map(x => x.column_name);
    assert("submission log has no PII columns", !logCols.some(c => ["email", "phone", "name", "ip", "payload"].includes(c)), logCols);

    console.log("\n[12] authenticated non-owner cannot read or mutate leads");
    r = await asRole(db, "authenticated", CLIENT_ID, "7.7.7.7", () => q(db, "SELECT COUNT(*)::int AS n FROM public.marketing_leads"));
    assert("client user sees 0 leads", r.rows[0].n === 0);
    r = await asRole(db, "authenticated", CLIENT_ID, "7.7.7.7", () =>
        q(db, "UPDATE public.marketing_leads SET status = 'won' WHERE id = $1 RETURNING id", [leadId]));
    assert("client user direct UPDATE affects 0 rows", r.rows.length === 0);
    err = await asRole(db, "authenticated", CLIENT_ID, "7.7.7.7", () =>
        expectError(q(db, "SELECT public.update_marketing_lead_status($1, 'qualified')", [leadId])));
    assert("client user status RPC → not authorized", err !== null && /not authorized/i.test(err), err);
    err = await asRole(db, "anon", null, "7.7.7.7", () =>
        expectError(q(db, "SELECT public.update_marketing_lead_status($1, 'qualified')", [leadId])));
    // anon is blocked one level earlier than authenticated: no EXECUTE grant at all
    assert("anon status RPC → denied", err !== null && /not authorized|permission denied/i.test(err), err);

    console.log("\n[13] owner: reads, status transitions, mandatory disqual reason");
    r = await asRole(db, "authenticated", OWNER_ID, "8.8.8.8", () => q(db, "SELECT COUNT(*)::int AS n FROM public.marketing_leads"));
    assert("owner sees all leads", r.rows[0].n >= 1, r.rows[0]);
    err = await asRole(db, "authenticated", OWNER_ID, "8.8.8.8", () =>
        expectError(q(db, "SELECT public.update_marketing_lead_status($1, 'disqualified')", [leadId])));
    assert("disqualified WITHOUT reason → rejected", err !== null && /disqual_reason is required/i.test(err), err);
    err = await asRole(db, "authenticated", OWNER_ID, "8.8.8.8", () =>
        expectError(q(db, "SELECT public.update_marketing_lead_status($1, 'disqualified', 'because')", [leadId])));
    assert("disqualified with non-dictionary reason → rejected", err !== null, err);
    err = await asRole(db, "authenticated", OWNER_ID, "8.8.8.8", () =>
        expectError(q(db, "SELECT public.update_marketing_lead_status($1, 'hacked_status')", [leadId])));
    assert("invalid status → rejected", err !== null && /invalid status/i.test(err), err);

    for (const [status, tsCol] of [["contacted", "first_contact_at"], ["qualified", "qualified_at"], ["booked", "booked_call_at"], ["consultation_paid", "consultation_paid_at"], ["won", "closed_at"]]) {
        res = await asRole(db, "authenticated", OWNER_ID, "8.8.8.8", async () =>
            (await q(db, "SELECT public.update_marketing_lead_status($1, $2, NULL, $3, $4) AS res", [leadId, status, status === "won" ? 2000 : null, status === "won" ? "USD" : null])).rows[0].res);
        const row = (await q(db, `SELECT status, ${tsCol} AS ts, revenue, currency FROM public.marketing_leads WHERE id = $1`, [leadId])).rows[0];
        assert(`status → ${status}, ${tsCol} stamped`, res.ok === true && row.status === status && row.ts !== null, row);
    }
    const wonRow = (await q(db, "SELECT revenue::float AS rev, currency FROM public.marketing_leads WHERE id = $1", [leadId])).rows[0];
    assert("revenue + currency recorded on won", wonRow.rev === 2000 && wonRow.currency === "USD", wonRow);
    const evAll = (await q(db, "SELECT event_type FROM public.marketing_lead_events WHERE lead_id = $1 ORDER BY created_at", [leadId])).rows.map(x => x.event_type);
    assert("funnel events logged (book_call, qualified_lead, consultation_paid, closed_won)",
        ["book_call", "qualified_lead", "consultation_paid", "closed_won"].every(t => evAll.includes(t)), evAll);

    console.log("\n[14] disqualification with dictionary reason works");
    res = await submit(db, "anon", null, "10.10.10.10", { event_id: null, email: "dq@test.local", phone: "+380970002000" });
    const dqId = res.lead_id;
    res = await asRole(db, "authenticated", OWNER_ID, "8.8.8.8", async () =>
        (await q(db, "SELECT public.update_marketing_lead_status($1, 'disqualified', 'spam_duplicate') AS res", [dqId])).rows[0].res);
    const dqRow = (await q(db, "SELECT status, disqual_reason FROM public.marketing_leads WHERE id = $1", [dqId])).rows[0];
    assert("disqualified with reason persisted", res.ok === true && dqRow.status === "disqualified" && dqRow.disqual_reason === "spam_duplicate", dqRow);

    console.log("\n[15] rollback");
    err = await expectError(db.exec(ROLLBACK));
    assert("rollback executes without errors", err === null, err);
    for (const t of ["marketing_leads", "marketing_lead_events", "marketing_submission_log"]) {
        const rr = await q(db, `SELECT to_regclass('public.${t}') IS NULL AS gone`);
        assert(`table ${t} removed`, rr.rows[0].gone);
    }
    const fn = await q(db, `SELECT COUNT(*)::int AS n FROM pg_proc WHERE proname IN ('submit_marketing_lead','update_marketing_lead_status','marketing_client_ip_hash')`);
    assert("functions removed", fn.rows[0].n === 0);
    const others = await q(db, `SELECT to_regclass('public.profiles') IS NOT NULL AS ok`);
    assert("rollback did not touch unrelated tables (profiles intact)", others.rows[0].ok);

    console.log("\n[16] re-apply after rollback (repeatability)");
    err = await expectError(db.exec(MIGRATION));
    assert("migration re-applies cleanly after rollback", err === null, err);
    await applyGrants(db);
    res = await submit(db, "anon", null, "11.11.11.11", { event_id: null, email: "again@test.local", phone: "+380970003000" });
    assert("submission works again after re-apply", res.ok === true, res);

    await db.close();
    console.log(`\n==== RESULT: ${passed} passed, ${failed} failed ====`);
    process.exit(failed > 0 ? 1 : 0);
})().catch((e) => { console.error("Test harness crashed:", e); process.exit(1); });
