const fs = require('fs');

const file = 'js/portal/ui/portal-automation-view.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Rule Modal to HTML
const ruleModalHTML = `
            <div id="rule-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white p-6 rounded shadow-lg w-1/2 max-h-[90vh] overflow-y-auto">
                    <h3 class="text-xl font-bold mb-4" id="rule-modal-title">Створити Правило</h3>
                    <input type="hidden" id="rule-id" value="">
                    
                    <div class="mb-4">
                        <label class="block text-sm font-semibold mb-1">Подія (Trigger)</label>
                        <select id="rule-trigger" class="w-full border p-2 rounded">
                            <option value="stage_completed">Етап завершено</option>
                            <option value="task_completed">Задачу завершено</option>
                            <option value="client_action_completed">Клієнт виконав дію</option>
                            <option value="project_created">Проєкт створено</option>
                        </select>
                    </div>

                    <div class="mb-4">
                        <label class="block text-sm font-semibold mb-1">Умови (Conditions) JSON</label>
                        <textarea id="rule-conditions" class="w-full border p-2 rounded h-24" placeholder='[{"field":"task_id","operator":"eq","value":"..."}]'>[]</textarea>
                    </div>

                    <div class="mb-4">
                        <label class="block text-sm font-semibold mb-1">Дії (Actions) JSON</label>
                        <textarea id="rule-actions" class="w-full border p-2 rounded h-24" placeholder='[{"type":"start_stage","target_name":"Stage 2"}]'>[]</textarea>
                        <p class="text-xs text-gray-500 mt-1">Підтримувані типи: start_stage, complete_stage, create_task, create_client_action</p>
                    </div>
                    
                    <div class="mb-4 flex items-center">
                        <input type="checkbox" id="rule-active" class="mr-2" checked>
                        <label for="rule-active" class="text-sm font-semibold">Активне</label>
                    </div>

                    <div class="flex justify-end gap-2">
                        <button id="btn-cancel-rule" class="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100">Скасувати</button>
                        <button id="btn-save-rule" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Зберегти</button>
                    </div>
                </div>
            </div>
`;

content = content.replace('<!-- Modals -->', '<!-- Modals -->\n' + ruleModalHTML);

// 2. Add bindEvents for Rule Modal
const ruleBindEvents = `
        document.getElementById('btn-add-rule').addEventListener('click', () => {
            document.getElementById('rule-modal-title').innerText = 'Створити Правило';
            document.getElementById('rule-id').value = '';
            document.getElementById('rule-trigger').value = 'stage_completed';
            document.getElementById('rule-conditions').value = '[]';
            document.getElementById('rule-actions').value = '[]';
            document.getElementById('rule-active').checked = true;
            document.getElementById('rule-modal').classList.remove('hidden');
        });

        document.getElementById('btn-cancel-rule').addEventListener('click', () => {
            document.getElementById('rule-modal').classList.add('hidden');
        });

        document.getElementById('btn-save-rule').addEventListener('click', async () => {
            try {
                const id = document.getElementById('rule-id').value;
                const payload = {
                    project_id: this.projectId,
                    trigger_event: document.getElementById('rule-trigger').value,
                    conditions: JSON.parse(document.getElementById('rule-conditions').value),
                    actions: JSON.parse(document.getElementById('rule-actions').value),
                    is_active: document.getElementById('rule-active').checked
                };
                
                if (id) {
                    await window.DataClient.updateAutomationRule(id, payload);
                } else {
                    // Assuming createAutomationRule exists in DataClient
                    if(!window.DataClient.createAutomationRule) {
                        window.DataClient.createAutomationRule = async (payload) => {
                            const { data, error } = await window.supabase.from('automation_rules').insert(payload).select().single();
                            if(error) throw error;
                            return data;
                        };
                    }
                    await window.DataClient.createAutomationRule(payload);
                }
                document.getElementById('rule-modal').classList.add('hidden');
                this.loadData();
            } catch (e) {
                console.error(e);
                alert('Помилка збереження правила. Перевірте формат JSON.');
            }
        });
`;

content = content.replace('bindEvents() {', 'bindEvents() {\n' + ruleBindEvents);

// 3. Make rules editable in the UI
// In renderRules, replace the toggle HTML with full edit buttons
content = content.replace(
    /return `\s*<div class="border p-3 rounded \${r\.is_active \? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'} flex justify-between items-center">[\s\S]*?<\/div>\s*`;/g,
    (match) => {
        return `return \`
            <div class="border p-3 rounded \${r.is_active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'} flex flex-col gap-2">
                <div class="flex justify-between items-center">
                    <div>
                        <span class="font-bold">\${r.trigger_event}</span>
                        <span class="text-xs ml-2 text-gray-500">ID: \${r.id.substring(0,8)}... \${r.template_id ? '(Template)' : '(Project Override)'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="flex items-center cursor-pointer">
                            <div class="relative">
                                <input type="checkbox" class="sr-only toggle-rule-active" data-id="\${r.id}" \${r.is_active ? 'checked' : ''}>
                                <div class="block bg-gray-400 w-10 h-6 rounded-full transition-colors toggle-bg \${r.is_active ? 'bg-green-500' : ''}"></div>
                                <div class="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform \${r.is_active ? 'transform translate-x-4' : ''}"></div>
                            </div>
                        </label>
                        <button class="text-blue-600 hover:text-blue-800 edit-rule-btn" data-rule='\${JSON.stringify(r).replace(/'/g, "&#39;")}'>Редагувати</button>
                    </div>
                </div>
                <div class="text-xs text-gray-600">
                    Умови: \${JSON.stringify(r.conditions)}<br>
                    Дії: \${JSON.stringify(r.actions)}
                </div>
            </div>\`;
        `;
    }
);

// 4. Bind the edit buttons
const renderRulesAddition = `
        document.querySelectorAll('.edit-rule-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const r = JSON.parse(e.target.getAttribute('data-rule'));
                document.getElementById('rule-modal-title').innerText = 'Редагувати Правило';
                document.getElementById('rule-id').value = r.id;
                document.getElementById('rule-trigger').value = r.trigger_event;
                document.getElementById('rule-conditions').value = JSON.stringify(r.conditions, null, 2);
                document.getElementById('rule-actions').value = JSON.stringify(r.actions, null, 2);
                document.getElementById('rule-active').checked = r.is_active;
                document.getElementById('rule-modal').classList.remove('hidden');
            });
        });
`;

content = content.replace("document.querySelectorAll('.toggle-rule-active').forEach(chk => {", renderRulesAddition + "\n        document.querySelectorAll('.toggle-rule-active').forEach(chk => {");

fs.writeFileSync(file, content);
console.log("Patched portal-automation-view.js!");
