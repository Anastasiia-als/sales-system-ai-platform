const fs = require("fs");
const file = "js/portal/ui/portal-automation-view.js";
let content = fs.readFileSync(file, "utf8");

const oldModalRegex = /<div id="rule-modal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const newModal = `<div id="rule-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-6 rounded shadow-lg w-3/4 max-w-4xl max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl font-bold mb-4" id="rule-modal-title">Створити правило</h3>
        <input type="hidden" id="rule-id" value="">
        
        <div class="mb-4 flex gap-4">
            <div class="flex-1">
                <label class="block text-sm font-semibold mb-1">Назва правила</label>
                <input type="text" id="rule-name" class="w-full border p-2 rounded" placeholder="Введіть назву правила...">
            </div>
            <div class="flex-1">
                <label class="block text-sm font-semibold mb-1">Подія (Trigger)</label>
                <select id="rule-trigger" class="w-full border p-2 rounded">
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
                <button id="btn-add-condition" class="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">+ Додати умову</button>
            </div>
            <div id="conditions-list" class="space-y-2 mb-2"></div>
        </div>

        <div class="mb-6 bg-slate-50 p-4 border rounded">
            <div class="flex justify-between items-center mb-2">
                <label class="block text-sm font-semibold">Дії (Actions)</label>
                <div>
                    <select id="action-type-select" class="text-sm border p-1 rounded bg-white">
                        <option value="start_stage">Start Stage</option>
                        <option value="complete_stage">Complete Stage</option>
                        <option value="create_task">Create Task</option>
                        <option value="create_client_action">Create Client Action</option>
                        <option value="notification">Send Notification</option>
                    </select>
                    <button id="btn-add-action" class="text-sm bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">+ Додати дію</button>
                </div>
            </div>
            <div id="actions-list" class="space-y-2 mb-2"></div>
        </div>

        <details class="mb-4">
            <summary class="text-sm text-gray-500 cursor-pointer">Розширені налаштування (Advanced JSON)</summary>
            <div class="mt-2 space-y-2">
                <label class="block text-xs font-semibold">Conditions JSON</label>
                <textarea id="rule-conditions" class="w-full border p-2 rounded h-20 font-mono text-xs">[]</textarea>
                <label class="block text-xs font-semibold">Actions JSON</label>
                <textarea id="rule-actions" class="w-full border p-2 rounded h-20 font-mono text-xs">[]</textarea>
            </div>
        </details>
        
        <div class="mb-4 flex items-center">
            <input type="checkbox" id="rule-active" class="mr-2" checked>
            <label class="text-sm font-semibold">Активне (Active)</label>
            <input type="checkbox" id="rule-override" class="ml-6 mr-2">
            <label class="text-sm font-semibold">Project Override (перевизначити шаблонне)</label>
        </div>

        <div id="rule-validation-error" class="text-red-600 text-sm mb-4 hidden"></div>

        <div class="flex justify-end gap-2">
            <button class="btn btn-outline" id="btn-cancel-rule">Скасувати</button>
            <button class="btn btn-primary" id="btn-save-rule">Зберегти</button>
        </div>
    </div>
</div>`;

content = content.replace(oldModalRegex, newModal);
fs.writeFileSync(file, content);
console.log("Replaced modal HTML in portal-automation-view.js");


