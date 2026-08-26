/* js/portal/ui/portal-meetings-view.js - Global Meetings Workspace */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";

export const MEETING_TYPES = [
    { value: "kickoff", label: "Стартова зустріч" },
    { value: "discovery", label: "Discovery" },
    { value: "interview_audit", label: "Інтерв'ю / аудит" },
    { value: "weekly_sync", label: "Щотижнева зустріч" },
    { value: "strategy_session", label: "Стратегічна сесія" },
    { value: "technical_sync", label: "Технічна зустріч" },
    { value: "demo", label: "Демонстрація" },
    { value: "result_review", label: "Перевірка результату" },
    { value: "final_presentation", label: "Фінальна презентація" },
    { value: "other", label: "Інше" }
];

export function getMeetingTypeLabel(type) {
    const found = MEETING_TYPES.find(t => t.value === type);
    return found ? found.label : (type || "Зустріч");
}

export function getMeetingStatusBadge(status) {
    switch (status) {
        case "scheduled":
            return `<span class="portal-badge portal-badge-primary"><i data-lucide="calendar" style="width: 12px; height: 12px;"></i> Заплановано</span>`;
        case "completed":
            return `<span class="portal-badge portal-badge-success"><i data-lucide="check-circle" style="width: 12px; height: 12px;"></i> Проведено</span>`;
        case "cancelled":
            return `<span class="portal-badge portal-badge-secondary"><i data-lucide="x-circle" style="width: 12px; height: 12px;"></i> Скасовано</span>`;
        default:
            return `<span class="portal-badge">${escapeHtml(status)}</span>`;
    }
}

export function renderMeetingsView() {
    const canCreate = PortalAuth.isGlobalOwner() || PortalAuth.getGlobalRole() === "pm";

    return `
        <div class="portal-content" id="meetings-view-container">
            <!-- Header Bar -->
            <div class="portal-view-header">
                <div class="portal-view-title-group">
                    <h1 class="portal-view-title">Зустрічі</h1>
                    <p class="portal-view-subtitle">Планування, ведення адженди, протоколів та рішень синхронізацій проєкту</p>
                </div>
                ${canCreate ? `
                    <button class="btn btn-primary" id="btn-create-meeting">
                        <i data-lucide="plus"></i> Запланувати зустріч
                    </button>
                ` : ""}
            </div>

            <!-- View Tabs (Upcoming, Completed, Cancelled, All) -->
            <div class="portal-tabs" style="margin-bottom: 16px;">
                <button class="portal-tab active" data-view-status="upcoming">
                    <i data-lucide="calendar-clock" style="width: 15px; height: 15px;"></i> Майбутні
                </button>
                <button class="portal-tab" data-view-status="completed">
                    <i data-lucide="check-circle" style="width: 15px; height: 15px;"></i> Проведені
                </button>
                <button class="portal-tab" data-view-status="cancelled">
                    <i data-lucide="x-circle" style="width: 15px; height: 15px;"></i> Скасовані
                </button>
                <button class="portal-tab" data-view-status="all">
                    <i data-lucide="list" style="width: 15px; height: 15px;"></i> Усі
                </button>
            </div>

            <!-- Filters Bar -->
            <div class="portal-filter-bar" style="margin-bottom: 20px;">
                <div class="portal-search-box" style="flex: 1; min-width: 200px;">
                    <i data-lucide="search" class="search-icon"></i>
                    <input type="text" id="filter-meeting-search" class="portal-input" placeholder="Пошук за назвою зустрічі..." />
                </div>

                <div class="portal-filter-group" style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <select id="filter-meeting-client" class="portal-select" style="min-width: 150px;">
                        <option value="all">Всі клієнти</option>
                    </select>

                    <select id="filter-meeting-project" class="portal-select" style="min-width: 150px;">
                        <option value="all">Всі проєкти</option>
                    </select>

                    <select id="filter-meeting-type" class="portal-select" style="min-width: 140px;">
                        <option value="all">Всі типи</option>
                        ${MEETING_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join("")}
                    </select>
                </div>
            </div>

            <!-- Meetings Table Container -->
            <div id="meetings-table-container">
                <div class="portal-loading-container">
                    <div class="portal-spinner"></div>
                    <span>Завантаження зустрічей...</span>
                </div>
            </div>
        </div>

        <!-- Modals Container -->
        <div id="meetings-modal-mount"></div>
    `;
}

