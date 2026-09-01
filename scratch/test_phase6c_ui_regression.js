const fs = require('fs');
const assert = require('assert');

async function run() {
    let passed = 0;
    console.log("=== Phase 6C UI Routing & Sidebar Regression Protection ===");

    // 1. Owner sidebar contains Автоматизації
    const shellStr = fs.readFileSync('js/portal/ui/portal-shell.js', 'utf8');
    assert(shellStr.includes('label: "Автоматизації"'), "Owner sidebar must contain 'Автоматизації'");
    passed++;
    
    // 2. href exactly #/portal/automation
    assert(shellStr.includes('href: "#/portal/automation"'), "Sidebar must link to '#/portal/automation'");
    passed++;
    
    // 3. canSeeAutomation correctly configured
    assert(shellStr.includes('const canSeeAutomation = PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin()'), "canSeeAutomation must strictly check isGlobalOwner || isOrgAdmin");
    passed++;
    
    // 4. Specialist/Client не отримують доступ
    const pageStr = fs.readFileSync('js/pages/portal-page.js', 'utf8');
    assert(pageStr.includes('if (!PortalAuth.isGlobalOwner() && !PortalAuth.isOrgAdmin())'), "Route must deny access if not Owner or PM");
    passed++;

    // 5. Owner direct route renders Automation Command Center (not generic placeholder)
    assert(pageStr.includes('childHtml = renderGlobalAutomationView()'), "Route must render renderGlobalAutomationView()");
    const automationBlock = pageStr.substring(pageStr.indexOf('activeSection === "automation"'), pageStr.indexOf('activeSection === "templates"'));
    assert(!automationBlock.includes('Модуль знаходиться в розробці'), "Automation route must NOT render generic placeholder");
    passed++;
    
    // 6. Test F5 and exact route string mapping
    assert(pageStr.includes('} else if (activeSection === "automation") {'), "Route map must explicitly intercept 'automation'");
    passed++;

    console.log(`[PASS] UI Regression Protection: ${passed}/${passed} assertions passed.`);
    return passed;
}

run().catch(err => {
    console.error("[FAIL]", err);
    process.exit(1);
});
