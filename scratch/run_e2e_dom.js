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
                    init: async () => {}, isAuthenticated: () => true, isGlobalOwner: () => true, isOrgAdmin: () => false, isPM: () => false, isSpecialist: () => false, isClientUser: () => false, isStaff: () => true, isOrgMember: () => true, getSession: () => ({ id: 'mock', global_role: 'owner' }), getUser: () => ({ email: 'owner@local' }), getProfile: () => ({ full_name: 'Owner' }), getGlobalRole: () => 'owner', logout: async () => {}, addEventListener: () => {}
                };`
            });
        } else if (url.includes('/rest/v1/automation')) {
            // Correct mock for both tables
            request.respond({ status: 200, contentType: 'application/json', body: '[]', headers: { 'Access-Control-Allow-Origin': '*' } });
        } else {
            request.continue();
        }
    });
    
    await page.goto('http://localhost:8002/#/portal/automation', { waitUntil: 'networkidle0' });
    
    // Evaluate explicit DOM states
    const results = await page.evaluate(() => {
        return {
            rulesHtml: document.getElementById('global-automation-list')?.innerHTML,
            logsHtml: document.getElementById('global-execution-list')?.innerHTML,
            rulesText: document.getElementById('global-automation-list')?.innerText,
            logsText: document.getElementById('global-execution-list')?.innerText
        };
    });
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
})();
