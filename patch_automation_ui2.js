const fs = require("fs");
const file = "js/portal/ui/portal-automation-view.js";
let content = fs.readFileSync(file, "utf8");

if (!content.includes("RuleBuilderUI")) {
    content = "import { RuleBuilderUI } from `./portal-rule-builder-ui.js`;\n" + content;
    content = content.replace("initPortalAutomationEvents() {", "initPortalAutomationEvents() {\n    RuleBuilderUI.init();");
    
    // Replace the old JSON loading logic with RuleBuilderUI.load
    content = content.replace(
        /document\.getElementById\("rule-conditions"\)\.value = JSON\.stringify\(rule\.conditions \|\| \[\]\);/g,
        ""
    );
    content = content.replace(
        /document\.getElementById\("rule-actions"\)\.value = JSON\.stringify\(rule\.actions \|\| \[\]\);/g,
        "RuleBuilderUI.load(rule.conditions || [], rule.actions || []);"
    );
    // Also patch for empty new rule
    content = content.replace(
        /document\.getElementById\("rule-conditions"\)\.value = "\[\]";/g,
        ""
    );
    content = content.replace(
        /document\.getElementById\("rule-actions"\)\.value = "\[\]";/g,
        "RuleBuilderUI.load([], []);"
    );
    
    fs.writeFileSync(file, content);
    console.log("Patched portal-automation-view.js");
}


