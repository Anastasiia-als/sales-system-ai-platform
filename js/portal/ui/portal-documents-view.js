/* js/portal/ui/portal-documents-view.js - Global Documents Workspace */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";

export const DOCUMENT_CATEGORIES = [
    "Аудит",
    "Стратегія",
    "Sales Playbook",
    "Скрипти",
    "Регламент / SOP",
    "Звіт",
    "Аналітика",
    "Технічне завдання",
    "Навчальні матеріали",
    "Матеріали зустрічі",
    "Фінальний результат",
    "Інше"
];

export function renderDocumentsView() {
    const canCreate = PortalAuth.isGlobalOwner() || PortalAuth.getGlobalRole() === "pm";

    return `
        <div class="portal-content" id="documents-view-container">
            <!-- Header Bar -->
            <div class="portal-view-header">
                <div class="portal-view-title-group">
                    <h1 class="portal-view-title">Документи та артефакти</h1>
                    <p class="portal-view-subtitle">Централізований реєстр проєктної документації, матеріалів та версій</p>
                </div>
                ${canCreate ? `
                    <button class="btn btn-primary" id="btn-create-document">
                        <i data-lucide="plus"></i> Додати документ
                    </button>
                ` : ""}
            </div>

            <!-- Filters Bar -->
            <div class="portal-filter-bar" style="margin-bottom: 20px;">
                <div class="portal-search-box" style="flex: 1; min-width: 200px;">
                    <i data-lucide="search" class="search-icon"></i>
                    <input type="text" id="filter-doc-search" class="portal-input" placeholder="Пошук за назвою документа..." />
                </div>

                <div class="portal-filter-group" style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <select id="filter-doc-client" class="portal-select" style="min-width: 150px;">
                        <option value="all">Всі клієнти</option>
                    </select>

                    <select id="filter-doc-project" class="portal-select" style="min-width: 150px;">
                        <option value="all">Всі проєкти</option>
                    </select>

                    <select id="filter-doc-category" class="portal-select" style="min-width: 140px;">
                        <option value="all">Всі категорії</option>
                        ${DOCUMENT_CATEGORIES.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
                    </select>

                    <select id="filter-doc-status" class="portal-select" style="min-width: 140px;">
                        <option value="all">Всі статуси</option>
                        <option value="draft">Чернетка</option>
                        <option value="internal_review">Внутрішня перевірка</option>
                        <option value="client_review">На перевірці клієнта</option>
                        <option value="changes_requested">Потрібні зміни</option>
                        <option value="approved">Погоджено</option>
                        <option value="final">Фінальний</option>
                    </select>

                    <select id="filter-doc-archived" class="portal-select" style="min-width: 130px;">
                        <option value="active">Активні</option>
                        <option value="archived">В архіві</option>
                        <option value="all">Всі</option>
                    </select>
                </div>
            </div>

            <!-- Documents Table Container -->
            <div id="documents-table-container">
                <div class="portal-loading-container">
                    <div class="portal-spinner"></div>
                    <span>Завантаження документів...</span>
                </div>
            </div>
        </div>

        <!-- Modals Container -->
        <div id="documents-modal-mount"></div>
    `;
}

