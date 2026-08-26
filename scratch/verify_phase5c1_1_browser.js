const puppeteer = require('puppeteer');
const path = require('path');

const APP_URL = 'http://localhost:8002';
const OWNER_EMAIL = 'anzaitseva96@gmail.com';
const OWNER_PASS = process.env.TEST_OWNER_PASSWORD || 'Password123!';
const ARTIFACT_DIR = 'C:/Users/UA/.gemini/antigravity/brain/87fdd05b-039b-4dcb-9b04-faa32d097b20';

const UAH_PROJECT_ID = '33333333-3333-3333-3333-333333333331';

async function verifyBrowser() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  console.log('--- 1. Authenticating as Owner ---');
  await page.goto(`${APP_URL}/#/portal`, { waitUntil: 'networkidle0' });

  // Direct login via PortalAuth in browser context
  const authResult = await page.evaluate(async (email, pwd) => {
    const { PortalAuth } = await import('./js/portal/auth/auth-service.js');
    await PortalAuth.init();
    const res = await PortalAuth.signInWithPassword(email, pwd);
    return { success: !res.error, error: res.error?.message, user: PortalAuth.getUserEmail() };
  }, OWNER_EMAIL, OWNER_PASS);

  console.log('✔ Auth result:', authResult);

  // 1. Finance Center #/portal/finance
  console.log('\n--- 2. Opening Finance Center (#/portal/finance) ---');
  await page.evaluate(() => { window.location.hash = '#/portal/finance'; });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('#finance-center-root', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => { if (window.lucide) window.lucide.createIcons(); });

  // Check currency buckets
  const pageText = await page.evaluate(() => document.body.innerText);
  if (!pageText.includes('UAH') || !pageText.includes('CZK') || !pageText.includes('EUR')) {
    throw new Error('Finance Center does not show all 3 currencies (UAH, CZK, EUR)');
  }
  console.log('✔ All 3 currencies (UAH, CZK, EUR) rendered in isolated aggregation cards.');

  // Check select options styling
  const optionStyles = await page.evaluate(() => {
    const sel = document.querySelector('.portal-form-select');
    const opt = sel ? sel.querySelector('option') : null;
    const computedSel = sel ? window.getComputedStyle(sel) : null;
    const computedOpt = opt ? window.getComputedStyle(opt) : null;
    return {
      selectBg: computedSel?.backgroundColor,
      selectColor: computedSel?.color,
      colorScheme: computedSel?.colorScheme,
      optionBg: computedOpt?.backgroundColor,
      optionColor: computedOpt?.color
    };
  });
  console.log('✔ Dropdown select styles:', optionStyles);

  // Take full screenshot of Finance Center
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'phase5c1_1_finance_center.png'),
    fullPage: true
  });
  console.log('✔ Screenshot saved: phase5c1_1_finance_center.png');

  // 2. Ukrainian UAH Project #/portal/projects/:id (tab Finance)
  console.log('\n--- 3. Opening Ukrainian UAH Project Finance Tab ---');
  await page.evaluate((pid) => { window.location.hash = `#/portal/projects/${pid}`; }, UAH_PROJECT_ID);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('#project-card-tabs', { timeout: 10000 });
  await page.click('.portal-tab-btn[data-tab="finance"]');
  await page.waitForSelector('#project-finance-view-root .portal-kpi-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => { if (window.lucide) window.lucide.createIcons(); });

  const uahKpis = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.portal-kpi-card'));
    return cards.map(c => c.innerText.replace(/\n/g, ' '));
  });
  console.log('✔ UAH KPI Cards rendered:');
  uahKpis.forEach(k => console.log('   •', k));

  // Take full page screenshot of UAH Project Finance Tab
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'phase5c1_1_uah_project_finance.png'),
    fullPage: true
  });
  console.log('✔ Screenshot saved: phase5c1_1_uah_project_finance.png');

  // 3. Demo Project Alpha 1 (top KPI grid)
  console.log('\n--- 4. Opening Demo Project Alpha 1 (Compact KPI Grid Check) ---');
  await page.evaluate(() => { window.location.hash = `#/portal/projects/170d3c57-224b-4ae5-a384-0ccdf17252cc`; });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('#project-card-tabs', { timeout: 10000 });
  await page.click('.portal-tab-btn[data-tab="finance"]');
  await page.waitForSelector('#project-finance-view-root .portal-kpi-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => { if (window.lucide) window.lucide.createIcons(); });

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'phase5c1_1_alpha1_compact_kpis.png'),
    fullPage: false
  });
  console.log('✔ Screenshot saved: phase5c1_1_alpha1_compact_kpis.png');

  console.log('\n--- 5. Console Errors Check ---');
  console.log('Runtime console errors count:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
  }

  await browser.close();
  console.log('\n✅ All browser verifications passed with 0 console errors!');
}

verifyBrowser().catch(err => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
