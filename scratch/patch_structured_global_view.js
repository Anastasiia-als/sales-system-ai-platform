const fs = require('fs');

const globalViewContent = `import { DataClient } from "../api/data-client.js";
import { getSupabase } from "../api/supabase-client.js";
import { PortalAuth } from "../auth/auth-service.js";
import { openRuleBuilderModal, TRIGGER_REGISTRY, FIELD_DEFINITIONS, ACTION_DEFINITIONS } from "./portal-rule-builder-ui.js";

const dict = {
    "stage_started": "Етап розпочато",
    "stage_completed": "Етап завершено",
    "client_action_added": "Дію клієнта призначено",
    "client_action_completed": "Дію клієнта виконано",
    "document_approved": "Документ погоджено",
    "document_changes_requested": "Запит змін документа",
    "task_completed": "Завдання виконано",
    "test_event": "Тестова подія"
};

export function renderGlobalAutomationView() {
    return \`
        <div class="portal-content">
            <div class="portal-view-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div class="portal-view-title-group">
                    <h1 class="portal-view-title">Центр управління автоматизацією</h1>
                    <p class="portal-view-subtitle">Глобальне управління бізнес-правилами автоматизації та їх виконанням для всіх клієнтів і проєктів</p>
                </div>
                <button class="btn btn-primary" id="btn-global-create-rule">
                    <i data-lucide="plus"></i> Створити правило
                </button>
            </div>
            
            <div class="portal-card" style="margin-bottom: 24px;">
                <div class="portal-card-header">
                    <h2 class="portal-card-title">Фільтри</h2>
                </div>
                <div class="portal-card-body" style="display: flex; gap: 16px; flex-wrap: wrap;">
                    <input type="text" id="global-rule-search" class="portal-input" placeholder="Пошук за назвою..." style="flex: 1; min-width: 200px;">
                    <select id="global-rule-filter-scope" class="portal-input" style="width: 200px;">
                        <option value="all">Всі області дії</option>
                        <option value="template">Шаблони</option>
                        <option value="project">Проєкти</option>
                    </select>
                    <select id="global-rule-filter-status" class="portal-input" style="width: 200px;">
                        <option value="all">Всі статуси</option>
                        <option value="active">Активні</option>
                        <option value="inactive">Неактивні</option>
                    </select>
                </div>
            </div>

            <div class="portal-card">
                <div class="portal-table-wrapper">
                    <table class="portal-table">
                        <thead>
                            <tr>
                                <th>Назва правила</th>
                                <th>Область дії</th>
                                <th>Тригер події</th>
                                <th>Умови</th>
                                <th>Автоматичні дії</th>
                                <th>Статус</th>
                                <th style="text-align:right;">Дії</th>
                            </tr>
                        </thead>
                        <tbody id="global-automation-list">
                            <tr>
                                <td colspan="7" style="text-align: center; padding: 24px;">
                                    <div class="portal-spinner" style="margin: 0 auto;"></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="portal-card" style="margin-top: 32px;">
                <div class="portal-card-header">
                    <h2 class="portal-card-title">Журнал виконання автоматизацій</h2>
                </div>
                <div class="portal-table-wrapper">
                    <table class="portal-table">
                        <thead>
                            <tr>
                                <th>Час виконання</th>
                                <th>Правило</th>
                                <th>Область дії</th>
                                <th>Тригер події</th>
                                <th>Результат</th>
                                <th>Деталі / Помилка</th>
                            </tr>
                        </thead>
                        <tbody id="global-execution-list">
                            <tr>
                                <td colspan="6" style="text-align: center; padding: 24px;">
                                    <div class="portal-spinner" style="margin: 0 auto;"></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    \`;
}

export async function initGlobalAutomationEvents() {
    if (window.lucide) window.lucide.createIcons();
    window.loadGlobalAutomationData = loadGlobalAutomationData; // bind for reload
    await loadGlobalAutomationData();
    
    document.getElementById("global-rule-search")?.addEventListener("input", filterGlobalRules);
    document.getElementById("global-rule-filter-scope")?.addEventListener("change", filterGlobalRules);
    document.getElementById("global-rule-filter-status")?.addEventListener("change", filterGlobalRules);
    
    const createBtn = document.getElementById("btn-global-create-rule");
    if (createBtn) {
        createBtn.addEventListener("click", () => {
            openRuleBuilderModal(null);
        });
    }
}

let allGlobalRules = [];

export async function loadGlobalAutomationData() {
    const supabase = await getSupabase();
    
    const rulesList = document.getElementById("global-automation-list");
    const logsList = document.getElementById("global-execution-list");
    if (rulesList) rulesList.innerHTML = \`<tr><td colspan="7" style="text-align:center; padding: 24px;"><div class="portal-spinner" style="margin: 0 auto;"></div></td></tr>\`;
    if (logsList) logsList.innerHTML = \`<tr><td colspan="6" style="text-align:center; padding: 24px;"><div class="portal-spinner" style="margin: 0 auto;"></div></td></tr>\`;

    try {
        const { data: rules, error: rulesErr } = await supabase
            .from('automation_rules')
            .select(\`id, name, project_id, template_id, trigger_event, conditions, is_active, actions, created_at, projects(name), project_templates(name)\`)
            .order('created_at', { ascending: false });
            
        if (rulesErr) {
            if (rulesErr.code === '42501' || (rulesErr.message && rulesErr.message.includes('denied'))) throw new Error('403');
            throw rulesErr;
        }
        allGlobalRules = rules || [];
        renderGlobalRulesTable(allGlobalRules);
        
        const { data: logs, error: logsErr } = await supabase
            .from('automation_execution_events')
            .select(\`id, rule_id, project_id, trigger_event, result, error_summary, evaluated_at, automation_rules(name), projects(name)\`)
            .order('evaluated_at', { ascending: false })
            .limit(50);
            
        if (logsErr) throw logsErr;
        renderGlobalLogsTable(logs || []);
        
    } catch (e) {
        console.error("Failed to load global automation:", e);
        if (e.message === '403') {
            if(rulesList) rulesList.innerHTML = \`<tr><td colspan="7" style="text-align:center; padding: 24px;"><div class="portal-empty-title" style="color:var(--color-danger);"><i data-lucide="shield-alert"></i> У вас немає доступу до цих правил</div></td></tr>\`;
            if(logsList) logsList.innerHTML = \`<tr><td colspan="6" style="text-align:center; padding: 24px;"><div class="portal-empty-title" style="color:var(--color-danger);"><i data-lucide="shield-alert"></i> Доступ обмежено</div></td></tr>\`;
        } else {
            if(rulesList) rulesList.innerHTML = \`<tr><td colspan="7" style="text-align:center; padding: 24px; color:var(--color-danger);">Помилка завантаження правил: \${e.message}</td></tr>\`;
            if(logsList) logsList.innerHTML = \`<tr><td colspan="6" style="text-align:center; padding: 24px; color:var(--color-danger);">Помилка завантаження логів: \${e.message}</td></tr>\`;
        }
    } finally {
        if (window.lucide) window.lucide.createIcons();
    }
}

function filterGlobalRules() {
    const q = (document.getElementById("global-rule-search")?.value || "").toLowerCase();
    const scope = document.getElementById("global-rule-filter-scope")?.value || "all";
    const status = document.getElementById("global-rule-filter-status")?.value || "all";
    
    const filtered = allGlobalRules.filter(r => {
        if (q && !r.name.toLowerCase().includes(q)) return false;
        
        const rScope = r.project_id ? "project" : (r.template_id ? "template" : "unknown");
        if (scope !== "all" && rScope !== scope) return false;
        
        const rStatus = r.is_active ? "active" : "inactive";
        if (status !== "all" && rStatus !== status) return false;
        
        return true;
    });
    
    renderGlobalRulesTable(filtered);
}

function formatConditionsSummary(conditions) {
    if (!Array.isArray(conditions) || conditions.length === 0) {
        return \`<span style="color: #64748B; font-size: 12px; font-style: italic;">Завжди</span>\`;
    }
    const items = conditions.map(c => {
        const fieldLabel = FIELD_DEFINITIONS[c.field]?.label || c.field;
        let opSymbol = "==";
        if (c.operator === "neq") opSymbol = "!=";
        if (c.operator === "contains") opSymbol = "містить";
        if (c.operator === "gt" || c.operator === "greater_than") opSymbol = ">";
        return \`\${fieldLabel} \${opSymbol} "\${c.value}"\`;
    });
    
    if (items.length === 1) {
        return \`<span style="font-size: 12px; color: #94A3B8; background: #141C31; border: 1px solid rgba(148,163,184,0.15); padding: 2px 6px; border-radius: 4px;" title="\${items[0]}">\${items[0]}</span>\`;
    }
    return \`<span style="font-size: 12px; color: #94A3B8; background: #141C31; border: 1px solid rgba(148,163,184,0.15); padding: 2px 6px; border-radius: 4px;" title="\${items.join(' ТА ')}">\${items.length} умови: \${items[0]}...</span>\`;
}

function formatActionsSummary(actions) {
    if (!Array.isArray(actions) || actions.length === 0) {
        return \`<span style="color: #EF4444; font-size: 12px; font-style: italic;">Немає дій</span>\`;
    }
    const items = actions.map(a => {
        const type = a.type || "create_task";
        const actLabel = ACTION_DEFINITIONS[type]?.label || type;
        const title = a.title || a.target_name || a.payload?.title || a.payload?.target_name || "";
        return title ? \`\${actLabel}: "\${title}"\` : actLabel;
    });
    
    if (items.length === 1) {
        return \`<span style="font-size: 12px; color: #60A5FA; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); padding: 2px 8px; border-radius: 4px;" title="\${items[0]}">\${items[0]}</span>\`;
    }
    return \`<span style="font-size: 12px; color: #60A5FA; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); padding: 2px 8px; border-radius: 4px;" title="\${items.join('; ')}">\${items.length} дії: \${items[0]}...</span>\`;
}

function renderGlobalRulesTable(rules) {
    const tbody = document.getElementById("global-automation-list");
    if (!tbody) return;
    
    if (rules.length === 0) {
        tbody.innerHTML = \`<tr><td colspan="7" style="text-align:center; padding: 24px; color: #94A3B8;">Правил не знайдено</td></tr>\`;
        return;
    }
    
    let html = "";
    for (const r of rules) {
        let scopeLabel = "Глобально";
        if (r.project_id) {
            scopeLabel = r.projects?.name ? \`<span class="portal-badge portal-badge-info" style="color:#0369a1; background:#e0f2fe;">Проєкт: \${r.projects.name}</span>\` : \`<span class="portal-badge portal-badge-danger" style="color:#b91c1c; background:#fee2e2;">Проєкт видалено</span>\`;
        } else if (r.template_id) {
            scopeLabel = r.project_templates?.name ? \`<span class="portal-badge portal-badge-primary" style="color:#4338ca; background:#e0e7ff;">Шаблон: \${r.project_templates.name}</span>\` : \`<span class="portal-badge portal-badge-danger" style="color:#b91c1c; background:#fee2e2;">Шаблон видалено</span>\`;
        }
            
        const activeBadge = r.is_active ? 
            \`<span class="portal-badge portal-badge-success" style="color:#15803d; background:#dcfce7;">Активне</span>\` : 
            \`<span class="portal-badge portal-badge-warning" style="color:#b45309; background:#fef3c7;">Неактивне</span>\`;
            
        const condSummary = formatConditionsSummary(r.conditions);
        const actSummary = formatActionsSummary(r.actions);
        
        const triggerLoc = TRIGGER_REGISTRY[r.trigger_event]?.label || dict[r.trigger_event] || r.trigger_event;
        
        html += \`
            <tr>
                <td style="font-weight: 600; color: #F8FAFC;">\${r.name || 'Безіменне правило'}</td>
                <td>\${scopeLabel}</td>
                <td><code style="background:#141C31; color:#F8FAFC; border: 1px solid rgba(148, 163, 184, 0.15); padding:3px 8px; border-radius:4px; font-size:12px;">\${triggerLoc}</code></td>
                <td>\${condSummary}</td>
                <td>\${actSummary}</td>
                <td>\${activeBadge}</td>
                <td style="text-align:right;">
                    <button class="btn btn-sm btn-outline btn-edit-rule" data-id="\${r.id}"><i data-lucide="edit-2"></i> Редагувати</button>
                </td>
            </tr>
        \`;
    }
    tbody.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
    
    // Bind edit buttons
    tbody.querySelectorAll(".btn-edit-rule").forEach(btn => {
        btn.addEventListener("click", () => {
            openRuleBuilderModal(btn.dataset.id);
        });
    });
}

function renderGlobalLogsTable(logs) {
    const tbody = document.getElementById("global-execution-list");
    if (!tbody) return;
    
    if (logs.length === 0) {
        tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; padding: 24px; color: #94A3B8;">Журнал виконань порожній</td></tr>\`;
        return;
    }
    
    let html = "";
    for (const l of logs) {
        const timeStr = new Date(l.evaluated_at).toLocaleString('uk-UA');
        const statusBadge = l.result === "success" ? 
            \`<span class="portal-badge portal-badge-success" style="color:#15803d; background:#dcfce7;">Успішно</span>\` : 
            (l.result === "condition_not_met" ?
                \`<span class="portal-badge portal-badge-secondary" style="color:#64748B; background:#1E293B;">Умови не зійшлися</span>\` :
                \`<span class="portal-badge portal-badge-danger" style="color:#b91c1c; background:#fee2e2;">Помилка</span>\`
            );
            
        const triggerLoc = TRIGGER_REGISTRY[l.trigger_event]?.label || dict[l.trigger_event] || l.trigger_event;
        const actCount = Array.isArray(l.actions_completed) ? l.actions_completed.length : 0;
        
        const ruleName = l.automation_rules?.name || \`<span style="color:#94A3B8; font-size:11px;">Видалено (\${l.rule_id ? l.rule_id.substring(0,8) + '...' : '—'})</span>\`;
        const scopeLabel = l.projects?.name ? \`Проєкт: \${l.projects.name}\` : (l.project_id ? "Видалений проєкт" : "Глобально");
        
        html += \`
            <tr>
                <td style="white-space:nowrap; font-size:13px; color:#94A3B8;">\${timeStr}</td>
                <td><strong>\${ruleName}</strong></td>
                <td><span style="font-size:12px; color:#94A3B8;">\${scopeLabel}</span></td>
                <td><code style="font-size:12px; background:#141C31; color:#F8FAFC; border: 1px solid rgba(148, 163, 184, 0.15); padding:2px 6px; border-radius:4px;">\${triggerLoc}</code></td>
                <td>\${statusBadge} <span style="font-size:11px; color:#94a3b8; margin-left:4px;">(\${actCount} дій)</span></td>
                <td style="font-size:12px;">
                    \${l.result === 'failed' ? \`<div style="color:#ef4444; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="\${l.error_summary || 'Unknown'}">\${l.error_summary || 'Помилка виконання'}</div>\` : (l.result === 'condition_not_met' ? \`<div style="color:#94A3B8;">Умови не виконано</div>\` : \`<div style="color:#10b981;">Успішне завершення</div>\`)}
                </td>
            </tr>
        \`;
    }
    tbody.innerHTML = html;
}
`;

fs.writeFileSync('js/portal/ui/portal-global-automation-view.js', globalViewContent, 'utf8');
console.log("Wrote structured portal-global-automation-view.js");