export async function initDocumentsViewEvents() {
    let currentFilter = {
        search: "",
        organizationId: "",
        projectId: "",
        category: "all",
        status: "all",
        archivedMode: "active"
    };

    // Load filter options
    await populateFilters();

    // Initial load
    await loadDocumentsList(currentFilter);

    // Event Listeners for Filters
    const searchInput = document.getElementById("filter-doc-search");
    const clientSelect = document.getElementById("filter-doc-client");
    const projectSelect = document.getElementById("filter-doc-project");
    const catSelect = document.getElementById("filter-doc-category");
    const statusSelect = document.getElementById("filter-doc-status");
    const archivedSelect = document.getElementById("filter-doc-archived");

    let debounceTimer = null;
    searchInput?.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentFilter.search = searchInput.value.trim();
            loadDocumentsList(currentFilter);
        }, 300);
    });

    clientSelect?.addEventListener("change", async () => {
        currentFilter.organizationId = clientSelect.value === "all" ? "" : clientSelect.value;
        await populateProjectFilter(currentFilter.organizationId);
        currentFilter.projectId = "";
        loadDocumentsList(currentFilter);
    });

    projectSelect?.addEventListener("change", () => {
        currentFilter.projectId = projectSelect.value === "all" ? "" : projectSelect.value;
        loadDocumentsList(currentFilter);
    });

    catSelect?.addEventListener("change", () => {
        currentFilter.category = catSelect.value;
        loadDocumentsList(currentFilter);
    });

    statusSelect?.addEventListener("change", () => {
        currentFilter.status = statusSelect.value;
        loadDocumentsList(currentFilter);
    });

    archivedSelect?.addEventListener("change", () => {
        currentFilter.archivedMode = archivedSelect.value;
        loadDocumentsList(currentFilter);
    });

    // Create Document Button
    document.getElementById("btn-create-document")?.addEventListener("click", () => {
        openCreateDocumentModal(null, null, async () => {
            await loadDocumentsList(currentFilter);
        });
    });
}

async function populateFilters() {
    const clientSelect = document.getElementById("filter-doc-client");
    if (!clientSelect) return;

    try {
        const [orgsRes, projsRes] = await Promise.all([
            DataClient.getOrganizations({ status: "all" }),
            DataClient.getProjects({ status: "all" })
        ]);

        const orgs = orgsRes.data || [];
        const projs = projsRes.data || [];

        clientSelect.innerHTML = `<option value="all">Всі клієнти</option>` + 
            orgs.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join("");

        const projectSelect = document.getElementById("filter-doc-project");
        if (projectSelect) {
            projectSelect.innerHTML = `<option value="all">Всі проєкти</option>` + 
                projs.map(p => `<option value="${p.id}">${escapeHtml(p.name || p.title)}</option>`).join("");
        }
    } catch (err) {
        console.error("Failed to populate document filters:", err);
    }
}

async function populateProjectFilter(orgId) {
    const projectSelect = document.getElementById("filter-doc-project");
    if (!projectSelect) return;

    const projsRes = await DataClient.getProjects({ 
        organizationId: orgId || undefined, 
        status: "all" 
    });
    const projs = projsRes.data || [];

    projectSelect.innerHTML = `<option value="all">Всі проєкти</option>` + 
        projs.map(p => `<option value="${p.id}">${escapeHtml(p.name || p.title)}</option>`).join("");
}

