/* js/marketing/leads-api.js — server-side lead capture into Supabase.
   Calls the SECURITY DEFINER RPC public.submit_marketing_lead (see migration
   20260901000025). Uses plain fetch with the public anon key — no session, no
   direct table access (RLS blocks it), no secrets.

   Lead-loss policy (owner decision 2026-09-01):
   - A lead counts as saved ONLY after the server confirms it. The UI must show
     an honest error + retry when the server did not confirm.
   - Personal data is never stored in localStorage. The only client-side copy is
     a short-lived form draft in sessionStorage (TTL below) so the visitor can
     retry after an accidental reload; it is deleted on success and on expiry. */

import { MarketingConfig } from "./marketing-config.js";
import { getAttribution } from "./attribution.js";
import { getConsent } from "./consent.js";

const REQUEST_TIMEOUT_MS = 15000;
const DRAFT_TTL_MS = 60 * 60 * 1000; // 1 hour, then auto-deleted

function env() {
    return window.FIRSTWIN_ENV || {};
}

/* --- Short-lived form draft (sessionStorage: dies with the tab, TTL-capped) --- */

function draftKey(formId) {
    return "ss_draft_" + formId;
}

export function saveDraft(formId, fields) {
    try {
        const clean = { ...fields };
        delete clean.website_hp;
        sessionStorage.setItem(draftKey(formId), JSON.stringify({ ts: Date.now(), fields: clean }));
    } catch (e) { /* storage unavailable */ }
}

export function loadDraft(formId) {
    try {
        const raw = sessionStorage.getItem(draftKey(formId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.ts || Date.now() - parsed.ts > DRAFT_TTL_MS) {
            sessionStorage.removeItem(draftKey(formId));
            return null;
        }
        return parsed.fields;
    } catch (e) {
        return null;
    }
}

export function clearDraft(formId) {
    try { sessionStorage.removeItem(draftKey(formId)); } catch (e) { /* ignore */ }
}

/* Submits a lead. Returns {ok, lead_id, event_id, duplicate} or {ok:false, error}. */
export async function submitLead(fields, formId, offerId, eventId) {
    if (!MarketingConfig.SUPABASE_LEADS_ENABLED) {
        return { ok: false, error: "disabled" };
    }
    const supabaseUrl = env().SUPABASE_URL;
    const anonKey = env().SUPABASE_PUBLISHABLE_KEY || env().SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
        return { ok: false, error: "no_config" };
    }

    const attribution = getAttribution();
    const consent = getConsent() || { analytics: false, marketing: false };
    const payload = {
        ...fields,
        form_id: formId,
        offer_id: offerId || null,
        event_id: eventId,
        page_path: (window.location.hash || "#/").slice(1),
        language: document.documentElement.lang || "uk",
        utm_source: attribution.utm_source,
        utm_medium: attribution.utm_medium,
        utm_campaign: attribution.utm_campaign,
        utm_content: attribution.utm_content,
        utm_term: attribution.utm_term,
        gclid: attribution.gclid,
        gbraid: attribution.gbraid,
        wbraid: attribution.wbraid,
        fbclid: attribution.fbclid,
        ttclid: attribution.ttclid,
        platform: attribution.platform,
        first_touch: attribution.first_touch,
        last_touch: attribution.last_touch,
        landing_page: attribution.landing_page,
        referrer: attribution.referrer,
        consent_analytics: !!consent.analytics,
        consent_marketing: !!consent.marketing
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(supabaseUrl + "/rest/v1/rpc/submit_marketing_lead", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": anonKey,
                "Authorization": "Bearer " + anonKey
            },
            body: JSON.stringify({ p: payload }),
            signal: controller.signal
        });
        if (!response.ok) {
            return { ok: false, error: "http_" + response.status };
        }
        const result = await response.json();
        if (!result || result.ok !== true) {
            // Structured server-side refusals: validation / rate_limited / server_error
            return { ok: false, error: (result && result.error) || "bad_response", field: result && result.field };
        }
        notifyOwner(result, payload); // fire-and-forget, disabled by default
        return result;
    } catch (e) {
        return { ok: false, error: "network" };
    } finally {
        clearTimeout(timer);
    }
}

/* Telegram notification via /api/lead-notify and Edge Function. */
function notifyOwner(result, payload) {
    if (!MarketingConfig.TELEGRAM_NOTIFY_ENABLED) return;
    try {
        fetch("/api/lead-notify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        }).catch(() => {});
    } catch (e) { /* notification must never break lead capture */ }

    if (!result || !result.ok || !result.lead_id) return;
    const supabaseUrl = env().SUPABASE_URL;
    const anonKey = env().SUPABASE_PUBLISHABLE_KEY || env().SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) return;
    try {
        fetch(supabaseUrl + "/functions/v1/" + MarketingConfig.LEAD_NOTIFY_FUNCTION, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + anonKey
            },
            body: JSON.stringify({ lead_id: result.lead_id, form_id: payload.form_id })
        }).catch(() => {});
    } catch (e) { /* notification must never break lead capture */ }
}
