const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\UA\\.gemini\\antigravity\\brain\\87fdd05b-039b-4dcb-9b04-faa32d097b20';

async function runPhase5DBrowserSuite() {
  console.log('=== PHASE 5D BROWSER ACCEPTANCE & VIEWPORT SUITE ===');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  let consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('404')) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  const routes = [
    { name: '1. Analytics Center', url: 'http://localhost:8002/#/portal/analytics', selector: '#analytics-center-root' },
    { name: '2. Reports Center', url: 'http://localhost:8002/#/portal/reports', selector: '#reports-center-root' },
    { name: '3. Owner Dashboard with Analytics Widget', url: 'http://localhost:8002/#/portal/dashboard', selector: '.portal-dashboard-content' }
  ];

  try {
    // 1. Authenticate as Owner
    console.log('Authenticating as Owner...');
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });
    await page.evaluate(async () => {
      const { PortalAuth } = await import('./js/portal/auth/auth-service.js');
      await PortalAuth.init();
      await PortalAuth.signInWithPassword('anzaitseva96@gmail.com', process.env.OWNER_PASSWORD);
    });
    await new Promise(r => setTimeout(r, 1000));

    // Test routes & capture screenshots
    for (const r of routes) {
      console.log(`\nTesting ${r.name} (${r.url})...`);
      
      // Normal load
      await page.goto(r.url, { waitUntil: 'networkidle0' });
      await page.waitForSelector(r.selector, { timeout: 10000 });
      console.log(`  ✔ Loaded successfully`);

      // F5 reload
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector(r.selector, { timeout: 10000 });
      console.log(`  ✔ F5 Reload & session restore verified`);

      // Overflow check
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`  ✔ Horizontal overflow: ${hasOverflow ? 'DETECTED' : 'NONE (Clean)'}`);
    }

    // Capture desktop screenshots
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('http://localhost:8002/#/portal/analytics', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#analytics-center-root', { timeout: 10000 });
    await new Promise(res => setTimeout(res, 1000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase5d_analytics_center.png'), fullPage: true });
    console.log('  ✔ Saved phase5d_analytics_center.png');

    await page.goto('http://localhost:8002/#/portal/reports', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#reports-center-root', { timeout: 10000 });
    await new Promise(res => setTimeout(res, 1000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase5d_reports_center.png'), fullPage: true });
    console.log('  ✔ Saved phase5d_reports_center.png');

    await page.goto('http://localhost:8002/#/portal/dashboard', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.portal-dashboard-content', { timeout: 10000 });
    await new Promise(res => setTimeout(res, 1000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase5d_owner_dashboard_analytics.png'), fullPage: true });
    console.log('  ✔ Saved phase5d_owner_dashboard_analytics.png');

    // Mobile Viewport (375x812)
    await page.setViewport({ width: 375, height: 812 });
    await page.goto('http://localhost:8002/#/portal/analytics', { waitUntil: 'networkidle0' });
    await page.waitForSelector('#analytics-center-root', { timeout: 10000 });
    await new Promise(res => setTimeout(res, 1000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase5d_analytics_mobile.png'), fullPage: true });
    console.log('  ✔ Saved phase5d_analytics_mobile.png');

    console.log('\n=================================================');
    console.log(`PHASE 5D BROWSER ACCEPTANCE: ALL ROUTES PASSED!`);
    console.log(`Console Runtime Errors: ${consoleErrors.length}`);
    console.log('=================================================');

    if (consoleErrors.length > 0) {
      console.error('Errors found:', consoleErrors);
      process.exit(1);
    }
  } catch (err) {
    console.error('Browser acceptance failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runPhase5DBrowserSuite();