export async function loadDocumentsList(filter) {
    const container = document.getElementById("documents-table-container");
    if (!container) return;

    container.innerHTML = `
        <div class="portal-loading-container">
            <div class="portal-spinner"></div>
            <span>Завантаження документів...</span>
        </div>
    `;

    try {
        const queryFilter = {
            search: filter.search || undefined,
            organizationId: filter.organizationId || undefined,
            projectId: filter.projectId || undefined,
            category: filter.category !== "all" ? filter.category : undefined,
            status: filter.status !== "all" ? filter.status : undefined
        };

        if (filter.archivedMode === "archived") {
            queryFilter.includeArchived = true;
            queryFilter.onlyArchived = true;
        } else if (filter.archivedMode === "all") {
            queryFilter.includeArchived = true;
            queryFilter.onlyArchived = false;
        } else {
            queryFilter.includeArchived = false;
        }

        const res = await DataClient.getDocuments(queryFilter);
        const documents = res.data || [];

        if (res.error) {
            container.innerHTML = `
                <div class="portal-empty-state">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                    <div class="portal-empty-title">Помилка завантаження</div>
                    <div class="portal-empty-desc">${escapeHtml(res.error.message)}</div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        if (documents.length === 0) {
            container.innerHTML = `
                <div class="portal-empty-state">
                    <div class="portal-empty-icon"><i data-lucide="file-text"></i></div>
                    <div class="portal-empty-title">Документів не знайдено</div>
                    <div class="portal-empty-desc">
                        ${filter.search || filter.category !== "all" || filter.status !== "all" 
                            ? "Спробуйте змінити параметри пошуку або фільтри." 
                            : "У системі ще немає доданих документів."}
                    </div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        container.innerHTML = renderDocumentsTable(documents);
        if (window.lucide) window.lucide.createIcons();

        // Attach table event handlers
        attachDocumentsTableEvents(documents, filter);

    } catch (err) {
        console.error("Error loading documents list:", err);
        container.innerHTML = `
            <div class="portal-empty-state">
                <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                <div class="portal-empty-title">Сталася помилка</div>
                <div class="portal-empty-desc">${escapeHtml(err.message)}</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}

export function renderDocumentsTable(documents = []) {
    const rows = documents.map(doc => {
        const orgName = doc.organization?.name || "—";
        const projName = doc.project?.name || doc.project?.title || "—";
        const statusBadge = getDocumentStatusBadge(doc.status);
        const latestVer = doc.latest_version;
        const verLabel = latestVer ? `v${latestVer.version_number}` : "—";
        const isArchived = Boolean(doc.archived_at);

        const scopeLabel = doc.internal_access_scope === "management" 
            ? `<span class="portal-badge portal-badge-danger" title="Доступно тільки керівництву">Керівництво</span>`
            : `<span class="portal-badge portal-badge-info" title="Доступно всій команді проєкту">Команда</span>`;

        const clientVisBadge = doc.is_client_visible 
            ? `<span class="portal-badge portal-badge-success" title="Буде доступно клієнту в Phase 4">Видно клієнту</span>`
            : "";

        const updatedStr = new Date(doc.updated_at).toLocaleDateString("uk-UA", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

        return `
            <tr class="${isArchived ? 'portal-row-archived' : ''}">
                <td style="font-weight: 600;">
                    <div style="display: flex; flex-direction: column; gap: 3px;">
                        <a href="#/portal/documents/${doc.id}" class="portal-table-link" style="font-size: 0.92rem; color: var(--color-primary-light);">
                            ${escapeHtml(doc.title)}
                        </a>
                        ${doc.description ? `<span style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.2;">${escapeHtml(doc.description.substring(0, 70))}${doc.description.length > 70 ? '...' : ''}</span>` : ""}
                    </div>
                </td>
                <td style="font-size: 0.85rem;">
                    ${doc.organization ? `<a href="#/portal/clients/${doc.organization.id}" class="portal-table-link">${escapeHtml(orgName)}</a>` : "—"}
                </td>
                <td style="font-size: 0.85rem;">
                    ${doc.project ? `<a href="#/portal/projects/${doc.project.id}" class="portal-table-link">${escapeHtml(projName)}</a>` : "—"}
                </td>
                <td>
                    <span class="portal-badge portal-badge-secondary">${escapeHtml(doc.category)}</span>
                </td>
                <td>
                    ${statusBadge}
                </td>
                <td style="font-size: 0.85rem;">
                    ${latestVer ? `
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span class="portal-badge portal-badge-role-pm">${verLabel}</span>
                            <span style="color: var(--text-muted); font-size: 0.78rem;" title="${escapeHtml(latestVer.original_filename)}">
                                ${formatBytes(latestVer.size_bytes)}
                            </span>
                        </div>
                    ` : `<span style="color: var(--text-muted); font-size: 0.8rem;">Без файлу</span>`}
                </td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        ${scopeLabel}
                        ${clientVisBadge}
                    </div>
                </td>
                <td style="font-size: 0.82rem; color: var(--text-muted); white-space: nowrap;">
                    ${updatedStr}
                </td>
                <td style="text-align: right; white-space: nowrap;">
                    <div style="display: flex; gap: 6px; justify-content: flex-end;">
                        ${latestVer ? `
                            <button class="btn btn-sm btn-outline btn-download-latest-doc" data-storage-path="${escapeHtml(latestVer.storage_path)}" data-filename="${escapeHtml(latestVer.original_filename)}" title="Завантажити останню версію">
                                <i data-lucide="download" style="width: 14px; height: 14px;"></i>
                            </button>
                        ` : ""}
                        <a href="#/portal/documents/${doc.id}" class="btn btn-sm btn-outline" title="Відкрити паспорт документа">
                            <i data-lucide="external-link" style="width: 14px; height: 14px;"></i>
                        </a>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    return `
        <div class="portal-table-wrapper">
            <table class="portal-table">
                <thead>
                    <tr>
                        <th style="min-width: 220px;">Назва документа</th>
                        <th>Клієнт</th>
                        <th>Проєкт</th>
                        <th>Категорія</th>
                        <th>Статус</th>
                        <th>Остання версія</th>
                        <th>Доступ</th>
                        <th>Оновлено</th>
                        <th style="text-align: right;">Дія</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

function attachDocumentsTableEvents(documents, filter) {
    document.querySelectorAll(".btn-download-latest-doc").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const storagePath = btn.dataset.storagePath;
            const filename = btn.dataset.filename;
            if (!storagePath) return;

            btn.disabled = true;
            try {
                await DataClient.downloadDocumentFile(storagePath, filename);
            } catch (err) {
                alert("Помилка завантаження файлу: " + (err.message || "Невідома помилка"));
            } finally {
                btn.disabled = false;
            }
        });
    });
}

// -----------------------------------------------------------------------------
// Modals: Create Document
// -----------------------------------------------------------------------------
export async function openCreateDocumentModal(preselectedOrgId = null, preselectedProjId = null, onCreated = null) {
    const modalMount = document.getElementById("documents-modal-mount") || document.getElementById("project-detail-modal-mount") || document.body;

    const [orgsRes, projsRes] = await Promise.all([
        DataClient.getOrganizations({ status: "all" }),
        DataClient.getProjects({ status: "all" })
    ]);

    const orgs = orgsRes.data || [];
    const projs = projsRes.data || [];

    const activeOrgId = preselectedOrgId || (orgs[0]?.id || "");
    const filteredProjs = projs.filter(p => !activeOrgId || p.organization_id === activeOrgId);
    const activeProjId = preselectedProjId || (filteredProjs[0]?.id || "");

    // Get stages for preselected project if any
    let stages = [];
    if (activeProjId) {
        const stagesRes = await DataClient.getProjectRoadmap(activeProjId);
        stages = stagesRes.data || [];
    }

    const modalHtml = `
        <div class="portal-modal-backdrop" id="modal-create-doc-backdrop">
            <div class="portal-modal" style="max-width: 620px;">
                <div class="portal-modal-header">
                    <h3 class="portal-modal-title">Створити документ</h3>
                    <button class="portal-modal-close" id="btn-close-create-doc-modal">&times;</button>
                </div>
                <form id="form-create-document" class="portal-form">
                    <div class="portal-grid-2">
                        <div class="portal-form-group">
                            <label class="portal-label">Організація / Клієнт *</label>
                            <select id="doc-form-org" class="portal-select" required ${preselectedOrgId ? 'disabled' : ''}>
                                ${orgs.map(o => `<option value="${o.id}" ${o.id === activeOrgId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join("")}
                            </select>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Проєкт *</label>
                            <select id="doc-form-project" class="portal-select" required ${preselectedProjId ? 'disabled' : ''}>
                                ${filteredProjs.map(p => `<option value="${p.id}" ${p.id === activeProjId ? 'selected' : ''}>${escapeHtml(p.name || p.title)}</option>`).join("")}
                            </select>
                        </div>
                    </div>

                    <div class="portal-form-group">
                        <label class="portal-label">Назва документа *</label>
                        <input type="text" id="doc-form-title" class="portal-input" placeholder="Наприклад: Аудит відділу продажів Q3" required />
                    </div>

                    <div class="portal-form-group">
                        <label class="portal-label">Опис / Призначення</label>
                        <textarea id="doc-form-desc" class="portal-textarea" rows="2" placeholder="Короткий опис або примітки до документа..."></textarea>
                    </div>

                    <div class="portal-grid-2">
                        <div class="portal-form-group">
                            <label class="portal-label">Категорія *</label>
                            <select id="doc-form-category" class="portal-select" required>
                                ${DOCUMENT_CATEGORIES.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
                            </select>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Етап делівері (Roadmap)</label>
                            <select id="doc-form-stage" class="portal-select">
                                <option value="">Без прив'язки до етапу</option>
                                ${stages.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}
                            </select>
                        </div>
                    </div>

                    <div class="portal-grid-2">
                        <div class="portal-form-group">
                            <label class="portal-label">Статус документа</label>
                            <select id="doc-form-status" class="portal-select">
                                <option value="draft" selected>Чернетка</option>
                                <option value="internal_review">Внутрішня перевірка</option>
                                <option value="client_review">На перевірці клієнта</option>
                                <option value="changes_requested">Потрібні зміни</option>
                                <option value="approved">Погоджено</option>
                                <option value="final">Фінальний</option>
                            </select>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Внутрішній доступ *</label>
                            <select id="doc-form-scope" class="portal-select">
                                <option value="project_team" selected>Команда проєкту (Всі учасники)</option>
                                <option value="management">Керівництво (Тільки PM та Власник)</option>
                            </select>
                        </div>
                    </div>

                    <div class="portal-form-group" id="group-client-visible" style="margin-top: -6px;">
                        <label class="portal-checkbox-label" style="font-size: 0.88rem; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="doc-form-client-visible" />
                            <span>Дозволити видимість клієнту (is_client_visible)</span>
                        </label>
                        <span style="font-size: 0.76rem; color: var(--text-muted); display: block; margin-left: 24px; margin-top: 2px;">
                            У Phase 3A діє default deny для ролі клієнта. Прапорець готує видимість для Phase 4.
                        </span>
                    </div>

                    <!-- File Upload Section (Optional for placeholder creation) -->
                    <div class="portal-form-group" style="background: #131B2F; padding: 14px; border-radius: var(--radius-sm); border: 1px dashed var(--border-color);">
                        <label class="portal-label" style="display: flex; justify-content: space-between; align-items: center;">
                            <span>Початковий файл версії v1 (Опціонально)</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">PDF, DOCX, XLSX, PPTX, PNG тощо (до 50 МБ)</span>
                        </label>
                        <input type="file" id="doc-form-file" class="portal-input" style="padding: 6px;" />
                        <div style="margin-top: 8px;">
                            <input type="text" id="doc-form-change-note" class="portal-input" placeholder="Коментар до початкової версії (наприклад: Перша редакція)" style="font-size: 0.85rem;" />
                        </div>
                    </div>

                    <div class="portal-modal-actions" style="margin-top: 18px; display: flex; justify-content: flex-end; gap: 10px;">
                        <button type="button" class="btn btn-outline" id="btn-cancel-create-doc">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-create-doc">
                            <i data-lucide="plus"></i> Створити документ
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = modalHtml;
    const modalEl = tempDiv.firstElementChild;
    modalMount.appendChild(modalEl);
    if (window.lucide) window.lucide.createIcons();

    // Org / Project dynamic link
    const orgSelect = modalEl.querySelector("#doc-form-org");
    const projSelect = modalEl.querySelector("#doc-form-project");
    const stageSelect = modalEl.querySelector("#doc-form-stage");
    const scopeSelect = modalEl.querySelector("#doc-form-scope");
    const clientVisCheckbox = modalEl.querySelector("#doc-form-client-visible");

    orgSelect?.addEventListener("change", async () => {
        const selectedOrg = orgSelect.value;
        const matchingProjs = projs.filter(p => p.organization_id === selectedOrg);
        projSelect.innerHTML = matchingProjs.map(p => `<option value="${p.id}">${escapeHtml(p.name || p.title)}</option>`).join("");
        
        // update stages
        if (matchingProjs[0]) {
            const sRes = await DataClient.getProjectRoadmap(matchingProjs[0].id);
            stageSelect.innerHTML = `<option value="">Без прив'язки до етапу</option>` + 
                (sRes.data || []).map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
        } else {
            stageSelect.innerHTML = `<option value="">Без прив'язки до етапу</option>`;
        }
    });

    projSelect?.addEventListener("change", async () => {
        const sRes = await DataClient.getProjectRoadmap(projSelect.value);
        stageSelect.innerHTML = `<option value="">Без прив'язки до етапу</option>` + 
            (sRes.data || []).map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
    });

    scopeSelect?.addEventListener("change", () => {
        if (scopeSelect.value === "management") {
            clientVisCheckbox.checked = false;
            clientVisCheckbox.disabled = true;
        } else {
            clientVisCheckbox.disabled = false;
        }
    });

    const closeModal = () => modalEl.remove();
    modalEl.querySelector("#btn-close-create-doc-modal")?.addEventListener("click", closeModal);
    modalEl.querySelector("#btn-cancel-create-doc")?.addEventListener("click", closeModal);

    // Form Submit
    const form = modalEl.querySelector("#form-create-document");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = modalEl.querySelector("#btn-submit-create-doc");
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="portal-spinner portal-spinner-sm"></span> Створення...`;

        try {
            const orgId = preselectedOrgId || orgSelect.value;
            const projId = preselectedProjId || projSelect.value;
            const title = modalEl.querySelector("#doc-form-title").value.trim();
            const description = modalEl.querySelector("#doc-form-desc").value.trim();
            const category = modalEl.querySelector("#doc-form-category").value;
            const stageId = stageSelect.value || null;
            const status = modalEl.querySelector("#doc-form-status").value;
            const scope = scopeSelect.value;
            const isClientVis = scope === "management" ? false : clientVisCheckbox.checked;

            const fileInput = modalEl.querySelector("#doc-form-file");
            const initialFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
            const changeNote = modalEl.querySelector("#doc-form-change-note").value.trim();

            const docData = {
                organization_id: orgId,
                project_id: projId,
                stage_id: stageId,
                title,
                description,
                category,
                status,
                internal_access_scope: scope,
                is_client_visible: isClientVis,
                created_by: PortalAuth.getUser()?.id || null
            };

            const res = await DataClient.createDocument(docData, initialFile, changeNote);
            if (res.error) {
                alert("Помилка створення документа: " + res.error.message);
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i data-lucide="plus"></i> Створити документ`;
                if (window.lucide) window.lucide.createIcons();
                return;
            }

            if (res.warning) {
                alert(res.warning);
            }

            closeModal();
            if (typeof onCreated === "function") {
                await onCreated(res.data);
            }
        } catch (err) {
            console.error("Create document error:", err);
            alert("Помилка: " + err.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="plus"></i> Створити документ`;
            if (window.lucide) window.lucide.createIcons();
        }
    });
}

// -----------------------------------------------------------------------------
// Helper UI Formatters
// -----------------------------------------------------------------------------
export function getDocumentStatusLabel(status) {
    switch (status) {
        case "draft": return "Чернетка";
        case "internal_review": return "Внутрішня перевірка";
        case "client_review": return "На перевірці клієнта";
        case "changes_requested": return "Потрібні зміни";
        case "approved": return "Погоджено";
        case "final": return "Фінальний";
        default: return status || "Чернетка";
    }
}

export function getDocumentStatusBadge(status) {
    const label = getDocumentStatusLabel(status);
    switch (status) {
        case "draft": return `<span class="portal-badge portal-badge-secondary">${label}</span>`;
        case "internal_review": return `<span class="portal-badge portal-badge-info">${label}</span>`;
        case "client_review": return `<span class="portal-badge portal-badge-warning">${label}</span>`;
        case "changes_requested": return `<span class="portal-badge portal-badge-danger">${label}</span>`;
        case "approved": return `<span class="portal-badge portal-badge-success">${label}</span>`;
        case "final": return `<span class="portal-badge portal-badge-primary">${label}</span>`;
        default: return `<span class="portal-badge">${label}</span>`;
    }
}

export function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
