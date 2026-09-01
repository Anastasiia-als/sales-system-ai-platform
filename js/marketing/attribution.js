/* js/marketing/attribution.js — advertising attribution capture.
   Captures UTM parameters, ad click IDs, landing page and referrer.
   First-touch persists in localStorage (survives sessions); last-touch lives in
   sessionStorage and is refreshed whenever a new tagged visit starts.
   Spec: docs/technical-specs/ads_tracking_plan.md §1, §4. */

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "fbclid", "ttclid"];
const FIRST_TOUCH_KEY = "ss_first_touch";
const LAST_TOUCH_KEY = "ss_last_touch";

function safeGet(storage, key) {
    try { return storage.getItem(key); } catch (e) { return null; }
}

function safeSet(storage, key, value) {
    try { storage.setItem(key, value); } catch (e) { /* private mode etc. */ }
}

function buildTouch(params) {
    const touch = {
        ts: new Date().toISOString(),
        landing_page: window.location.href.split("#")[0],
        page_path: (window.location.hash || "#/").slice(1),
        referrer: document.referrer || ""
    };
    let tagged = false;
    UTM_KEYS.concat(CLICK_ID_KEYS).forEach((key) => {
        if (params.has(key)) {
            touch[key] = params.get(key);
            tagged = true;
        }
    });
    touch.tagged = tagged;
    return touch;
}

/* Runs once per page load. A visit counts as a new "touch" when it carries any
   UTM/click-id parameter, or when there is no touch recorded yet (organic/direct). */
export function captureAttribution() {
    const params = new URLSearchParams(window.location.search);
    const touch = buildTouch(params);

    // Back-compat: keep legacy sessionStorage keys used by js/state.js
    UTM_KEYS.forEach((key) => {
        if (params.has(key)) safeSet(sessionStorage, key, params.get(key));
    });
    CLICK_ID_KEYS.forEach((key) => {
        if (params.has(key)) safeSet(sessionStorage, key, params.get(key));
    });

    if (!safeGet(localStorage, FIRST_TOUCH_KEY)) {
        safeSet(localStorage, FIRST_TOUCH_KEY, JSON.stringify(touch));
    }
    if (touch.tagged || !safeGet(sessionStorage, LAST_TOUCH_KEY)) {
        safeSet(sessionStorage, LAST_TOUCH_KEY, JSON.stringify(touch));
    }
}

function parseTouch(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

/* Flat attribution snapshot for lead payloads and analytics events. */
export function getAttribution() {
    const firstTouch = parseTouch(safeGet(localStorage, FIRST_TOUCH_KEY));
    const lastTouch = parseTouch(safeGet(sessionStorage, LAST_TOUCH_KEY));
    const attribution = {
        first_touch: firstTouch,
        last_touch: lastTouch,
        landing_page: (lastTouch && lastTouch.landing_page) || window.location.href.split("#")[0],
        referrer: (lastTouch && lastTouch.referrer) || document.referrer || ""
    };
    UTM_KEYS.concat(CLICK_ID_KEYS).forEach((key) => {
        attribution[key] =
            (lastTouch && lastTouch[key]) ||
            safeGet(sessionStorage, key) ||
            (firstTouch && firstTouch[key]) ||
            null;
    });
    attribution.platform = attribution.utm_source || null;
    return attribution;
}
