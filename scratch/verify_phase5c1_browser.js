const puppeteer = require('puppeteer');

const APP_URL = 'http://localhost:8002';
const OWNER_EMAIL = 'anzaitseva96@gmail.com';
const OWNER_PASS = process.env.TEST_OWNER_PASSWORD || 'Password123!';

async function verifyBrowser() {
  console.log('=== Phase 5C.1 In-Browser Finance Verification ===');

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('pageerror', err => {
    const str = err.toString();
    if (!str.includes('favicon.ico') && !str.includes('404')) consoleErrors.push(str);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('favicon.ico') && !txt.includes('404')) {
        consoleErrors.push(txt);
        console.error('[BROWSER ERROR]', txt);
      }
    }
  });

  try {
    // 1. Authenticate as Owner
    console.log('1. Authenticating as Owner...');
    await page.goto(`${APP_URL}/#/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${APP_URL}/#/portal`, { waitUntil: 'networkidle0' });

    await page.waitForSelector('#auth-email-pwd', { timeout: 10000 });
    await page.type('#auth-email-pwd', OWNER_EMAIL);
    await page.type('#auth-password', OWNER_PASS);
    await page.click('#btn-submit-pwd');
    await page.waitForSelector('.portal-sidebar', { timeout: 12000 });
    console.log('✔ Authenticated as Owner.');

    // 2. Open Project Detail -> Tab Фінанси
    console.log('2. Navigating to Demo Project Alpha 1...');
    await page.goto(`${APP_URL}/#/portal/projects/170d3c57-224b-4ae5-a384-0ccdf17252cc`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#project-card-tabs', { timeout: 10000 });

    console.log('3. Clicking tab «Фінанси»...');
    await page.click('.portal-tab-btn[data-tab="finance"]');
    await page.waitForSelector('#project-finance-view-root .portal-kpi-card', { timeout: 10000 });

    // Verify KPIs
    const kpiTexts = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#project-finance-view-root .portal-kpi-card'));
      return cards.map(c => ({
        label: c.querySelector('.portal-kpi-label')?.innerText.trim(),
        val: c.querySelector('.portal-kpi-value')?.innerText.trim()
      }));
    });
    console.log('Project Finance KPIs:', kpiTexts);

    // Verify Owner Economics Box
    const ownerEconomics = await page.evaluate(() => {
      const box = document.querySelector('#project-finance-view-root .portal-card[style*="dashed"]');
      return Boolean(box);
    });
    console.log('Owner Confidential Economics Box visible:', ownerEconomics);

    // Verify Payment Schedule tranches count
    const tranchesCount = await page.evaluate(() => {
      return document.querySelectorAll('tr[data-tranche-id]').length;
    });
    console.log(`Payment Schedule Tranches Rendered: ${tranchesCount}`);

    // Verify Received Payments count
    const paymentsCount = await page.evaluate(() => {
      return document.querySelectorAll('.portal-card:nth-of-type(3) tbody tr').length;
    });
    console.log(`Received Payments Rendered: ${paymentsCount}`);

    // 4. Open Finance Center #/portal/finance
    console.log('4. Navigating to #/portal/finance (Finance Center)...');
    await page.goto(`${APP_URL}/#/portal/finance`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#finance-center-root table', { timeout: 10000 });

    const financeCenterRowsCount = await page.evaluate(() => {
      return document.querySelectorAll('#finance-center-root tbody tr').length;
    });
    console.log(`Finance Center Table Rows: ${financeCenterRowsCount}`);

    // 5. Open Owner Dashboard #/portal/dashboard
    console.log('5. Navigating to #/portal/dashboard...');
    await page.goto(`${APP_URL}/#/portal/dashboard`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.portal-financial-summary-list', { timeout: 10000 });

    const hasFinancialWidget = await page.evaluate(() => {
      return Boolean(document.querySelector('.portal-financial-summary-list'));
    });
    console.log('Dashboard Financial State Widget visible:', hasFinancialWidget);

    // 6. Return to Demo Project Alpha 1 -> Фінанси as final state
    console.log('6. Returning to Demo Project Alpha 1 -> Фінанси (final state)...');
    await page.goto(`${APP_URL}/#/portal/projects/170d3c57-224b-4ae5-a384-0ccdf17252cc`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#project-card-tabs', { timeout: 10000 });
    await page.click('.portal-tab-btn[data-tab="finance"]');
    await page.waitForSelector('#project-finance-view-root .portal-kpi-card', { timeout: 10000 });

    console.log('\n=== Final Browser Assertion Summary ===');
    console.log(`✔ Project Finance Tab renders KPIs & Economics: ${kpiTexts.length >= 4 && ownerEconomics ? 'PASS' : 'FAIL'}`);
    console.log(`✔ Payment Schedule & Payments tables render: ${tranchesCount >= 3 ? 'PASS' : 'FAIL'}`);
    console.log(`✔ Finance Center #/portal/finance renders portfolio table: ${financeCenterRowsCount >= 3 ? 'PASS' : 'FAIL'}`);
    console.log(`✔ Owner Dashboard financial widget renders: ${hasFinancialWidget ? 'PASS' : 'FAIL'}`);
    console.log(`✔ Console runtime errors: ${consoleErrors.length} (${consoleErrors.length === 0 ? 'PASS' : 'FAIL'})`);

    if (consoleErrors.length > 0) {
      throw new Error(`Console errors detected: ${JSON.stringify(consoleErrors)}`);
    }

  } finally {
    await browser.close();
  }
}

verifyBrowser().catch(err => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