export async function initMeetingsViewEvents() {
    let currentFilter = {
        search: "",
        organizationId: "",
        projectId: "",
        meetingType: "all",
        status: "upcoming"
    };

    // 1. Populate Client and Project filter dropdowns
    const { data: orgs } = await DataClient.getOrganizations();
    const clientSelect = document.getElementById("filter-meeting-client");
    if (clientSelect && orgs) {
        orgs.forEach(o => {
            const opt = document.createElement("option");
            opt.value = o.id;
            opt.textContent = o.name;
            clientSelect.appendChild(opt);
        });
    }

    const { data: projects } = await DataClient.getProjects();
    const projectSelect = document.getElementById("filter-meeting-project");
    if (projectSelect && projects) {
        projects.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = p.name || p.title;
            projectSelect.appendChild(opt);
        });
    }

    // 2. Load Meetings Data
    async function loadMeetings() {
        const container = document.getElementById("meetings-table-container");
        if (!container) return;

        container.innerHTML = `
            <div class="portal-loading-container">
                <div class="portal-spinner"></div>
                <span>Завантаження зустрічей...</span>
            </div>
        `;

        const { data: meetings, error } = await DataClient.getMeetings(currentFilter);

        if (error) {
            container.innerHTML = `
                <div class="portal-empty-state">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                    <div class="portal-empty-title">Помилка завантаження зустрічей</div>
                    <div class="portal-empty-desc">${escapeHtml(error.message || "Не вдалося отримати список зустрічей.")}</div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        if (!meetings || meetings.length === 0) {
            container.innerHTML = `
                <div class="portal-empty-state">
                    <div class="portal-empty-icon"><i data-lucide="calendar-x"></i></div>
                    <div class="portal-empty-title">Зустрічей не знайдено</div>
                    <div class="portal-empty-desc">
                        ${currentFilter.search || currentFilter.organizationId || currentFilter.projectId || currentFilter.meetingType !== "all"
                            ? "Немає зустрічей, що відповідають вибраним фільтрам."
                            : (currentFilter.status === "upcoming" ? "Наразі немає запланованих майбутніх зустрічей." : "Зустрічі відсутні у цьому розділі.")}
                    </div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        container.innerHTML = renderMeetingsTable(meetings);
        if (window.lucide) window.lucide.createIcons();
    }

    // 3. Setup Filter Listeners
    document.querySelectorAll(".portal-tab[data-view-status]").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".portal-tab[data-view-status]").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            currentFilter.status = tab.dataset.viewStatus;
            loadMeetings();
        });
    });

    let searchDebounce = null;
    document.getElementById("filter-meeting-search")?.addEventListener("input", (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            currentFilter.search = e.target.value.trim();
            loadMeetings();
        }, 300);
    });

    document.getElementById("filter-meeting-client")?.addEventListener("change", (e) => {
        currentFilter.organizationId = e.target.value === "all" ? "" : e.target.value;
        loadMeetings();
    });

    document.getElementById("filter-meeting-project")?.addEventListener("change", (e) => {
        currentFilter.projectId = e.target.value === "all" ? "" : e.target.value;
        loadMeetings();
    });

    document.getElementById("filter-meeting-type")?.addEventListener("change", (e) => {
        currentFilter.meetingType = e.target.value;
        loadMeetings();
    });

    // 4. Setup Create Meeting Button
    document.getElementById("btn-create-meeting")?.addEventListener("click", () => {
        openCreateMeetingModal(orgs || [], projects || [], () => {
            loadMeetings();
        });
    });

    // Initial load
    await loadMeetings();
}

