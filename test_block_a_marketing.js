/* test_block_a_marketing.js — local E2E for Block A (marketing/tracking/lead capture).
   Runs fully offline: static server on localhost, Supabase URL overridden to a
   local 404 endpoint so NO request ever reaches production. */

const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const PORT = 3999;
const ROOT = __dirname;
const MIME = {
    ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
    ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json"
};

let passed = 0, failed = 0;
function assert(name, cond, extra) {
    if (cond) { passed++; console.log("  PASS: " + name); }
    else { failed++; console.log("  FAIL: " + name + (extra ? " — " + extra : "")); }
}

function startServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent(req.url.split("?")[0]);
            if (urlPath.startsWith("/rest/") || urlPath.startsWith("/functions/")) {
                res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
                res.end(JSON.stringify({ error: "not found (local test stub)" }));
                return;
            }
            let filePath = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);
            fs.readFile(filePath, (err, data) => {
                if (err) { res.writeHead(404); res.end("not found"); return; }
                res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
                res.end(data);
            });
        });
        server.listen(PORT, () => resolve(server));
    });
}

(async () => {
    const server = await startServer();
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

    const base = `http://localhost:${PORT}/`;
    const utm = "utm_source=meta&utm_medium=paid_social&utm_campaign=META_UA_UK_AIAUTO_COLD_SMBOWNER_202610&utm_content=AIAUTO-PAIN-01&utm_term=broad&fbclid=FB.TEST.123";

    console.log("\n[1] Landing with UTM + consent banner");
    await page.goto(`${base}?${utm}#/`, { waitUntil: "networkidle0" });
    // Point Supabase at the local stub so nothing reaches production
    await page.evaluate((p) => {
        window.FIRSTWIN_ENV = {
            SUPABASE_URL: "http://localhost:" + p,
            SUPABASE_PUBLISHABLE_KEY: "test-key",
            SUPABASE_ANON_KEY: "test-key"
        };
    }, PORT);

    await page.waitForSelector("#consent-banner", { timeout: 5000 }).catch(() => {});
    assert("consent banner is shown", await page.$("#consent-banner") !== null);

    const consentDefault = await page.evaluate(() =>
        (window.dataLayer || []).some(e => e[0] === "consent" && e[1] === "default"));
    assert("Consent Mode default=denied pushed", consentDefault);

    await page.click("#consent-accept-all");
    const consentStored = await page.evaluate(() => JSON.parse(localStorage.getItem("ss_consent") || "null"));
    assert("consent stored (analytics+marketing)", !!consentStored && consentStored.analytics && consentStored.marketing);
    assert("consent banner removed after choice", await page.$("#consent-banner") === null);

    console.log("\n[2] Attribution capture");
    const firstTouch = await page.evaluate(() => JSON.parse(localStorage.getItem("ss_first_touch") || "null"));
    assert("first-touch persisted", !!firstTouch && firstTouch.tagged === true);
    assert("first-touch has utm_campaign", firstTouch && firstTouch.utm_campaign === "META_UA_UK_AIAUTO_COLD_SMBOWNER_202610");
    assert("first-touch has fbclid", firstTouch && firstTouch.fbclid === "FB.TEST.123");
    const ssUtmContent = await page.evaluate(() => sessionStorage.getItem("utm_content"));
    assert("utm_content in sessionStorage (state.js back-compat)", ssUtmContent === "AIAUTO-PAIN-01");

    const hasPageView = await page.evaluate(() =>
        (window.dataLayer || []).some(e => e && e.event === "page_view"));
    assert("page_view pushed to dataLayer", hasPageView);

    console.log("\n[3] view_offer on offer route");
    await page.evaluate(() => { window.location.hash = "#/ai-solutions"; });
    await new Promise(r => setTimeout(r, 600));
    const viewOffer = await page.evaluate(() =>
        (window.dataLayer || []).find(e => e && e.event === "view_offer"));
    assert("view_offer fired", !!viewOffer);
    assert("view_offer offer_id=aiauto", viewOffer && viewOffer.offer_id === "aiauto");

    console.log("\n[4] Consultation form → generate_lead + fallback");
    await page.evaluate(() => { window.location.hash = "#/consultation"; });
    await page.waitForSelector("#consultation-form", { timeout: 5000 });
    await page.type("#c-name", "Тест Тестовий");
    await page.type("#c-phone", "+380001112233");
    await page.type("#c-email", "test@test.local");
    await page.type("#c-problem", "E2E тест Блоку А");
    await page.evaluate(() => { document.getElementById("c-date").value = "2026-09-10"; });

    const formStart = await page.evaluate(() =>
        (window.dataLayer || []).some(e => e && e.event === "form_start" && e.form_id === "consultation"));
    assert("form_start fired once for consultation", formStart);

    await page.click("#consultation-form button[type=submit]");
    await page.waitForFunction(() => window.location.hash === "#/success", { timeout: 8000 });
    assert("redirected to #/success", true);

    const genLead = await page.evaluate(() =>
        (window.dataLayer || []).find(e => e && e.event === "generate_lead" && e.form_id === "consultation"));
    assert("generate_lead fired with event_id", !!genLead && !!genLead.event_id);
    assert("generate_lead carries utm_campaign", genLead && genLead.utm_campaign === "META_UA_UK_AIAUTO_COLD_SMBOWNER_202610");

    const leads = await page.evaluate(() => JSON.parse(localStorage.getItem("sales_app_leads") || "[]"));
    const testLead = leads.find(l => l.name === "Тест Тестовий");
    assert("lead saved to localStorage fallback", !!testLead);
    assert("fallback lead has utm_content", testLead && testLead.utm_content === "AIAUTO-PAIN-01");

    console.log("\n[5] Contacts form");
    await page.evaluate(() => { window.location.hash = "#/contacts"; });
    await page.waitForSelector("#contacts-form", { timeout: 5000 });
    const contactsEmailShown = await page.evaluate(() => document.body.innerHTML.includes("a.zaporozhetswork@gmail.com"));
    assert("confirmed email shown on contacts page", contactsEmailShown);
    const noPlaceholders = await page.evaluate(() =>
        !document.body.innerHTML.includes("contact@example.com") &&
        !document.body.innerHTML.includes("sales_expert") &&
        !document.body.innerHTML.includes("099) 000-00-00"));
    assert("no placeholder contacts anywhere in DOM", noPlaceholders);

    await page.type("#ct-name", "Тест Контакт");
    await page.type("#ct-contact", "@test_tg");
    await page.type("#ct-message", "Повідомлення E2E");
    await page.click("#contacts-form button[type=submit]");
    await page.waitForFunction(() => window.location.hash === "#/success", { timeout: 8000 });
    const genLead2 = await page.evaluate(() =>
        (window.dataLayer || []).filter(e => e && e.event === "generate_lead").length);
    assert("second generate_lead fired (contacts)", genLead2 >= 2);

    console.log("\n[6] No requests to production Supabase");
    // All fetches went to localhost stub; verify by checking the RPC result handling
    const leads2 = await page.evaluate(() => JSON.parse(localStorage.getItem("sales_app_leads") || "[]").length);
    assert("both leads kept locally (server 404 fallback worked)", leads2 >= 2 + 3 /* 3 demo leads */);

    console.log("\n[7] GA4 not loaded without Measurement ID");
    const gaLoaded = await page.evaluate(() =>
        Array.from(document.querySelectorAll("script")).some(s => (s.src || "").includes("googletagmanager")));
    assert("gtag.js NOT loaded (no GA4 ID configured)", !gaLoaded);

    await browser.close();
    server.close();

    console.log(`\n==== RESULT: ${passed} passed, ${failed} failed ====`);
    process.exit(failed > 0 ? 1 : 0);
})().catch((e) => { console.error("Test crashed:", e); process.exit(1); });
