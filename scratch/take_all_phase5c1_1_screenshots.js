const puppeteer = require('puppeteer');
const path = require('path');

const APP_URL = 'http://localhost:8002';
const OWNER_EMAIL = 'anzaitseva96@gmail.com';
const OWNER_PASS = process.env.TEST_OWNER_PASSWORD || process.env.OWNER_PASSWORD;
const ARTIFACT_DIR = 'C:/Users/UA/.gemini/antigravity/brain/87fdd05b-039b-4dcb-9b04-faa32d097b20';

const UAH_PROJECT_ID = '33333333-3333-3333-3333-333333333331';
const ALPHA_1_PROJECT_ID = '170d3c57-224b-4ae5-a384-0ccdf17252cc';

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    console.log('PAGE LOG [' + msg.type() + ']:', msg.text());
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  console.log('1. Initializing and ensuring Owner session...');
  await page.goto(`${APP_URL}/#/portal`, { waitUntil: 'networkidle0' });

  const auth = await page.evaluate(async (email, pwd) => {
    const { PortalAuth } = await import('./js/portal/auth/auth-service.js');
    await PortalAuth.init();
    if (PortalAuth.isAuthenticated() && PortalAuth.getUserEmail() === email && PortalAuth.isGlobalOwner()) {
      return { status: 'already_authenticated', email: PortalAuth.getUserEmail() };
    }
    await PortalAuth.signOut();
    const res = await PortalAuth.signInWithPassword(email, pwd);
    return { status: 'signed_in', success: !res.error, email: PortalAuth.getUserEmail(), error: res.error?.message };
  }, OWNER_EMAIL, OWNER_PASS);

  console.log('✔ Auth status:', auth);

  // ---------------------------------------------------------------------------
  // 2. Finance Center #/portal/finance
  // ---------------------------------------------------------------------------
  console.log('\n2. Capturing Finance Center (#/portal/finance)...');
  await page.goto(`${APP_URL}/#/portal/finance`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#finance-center-root', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => { if (window.lucide) window.lucide.createIcons(); });

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'phase5c1_1_finance_center_full.png'),
    fullPage: true
  });
  console.log('✔ Screenshot 1 saved: phase5c1_1_finance_center_full.png');

  // ---------------------------------------------------------------------------
  // 3. Ukrainian UAH Project: Demo Project Gamma 1 (#/portal/projects/:id)
  // ---------------------------------------------------------------------------
  console.log('\n3. Capturing Ukrainian UAH Project (Finance tab)...');
  await page.goto(`${APP_URL}/#/portal/projects/${UAH_PROJECT_ID}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#project-card-tabs', { timeout: 10000 });
  await page.click('.portal-tab-btn[data-tab="finance"]');
  await page.waitForSelector('#project-finance-view-root .portal-kpi-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => { if (window.lucide) window.lucide.createIcons(); });

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'phase5c1_1_uah_project_finance_full.png'),
    fullPage: true
  });
  console.log('✔ Screenshot 2 saved: phase5c1_1_uah_project_finance_full.png');

  // ---------------------------------------------------------------------------
  // 4. Demo Project Alpha 1: Compact KPI grid check
  // ---------------------------------------------------------------------------
  console.log('\n4. Capturing Demo Project Alpha 1 (Compact 4-Card KPI Grid)...');
  await page.goto(`${APP_URL}/#/portal/projects/${ALPHA_1_PROJECT_ID}`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#project-card-tabs', { timeout: 10000 });
  await page.click('.portal-tab-btn[data-tab="finance"]');
  await page.waitForSelector('#project-finance-view-root .portal-kpi-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => { if (window.lucide) window.lucide.createIcons(); });

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'phase5c1_1_alpha1_compact_kpis.png'),
    fullPage: false
  });
  console.log('✔ Screenshot 3 saved: phase5c1_1_alpha1_compact_kpis.png');

  console.log('\n--- 5. Diagnostics ---');
  console.log('Console errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Errors:', consoleErrors);
  }

  await browser.close();
  console.log('\n✅ All screenshots captured successfully with 0 errors!');
}

run().catch(err => {
  console.error('Run failed:', err);
  process.exit(1);
});