function renderMeetingsTable(meetings) {
    const rows = meetings.map(m => {
        const startDate = new Date(m.start_at);
        const endDate = new Date(m.end_at);
        
        const dateStr = startDate.toLocaleDateString("uk-UA", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
        const timeStr = `${startDate.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })} – ${endDate.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}`;
        
        const orgName = m.organization ? m.organization.name : "—";
        const projName = m.project ? (m.project.title || m.project.name) : "—";

        // Participants summary
        const participants = m.participants || [];
        const internalCount = participants.filter(p => p.participant_type === "user").length;
        const clientCount = participants.filter(p => p.participant_type === "contact").length;

        const isRecurring = !!m.recurrence_series_id;

        return `
            <tr>
                <td style="white-space: nowrap;">
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.92rem;">${dateStr}</div>
                    <div style="color: var(--text-muted); font-size: 0.78rem;">${timeStr} (${escapeHtml(m.timezone || 'Kyiv')})</div>
                </td>
                <td>
                    <div style="font-weight: 600;">
                        <a href="#/portal/meetings/${m.id}" class="portal-table-link" style="font-size: 0.95rem;">
                            ${escapeHtml(m.title)}
                        </a>
                        ${isRecurring ? `
                            <span class="portal-badge portal-badge-info" style="font-size: 0.7rem; padding: 2px 6px; margin-left: 6px;" title="Повторювана зустріч">
                                <i data-lucide="repeat" style="width: 10px; height: 10px;"></i> Серія
                            </span>
                        ` : ""}
                    </div>
                    ${m.location_type === 'online' && m.meeting_url ? `
                        <div style="margin-top: 4px;">
                            <a href="${escapeHtml(m.meeting_url)}" target="_blank" rel="noopener noreferrer" style="color: var(--color-primary); font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;">
                                <i data-lucide="video" style="width: 12px; height: 12px;"></i> Приєднатися до дзвінка
                            </a>
                        </div>
                    ` : (m.location_text ? `<div style="color: var(--text-muted); font-size: 0.78rem; margin-top: 2px;">📍 ${escapeHtml(m.location_text)}</div>` : "")}
                </td>
                <td>
                    ${m.organization ? `
                        <a href="#/portal/clients/${m.organization.id}" class="portal-table-link">
                            ${escapeHtml(orgName)}
                        </a>
                    ` : "—"}
                </td>
                <td>
                    ${m.project ? `
                        <a href="#/portal/projects/${m.project.id}" class="portal-table-link">
                            ${escapeHtml(projName)}
                        </a>
                    ` : "—"}
                </td>
                <td>
                    <span class="portal-badge portal-badge-secondary" style="font-size: 0.8rem;">
                        ${getMeetingTypeLabel(m.meeting_type)}
                    </span>
                </td>
                <td>
                    <div style="font-size: 0.82rem; color: var(--text-secondary);">
                        <span title="Внутрішня команда">👥 ${internalCount} ком.</span> • 
                        <span title="Клієнтські контакти">👤 ${clientCount} клієнт</span>
                    </div>
                </td>
                <td>
                    ${getMeetingStatusBadge(m.status)}
                </td>
                <td style="text-align: right; white-space: nowrap;">
                    <a href="#/portal/meetings/${m.id}" class="btn btn-sm btn-outline" title="Відкрити картку зустрічі">
                        <i data-lucide="arrow-right"></i>
                    </a>
                </td>
            </tr>
        `;
    }).join("");

    return `
        <div class="portal-table-wrapper">
            <table class="portal-table">
                <thead>
                    <tr>
                        <th style="width: 180px;">Дата та час</th>
                        <th>Назва зустрічі</th>
                        <th>Клієнт</th>
                        <th>Проєкт</th>
                        <th>Тип</th>
                        <th>Учасники</th>
                        <th>Статус</th>
                        <th style="text-align: right; width: 80px;">Дії</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

export async function openCreateMeetingModal(orgs = [], projects = [], onCreated = null, defaultProjectId = null, defaultOrgId = null) {
    const mount = document.getElementById("meetings-modal-mount") || document.body;

    // Filter projects if org given
    let selectedOrgId = defaultOrgId || (projects.length > 0 ? projects[0].organization_id : (orgs[0]?.id || ""));
    let selectedProjId = defaultProjectId || (projects.find(p => p.organization_id === selectedOrgId)?.id || projects[0]?.id || "");

    // Fetch team staff and client contacts
    const { data: staff } = await DataClient.getStaffProfiles();
    let contacts = [];
    if (selectedOrgId) {
        const { data: contactData } = await DataClient.getContactsByOrg(selectedOrgId);
        contacts = contactData || [];
    }

    // Default dates
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0); // next round hour
    const dateDefault = now.toISOString().split("T")[0];
    const timeDefault = now.toTimeString().slice(0, 5);

    const modalHtml = `
        <div class="portal-modal-backdrop" id="create-meeting-backdrop">
            <div class="portal-modal" style="max-width: 680px; max-height: 90vh; overflow-y: auto;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">
                        <i data-lucide="calendar-plus" style="color: var(--color-primary);"></i>
                        <span>Запланувати зустріч</span>
                    </div>
                    <button class="portal-modal-close" id="btn-close-meeting-modal">&times;</button>
                </div>

                <form id="form-create-meeting" class="portal-modal-body" style="display: flex; flex-direction: column; gap: 16px;">
                    <!-- Project & Org Selection -->
                    <div class="portal-form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                        <div class="portal-form-group">
                            <label class="portal-label">Клієнт / Організація *</label>
                            <select id="meeting-form-org" class="portal-select" required ${defaultOrgId ? 'disabled' : ''}>
                                ${orgs.map(o => `<option value="${o.id}" ${o.id === selectedOrgId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join("")}
                            </select>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Проєкт делівері *</label>
                            <select id="meeting-form-project" class="portal-select" required ${defaultProjectId ? 'disabled' : ''}>
                                ${projects.filter(p => !selectedOrgId || p.organization_id === selectedOrgId).map(p => `
                                    <option value="${p.id}" ${p.id === selectedProjId ? 'selected' : ''}>${escapeHtml(p.name || p.title)}</option>
                                `).join("")}
                            </select>
                        </div>
                    </div>

                    <!-- Title & Type -->
                    <div class="portal-form-row" style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px;">
                        <div class="portal-form-group">
                            <label class="portal-label">Тема зустрічі *</label>
                            <input type="text" id="meeting-form-title" class="portal-input" placeholder="напр., Щотижневий синхрон проєкту" required />
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Тип зустрічі *</label>
                            <select id="meeting-form-type" class="portal-select" required>
                                ${MEETING_TYPES.map(t => `<option value="${t.value}" ${t.value === 'weekly_sync' ? 'selected' : ''}>${t.label}</option>`).join("")}
                            </select>
                        </div>
                    </div>

                    <!-- Date, Time, Duration & Timezone -->
                    <div class="portal-form-row" style="display: grid; grid-template-columns: 1.2fr 1fr 1fr 1.2fr; gap: 12px;">
                        <div class="portal-form-group">
                            <label class="portal-label">Дата *</label>
                            <input type="date" id="meeting-form-date" class="portal-input" value="${dateDefault}" required />
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Час початку *</label>
                            <input type="time" id="meeting-form-time" class="portal-input" value="${timeDefault}" required />
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Тривалість</label>
                            <select id="meeting-form-duration" class="portal-select">
                                <option value="30">30 хв</option>
                                <option value="45">45 хв</option>
                                <option value="60" selected>1 година</option>
                                <option value="90">1.5 години</option>
                                <option value="120">2 години</option>
                            </select>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Часовий пояс *</label>
                            <select id="meeting-form-timezone" class="portal-select">
                                <option value="Europe/Kyiv" selected>Київ (UTC+2 / +3)</option>
                                <option value="Europe/Warsaw">Варшава (UTC+1 / +2)</option>
                                <option value="Europe/London">Лондон (UTC+0 / +1)</option>
                                <option value="America/New_York">Нью-Йорк (EST)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Location / URL -->
                    <div class="portal-form-row" style="display: grid; grid-template-columns: 1fr 2fr; gap: 14px;">
                        <div class="portal-form-group">
                            <label class="portal-label">Формат *</label>
                            <select id="meeting-form-location-type" class="portal-select">
                                <option value="online" selected>Онлайн (Google Meet / Zoom)</option>
                                <option value="in_person">Офлайн / Офіс</option>
                                <option value="phone">Телефонний дзвінок</option>
                            </select>
                        </div>

                        <div class="portal-form-group" id="group-meeting-url">
                            <label class="portal-label">Посилання на зустріч</label>
                            <input type="url" id="meeting-form-url" class="portal-input" placeholder="https://meet.google.com/... або Zoom" />
                        </div>

                        <div class="portal-form-group" id="group-location-text" style="display: none; grid-column: span 2;">
                            <label class="portal-label">Адреса / локація</label>
                            <input type="text" id="meeting-form-location-text" class="portal-input" placeholder="Адреса офісу або конференц-зали" />
                        </div>
                    </div>

                    <!-- Participants Selection -->
                    <div class="portal-form-group">
                        <label class="portal-label">Внутрішня команда (Staff)</label>
                        <div style="max-height: 120px; overflow-y: auto; background: var(--bg-surface); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px;" id="meeting-staff-list">
                            ${(staff || []).map(s => `
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                    <input type="checkbox" class="chk-staff-participant" value="${s.id}" ${s.id === PortalAuth.getUserId() ? 'checked' : ''} />
                                    <span>${escapeHtml(s.full_name || s.email)} <small style="color: var(--text-muted);">(${s.global_role})</small></span>
                                </label>
                            `).join("")}
                        </div>
                    </div>

                    <div class="portal-form-group">
                        <label class="portal-label">Контакти клієнта</label>
                        <div style="max-height: 120px; overflow-y: auto; background: var(--bg-surface); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 6px;" id="meeting-contacts-list">
                            ${contacts.length === 0 ? `<div style="color: var(--text-muted); font-size: 0.85rem;">Контактних осіб не знайдено для обраного клієнта</div>` : contacts.map(c => `
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                    <input type="checkbox" class="chk-contact-participant" value="${c.id}" checked />
                                    <span>${escapeHtml(c.first_name)} ${escapeHtml(c.last_name || "")} ${c.position ? `<small style="color: var(--text-muted);">(${escapeHtml(c.position)})</small>` : ""}</span>
                                </label>
                            `).join("")}
                        </div>
                    </div>

                    <!-- Agenda -->
                    <div class="portal-form-group">
                        <label class="portal-label">Порядок денний (Agenda)</label>
                        <textarea id="meeting-form-agenda" class="portal-textarea" rows="3" placeholder="1. Огляд прогресу за тиждень&#10;2. Демонстрація прототипу&#10;3. Питання та блокери від клієнта"></textarea>
                    </div>

                    <!-- Recurrence Option (None, Weekly, Biweekly, Monthly) -->
                    <div style="background: rgba(59, 130, 246, 0.05); padding: 14px; border-radius: var(--radius-sm); border: 1px solid rgba(59, 130, 246, 0.2);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <label class="portal-checkbox-label" style="font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                <input type="checkbox" id="chk-is-recurring" />
                                <span>Зробити зустріч повторюваною (Серія зустрічей)</span>
                            </label>
                        </div>

                        <div id="recurring-options-panel" style="display: none; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px;">
                            <div class="portal-form-group">
                                <label class="portal-label">Періодичність *</label>
                                <select id="recurring-frequency" class="portal-select">
                                    <option value="weekly" selected>Щотижня (Weekly)</option>
                                    <option value="biweekly">Кожні 2 тижні (Biweekly)</option>
                                    <option value="monthly">Щомісяця (Monthly)</option>
                                </select>
                            </div>

                            <div class="portal-form-group">
                                <label class="portal-label">Кількість зустрічей уперед</label>
                                <select id="recurring-occurrences" class="portal-select">
                                    <option value="4" selected>4 зустрічі (на 1 місяць)</option>
                                    <option value="8">8 зустрічей (на 2 місяці)</option>
                                    <option value="12">12 зустрічей (на квартал)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="portal-form-group" style="margin-top: -4px;">
                        <label class="portal-checkbox-label" style="font-size: 0.88rem; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                            <input type="checkbox" id="meeting-form-client-visible" checked />
                            <span>Видимо клієнту в майбутньому кабінеті (is_client_visible)</span>
                        </label>
                    </div>

                    <div class="portal-modal-actions" style="margin-top: 8px;">
                        <button type="button" class="btn btn-outline" id="btn-cancel-create-meeting">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-create-meeting">
                            <i data-lucide="check"></i> Зберегти зустріч
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const modalDiv = document.createElement("div");
    modalDiv.innerHTML = modalHtml;
    mount.appendChild(modalDiv);

    if (window.lucide) window.lucide.createIcons();

    // Event Handlers for Modal
    const closeModal = () => modalDiv.remove();
    document.getElementById("btn-close-meeting-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-create-meeting")?.addEventListener("click", closeModal);

    // Format toggle
    document.getElementById("meeting-form-location-type")?.addEventListener("change", (e) => {
        const val = e.target.value;
        const groupUrl = document.getElementById("group-meeting-url");
        const groupLoc = document.getElementById("group-location-text");
        if (val === "online") {
            if (groupUrl) groupUrl.style.display = "block";
            if (groupLoc) groupLoc.style.display = "none";
        } else {
            if (groupUrl) groupUrl.style.display = "none";
            if (groupLoc) groupLoc.style.display = "block";
        }
    });

    // Recurrence toggle
    document.getElementById("chk-is-recurring")?.addEventListener("change", (e) => {
        const panel = document.getElementById("recurring-options-panel");
        if (panel) {
            panel.style.display = e.target.checked ? "grid" : "none";
        }
    });

    // Org change updates projects and contacts
    document.getElementById("meeting-form-org")?.addEventListener("change", async (e) => {
        const newOrgId = e.target.value;
        const projSelect = document.getElementById("meeting-form-project");
        if (projSelect) {
            projSelect.innerHTML = projects.filter(p => p.organization_id === newOrgId).map(p => `
                <option value="${p.id}">${escapeHtml(p.name || p.title)}</option>
            `).join("");
        }

        const contactsContainer = document.getElementById("meeting-contacts-list");
        if (contactsContainer) {
            const { data: newContacts } = await DataClient.getContactsByOrg(newOrgId);
            if (!newContacts || newContacts.length === 0) {
                contactsContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">Контактних осіб не знайдено для обраного клієнта</div>`;
            } else {
                contactsContainer.innerHTML = newContacts.map(c => `
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                        <input type="checkbox" class="chk-contact-participant" value="${c.id}" checked />
                        <span>${escapeHtml(c.first_name)} ${escapeHtml(c.last_name || "")} ${c.position ? `<small style="color: var(--text-muted);">(${escapeHtml(c.position)})</small>` : ""}</span>
                    </label>
                `).join("");
            }
        }
    });

    // Form submission
    document.getElementById("form-create-meeting")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById("btn-submit-create-meeting");
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<div class="portal-spinner" style="width: 14px; height: 14px;"></div> Збереження...`;
        }

        const orgId = document.getElementById("meeting-form-org").value;
        const projId = document.getElementById("meeting-form-project").value;
        const title = document.getElementById("meeting-form-title").value.trim();
        const meetingType = document.getElementById("meeting-form-type").value;
        const date = document.getElementById("meeting-form-date").value;
        const time = document.getElementById("meeting-form-time").value;
        const durationMinutes = parseInt(document.getElementById("meeting-form-duration").value, 10) || 60;
        const timezone = document.getElementById("meeting-form-timezone").value;
        const locationType = document.getElementById("meeting-form-location-type").value;
        const meetingUrl = document.getElementById("meeting-form-url")?.value.trim() || null;
        const locationText = document.getElementById("meeting-form-location-text")?.value.trim() || null;
        const agenda = document.getElementById("meeting-form-agenda")?.value.trim() || null;
        const isClientVisible = document.getElementById("meeting-form-client-visible")?.checked ?? true;
        const isRecurring = document.getElementById("chk-is-recurring")?.checked ?? false;

        // Calculate ISO timestamps
        const startAt = new Date(`${date}T${time.length === 5 ? time + ':00' : time}`);
        const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

        // Gather participants
        const participants = [];
        document.querySelectorAll(".chk-staff-participant:checked").forEach(chk => {
            participants.push({
                participant_type: "user",
                user_id: chk.value,
                attendance_status: "invited"
            });
        });
        document.querySelectorAll(".chk-contact-participant:checked").forEach(chk => {
            participants.push({
                participant_type: "contact",
                contact_id: chk.value,
                attendance_status: "invited"
            });
        });

        try {
            if (isRecurring) {
                const frequency = document.getElementById("recurring-frequency").value;
                const occurrences = parseInt(document.getElementById("recurring-occurrences").value, 10) || 4;

                const seriesData = {
                    organization_id: orgId,
                    project_id: projId,
                    title,
                    meeting_type: meetingType,
                    frequency,
                    interval: 1,
                    start_time: time,
                    duration_minutes: durationMinutes,
                    timezone,
                    start_date: date,
                    location_type: locationType,
                    meeting_url: meetingUrl,
                    location_text: locationText,
                    agenda,
                    is_client_visible: isClientVisible
                };

                const res = await DataClient.createMeetingSeries(seriesData, occurrences, participants);
                if (res.error) throw res.error;
            } else {
                const meetingData = {
                    organization_id: orgId,
                    project_id: projId,
                    title,
                    meeting_type: meetingType,
                    status: "scheduled",
                    start_at: startAt.toISOString(),
                    end_at: endAt.toISOString(),
                    timezone,
                    location_type: locationType,
                    meeting_url: meetingUrl,
                    location_text: locationText,
                    agenda,
                    organizer_user_id: PortalAuth.getUserId(),
                    is_client_visible: isClientVisible
                };

                const res = await DataClient.createMeeting(meetingData, participants);
                if (res.error) throw res.error;
            }

            closeModal();
            if (typeof onCreated === "function") {
                onCreated();
            }
        } catch (err) {
            console.error("Create meeting error:", err);
            alert("Помилка створення зустрічі: " + (err.message || "Спробуйте ще раз"));
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i data-lucide="check"></i> Зберегти зустріч`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
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
