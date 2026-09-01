/* js/marketing/consent.js — cookie/consent banner with Google Consent Mode v2.
   Defaults: everything denied until the visitor makes a choice. The banner is a
   prerequisite for Meta Pixel/CAPI and Google enhanced conversions (ads_master_tz §5).
   Consent Mode is wired in addition to — not instead of — the visible banner. */

import { MarketingConfig } from "./marketing-config.js";

const CONSENT_KEY = "ss_consent";

function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
}

export function getConsent() {
    const raw = safeGet(CONSENT_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === MarketingConfig.CONSENT_VERSION) return parsed;
        return null; // version bump re-asks consent
    } catch (e) {
        return null;
    }
}

function pushConsentToGtag(consent) {
    if (typeof window.gtag !== "function") return;
    window.gtag("consent", "update", {
        analytics_storage: consent.analytics ? "granted" : "denied",
        ad_storage: consent.marketing ? "granted" : "denied",
        ad_user_data: consent.marketing ? "granted" : "denied",
        ad_personalization: consent.marketing ? "granted" : "denied"
    });
}

export function saveConsent(analytics, marketing) {
    const consent = {
        version: MarketingConfig.CONSENT_VERSION,
        analytics: !!analytics,
        marketing: !!marketing,
        ts: new Date().toISOString()
    };
    safeSet(CONSENT_KEY, JSON.stringify(consent));
    pushConsentToGtag(consent);
    window.dispatchEvent(new CustomEvent("ss-consent-changed", { detail: consent }));
    return consent;
}

function renderBanner() {
    const el = document.createElement("div");
    el.id = "consent-banner";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Налаштування cookies");
    el.innerHTML = `
      <div class="consent-banner-inner">
        <p class="consent-text">
          Ми використовуємо cookies для роботи сайту та (за вашою згодою) для анонімної
          аналітики й вимірювання реклами. Деталі — у
          <a href="#/privacy">Політиці конфіденційності</a>.
        </p>
        <div class="consent-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="consent-decline">Лише необхідні</button>
          <button type="button" class="btn btn-secondary btn-sm" id="consent-analytics-only">+ Аналітика</button>
          <button type="button" class="btn btn-primary btn-sm" id="consent-accept-all">Прийняти всі</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    const close = () => el.remove();
    document.getElementById("consent-decline").addEventListener("click", () => {
        saveConsent(false, false); close();
    });
    document.getElementById("consent-analytics-only").addEventListener("click", () => {
        saveConsent(true, false); close();
    });
    document.getElementById("consent-accept-all").addEventListener("click", () => {
        saveConsent(true, true); close();
    });
}

export const Consent = {
    init() {
        const existing = getConsent();
        if (existing) {
            pushConsentToGtag(existing);
            return;
        }
        // Never show the banner inside the internal portal / client workspace
        const hash = window.location.hash || "";
        if (hash.indexOf("#/portal") === 0 || hash.indexOf("#/client") === 0) return;
        renderBanner();
    }
};
