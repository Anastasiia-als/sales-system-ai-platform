/* js/marketing/analytics.js — unified event layer (tracking plan implementation).
   Every event goes to window.dataLayer always (single source of truth, testable
   locally) and to GA4 via gtag only when GA4_MEASUREMENT_ID is set AND the
   visitor granted analytics consent.
   Spec: docs/technical-specs/ads_tracking_plan.md §2. */

import { MarketingConfig } from "./marketing-config.js";
import { getConsent } from "./consent.js";
import { getAttribution } from "./attribution.js";

let ga4Loaded = false;
const sessionFlags = {};

export function newEventId() {
    try { return crypto.randomUUID(); } catch (e) {
        return "ev-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    }
}

/* Loads gtag.js once: only with a real Measurement ID and analytics consent. */
export function maybeLoadGa4() {
    const id = MarketingConfig.GA4_MEASUREMENT_ID;
    const consent = getConsent();
    if (!id || ga4Loaded || !consent || !consent.analytics) return;
    ga4Loaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    // SPA: page_view is sent manually from the router
    window.gtag("config", id, { send_page_view: false });

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(script);
}

/* Core tracking primitive. Returns the event_id used (for browser↔server dedup). */
export function track(eventName, params = {}) {
    const eventId = params.event_id || newEventId();
    const attribution = getAttribution();
    const payload = {
        event: eventName,
        page_path: (window.location.hash || "#/").slice(1),
        utm_source: attribution.utm_source || undefined,
        utm_medium: attribution.utm_medium || undefined,
        utm_campaign: attribution.utm_campaign || undefined,
        utm_content: attribution.utm_content || undefined,
        utm_term: attribution.utm_term || undefined,
        ...params,
        event_id: eventId
    };

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);

    const consent = getConsent();
    if (typeof window.gtag === "function" && ga4Loaded && consent && consent.analytics) {
        const gaParams = { ...payload };
        delete gaParams.event;
        window.gtag("event", eventName, gaParams);
    }
    return eventId;
}

export function trackPageView() {
    maybeLoadGa4();
    track("page_view", {
        page_location: window.location.href,
        page_referrer: document.referrer || undefined
    });
}

/* view_offer: fired by the router for offer pages (route → offer_id mapping). */
export function trackViewOffer(offerId) {
    track("view_offer", { offer_id: offerId });
}

/* form_start: once per session per form. */
export function trackFormStart(formId, offerId) {
    const flag = "form_start_" + formId;
    if (sessionFlags[flag]) return;
    sessionFlags[flag] = true;
    track("form_start", { form_id: formId, offer_id: offerId || undefined });
}

/* generate_lead is fired ONLY after the server confirmed the lead was stored
   (owner decision 2026-09-01): callers pass the event_id that the server accepted. */
export function trackGenerateLead(formId, offerId, eventId) {
    return track("generate_lead", {
        form_id: formId,
        offer_id: offerId || undefined,
        event_id: eventId
    });
}

export function trackContactClick(channel) {
    track("contact_click", { channel });
}

export function trackCtaClick(offerId, ctaId) {
    track("cta_click", { offer_id: offerId || undefined, cta_id: ctaId });
}
