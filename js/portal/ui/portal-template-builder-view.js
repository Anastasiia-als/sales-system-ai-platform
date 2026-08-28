import { supabase } from "../api/supabase-client.js";

let currentTemplateId = null;
let currentTemplate = null;
let activeVersion = null;
let activeTab = 'overview';

export function renderTemplateBuilderView(templateId) {
    currentTemplateId = templateId;
    return `
        <div class="portal-template-builder">
            <div class="portal-header">
                <div>
                    <h2 id="builder-title">Завантаження...</h2>
                    <div id="builder-subtitle" style="font-size: 0.9rem; color: var(--text-secondary);"></div>
                </div>
                <div class="portal-header-actions" id="builder-actions">
                    <button class="btn btn-outline" onclick="window.history.back()">Назад</button>
                    <!-- actions will be injected here -->
                </div>
            </div>

            <div class="portal-tabs" style="margin-bottom: 24px; border-bottom: 1px solid var(--border-color); display: flex; gap: 16px;">
                <button class="tab-btn active" data-tab="overview" style="padding: 12px 16px; background: none; border: none; border-bottom: 2px solid var(--color-primary); cursor: pointer; color: var(--text-primary); font-weight: 500;">Огляд</button>
                <button class="tab-btn" data-tab="stages" style="padding: 12px 16px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; color: var(--text-secondary);">Етапи</button>
                <button class="tab-btn" data-tab="milestones" style="padding: 12px 16px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; color: var(--text-secondary);">Контрольні точки</button>
                <button class="tab-btn" data-tab="tasks" style="padding: 12px 16px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; color: var(--text-secondary);">Задачі</button>
                <button class="tab-btn" data-tab="client_actions" style="padding: 12px 16px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; color: var(--text-secondary);">Дії клієнта</button>
                <button class="tab-btn" data-tab="documents" style="padding: 12px 16px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; color: var(--text-secondary);">Документи</button>
                <button class="tab-btn" data-tab="meetings" style="padding: 12px 16px; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; color: var(--text-secondary);">Зустрічі</button>
            </div>

            <div id="builder-content" class="portal-card">
                Завантаження...
            </div>
        </div>
    `;
}

export async function initTemplateBuilderEvents() {
    if (window.lucide) window.lucide.createIcons();

    await loadData();

    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".tab-btn").forEach(b => {
                b.style.borderBottomColor = 'transparent';
                b.style.color = 'var(--text-secondary)';
                b.style.fontWeight = 'normal';
            });
            const target = e.currentTarget;
            target.style.borderBottomColor = 'var(--color-primary)';
            target.style.color = 'var(--text-primary)';
            target.style.fontWeight = '500';
            activeTab = target.dataset.tab;
            renderTabContent();
        });
    });

    document.getElementById("builder-actions").addEventListener("click", async (e) => {
        const pubBtn = e.target.closest("#btn-publish-version");
        if (pubBtn) {
            if (confirm("Опублікувати цю версію? Вона стане доступною для генерації проєктів.")) {
                await supabase.from('template_versions').update({ status: 'published', is_locked: true }).eq('id', activeVersion.id);
                // lock all previous published
                await supabase.from('template_versions').update({ status: 'archived' }).eq('template_id', currentTemplateId).eq('status', 'published').neq('id', activeVersion.id);
                await loadData();
            }
        }
        const draftBtn = e.target.closest("#btn-create-draft");
        if (draftBtn) {
            if (confirm("Створити нову чернетку на основі цієї версії?")) {
                alert("This requires an RPC clone function in Phase 6B. Currently unsupported in demo UI.");
            }
        }
    });
}

async function loadData() {
    const { data: tData } = await supabase.from('project_templates').select('*, template_versions(*)').eq('id', currentTemplateId).single();
    if (tData) {
        currentTemplate = tData;
        const versions = [...tData.template_versions].sort((a, b) => b.version_number - a.version_number);
        activeVersion = versions[0]; // load latest
        
        document.getElementById("builder-title").innerText = tData.name;
        document.getElementById("builder-subtitle").innerText = `Версія ${activeVersion?.version_number || 1} • ${activeVersion?.status === 'published' ? 'Опубліковано (Locked)' : 'Чернетка'}`;
        
        let actionsHtml = `<button class="btn btn-outline" onclick="window.history.back()">Назад</button>`;
        if (activeVersion?.status === 'draft') {
            actionsHtml += `<button class="btn btn-primary" id="btn-publish-version">Опублікувати версію</button>`;
        } else {
            actionsHtml += `<button class="btn btn-primary" id="btn-create-draft">Редагувати (Нова версія)</button>`;
        }
        document.getElementById("builder-actions").innerHTML = actionsHtml;

        renderTabContent();
    }
}

