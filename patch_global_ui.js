const fs = require("fs");
const file = "js/portal/ui/portal-global-automation-view.js";
let content = fs.readFileSync(file, "utf8");

const newModal = `<!-- Modals -->
<div id="global-rule-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-6 rounded shadow-lg w-3/4 max-w-4xl max-h-[90vh] overflow-y-auto text-left">
        <h3 class="text-xl font-bold mb-4" id="global-rule-modal-title">Створити правило</h3>
        <input type="hidden" id="global-rule-id" value="">
        
        <div class="mb-4 flex gap-4">
            <div class="flex-1">
                <label class="block text-sm font-semibold mb-1">Назва правила</label>
                <input type="text" id="global-rule-name" class="w-full border p-2 rounded" placeholder="Введіть назву правила...">
            </div>
            <div class="flex-1">
                <label class="block text-sm font-semibold mb-1">Scope (Project/Template ID)</label>
                <input type="text" id="global-rule-scope" class="w-full border p-2 rounded" placeholder="UUID проєкту або шаблону...">
            </div>
            <div class="flex-1">
                <label class="block text-sm font-semibold mb-1">Подія (Trigger)</label>
                <select id="global-rule-trigger" class="w-full border p-2 rounded">
                    <option value="stage_started">Етап розпочато (Stage Started)</option>
                    <option value="stage_completed">Етап завершено (Stage Completed)</option>
                    <option value="task_created">Задачу створено (Task Created)</option>
                    <option value="task_completed">Задачу завершено (Task Completed)</option>
                    <option value="client_action_completed">Клієнтську дію завершено</option>
                    <option value="sla_warning">SLA Warning</option>
                    <option value="sla_breach">SLA Breach</option>
                    <option value="project_health_changed">Зміна Project Health</option>
                    <option value="blocker_created">Блокер створено</option>
                    <option value="blocker_resolved">Блокер закрито</option>
                </select>
            </div>
        </div>

        <div class="mb-6 bg-slate-50 p-4 border rounded">
            <div class="flex justify-between items-center mb-2">
                <label class="block text-sm font-semibold">Умови (Conditions)</label>
                <button id="btn-global-add-condition" class="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">+ Додати умову</button>
            </div>
            <div id="global-conditions-list" class="space-y-2 mb-2"></div>
        </div>

        <div class="mb-6 bg-slate-50 p-4 border rounded">
            <div class="flex justify-between items-center mb-2">
                <label class="block text-sm font-semibold">Дії (Actions)</label>
                <div>
                    <select id="global-action-type-select" class="text-sm border p-1 rounded bg-white">
                        <option value="start_stage">Start Stage</option>
                        <option value="complete_stage">Complete Stage</option>
                        <option value="create_task">Create Task</option>
                        <option value="create_client_action">Create Client Action</option>
                        <option value="notification">Send Notification</option>
                    </select>
                    <button id="btn-global-add-action" class="text-sm bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">+ Додати дію</button>
                </div>
            </div>
            <div id="global-actions-list" class="space-y-2 mb-2"></div>
        </div>

        <details class="mb-4">
            <summary class="text-sm text-gray-500 cursor-pointer">Розширені налаштування (Advanced JSON)</summary>
            <div class="mt-2 space-y-2">
                <label class="block text-xs font-semibold">Conditions JSON</label>
                <textarea id="global-rule-conditions" class="w-full border p-2 rounded h-20 font-mono text-xs">[]</textarea>
                <label class="block text-xs font-semibold">Actions JSON</label>
                <textarea id="global-rule-actions" class="w-full border p-2 rounded h-20 font-mono text-xs">[]</textarea>
            </div>
        </details>
        
        <div class="mb-4 flex items-center">
            <input type="checkbox" id="global-rule-active" class="mr-2" checked>
            <label class="text-sm font-semibold">Активне (Active)</label>
        </div>

        <div id="global-rule-validation-error" class="text-red-600 text-sm mb-4 hidden"></div>

        <div class="flex justify-end gap-2">
            <button class="btn btn-outline" id="btn-global-cancel-rule">Скасувати</button>
            <button class="btn btn-primary" id="btn-global-save-rule">Зберегти</button>
        </div>
    </div>
</div>
`;

content = content.replace("</div>\n    `;\n}", "</div>\n" + newModal + "    `;\n}");
content = "import { RuleBuilderUI } from `./portal-rule-builder-ui.js`;\n" + content;

content = content.replace(
    /alert\("To be implemented: Structured Rule Builder Edit Mode for Rule ID: " \+ btn\.dataset\.id\);/g,
    `const r = allGlobalRules.find(x => x.id === btn.dataset.id);
            if(r) {
                document.getElementById("global-rule-modal-title").textContent = "Редагувати правило";
                document.getElementById("global-rule-id").value = r.id;
                document.getElementById("global-rule-name").value = r.name;
                document.getElementById("global-rule-trigger").value = r.trigger_event;
                document.getElementById("global-rule-active").checked = r.is_active;
                document.getElementById("global-rule-scope").value = r.project_id || r.template_id || "";
                
                // Hack: use the same IDs for RuleBuilderUI for now, or just write JSON directly
                document.getElementById("global-rule-conditions").value = JSON.stringify(r.conditions||[]);
                document.getElementById("global-rule-actions").value = JSON.stringify(r.actions||[]);
                
                document.getElementById("global-rule-modal").classList.remove("hidden");
            }`
);

content = content.replace(
    /alert\("To be implemented: Structured Rule Builder"\);/g,
    `document.getElementById("global-rule-modal-title").textContent = "Створити правило";
            document.getElementById("global-rule-id").value = "";
            document.getElementById("global-rule-name").value = "";
            document.getElementById("global-rule-scope").value = "";
            document.getElementById("global-rule-conditions").value = "[]";
            document.getElementById("global-rule-actions").value = "[]";
            document.getElementById("global-rule-modal").classList.remove("hidden");`
);

content = content.replace("export async function initGlobalAutomationEvents() {", `export async function initGlobalAutomationEvents() {\n    document.getElementById("btn-global-cancel-rule")?.addEventListener("click", () => document.getElementById("global-rule-modal").classList.add("hidden"));`);

fs.writeFileSync(file, content);
console.log("Patched portal-global-automation-view.js");

