const fs = require("fs");
const file = "./js/pages/portal-page.js";
let content = fs.readFileSync(file, "utf8");

if (!content.includes("portal-global-automation-view.js")) {
    content = content.replace(
        `import { renderTemplatesView, initTemplatesEvents } from "../portal/ui/portal-templates-view.js";`,
        `import { renderTemplatesView, initTemplatesEvents } from "../portal/ui/portal-templates-view.js";\nimport { renderGlobalAutomationView, initGlobalAutomationEvents } from "../portal/ui/portal-global-automation-view.js";`
    );
}

if (!content.includes("activeSection === `automation`".replace(/`/g, "\""))) {
    let parts = content.split(`} else if (activeSection === "templates") {`);
    if (parts.length === 3) {
        content = parts[0] +
            `} else if (activeSection === "automation") {\n            if (PortalAuth.isSpecialist() && !PortalAuth.isGlobalOwner() && !PortalAuth.isOrgAdmin()) {\n                breadcrumbTitle = "Автоматизації";\n                childHtml = "<div class=\\"portal-content\\"><div class=\\"portal-placeholder-box\\"><div class=\\"portal-empty-title\\">Доступ закрито</div></div></div>";\n            } else {\n                breadcrumbTitle = "Автоматизації";\n                childHtml = renderGlobalAutomationView();\n            }\n        } else if (activeSection === "templates") {` +
            parts[1] +
            `} else if (activeSection === "automation") {\n            if (!PortalAuth.isSpecialist() || PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin()) {\n                await initGlobalAutomationEvents();\n            }\n        } else if (activeSection === "templates") {` +
            parts[2];
    }
}

fs.writeFileSync(file, content);
console.log("Patched portal-page.js");
