export class PortalAutomationView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    async render(projectId) {
        this.projectId = projectId;
        this.container.innerHTML = `
            <div class="automation-view p-4">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">Керування автоматизаціями (Phase 6C)</h2>
                    <button id="btn-add-rule" class="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">
                        Додати правило
                    </button>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Rules Section -->
                    <div class="bg-white p-4 rounded shadow">
                        <h3 class="text-xl font-semibold mb-4">Правила (Workflow Rules)</h3>
                        <div id="rules-list" class="space-y-4">
                            <div class="text-center text-gray-500 py-4">Завантаження...</div>
                        </div>
                    </div>
                    
                    <!-- Logs & Blockers Section -->
                    <div class="space-y-6">
                        <div class="bg-white p-4 rounded shadow">
                            <div class="flex justify-between items-center mb-4">
                                <h3 class="text-xl font-semibold">Блокери</h3>
                                <button id="btn-add-blocker" class="text-sm bg-red-100 text-red-700 px-3 py-1 rounded">Зареєструвати</button>
                            </div>
                            <div id="blockers-list" class="space-y-2">
                                <div class="text-center text-gray-500 py-4">Завантаження...</div>
                            </div>
                        </div>

                        <div class="bg-white p-4 rounded shadow">
                            <h3 class="text-xl font-semibold mb-4">Журнал виконання (Execution Log)</h3>
                            <div id="execution-log" class="space-y-2 max-h-64 overflow-y-auto">
                                <div class="text-center text-gray-500 py-4">Завантаження...</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modals -->
            <div id="blocker-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white p-6 rounded shadow-lg w-96">
                    <h3 class="text-xl font-bold mb-4">Новий Блокер</h3>
                    <input type="text" id="blocker-title" class="w-full border p-2 rounded mb-4" placeholder="Короткий опис проблеми">
                    <select id="blocker-severity" class="w-full border p-2 rounded mb-4">
                        <option value="low">Низький</option>
                        <option value="medium">Середній</option>
                        <option value="high">Високий</option>
                        <option value="critical">Критичний</option>
                    </select>
                    <div class="flex justify-end space-x-2">
                        <button id="btn-cancel-blocker" class="px-4 py-2 text-gray-600">Скасувати</button>
                        <button id="btn-save-blocker" class="px-4 py-2 bg-red-600 text-white rounded">Зберегти</button>
                    </div>
                </div>
            </div>
        `;

        await this.loadData();
        this.bindEvents();
    }

    async loadData() {
        try {
            const rules = await window.DataClient.getAutomationRules(this.projectId);
            this.renderRules(rules);

            const blockers = await window.DataClient.getProjectBlockers(this.projectId);
            this.renderBlockers(blockers);

            const logs = await window.DataClient.getExecutionLogs(this.projectId);
            this.renderLogs(logs);
        } catch (e) {
            console.error('Failed to load automation data', e);
        }
    }

    renderRules(rules) {
        const container = document.getElementById('rules-list');
        if (!rules || rules.length === 0) {
            container.innerHTML = '<div class="text-gray-500">Немає налаштованих правил.</div>';
            return;
        }

        container.innerHTML = rules.map(r => `
            <div class="border p-3 rounded flex justify-between items-start">
                <div>
                    <h4 class="font-bold">${r.name}</h4>
                    <p class="text-sm text-gray-600">WHEN ${r.trigger_event}</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" value="" class="sr-only peer toggle-rule" data-id="${r.id}" ${r.is_active ? 'checked' : ''}>
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>
        `).join('');
    }

    renderBlockers(blockers) {
        const container = document.getElementById('blockers-list');
        if (!blockers || blockers.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-sm">Активних блокерів немає.</div>';
            return;
        }

        container.innerHTML = blockers.map(b => `
            <div class="border-l-4 ${b.status === 'resolved' ? 'border-green-500 opacity-50' : 'border-red-500'} p-3 rounded bg-gray-50 flex justify-between items-center">
                <div>
                    <div class="font-semibold text-sm">${b.title}</div>
                    <div class="text-xs text-gray-500">Severity: ${b.severity} | Status: ${b.status}</div>
                </div>
                ${b.status !== 'resolved' ? `<button class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded resolve-blocker" data-id="${b.id}">Resolve</button>` : ''}
            </div>
        `).join('');
    }

    renderLogs(logs) {
        const container = document.getElementById('execution-log');
        if (!logs || logs.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-sm">Журнал порожній.</div>';
            return;
        }

        container.innerHTML = logs.map(l => `
            <div class="text-sm border-b pb-2">
                <span class="text-gray-500">${new Date(l.evaluated_at).toLocaleString()}</span>
                <span class="font-medium ml-2">${l.trigger_event}</span>
                <span class="ml-2 px-2 rounded text-xs ${l.result === 'success' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">${l.result}</span>
            </div>
        `).join('');
    }

    bindEvents() {
        document.getElementById('btn-add-blocker').addEventListener('click', () => {
            document.getElementById('blocker-modal').classList.remove('hidden');
        });

        document.getElementById('btn-cancel-blocker').addEventListener('click', () => {
            document.getElementById('blocker-modal').classList.add('hidden');
        });

        document.getElementById('btn-save-blocker').addEventListener('click', async () => {
            const title = document.getElementById('blocker-title').value;
            const severity = document.getElementById('blocker-severity').value;
            if (!title) return;
            
            try {
                await window.DataClient.createBlocker({
                    organization_id: window.appState.currentOrganization.id,
                    project_id: this.projectId,
                    title: title,
                    severity: severity,
                    source_type: 'manual'
                });
                document.getElementById('blocker-modal').classList.add('hidden');
                document.getElementById('blocker-title').value = '';
                this.loadData();
            } catch (e) {
                alert('Помилка збереження блокера');
            }
        });

        this.container.addEventListener('click', async (e) => {
            if (e.target.classList.contains('resolve-blocker')) {
                const id = e.target.getAttribute('data-id');
                try {
                    await window.DataClient.resolveBlocker(id, 'Resolved via UI');
                    this.loadData();
                } catch(err) {
                    alert('Помилка');
                }
            }
        });
        
        this.container.addEventListener('change', async (e) => {
            if (e.target.classList.contains('toggle-rule')) {
                const id = e.target.getAttribute('data-id');
                const isActive = e.target.checked;
                try {
                    await window.DataClient.updateAutomationRule(id, { is_active: isActive });
                } catch(err) {
                    alert('Помилка оновлення правила');
                    e.target.checked = !isActive; // revert
                }
            }
        });
    }
}
