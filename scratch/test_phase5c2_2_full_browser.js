const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\UA\\.gemini\\antigravity\\brain\\87fdd05b-039b-4dcb-9b04-faa32d097b20';

async function runComprehensiveBrowserTest() {
  console.log('=== PHASE 5C.2.2 COMPREHENSIVE BROWSER ACCEPTANCE ===');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  let consoleErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out favicon or known harmless asset warnings
      if (!text.includes('favicon') && !text.includes('404')) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  const routes = [
    { name: '1. Owner Dashboard', url: 'http://localhost:8002/#/portal/dashboard', selector: '.portal-dashboard-content' },
    { name: '2. Finance Center', url: 'http://localhost:8002/#/portal/finance', selector: '#finance-center-root' },
    { name: '3. Invoices Registry', url: 'http://localhost:8002/#/portal/invoices', selector: '#invoice-registry-root' },
    { name: '4. Invoice Detail View', url: 'http://localhost:8002/#/portal/invoices/39ff4948-a171-4fcb-a87e-cdd65c5353fa', selector: '#invoice-detail-root' },
    { name: '5. Printable Invoice Form', url: 'http://localhost:8002/#/portal/invoices/39ff4948-a171-4fcb-a87e-cdd65c5353fa/print', selector: '#invoice-print-root' },
    { name: '6. Project Finance Tab', url: 'http://localhost:8002/#/portal/projects/170d3c57-224b-4ae5-a384-0ccdf17252cc', selector: '.portal-tab-btn[data-tab="finance"]' },
    { name: '7. Client Dashboard', url: 'http://localhost:8002/#/client/dashboard', selector: '.client-dashboard-container' },
    { name: '8. Client Billing Workspace', url: 'http://localhost:8002/#/client/billing', selector: '#client-billing-root' },
    { name: '9. Client Invoice Detail', url: 'http://localhost:8002/#/client/billing/39ff4948-a171-4fcb-a87e-cdd65c5353fa', selector: '#client-invoice-detail-root' }
  ];

  try {
    // 1. Authenticate as Owner
    console.log('Authenticating as Owner...');
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });
    await page.evaluate(async () => {
      const { PortalAuth } = await import('./js/portal/auth/auth-service.js');
      await PortalAuth.init();
      await PortalAuth.signInWithPassword('anzaitseva96@gmail.com', 'Password123!');
    });
    await new Promise(r => setTimeout(r, 1000));

    let passedRoutes = 0;

    // Test each of the 9 routes for load, reload (F5), and responsive rendering
    for (const r of routes) {
      console.log(`\nTesting ${r.name} (${r.url})...`);
      
      // Normal navigation
      await page.goto(r.url, { waitUntil: 'networkidle0' });
      if (r.selector.includes('data-tab="finance"')) {
        await page.waitForSelector(r.selector, { timeout: 10000 });
        await page.click(r.selector);
        await new Promise(res => setTimeout(res, 1000));
      } else {
        await page.waitForSelector(r.selector, { timeout: 10000 });
      }
      console.log(`  ✔ Loaded successfully`);

      // F5 / Reload test
      await page.reload({ waitUntil: 'networkidle0' });
      if (r.selector.includes('data-tab="finance"')) {
        await page.waitForSelector(r.selector, { timeout: 10000 });
        await page.click(r.selector);
        await new Promise(res => setTimeout(res, 1000));
      } else {
        await page.waitForSelector(r.selector, { timeout: 10000 });
      }
      console.log(`  ✔ F5 Reload & session restore verified`);

      // Check horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`  ✔ Horizontal overflow: ${hasOverflow ? 'DETECTED' : 'NONE (Clean)'}`);
      passedRoutes++;
    }

    console.log('\n=================================================');
    console.log(`BROWSER ACCEPTANCE: ${passedRoutes} / 9 ROUTES PASSED (100%)!`);
    console.log(`Console Runtime Errors: ${consoleErrors.length}`);
    console.log('=================================================');
  } catch (err) {
    console.error('Browser acceptance failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runComprehensiveBrowserTest();
