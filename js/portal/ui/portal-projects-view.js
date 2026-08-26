/* js/portal/ui/portal-projects-view.js - Projects List & Management */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";

export function renderProjectsView() {
    const canCreate = PortalAuth.isGlobalOwner() || PortalAuth.getMemberships().some(m => ["owner", "admin", "pm"].includes(m.org_role));

    return `
        <div class="portal-content">
            <div class="portal-view-header">
                <div class="portal-view-title-group">
                    <h1 class="portal-view-title">Проєкти делівері</h1>
                    <p class="portal-view-subtitle">Відстеження виконання зобов'язань, термінів, статусів здоров'я та команд</p>
                </div>
                ${canCreate ? `
                    <button class="btn btn-primary" id="btn-open-create-project">
                        <i data-lucide="plus"></i> Створити проєкт
                    </button>
                ` : ""}
            </div>

            <!-- Filter & Search Bar -->
            <div class="portal-filter-bar" style="display: flex; flex-direction: column; gap: 14px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; flex-wrap: wrap;">
                    <div class="portal-search-box" style="flex: 1; min-width: 260px;">
                        <i data-lucide="search" style="width: 16px; height: 16px; color: var(--text-muted);"></i>
                        <input type="text" id="projects-search-input" class="portal-search-input" placeholder="Пошук за назвою проєкту..." />
                    </div>

                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <!-- Client Filter -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <label style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Клієнт:</label>
                            <select id="projects-client-filter" class="portal-select" style="padding: 6px 12px; font-size: 0.82rem; min-width: 160px;">
                                <option value="all">Всі організації</option>
                            </select>
                        </div>

                        <!-- PM Filter -->
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <label style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">PM:</label>
                            <select id="projects-pm-filter" class="portal-select" style="padding: 6px 12px; font-size: 0.82rem; min-width: 140px;">
                                <option value="all">Всі менеджери</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Status Pills -->
                <div class="portal-status-pills" id="projects-status-pills" style="overflow-x: auto; padding-bottom: 4px; width: 100%;">
                    <button class="portal-pill active" data-status="all">Всі</button>
                    <button class="portal-pill" data-status="in_progress">В роботі</button>
                    <button class="portal-pill" data-status="discovery">Аудит / Дослідження</button>
                    <button class="portal-pill" data-status="onboarding">Онбординг</button>
                    <button class="portal-pill" data-status="client_review">Погодження клієнтом</button>
                    <button class="portal-pill" data-status="waiting_client">Очікує клієнта</button>
                    <button class="portal-pill" data-status="blocked">Заблоковано</button>
                    <button class="portal-pill" data-status="draft">Чернетка</button>
                    <button class="portal-pill" data-status="completed">Завершено</button>
                    <button class="portal-pill" data-status="paused">Призупинено</button>
                </div>
            </div>

            <!-- Table Container -->
            <div id="projects-table-container">
                <div class="portal-loading-container">
                    <div class="portal-spinner"></div>
                    <span>Завантаження проєктів...</span>
                </div>
            </div>
        </div>

        <!-- Create Project Modal Container -->
        <div id="create-project-modal-mount"></div>
    `;
}

export async function initProjectsViewEvents() {
    let currentFilter = {
        status: "all",
        search: "",
        organizationId: "all",
        pmId: "all"
    };
    let searchDebounceTimer = null;

    if (window.lucide) window.lucide.createIcons();

    // Populate Organization & PM filter dropdowns
    await populateFilterOptions();

    // Initial Load
    await loadProjectsTable(currentFilter);

    // Search Input Listener
    const searchInput = document.getElementById("projects-search-input");
    searchInput?.addEventListener("input", (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(async () => {
            currentFilter.search = e.target.value.trim();
            await loadProjectsTable(currentFilter);
        }, 300);
    });

    // Status Filter Listener
    const statusPills = document.querySelectorAll("#projects-status-pills .portal-pill");
    statusPills.forEach(pill => {
        pill.addEventListener("click", async () => {
            statusPills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            currentFilter.status = pill.getAttribute("data-status") || "all";
            await loadProjectsTable(currentFilter);
        });
    });

    // Client Filter Listener
    const clientSelect = document.getElementById("projects-client-filter");
    clientSelect?.addEventListener("change", async (e) => {
        currentFilter.organizationId = e.target.value;
        await loadProjectsTable(currentFilter);
    });

    // PM Filter Listener
    const pmSelect = document.getElementById("projects-pm-filter");
    pmSelect?.addEventListener("change", async (e) => {
        currentFilter.pmId = e.target.value;
        await loadProjectsTable(currentFilter);
    });

    // Open Create Project Modal
    const btnCreate = document.getElementById("btn-open-create-project");
    btnCreate?.addEventListener("click", () => {
        openCreateProjectModal(null, async () => {
            await loadProjectsTable(currentFilter);
        });
    });
}