async function renderTabContent() {
    const content = document.getElementById("builder-content");
    const isLocked = activeVersion?.is_locked;
    const lockMsg = isLocked ? `<div class="alert alert-warning" style="margin-bottom:16px;"><i data-lucide="lock"></i> Версія заблокована для змін. Створіть нову чернетку для редагування.</div>` : '';
    
    if (activeTab === 'overview') {
        content.innerHTML = `
            ${lockMsg}
            <div style="max-width: 600px;">
                <div class="form-group">
                    <label>Назва шаблону</label>
                    <input type="text" class="form-input" value="${currentTemplate.name}" ${isLocked?'disabled':''}>
                </div>
                <div class="form-group">
                    <label>Категорія (Тип послуги)</label>
                    <input type="text" class="form-input" value="${currentTemplate.project_type}" ${isLocked?'disabled':''}>
                </div>
                <div class="form-group">
                    <label>Опис</label>
                    <textarea class="form-input" rows="4" ${isLocked?'disabled':''}>${currentTemplate.description || ''}</textarea>
                </div>
                <div class="form-group" style="display:flex; gap:16px;">
                    <div style="flex:1">
                        <label>Тривалість (днів)</label>
                        <input type="number" class="form-input" value="${currentTemplate.estimated_duration_days || 0}" ${isLocked?'disabled':''}>
                    </div>
                    <div style="flex:1">
                        <label>Валюта за замовчуванням</label>
                        <select class="form-input" ${isLocked?'disabled':''}>
                            <option value="UAH" ${currentTemplate.default_currency==='UAH'?'selected':''}>UAH</option>
                            <option value="USD" ${currentTemplate.default_currency==='USD'?'selected':''}>USD</option>
                            <option value="EUR" ${currentTemplate.default_currency==='EUR'?'selected':''}>EUR</option>
                        </select>
                    </div>
                </div>
                ${!isLocked ? '<button class="btn btn-primary" style="margin-top:16px;">Зберегти налаштування</button>' : ''}
            </div>
        `;
    } else {
        content.innerHTML = `
            ${lockMsg}
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
                <h3 style="text-transform: capitalize;">${activeTab.replace('_', ' ')}</h3>
                ${!isLocked ? '<button class="btn btn-primary btn-sm"><i data-lucide="plus"></i> Додати</button>' : ''}
            </div>
            
            <div class="table-responsive">
                <table class="portal-table">
                    <thead>
                        <tr>
                            <th>Назва</th>
                            <th>Опис</th>
                            <th>${activeTab === 'stages' ? 'Тривалість' : 'Зсув дедлайну'}</th>
                            ${!isLocked ? '<th>Дії</th>' : ''}
                        </tr>
                    </thead>
                    <tbody id="tab-table-body">
                        <tr><td colspan="4" style="text-align:center;">Завантаження...</td></tr>
                    </tbody>
                </table>
            </div>
        `;
        
        // Dynamic fetch depending on tab
        const tableName = 'template_' + activeTab;
        const { data } = await supabase.from(tableName).select('*').eq('version_id', activeVersion.id);
        const tbody = document.getElementById("tab-table-body");
        if (data && data.length > 0) {
            tbody.innerHTML = data.map(item => `
                <tr>
                    <td><strong>${item.title || item.name}</strong></td>
                    <td>${item.description || '-'}</td>
                    <td>${item.offset_days || item.relative_due_offset || item.deadline_offset || item.scheduling_offset_days || 0} днів</td>
                    ${!isLocked ? `
                        <td style="width: 100px;">
                            <button class="btn btn-icon btn-outline btn-sm"><i data-lucide="edit-2"></i></button>
                            <button class="btn btn-icon btn-outline btn-danger btn-sm"><i data-lucide="trash"></i></button>
                        </td>
                    ` : ''}
                </tr>
            `).join("");
        } else {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-secondary);">Немає записів</td></tr>`;
        }
    }
    
    if (window.lucide) window.lucide.createIcons();
}
