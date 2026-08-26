const puppeteer = require('puppeteer');
const path = require('path');

const APP_URL = 'http://localhost:8002';
const OWNER_EMAIL = 'anzaitseva96@gmail.com';
const OWNER_PASS = process.env.TEST_OWNER_PASSWORD || 'Password123!';
const ARTIFACTS_DIR = 'C:\\Users\\UA\\.gemini\\antigravity\\brain\\87fdd05b-039b-4dcb-9b04-faa32d097b20';

async function runBrowserVerification() {
  console.log('=== PHASE 5C.2 BROWSER VERIFICATION ===');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE LOG ERROR:', msg.text());
  });

  try {
    // 1. Authenticate via PortalAuth in browser context
    console.log('1. Navigating to portal and authenticating...');
    await page.goto(`${APP_URL}/#/portal`, { waitUntil: 'networkidle0' });

    const authResult = await page.evaluate(async (email, pwd) => {
      const { PortalAuth } = await import('./js/portal/auth/auth-service.js');
      await PortalAuth.init();
      const res = await PortalAuth.signInWithPassword(email, pwd);
      return { success: !res.error, error: res.error?.message, user: PortalAuth.getUserEmail() };
    }, OWNER_EMAIL, OWNER_PASS);

    console.log('✔ Auth result:', authResult);

    // 2. Invoices Registry View (#/portal/invoices)
    console.log('2. Opening Invoices Registry (#/portal/invoices)...');
    await page.evaluate(() => { window.location.hash = '#/portal/invoices'; });
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('#invoice-registry-root', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => { if (window.lucide) window.lucide.createIcons(); });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase5c2_invoices_registry.png'), fullPage: true });
    console.log('✔ Saved phase5c2_invoices_registry.png');

    // 3. Open invoice detail directly from link or first row
    const invoiceLink = await page.$('a[href*="#/portal/invoices/"]');
    if (invoiceLink) {
      const invoiceUrl = await page.evaluate(el => el.href, invoiceLink);
      console.log('3. Opening Invoice Detail:', invoiceUrl);
      await page.goto(invoiceUrl, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#invoice-detail-root', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 1500));
      await page.evaluate(() => { if (window.lucide) window.lucide.createIcons(); });
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase5c2_invoice_detail.png'), fullPage: true });
      console.log('✔ Saved phase5c2_invoice_detail.png');

      // 4. Open Printable Form
      const printUrl = invoiceUrl + '/print';
      console.log('4. Opening Printable Form:', printUrl);
      await page.goto(printUrl, { waitUntil: 'networkidle0' });
      await page.waitForSelector('#invoice-print-root', { timeout: 10000 });
      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase5c2_invoice_printable.png'), fullPage: true });
      console.log('✔ Saved phase5c2_invoice_printable.png');
    }

    // 5. Finance Center with AR & Aging Buckets (#/portal/finance)
    console.log('5. Opening Finance Center with AR (#/portal/finance)...');
    await page.goto(`${APP_URL}/#/portal/finance`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#finance-center-root', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => { if (window.lucide) window.lucide.createIcons(); });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase5c2_finance_ar_center.png'), fullPage: true });
    console.log('✔ Saved phase5c2_finance_ar_center.png');

    // 6. Client Billing Workspace (#/client/billing)
    console.log('6. Opening Client Billing Workspace (#/client/billing)...');
    await page.goto(`${APP_URL}/#/client/billing`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#client-billing-root', { timeout: 10000 });
    
    // Switch org to Test Org Gamma or Alpha if available
    await page.evaluate(() => {
      const select = document.getElementById('client-org-switcher');
      if (select && select.options.length > 1) {
        for (let i = 0; i < select.options.length; i++) {
          if (select.options[i].text.includes('Gamma') || select.options[i].text.includes('Alpha')) {
            select.selectedIndex = i;
            select.dispatchEvent(new Event('change'));
            break;
          }
        }
      }
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => { if (window.lucide) window.lucide.createIcons(); });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase5c2_client_billing.png'), fullPage: true });
    console.log('✔ Saved phase5c2_client_billing.png');

    // 7. Client Dashboard (#/client/dashboard)
    console.log('7. Opening Client Dashboard (#/client/dashboard)...');
    await page.goto(`${APP_URL}/#/client/dashboard`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.client-dashboard-container', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => { if (window.lucide) window.lucide.createIcons(); });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'phase5c2_client_dashboard.png'), fullPage: true });
    console.log('✔ Saved phase5c2_client_dashboard.png');

    console.log('✔ All browser verification screenshots captured successfully!');
  } catch (err) {
    console.error('Browser verification error:', err);
  } finally {
    await browser.close();
  }
}

runBrowserVerification();