async function populateFilterOptions() {
    try {
        const [{ data: orgs }, { data: staff }] = await Promise.all([
            DataClient.getOrganizations(),
            DataClient.getStaffProfiles()
        ]);

        const clientSelect = document.getElementById("projects-client-filter");
        if (clientSelect && orgs) {
            const orgOptions = orgs.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join("");
            clientSelect.innerHTML = `<option value="all">Всі організації</option>${orgOptions}`;
        }

        const pmSelect = document.getElementById("projects-pm-filter");
        if (pmSelect && staff) {
            const pmOptions = staff.map(p => `<option value="${p.id}">${escapeHtml(p.full_name || p.email)}</option>`).join("");
            pmSelect.innerHTML = `<option value="all">Всі менеджери</option>${pmOptions}`;
        }
    } catch (err) {
        console.warn("[ProjectsView] Filter populate error:", err);
    }
}

async function loadProjectsTable(filter) {
    const container = document.getElementById("projects-table-container");
    if (!container) return;

    container.innerHTML = `
        <div class="portal-loading-container">
            <div class="portal-spinner"></div>
            <span>Завантаження даних...</span>
        </div>
    `;

    try {
        const { data: projects, error } = await DataClient.getProjects(filter);

        if (error) {
            container.innerHTML = `
                <div class="portal-empty-state">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                    <div class="portal-empty-title">Помилка завантаження проєктів</div>
                    <div class="portal-empty-desc">${error.message}</div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        if (!projects || projects.length === 0) {
            const canCreate = PortalAuth.isGlobalOwner() || PortalAuth.getMemberships().some(m => ["owner", "admin", "pm"].includes(m.org_role));
            const hasFilters = filter.search || filter.status !== "all" || filter.organizationId !== "all" || filter.pmId !== "all";

            container.innerHTML = `
                <div class="portal-empty-state">
                    <div class="portal-empty-icon"><i data-lucide="folder"></i></div>
                    <div class="portal-empty-title">Проєктів не знайдено</div>
                    <div class="portal-empty-desc">
                        ${hasFilters 
                            ? "За обраними фільтрами немає активних проєктів. Спробуйте скинути фільтри." 
                            : "У системі ще немає створених проєктів делівері. Створіть перший проєкт."}
                    </div>
                    ${canCreate && !hasFilters ? `
                        <button class="btn btn-primary" id="btn-empty-create-project" style="margin-top: 8px;">
                            <i data-lucide="plus"></i> Створити проєкт
                        </button>
                    ` : ""}
                </div>
            `;
            document.getElementById("btn-empty-create-project")?.addEventListener("click", () => {
                openCreateProjectModal(null, async () => {
                    await loadProjectsTable(filter);
                });
            });
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const rowsHtml = projects.map(proj => {
            const org = proj.organizations;
            const pm = proj.responsible_pm;
            const teamCount = proj.project_memberships?.length || 0;
            const projectName = proj.name || proj.title || "Проєкт без назви";
            const startDate = proj.start_date ? formatDate(proj.start_date) : "—";
            const targetDate = (proj.target_date || proj.target_end_date) ? formatDate(proj.target_date || proj.target_end_date) : "—";
            const health = proj.health || proj.health_status || "on_track";
            const status = proj.status || "draft";
            const progress = proj.progress_percent;

            let progressHtml = `<span class="text-muted" style="color: var(--text-muted);">—</span>`;
            if (progress !== null && progress !== undefined) {
                progressHtml = `
                <div class="portal-progress-compact">
                  <div class="portal-progress-bar-mini">
                    <div class="portal-progress-fill-mini" style="width: ${progress}%"></div>
                  </div>
                  <span class="portal-progress-text-mini">${progress}%</span>
                </div>
                `;
            }

            return `
                <tr>
                    <td>
                        <div style="display: flex; flex-direction: column; gap: 3px;">
                            <a href="#/portal/projects/${proj.id}" class="portal-table-client-name" style="font-size: 0.95rem;">
                                ${escapeHtml(projectName)}
                            </a>
                            <span style="font-size: 0.76rem; color: var(--text-muted);">
                                ${getProjectTypeLabel(proj.project_type)}
                            </span>
                        </div>
                    </td>
                    <td>
                        ${org ? `
                            <a href="#/portal/clients/${org.id}" style="color: var(--color-primary); font-weight: 500; font-size: 0.88rem; display: inline-flex; align-items: center; gap: 6px;">
                                <i data-lucide="building" style="width: 13px; height: 13px;"></i> ${escapeHtml(org.name)}
                            </a>
                        ` : `<span style="color: var(--text-muted); font-size: 0.82rem;">—</span>`}
                    </td>
                    <td>
                        <span class="portal-badge portal-badge-status-${status}">
                            ${getProjectStatusLabel(status)}
                        </span>
                    </td>
                    <td>
                        ${progressHtml}
                    </td>
                    <td>
                        <span class="portal-badge portal-badge-health-${health}">
                            <span class="portal-health-dot portal-health-dot-${health}"></span>
                            ${getHealthLabel(health)}
                        </span>
                    </td>
                    <td>
                        ${pm ? `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 26px; height: 26px; border-radius: 50%; background: #1E293B; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; color: var(--color-primary);">
                                    ${pm.full_name ? pm.full_name.substring(0, 2).toUpperCase() : "PM"}
                                </div>
                                <span style="font-size: 0.84rem;">${escapeHtml(pm.full_name || pm.email)}</span>
                            </div>
                        ` : `<span style="color: var(--text-muted); font-size: 0.82rem;">—</span>`}
                    </td>
                    <td style="font-size: 0.82rem; color: var(--text-secondary);">
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span>${startDate}</span>
                            <span style="color: var(--text-muted); font-size: 0.75rem;">до ${targetDate}</span>
                        </div>
                    </td>
                    <td>
                        <span class="portal-badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary);">
                            <i data-lucide="users" style="width: 12px; height: 12px;"></i> ${teamCount} ${getMemberPlural(teamCount)}
                        </span>
                    </td>
                    <td style="text-align: right;">
                        <a href="#/portal/projects/${proj.id}" class="btn btn-sm btn-outline" style="padding: 6px 12px; font-size: 0.8rem;">
                            Відкрити <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
                        </a>
                    </td>
                </tr>
            `;
        }).join("");

        container.innerHTML = `
            <div class="portal-table-container">
                <table class="portal-table">
                    <thead>
                        <tr>
                            <th>Назва проєкту</th>
                            <th>Клієнт / Компанія</th>
                            <th>Статус</th>
                            <th>Прогрес</th>
                            <th>Стан</th>
                            <th>Відповідальний PM</th>
                            <th>Терміни</th>
                            <th>Команда</th>
                            <th style="text-align: right;">Дія</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();
    } catch (err) {
        container.innerHTML = `
            <div class="portal-empty-state">
                <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                <div class="portal-empty-title">Помилка</div>
                <div class="portal-empty-desc">${err.message}</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}

export async function openCreateProjectModal(defaultOrgId = null, onSuccess) {
    const mount = document.getElementById("create-project-modal-mount") || document.getElementById("client-detail-modal-mount");
    if (!mount) return;

    // Fetch organizations & staff
    const [{ data: orgs }, { data: staff }] = await Promise.all([
        DataClient.getOrganizations(),
        DataClient.getStaffProfiles()
    ]);

    const orgOptions = (orgs || []).map(o => `
        <option value="${o.id}" ${defaultOrgId === o.id ? "selected" : ""}>${escapeHtml(o.name)}</option>
    `).join("");

    const pmOptions = (staff || []).map(p => `
        <option value="${p.id}">${escapeHtml(p.full_name || p.email)} (${p.global_role.toUpperCase()})</option>
    `).join("");

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="create-project-modal-overlay">
            <div class="portal-modal" style="max-width: 620px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">Створити новий проєкт</div>
                    <button id="btn-close-create-project" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <form id="form-create-project">
                    <div class="portal-modal-body">
                        <div class="portal-form-group">
                            <label class="portal-label">Клієнт / Організація <span style="color: var(--color-danger);">*</span></label>
                            <select id="create-project-org-id" class="portal-select" required ${defaultOrgId ? "disabled" : ""}>
                                <option value="">-- Оберіть клієнта --</option>
                                ${orgOptions}
                            </select>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Назва проєкту <span style="color: var(--color-danger);">*</span></label>
                            <input type="text" id="create-project-name" class="portal-input" placeholder="Наприклад: Впровадження Sales CRM & Навчання менеджерів" required />
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Тип послуги / проєкту</label>
                                <select id="create-project-type" class="portal-select">
                                    <option value="custom" selected>Комплексний проєкт</option>
                                    <option value="audit_sales">Аудит відділу продажів</option>
                                    <option value="crm_implementation">Впровадження CRM</option>
                                    <option value="scripts_kpi">Скрипти та KPI</option>
                                    <option value="sales_training">Тренінг з продажів</option>
                                    <option value="ai_automation">ШІ & Автоматизація</option>
                                </select>
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Відповідальний PM</label>
                                <select id="create-project-pm-id" class="portal-select">
                                    <option value="">-- Не призначено --</option>
                                    ${pmOptions}
                                </select>
                            </div>
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Початковий статус</label>
                                <select id="create-project-status" class="portal-select">
                                    <option value="draft" selected>Чернетка</option>
                                    <option value="onboarding">Онбординг</option>
                                    <option value="discovery">Аудит / Дослідження</option>
                                    <option value="in_progress">В роботі</option>
                                    <option value="waiting_client">Очікує клієнта</option>
                                    <option value="blocked">Заблоковано</option>
                                    <option value="client_review">Погодження клієнтом</option>
                                    <option value="paused">Призупинено</option>
                                </select>
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Стан проєкту (Health)</label>
                                <select id="create-project-health" class="portal-select">
                                    <option value="on_track" selected>🟢 В нормі</option>
                                    <option value="at_risk">🟡 Є ризик</option>
                                    <option value="delayed">🔴 Із затримкою</option>
                                </select>
                            </div>
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Дата старту</label>
                                <input type="date" id="create-project-start-date" class="portal-input" />
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Планова дата завершення (Target)</label>
                                <input type="date" id="create-project-target-date" class="portal-input" />
                            </div>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Опис та ключові цілі проєкту</label>
                            <textarea id="create-project-description" class="portal-textarea" placeholder="Короткий опис результатів, очікувань клієнта та скоупу робіт..."></textarea>
                        </div>

                        <div id="create-project-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button type="button" class="btn btn-outline" id="btn-cancel-create-project">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-create-project">
                            <i data-lucide="check"></i> Створити проєкт
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    function closeModal() {
        mount.innerHTML = "";
    }

    document.getElementById("btn-close-create-project")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-create-project")?.addEventListener("click", closeModal);
    document.getElementById("create-project-modal-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "create-project-modal-overlay") closeModal();
    });

    const form = document.getElementById("form-create-project");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const organization_id = defaultOrgId || document.getElementById("create-project-org-id")?.value;
        const name = document.getElementById("create-project-name")?.value.trim();
        const project_type = document.getElementById("create-project-type")?.value || "custom";
        const responsible_pm_id = document.getElementById("create-project-pm-id")?.value || null;
        const status = document.getElementById("create-project-status")?.value || "draft";
        const health = document.getElementById("create-project-health")?.value || "on_track";
        const start_date = document.getElementById("create-project-start-date")?.value || null;
        const target_date = document.getElementById("create-project-target-date")?.value || null;
        const description = document.getElementById("create-project-description")?.value.trim();
        const errBox = document.getElementById("create-project-error");
        const btn = document.getElementById("btn-submit-create-project");

        if (!organization_id) {
            if (errBox) {
                errBox.textContent = "Оберіть організацію для проєкту";
                errBox.style.display = "block";
            }
            return;
        }

        if (!name) return;

        if (errBox) errBox.style.display = "none";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:16px;height:16px;border-width:2px;"></span> Створення...`;
        }

        try {
            const { data, error } = await DataClient.createProject({
                organization_id,
                name,
                project_type,
                responsible_pm_id,
                status,
                health,
                start_date,
                target_date,
                description: description || null
            });

            if (error) {
                if (errBox) {
                    errBox.textContent = error.message;
                    errBox.style.display = "block";
                }
            } else {
                closeModal();
                if (onSuccess) await onSuccess(data);
            }
        } catch (err) {
            if (errBox) {
                errBox.textContent = err.message;
                errBox.style.display = "block";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="check"></i> Створити проєкт`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

export function getProjectStatusLabel(status) {
    switch (status) {
        case "draft": return "Чернетка";
        case "onboarding": return "Onboarding";
        case "discovery": return "Discovery";
        case "in_progress":
        case "active": return "В роботі";
        case "waiting_client":
        case "waiting_for_client": return "Очікує клієнта";
        case "blocked": return "Заблоковано";
        case "client_review":
        case "review": return "Client Review";
        case "completed": return "Завершений";
        case "paused":
        case "on_hold": return "На паузі";
        case "archived": return "В архіві";
        case "planning": return "Планування";
        default: return status || "—";
    }
}

export function getHealthLabel(health) {
    switch (health) {
        case "on_track": return "В нормі";
        case "at_risk": return "Є ризик";
        case "delayed": return "Із затримкою";
        default: return health || "—";
    }
}

export function getProjectTypeLabel(type) {
    switch (type) {
        case "audit_sales": return "Аудит продажів";
        case "crm_implementation": return "Впровадження CRM";
        case "scripts_kpi": return "Скрипти та KPI";
        case "sales_training": return "Тренінг продажів";
        case "ai_automation": return "ШІ & Автоматизація";
        case "custom": return "Комплексний проєкт";
        default: return type || "Проєкт";
    }
}

function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" });
}

function getMemberPlural(count) {
    if (count === 1) return "учасник";
    if (count >= 2 && count <= 4) return "учасники";
    return "учасників";
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
