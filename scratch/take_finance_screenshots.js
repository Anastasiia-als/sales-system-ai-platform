const puppeteer = require('puppeteer');
const path = require('path');

const APP_URL = 'http://localhost:8002';
const OWNER_EMAIL = 'anzaitseva96@gmail.com';
const OWNER_PASS = process.env.TEST_OWNER_PASSWORD || 'Password123!';
const ARTIFACT_DIR = 'C:/Users/UA/.gemini/antigravity/brain/87fdd05b-039b-4dcb-9b04-faa32d097b20';

async function takeScreenshots() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Authenticate
  console.log('Authenticating...');
  await page.goto(`${APP_URL}/#/`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${APP_URL}/#/portal`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
  await page.type('#auth-email-pwd', OWNER_EMAIL);
  await page.type('#auth-password', OWNER_PASS);
  await page.click('#btn-submit-pwd');
  await page.waitForSelector('.portal-sidebar', { timeout: 12000 });
  console.log('✔ Authenticated.');

  // 1. Project Finance Tab - TOP (KPI + Commercial Terms)
  console.log('1. Opening Project Alpha 1 → Фінанси (top)...');
  await page.goto(`${APP_URL}/#/portal/projects/170d3c57-224b-4ae5-a384-0ccdf17252cc`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#project-card-tabs', { timeout: 10000 });
  await page.click('.portal-tab-btn[data-tab="finance"]');
  await page.waitForSelector('#project-finance-view-root .portal-kpi-card', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => { if (window.lucide) window.lucide.createIcons(); });
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'finance_tab_top.png'),
    fullPage: false
  });
  console.log('✔ Screenshot 1: finance_tab_top.png');

  // 2. Project Finance Tab - BOTTOM (scroll down to see schedule, payments, costs)
  console.log('2. Scrolling down for schedule + payments + costs...');
  await page.evaluate(() => {
    const finRoot = document.getElementById('project-finance-view-root');
    if (finRoot) finRoot.scrollIntoView({ block: 'end', behavior: 'instant' });
    window.scrollBy(0, 600);
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'finance_tab_bottom.png'),
    fullPage: false
  });
  console.log('✔ Screenshot 2: finance_tab_bottom.png');

  // 2b. Full-page screenshot of the finance tab
  console.log('2b. Full-page screenshot of finance tab...');
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'finance_tab_full.png'),
    fullPage: true
  });
  console.log('✔ Screenshot 2b: finance_tab_full.png');

  // 3. Finance Center #/portal/finance
  console.log('3. Opening #/portal/finance (Finance Center)...');
  await page.goto(`${APP_URL}/#/portal/finance`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#finance-center-root', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'finance_center_top.png'),
    fullPage: false
  });
  console.log('✔ Screenshot 3: finance_center_top.png');

  // 3b. Scroll down for the table
  await page.evaluate(() => window.scrollBy(0, 500));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'finance_center_table.png'),
    fullPage: false
  });
  console.log('✔ Screenshot 3b: finance_center_table.png');

  // 3c. Full page
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'finance_center_full.png'),
    fullPage: true
  });
  console.log('✔ Screenshot 3c: finance_center_full.png');

  console.log('\n✅ All screenshots saved.');
  await browser.close();
}

takeScreenshots().catch(err => {
  console.error('Screenshot error:', err);
  process.exit(1);
});
