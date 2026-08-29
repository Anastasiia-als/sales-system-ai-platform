import { getSupabase } from "../api/supabase-client.js";
import { PortalAuth } from "../auth/auth-service.js";
import { renderPortalWizard } from "./portal-project-wizard.js";

let templates = [];

export function renderTemplatesView() {
    return `
        <div class="portal-templates-view">
            <div class="portal-header">
                <h2>Шаблони проєктів</h2>
                <div class="portal-header-actions">
                    <button class="btn btn-primary" id="btn-create-template">
                        <i data-lucide="plus"></i> Створити шаблон
                    </button>
                </div>
            </div>

            <div class="portal-filters" style="display: flex; gap: 16px; margin-bottom: 24px;">
                <div class="filter-group">
                    <label>Статус</label>
                    <select id="filter-template-status" class="form-input">
                        <option value="all">Усі статуси</option>
                        <option value="active" selected>Активний</option>
                        <option value="draft">Чернетка</option>
                        <option value="archived">Архівний</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>Пошук</label>
                    <input type="text" id="filter-template-search" class="form-input" placeholder="Назва шаблону...">
                </div>
            </div>

            <div class="portal-card">
                <div class="table-responsive">
                    <table class="portal-table">
                        <thead>
                            <tr>
                                <th>Назва шаблону</th>
                                <th>Тип</th>
                                <th>Статус</th>
                                <th>Тривалість</th>
                                <th>Дії</th>
                            </tr>
                        </thead>
                        <tbody id="templates-table-body">
                            <tr>
                                <td colspan="5" style="text-align: center;">Завантаження шаблонів...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div id="wizard-container"></div>
        </div>
    `;
}

export async function initTemplatesEvents() {
    if (window.lucide) window.lucide.createIcons();

    await loadTemplates();

    document.getElementById("filter-template-status")?.addEventListener("change", renderTable);
    document.getElementById("filter-template-search")?.addEventListener("input", renderTable);

    document.getElementById("btn-create-template")?.addEventListener("click", async () => {
        // Quick create draft
        const { data, error } = await (await getSupabase()).from('project_templates')
            .insert([{
                name: 'Новий Шаблон',
                project_type: 'consulting',
                status: 'draft',
                created_by: PortalAuth.currentUser.id
            }]).select().single();
        if (data) {
            // create initial draft version
            await (await getSupabase()).from('template_versions').insert([{
                template_id: data.id, version_number: 1, status: 'draft', created_by: PortalAuth.currentUser.id
            }]);
            window.location.hash = `#/portal/templates/${data.id}`;
        }
    });

    document.getElementById("templates-table-body")?.addEventListener("click", async (e) => {
        const createBtn = e.target.closest('.btn-create-project');
        if (createBtn) {
            const templateId = createBtn.dataset.id;
            const container = document.getElementById("wizard-container");
            container.innerHTML = await renderPortalWizard(templateId);
            const script = await import("./portal-project-wizard.js");
            script.initPortalWizardEvents(templateId, () => {
                container.innerHTML = "";
            });
        }
        
        const archiveBtn = e.target.closest('.btn-archive-template');
        if (archiveBtn) {
            const templateId = archiveBtn.dataset.id;
            if (confirm("Архівувати цей шаблон?")) {
                await (await getSupabase()).from('project_templates').update({ status: 'archived' }).eq('id', templateId);
                await loadTemplates();
            }
        }

        const cloneBtn = e.target.closest('.btn-clone-template');
        if (cloneBtn) {
            const templateId = cloneBtn.dataset.id;
            const t = templates.find(x => x.id === templateId);
            const newName = prompt("Введіть назву для нового шаблону:", t.name + " (Copy)");
            if (newName && newName.trim()) {
                cloneBtn.disabled = true;
                cloneBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
                try {
                    const rpcRes = await (await getSupabase()).rpc('clone_project_template', {
                        p_template_id: templateId,
                        p_new_name: newName.trim(),
                        p_idempotency_key: 'clone-' + Date.now() + '-' + Math.random()
                    });
                    if (rpcRes.error) throw rpcRes.error;
                    const res = rpcRes.data || rpcRes;
                    if (res && res.success === false) {
                        alert("Помилка клонування: " + res.error);
                    } else {
                        await loadTemplates();
                    }
                } catch(err) {
                    console.error(err);
                    let msg = "Сталася помилка при клонуванні шаблону.";
                    if (err.code === '42501' || err.message?.includes('Access denied')) {
                        msg = "Недостатньо прав для виконання цієї дії.";
                    } else if (err.code === 'P0002' || err.message?.includes('not found')) {
                        msg = "Шаблон недоступний або не існує.";
                    } else if (err.message) {
                        msg = err.message;
                    }
                    alert("Помилка: " + msg);
                }
                cloneBtn.disabled = false;
                cloneBtn.innerHTML = '<i data-lucide="copy"></i>';
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

async function loadTemplates() {
    // In a real app we would join with versions to get metrics, but let's keep it simple for now
    const { data, error } = await (await getSupabase()).from('project_templates')
        .select('*, template_versions(id, version_number, status, is_locked)')
        .order('created_at', { ascending: false });
    
    if (data) {
        templates = data;
        renderTable();
    }
}

function renderTable() {
    const tbody = document.getElementById("templates-table-body");
    if (!tbody) return;

    const statusFilter = document.getElementById("filter-template-status")?.value || 'all';
    const searchFilter = (document.getElementById("filter-template-search")?.value || '').toLowerCase();

    let filtered = templates.filter(t => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (searchFilter && !t.name.toLowerCase().includes(searchFilter)) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">Шаблонів не знайдено</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(t => {
        const pubVer = (t.template_versions || []).find(v => v.status === 'published');
        const hasPublished = !!pubVer;
        
        return `
            <tr>
                <td>
                    <div style="font-weight: 500;">${t.name}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">${t.category || ''}</div>
                </td>
                <td>${t.project_type}</td>
                <td>
                    <span class="portal-badge badge-${t.status === 'active' ? 'success' : (t.status === 'archived' ? 'neutral' : 'warning')}">
                        ${t.status === 'active' ? 'Активний' : (t.status === 'archived' ? 'Архівний' : 'Чернетка')}
                    </span>
                    ${hasPublished ? `<span style="margin-left:8px; font-size:0.8rem;">v${pubVer.version_number}</span>` : ''}
                </td>
                <td>${t.estimated_duration_days || '-'} днів</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <a href="#/portal/templates/${t.id}" class="btn btn-icon btn-outline" title="Редагувати шаблон">
                            <i data-lucide="edit-2"></i>
                        </a>
                        <button class="btn btn-icon btn-outline btn-clone-template" data-id="${t.id}" title="Клонувати шаблон">
                            <i data-lucide="copy"></i>
                        </button>
                        ${hasPublished && t.status === 'active' ? `
                        <button class="btn btn-icon btn-primary btn-create-project" data-id="${t.id}" title="Створити проєкт">
                            <i data-lucide="play"></i>
                        </button>
                        ` : ''}
                        ${t.status !== 'archived' ? `
                        <button class="btn btn-icon btn-outline btn-danger btn-archive-template" data-id="${t.id}" title="Архівувати">
                            <i data-lucide="archive"></i>
                        </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();
}
