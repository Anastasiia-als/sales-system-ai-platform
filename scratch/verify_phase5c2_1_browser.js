const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\UA\\.gemini\\antigravity\\brain\\87fdd05b-039b-4dcb-9b04-faa32d097b20';

async function runBrowserAcceptance() {
  console.log('Launching browser for Phase 5C.2.1 multi-viewport regression...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  let runtimeErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      runtimeErrors.push(`[CONSOLE_ERROR] ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    runtimeErrors.push(`[PAGE_ERROR] ${error.message}`);
  });

  // Test across responsive breakpoints
  const viewports = [
    { name: 'desktop_1920', width: 1920, height: 1080 },
    { name: 'laptop_1366', width: 1366, height: 768 },
    { name: 'tablet_768', width: 768, height: 1024 },
    { name: 'mobile_375', width: 375, height: 812 }
  ];

  try {
    // 1. Authenticate via PortalAuth
    await page.setViewport(viewports[0]);
    await page.goto('http://localhost:8002/#/portal', { waitUntil: 'networkidle0' });

    const authResult = await page.evaluate(async () => {
      const { PortalAuth } = await import('./js/portal/auth/auth-service.js');
      await PortalAuth.init();
      const res = await PortalAuth.signInWithPassword('anzaitseva96@gmail.com', 'Password123!');
      return { success: !res.error, error: res.error?.message };
    });
    console.log('Auth result:', authResult);
    await new Promise(r => setTimeout(r, 1000));

    console.log('Logged in as Owner. Testing Portal views...');

    // 1.1 Invoices Registry
    await page.goto('http://localhost:8002/#/portal/invoices', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase5c2_1_invoices_registry.png') });
    console.log('  ✔ Captured phase5c2_1_invoices_registry.png');

    // Get an invoice ID from the registry to open detail and print view
    const invoiceId = await page.evaluate(() => {
      const btn = document.querySelector('[data-action="open-invoice"]');
      return btn ? btn.getAttribute('data-id') : null;
    });

    if (invoiceId) {
      // 1.2 Invoice Detail
      await page.goto(`http://localhost:8002/#/portal/invoices/${invoiceId}`, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase5c2_1_invoice_detail.png') });
      console.log('  ✔ Captured phase5c2_1_invoice_detail.png');

      // 1.3 Invoice Printable View
      await page.goto(`http://localhost:8002/#/portal/invoices/${invoiceId}/print`, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase5c2_1_invoice_printable.png') });
      console.log('  ✔ Captured phase5c2_1_invoice_printable.png');
    }

    // 1.4 Finance Center with AR
    await page.goto('http://localhost:8002/#/portal/finance', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase5c2_1_finance_ar.png') });
    console.log('  ✔ Captured phase5c2_1_finance_ar.png');

    // 1.5 Project Finance Tab
    await page.goto('http://localhost:8002/#/portal/projects/77777777-7777-4700-8000-000000000001', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));
    // Click Finance tab
    await page.evaluate(() => {
      const tab = document.querySelector('[data-tab="finance"]');
      if (tab) tab.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase5c2_1_project_finance.png') });
    console.log('  ✔ Captured phase5c2_1_project_finance.png');

    // 1.6 Owner Dashboard with AR Widget
    await page.goto('http://localhost:8002/#/portal/dashboard', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase5c2_1_owner_dashboard.png') });
    console.log('  ✔ Captured phase5c2_1_owner_dashboard.png');

    // 2. Client Workspace
    console.log('Testing Client Workspace views...');

    // 2.1 Client Billing
    await page.goto('http://localhost:8002/#/client/billing', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase5c2_1_client_billing.png') });
    console.log('  ✔ Captured phase5c2_1_client_billing.png');

    // 2.2 Client Dashboard with «Очікується оплата»
    await page.goto('http://localhost:8002/#/client/dashboard', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase5c2_1_client_dashboard.png') });
    console.log('  ✔ Captured phase5c2_1_client_dashboard.png');

    // 2.3 Responsive Checks on Mobile Viewport
    console.log('Testing Mobile (375x812) Viewport...');
    await page.setViewport(viewports[3]);
    await page.goto('http://localhost:8002/#/client/billing', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase5c2_1_client_billing_mobile.png') });
    console.log('  ✔ Captured phase5c2_1_client_billing_mobile.png');

    await page.goto('http://localhost:8002/#/portal/invoices', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'phase5c2_1_invoices_mobile.png') });
    console.log('  ✔ Captured phase5c2_1_invoices_mobile.png');

    console.log('\n--- BROWSER VERIFICATION SUMMARY ---');
    console.log(`Runtime errors logged: ${runtimeErrors.length}`);
    if (runtimeErrors.length > 0) {
      console.warn('Errors:', runtimeErrors);
    }
  } catch (err) {
    console.error('Puppeteer verification failed:', err);
  } finally {
    await browser.close();
  }
}

runBrowserAcceptance();
