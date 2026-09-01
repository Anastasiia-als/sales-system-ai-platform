const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', async request => {
        const url = request.url();
        if (url.includes('auth-service.js')) {
            request.respond({
                status: 200,
                contentType: 'application/javascript',
                body: `export const PortalAuth = {
                    init: async () => {},
                    isAuthenticated: () => true,
                    isGlobalOwner: () => true,
                    isOrgAdmin: () => false,
                    isPM: () => false,
                    isSpecialist: () => false,
                    isClient: () => false,
                    getSession: () => ({ id: 'mock', global_role: 'owner' }),
                    getUser: () => ({ email: 'owner@local' }),
                    getProfile: () => ({ full_name: 'Owner' }),
                    getGlobalRole: () => 'owner',
                    logout: async () => {}
                };`
            });
        } else if (url.includes('/rest/v1/automation')) {
            request.respond({ status: 200, contentType: 'application/json', body: '[]' });
        } else {
            request.continue();
        }
    });
    await page.goto('http://localhost:8002/#/portal/automation', { waitUntil: 'networkidle0' });
    let text = await page.evaluate(() => document.body.innerText);
    console.log(text.substring(0, 1000));
    await browser.close();
})();
