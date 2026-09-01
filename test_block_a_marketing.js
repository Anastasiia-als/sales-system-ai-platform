/* test_block_a_marketing.js — local E2E for Block A (marketing/tracking/lead capture).
   Runs fully offline: static server on localhost with a switchable Supabase RPC stub,
   so NO request ever reaches production.

   Verifies the owner's pre-production rules (2026-09-01):
   - success page ONLY after server-confirmed lead storage;
   - honest error + retry when the server fails, same event_id reused on retry;
   - generate_lead only after server confirmation;
   - no personal data in localStorage or dataLayer;
   - consent can be changed/withdrawn; no tags load without consent/IDs. */

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
    else { failed++; console.log("  FAIL: " + name + (extra !== undefined ? " — " + JSON.stringify(extra).slice(0, 200) : "")); }
}

/* Supabase RPC stub: mode switchable per test phase */
let rpcMode = "ok"; // ok | fail500 | ratelimited
let rpcCalls = [];

function startServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const urlPath = decodeURIComponent(req.url.split("?")[0]);
            if (urlPath === "/rest/v1/rpc/submit_marketing_lead" && req.method === "POST") {
                let body = "";
                req.on("data", c => body += c);
                req.on("end", () => {
                    let payload = {};
                    try { payload = JSON.parse(body).p || {}; } catch (e) {}
                    rpcCalls.push({ mode: rpcMode, event_id: payload.event_id, form_id: payload.form_id });
                    const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
                    if (rpcMode === "fail500") {
                        res.writeHead(500, headers);
                        res.end(JSON.stringify({ error: "stub failure" }));
                    } else if (rpcMode === "ratelimited") {
                        res.writeHead(200, headers);
                        res.end(JSON.stringify({ ok: false, error: "rate_limited" }));
                    } else {
                        res.writeHead(200, headers);
                        res.end(JSON.stringify({ ok: true, lead_id: "00000000-0000-4000-8000-00000000000" + rpcCalls.length, event_id: payload.event_id, duplicate: false }));
                    }
                });
                return;
            }
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
    const overrideEnv = async () => page.evaluate((p) => {
        window.FIRSTWIN_ENV = {
            SUPABASE_URL: "http://localhost:" + p,
            SUPABASE_PUBLISHABLE_KEY: "test-key",
            SUPABASE_ANON_KEY: "test-key"
        };
    }, PORT);

    console.log("\n[1] Landing with UTM + consent banner");
    await page.goto(`${base}?${utm}#/`, { waitUntil: "networkidle0" });
    await overrideEnv();

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
    const hasPageView = await page.evaluate(() =>
        (window.dataLayer || []).some(e => e && e.event === "page_view"));
    assert("page_view pushed to dataLayer", hasPageView);

    console.log("\n[3] view_offer on offer route");
    await page.evaluate(() => { window.location.hash = "#/ai-solutions"; });
    await new Promise(r => setTimeout(r, 600));
    const viewOffer = await page.evaluate(() =>
        (window.dataLayer || []).find(e => e && e.event === "view_offer"));
    assert("view_offer fired with offer_id=aiauto", !!viewOffer && viewOffer.offer_id === "aiauto");

    console.log("\n[4] Consultation form: server DOWN → honest error, no success, no generate_lead");
    rpcMode = "fail500";
    await page.evaluate(() => { window.location.hash = "#/consultation"; });
    await page.waitForSelector("#consultation-form", { timeout: 5000 });
    await page.type("#c-name", "Тест Тестовий");
    await page.type("#c-phone", "+380001112233");
    await page.type("#c-email", "test@test.local");
    await page.type("#c-problem", "E2E тест Блоку А");
    await page.evaluate(() => { document.getElementById("c-date").value = "2026-09-10"; });

    const formStart = await page.evaluate(() =>
        (window.dataLayer || []).some(e => e && e.event === "form_start" && e.form_id === "consultation"));
    assert("form_start fired", formStart);

    await page.click("#consultation-form button[type=submit]");
    await new Promise(r => setTimeout(r, 1500));
    assert("NOT redirected to success on server failure",
        await page.evaluate(() => window.location.hash) === "#/consultation");
    const errVisible = await page.evaluate(() => {
        const el = document.getElementById("c-form-error");
        return el && el.style.display !== "none" && el.textContent.length > 10;
    });
    assert("honest error message shown", errVisible);
    const retryEnabled = await page.evaluate(() =>
        !document.querySelector("#consultation-form button[type=submit]").disabled);
    assert("retry button re-enabled", retryEnabled);
    let genLeadCount = await page.evaluate(() =>
        (window.dataLayer || []).filter(e => e && e.event === "generate_lead").length);
    assert("NO generate_lead without server confirmation", genLeadCount === 0);
    const draft = await page.evaluate(() => JSON.parse(sessionStorage.getItem("ss_draft_consultation") || "null"));
    assert("short-lived draft kept in sessionStorage", !!draft && draft.fields && draft.fields.name === "Тест Тестовий");
    assert("draft has TTL timestamp", !!draft.ts);

    console.log("\n[5] Retry with server UP → success, same event_id, draft cleared");
    rpcMode = "ok";
    const failedCall = rpcCalls[rpcCalls.length - 1];
    await page.click("#consultation-form button[type=submit]");
    await page.waitForFunction(() => window.location.hash === "#/success", { timeout: 8000 });
    assert("redirected to success after confirmed save", true);
    const okCall = rpcCalls[rpcCalls.length - 1];
    assert("same event_id reused on retry (server-side dedup safe)",
        failedCall.event_id && failedCall.event_id === okCall.event_id, { failed: failedCall.event_id, ok: okCall.event_id });
    const genLead = await page.evaluate(() =>
        (window.dataLayer || []).find(e => e && e.event === "generate_lead"));
    assert("generate_lead fired AFTER confirmation with server event_id",
        !!genLead && genLead.event_id === okCall.event_id);
    assert("generate_lead carries utm_campaign", genLead && genLead.utm_campaign === "META_UA_UK_AIAUTO_COLD_SMBOWNER_202610");
    const draftAfter = await page.evaluate(() => sessionStorage.getItem("ss_draft_consultation"));
    assert("draft cleared after success", draftAfter === null);

    console.log("\n[6] No personal data at rest or in analytics");
    const localLeads = await page.evaluate(() => localStorage.getItem("sales_app_leads") || "");
    assert("submitted lead NOT stored in localStorage", !localLeads.includes("Тест Тестовий") && !localLeads.includes("test@test.local"));
    const dlClean = await page.evaluate(() => {
        const s = JSON.stringify(Array.from(window.dataLayer || []).filter(e => e && e.event));
        return !s.includes("Тест Тестовий") && !s.includes("test@test.local") && !s.includes("+380001112233");
    });
    assert("no PII in dataLayer events", dlClean);

    console.log("\n[7] Contacts form success path + placeholders removed");
    await page.evaluate(() => { window.location.hash = "#/contacts"; });
    await page.waitForSelector("#contacts-form", { timeout: 5000 });
    assert("confirmed email shown on contacts page",
        await page.evaluate(() => document.body.innerHTML.includes("a.zaporozhetswork@gmail.com")));
    assert("no placeholder contacts anywhere in DOM",
        await page.evaluate(() =>
            !document.body.innerHTML.includes("contact@example.com") &&
            !document.body.innerHTML.includes("sales_expert") &&
            !document.body.innerHTML.includes("099) 000-00-00")));
    await page.type("#ct-name", "Тест Контакт");
    await page.type("#ct-contact", "@test_tg");
    await page.type("#ct-message", "Повідомлення E2E");
    await page.click("#contacts-form button[type=submit]");
    await page.waitForFunction(() => window.location.hash === "#/success", { timeout: 8000 });
    genLeadCount = await page.evaluate(() =>
        (window.dataLayer || []).filter(e => e && e.event === "generate_lead").length);
    assert("contacts generate_lead fired after confirmation", genLeadCount === 2);

    console.log("\n[8] Rate-limited response → honest message, no success");
    rpcMode = "ratelimited";
    await page.evaluate(() => { window.location.hash = "#/contacts"; });
    await page.waitForSelector("#contacts-form", { timeout: 5000 });
    await page.type("#ct-name", "Тест Ліміт");
    await page.type("#ct-contact", "@limit_tg");
    await page.type("#ct-message", "Ще одне");
    await page.click("#contacts-form button[type=submit]");
    await new Promise(r => setTimeout(r, 1200));
    assert("stays on contacts when rate-limited",
        await page.evaluate(() => window.location.hash) === "#/contacts");
    const rlMessage = await page.evaluate(() => document.getElementById("ct-form-error").textContent);
    assert("rate-limit message shown", rlMessage.includes("Забагато"));
    rpcMode = "ok";

    console.log("\n[9] Consent can be changed / withdrawn");
    await page.evaluate(() => { window.location.hash = "#/"; });
    await new Promise(r => setTimeout(r, 600));
    await page.click("[data-consent-settings]");
    await page.waitForSelector("#consent-banner", { timeout: 5000 });
    assert("banner reopens from footer link", true);
    await page.click("#consent-decline");
    const consentAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("ss_consent") || "null"));
    assert("withdrawal stored (all denied)", !!consentAfter && !consentAfter.analytics && !consentAfter.marketing);
    const deniedPushed = await page.evaluate(() =>
        (window.dataLayer || []).some(e => e[0] === "consent" && e[1] === "update" && e[2] && e[2].analytics_storage === "denied"));
    assert("Consent Mode update=denied pushed to gtag", deniedPushed);

    console.log("\n[10] No marketing/analytics tags load without real IDs");
    const externalTags = await page.evaluate(() =>
        Array.from(document.querySelectorAll("script")).filter(s =>
            (s.src || "").includes("googletagmanager") ||
            (s.src || "").includes("google-analytics") ||
            (s.src || "").includes("connect.facebook")).length);
    assert("no GA4/Meta scripts in DOM (placeholder IDs inert)", externalTags === 0);

    await browser.close();
    server.close();

    console.log(`\n==== RESULT: ${passed} passed, ${failed} failed ====`);
    process.exit(failed > 0 ? 1 : 0);
})().catch((e) => { console.error("Test crashed:", e); process.exit(1); });
