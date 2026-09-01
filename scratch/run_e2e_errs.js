const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    await page.setRequestInterception(true);
    page.on('request', async request => {
        const url = request.url();
        if (url.includes('auth-service.js')) {
            request.respond({
                status: 200,
                contentType: 'application/javascript',
                body: `export const PortalAuth = {
                    init: async () => {}, isAuthenticated: () => true, isGlobalOwner: () => true, isOrgAdmin: () => false, isPM: () => false, isSpecialist: () => false, isClientUser: () => false, isStaff: () => true, isOrgMember: () => true, getSession: () => ({ id: 'mock', global_role: 'owner' }), getUser: () => ({ email: 'owner@local' }), getProfile: () => ({ full_name: 'Owner' }), getGlobalRole: () => 'owner', logout: async () => {}, addEventListener: () => {}
                };`
            });
        } else if (url.includes('/rest/v1/automation')) {
            request.respond({ status: 200, contentType: 'application/json', body: '[]' });
        } else {
            request.continue();
        }
    });
    
    await page.goto('http://localhost:8002/#/portal/automation', { waitUntil: 'networkidle0' });
    await browser.close();
})();
