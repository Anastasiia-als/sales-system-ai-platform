const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    page.on('console', msg => console.log('LOG:', msg.text()));
    
    await page.setRequestInterception(true);
    page.on('request', async request => {
        const url = request.url();
        const method = request.method();
        
        if (url.includes('auth-service.js')) {
            request.respond({
                status: 200,
                contentType: 'application/javascript',
                body: `export const PortalAuth = {
                    init: async () => {}, isAuthenticated: () => true, isGlobalOwner: () => true, isOrgAdmin: () => false, isPM: () => false, isSpecialist: () => false, isClientUser: () => false, isStaff: () => true, isOrgMember: () => true, getSession: () => ({ id: 'mock', global_role: 'owner' }), getUser: () => ({ email: 'owner@local' }), getProfile: () => ({ full_name: 'Owner' }), getGlobalRole: () => 'owner', logout: async () => {}, addEventListener: () => {}
                };`
            });
        } else if (url.includes('portal-global-automation-view.js')) {
            let code = fs.readFileSync('js/portal/ui/portal-global-automation-view.js', 'utf8');
            code = code.replace('async function loadGlobalAutomationData() {', 'async function loadGlobalAutomationData() { console.log("loadGlobalAutomationData STARTED"); ');
            code = code.replace('const supabase = await getSupabase();', 'console.log("getting supabase"); const supabase = await getSupabase(); console.log("supabase got", !!supabase);');
            code = code.replace('} catch (e) {', '} catch (e) { console.log("CATCH", e.message);');
            code = code.replace('} finally {', '} finally { console.log("loadGlobalAutomationData FINALLY");');
            request.respond({ status: 200, contentType: 'application/javascript', body: code });
        } else if (url.includes('/rest/v1/automation')) {
            if (method === 'OPTIONS') {
                request.respond({
                    status: 204,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                        'Access-Control-Allow-Headers': '*'
                    }
                });
            } else {
                console.log('MOCKED REST:', url);
                request.respond({ 
                    status: 200, 
                    contentType: 'application/json', 
                    body: '[]', 
                    headers: { 'Access-Control-Allow-Origin': '*' } 
                });
            }
        } else {
            request.continue();
        }
    });
    
    await page.goto('http://localhost:8002/#/portal/automation', { waitUntil: 'networkidle0' });
    
    const results = await page.evaluate(() => {
        return {
            rulesHtml: document.getElementById('global-automation-list')?.innerHTML,
            logsHtml: document.getElementById('global-execution-list')?.innerHTML
        };
    });
    console.log(JSON.stringify(results, null, 2));
    
    await browser.close();
})();
