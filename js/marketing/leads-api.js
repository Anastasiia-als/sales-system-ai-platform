/* js/marketing/leads-api.js — server-side lead capture into Supabase.
   Calls the SECURITY DEFINER RPC public.submit_marketing_lead (see migration
   20260901000025). Uses plain fetch with the public anon key — no session, no
   direct table access (RLS blocks it), no secrets.
   Degrades gracefully: on any failure the caller keeps the localStorage lead
   as fallback, so a lead is never silently lost. */

import { MarketingConfig } from "./marketing-config.js";
import { getAttribution } from "./attribution.js";
import { getConsent } from "./consent.js";

function env() {
    return window.FIRSTWIN_ENV || {};
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

    try {
        const response = await fetch(supabaseUrl + "/rest/v1/rpc/submit_marketing_lead", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": anonKey,
                "Authorization": "Bearer " + anonKey
            },
            body: JSON.stringify({ p: payload })
        });
        if (!response.ok) {
            return { ok: false, error: "http_" + response.status };
        }
        const result = await response.json();
        notifyOwner(result, payload); // fire-and-forget, disabled by default
        return result && result.ok ? result : { ok: false, error: "bad_response" };
    } catch (e) {
        return { ok: false, error: "network" };
    }
}

/* Telegram notification via Edge Function lead-notify.
   HARD-DISABLED until the owner provides a bot token (config + secrets). */
function notifyOwner(result, payload) {
    if (!MarketingConfig.TELEGRAM_NOTIFY_ENABLED) return;
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
