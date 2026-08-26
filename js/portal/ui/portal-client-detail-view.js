/* js/portal/ui/portal-client-detail-view.js - Client Card & Contacts Management */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";
import { openCreateProjectModal, getProjectStatusLabel, getHealthLabel, getProjectTypeLabel } from "./portal-projects-view.js";

export function renderClientDetailView(clientId) {
    return `
        <div class="portal-content" id="client-detail-container" data-client-id="${clientId}">
            <div class="portal-loading-container">
                <div class="portal-spinner"></div>
                <span>Завантаження картки клієнта...</span>
            </div>
        </div>

        <!-- Modals Container -->
        <div id="client-detail-modal-mount"></div>
    `;
}

export async function initClientDetailEvents(clientId) {
    await loadClientDetail(clientId);
}

async function loadClientDetail(clientId) {
    const container = document.getElementById("client-detail-container");
    if (!container) return;

    try {
        const [{ data: client, error }, nextMeetingRes, portalAccessRes] = await Promise.all([
            DataClient.getOrganizationById(clientId),
            DataClient.getNextMeetingForClient(clientId),
            DataClient.getClientPortalAccessByOrg(clientId)
        ]);
        const nextMeeting = nextMeetingRes?.data || null;
        const portalAccessList = portalAccessRes?.data || [];

        if (error || !client) {
            container.innerHTML = `
                <div class="portal-empty-state">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                    <div class="portal-empty-title">Клієнта не знайдено</div>
                    <div class="portal-empty-desc">${error ? error.message : "Організація не існує або у вас немає доступу до неї."}</div>
                    <a href="#/portal/clients" class="btn btn-outline" style="margin-top: 12px;">
                        <i data-lucide="arrow-left"></i> Назад до списку
                    </a>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const canManage = PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin(client.id);
        const contacts = client.contacts || [];
        const projects = client.projects || [];
        const pm = client.responsible_pm;
        const createdDate = new Date(client.created_at).toLocaleDateString("uk-UA", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
        const updatedDate = new Date(client.updated_at).toLocaleDateString("uk-UA", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });

        container.innerHTML = `
            <!-- Top Breadcrumb -->
            <div style="margin-bottom: 20px;">
                <a href="#/portal/clients" class="link-arrow" style="font-size: 0.88rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px;">
                    <i data-lucide="arrow-left" style="width: 14px; height: 14px;"></i> До списку клієнтів
                </a>
            </div>

            <!-- Client Header Card -->
            <div class="portal-card-header">
                <div class="portal-card-header-left">
                    <div class="portal-card-logo-large">
                        ${client.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                            <h1 style="font-size: 1.8rem; margin: 0;">${escapeHtml(client.name)}</h1>
                            <span class="portal-badge portal-badge-status-${client.status}">
                                ${getStatusLabel(client.status)}
                            </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 16px; margin-top: 6px; font-size: 0.85rem; color: var(--text-secondary); flex-wrap: wrap;">
                            ${client.legal_name ? `<span><i data-lucide="building" style="width:13px;height:13px;vertical-align:middle;"></i> ${escapeHtml(client.legal_name)}</span>` : ""}
                            ${client.website ? `<a href="${escapeHtml(client.website)}" target="_blank" style="color: var(--color-primary);"><i data-lucide="globe" style="width:13px;height:13px;vertical-align:middle;"></i> ${escapeHtml(client.website.replace(/^https?:\/\//, ''))}</a>` : ""}
                            ${client.country ? `<span><i data-lucide="map-pin" style="width:13px;height:13px;vertical-align:middle;"></i> ${escapeHtml(client.country)}</span>` : ""}
                        </div>
                    </div>
                </div>

                ${canManage ? `
                    <button class="btn btn-outline" id="btn-edit-client">
                        <i data-lucide="edit-3"></i> Редагувати
                    </button>
                ` : ""}
            </div>

            <!-- Navigation Tabs -->
            <div class="portal-tabs-nav" id="client-card-tabs">
                <div class="portal-tab-btn active" data-tab="overview"><i data-lucide="info"></i> Огляд компанії</div>
                <div class="portal-tab-btn" data-tab="contacts"><i data-lucide="users"></i> Контакти (${contacts.length})</div>
                <div class="portal-tab-btn" data-tab="projects"><i data-lucide="folder"></i> Проєкти (${projects.length})</div>
            </div>

            <!-- Tab 1: Overview -->
            <div class="portal-tab-content" id="tab-content-overview">
                <div class="portal-grid-2">
                    <div>
                        <div class="portal-section-card">
                            <div class="portal-section-card-title">
                                <span>Профіль організації</span>
                            </div>
                            <div class="portal-detail-list">
                                <div class="portal-detail-item">
                                    <span class="portal-detail-label">Назва</span>
                                    <span class="portal-detail-value">${escapeHtml(client.name)}</span>
                                </div>
                                ${client.legal_name ? `<div class="portal-detail-item"><span class="portal-detail-label">Юридична назва</span><span class="portal-detail-value">${escapeHtml(client.legal_name)}</span></div>` : ""}
                                ${client.industry ? `<div class="portal-detail-item"><span class="portal-detail-label">Індустрія</span><span class="portal-detail-value">${escapeHtml(client.industry)}</span></div>` : ""}
                                ${client.country ? `<div class="portal-detail-item"><span class="portal-detail-label">Країна / Локація</span><span class="portal-detail-value">${escapeHtml(client.country)}</span></div>` : ""}
                                ${client.timezone ? `<div class="portal-detail-item"><span class="portal-detail-label">Часовий пояс</span><span class="portal-detail-value">${escapeHtml(client.timezone)}</span></div>` : ""}
                                ${client.website ? `<div class="portal-detail-item"><span class="portal-detail-label">Веб-сайт</span><span class="portal-detail-value"><a href="${escapeHtml(client.website)}" target="_blank" style="color:var(--color-primary);">${escapeHtml(client.website)}</a></span></div>` : ""}
                            </div>
                        </div>

                        <div class="portal-section-card">
                            <div class="portal-section-card-title">
                                <span>Внутрішні нотатки</span>
                            </div>
                            <div style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; background: #131B2F; padding: 14px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                ${escapeHtml(client.notes || "Немає додаткових внутрішніх нотаток.")}
                            </div>
                        </div>
                        
                        <details style="margin-top: 16px; background: #131B2F; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px;">
                            <summary style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary); cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center;">
                                <span>Технічна інформація</span>
                                <span style="font-size: 0.8rem;">▾</span>
                            </summary>
                            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem; margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 12px;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: var(--text-muted);">ID організації:</span>
                                    <span style="font-family: monospace; color: var(--text-secondary);">${client.id.substring(0, 8)}...</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: var(--text-muted);">Дата створення:</span>
                                    <span>${createdDate}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="color: var(--text-muted);">Останнє оновлення:</span>
                                    <span>${updatedDate}</span>
                                </div>
                            </div>
                        </details>
                    </div>

                    <!-- Right Column: Responsible & Meta -->
                    <div>
                        <div class="portal-section-card">
                            <div class="portal-section-card-title">
                                <span>Відповідальний менеджер</span>
                            </div>
                            ${pm ? `
                                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #131B2F; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #1E293B, #3B82F6); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #FFF;">
                                        ${pm.full_name ? pm.full_name.substring(0, 2).toUpperCase() : "PM"}
                                    </div>
                                    <div>
                                        <div style="font-weight: 600; font-size: 0.92rem;">${escapeHtml(pm.full_name || pm.email)}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(pm.email)}</div>
                                    </div>
                                </div>
                            ` : `
                                <div style="color: var(--text-muted); font-size: 0.85rem; padding: 12px; background: #131B2F; border-radius: var(--radius-sm); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                                    <span>Не призначено</span>
                                    ${canManage ? `<button class="btn btn-sm btn-outline" onclick="document.getElementById('btn-edit-client').click()" style="padding: 4px 8px; font-size: 0.8rem;">Призначити PM</button>` : ""}
                                </div>
                            `}
                        </div>

                        <!-- Next Meeting Card (Phase 3B) -->
                        <div class="portal-section-card">
                            <div class="portal-section-card-title" style="display: flex; justify-content: space-between; align-items: center;">
                                <span>Наступна зустріч</span>
                                <a href="#/portal/meetings" class="btn btn-sm btn-outline" style="padding: 2px 8px; font-size: 0.75rem;">
                                    Всі зустрічі →
                                </a>
                            </div>
                            <div style="background: #131B2F; padding: 14px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                                ${nextMeeting ? `
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
                                        <div>
                                            <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">
                                                <a href="#/portal/meetings/${nextMeeting.id}" class="portal-table-link">
                                                    ${escapeHtml(nextMeeting.title)}
                                                </a>
                                            </div>
                                            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                                                Проєкт: <strong style="color: var(--text-secondary);">${escapeHtml(nextMeeting.project?.title || nextMeeting.project?.name || "Проєкт")}</strong>
                                            </div>
                                        </div>
                                        <a href="#/portal/meetings/${nextMeeting.id}" class="btn btn-sm btn-primary" style="padding: 3px 8px; font-size: 0.75rem;">
                                            Відкрити
                                        </a>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 12px; font-size: 0.82rem; color: var(--text-secondary); margin-top: 8px; flex-wrap: wrap;">
                                        <span>📅 ${new Date(nextMeeting.start_at).toLocaleDateString("uk-UA", { day: "2-digit", month: "short" })}</span>
                                        <span>⏰ ${new Date(nextMeeting.start_at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}</span>
                                        <span>👥 ${(nextMeeting.participants || []).length} учасн.</span>
                                    </div>
                                ` : `
                                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                                        Наступних зустрічей не заплановано
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab 2: Contacts -->
            <div class="portal-tab-content" id="tab-content-contacts" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.2rem;">Контакти клієнта</h3>
                        <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-secondary);">Особи, які беруть участь у прийнятті рішень та технічній комунікації</p>
                    </div>
                    ${canManage ? `
                        <button class="btn btn-primary" id="btn-add-contact">
                            <i data-lucide="user-plus"></i> Додати контакт
                        </button>
                    ` : ""}
                </div>

                <div id="contacts-grid-container">
                    ${renderContactsGrid(contacts, canManage, portalAccessList, projects, client)}
                </div>
            </div>

            <!-- Tab 3: Projects (Active in Phase 1B) -->
            <div class="portal-tab-content" id="tab-content-projects" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.2rem;">Проєкти клієнта</h3>
                        <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-secondary);">
                            Всі активні та архівні проєкти виконання зобов'язань для <strong>${escapeHtml(client.name)}</strong>
                        </p>
                    </div>
                    ${canManage ? `
                        <button class="btn btn-primary" id="btn-add-client-project">
                            <i data-lucide="folder-plus"></i> Створити проєкт
                        </button>
                    ` : ""}
                </div>

                <div id="client-projects-container">
                    ${renderClientProjectsList(projects, canManage)}
                </div>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();

        // Setup Tabs switching
        const tabs = document.querySelectorAll("#client-card-tabs .portal-tab-btn");
        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                tabs.forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                const target = tab.getAttribute("data-tab");
                document.getElementById("tab-content-overview").style.display = target === "overview" ? "block" : "none";
                document.getElementById("tab-content-contacts").style.display = target === "contacts" ? "block" : "none";
                document.getElementById("tab-content-projects").style.display = target === "projects" ? "block" : "none";
            });
        });

        // Edit Client Button
        document.getElementById("btn-edit-client")?.addEventListener("click", () => {
            openEditClientModal(client, async () => {
                await loadClientDetail(clientId);
            });
        });

        // Add Contact Button
        document.getElementById("btn-add-contact")?.addEventListener("click", () => {
            openContactModal(client.id, null, async () => {
                await loadClientDetail(clientId);
            });
        });

        // Add Project Button (pre-selected with client.id)
        document.getElementById("btn-add-client-project")?.addEventListener("click", () => {
            openCreateProjectModal(client.id, async () => {
                await loadClientDetail(clientId);
            });
        });

        document.querySelector(".btn-empty-add-proj")?.addEventListener("click", () => {
            openCreateProjectModal(client.id, async () => {
                await loadClientDetail(clientId);
            });
        });

        // Contact Action Buttons (Edit / Delete / Client Access)
        attachContactActionEvents(client, contacts, portalAccessList, projects, async () => {
            await loadClientDetail(clientId);
        });

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

function renderContactsGrid(contacts, canManage, portalAccessList = [], projects = [], client = {}) {
    if (!contacts || contacts.length === 0) {
        return `
            <div class="portal-empty-state" style="background: #0E1526; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <div class="portal-empty-icon"><i data-lucide="users"></i></div>
                <div class="portal-empty-title">Контактів ще немає</div>
                <div class="portal-empty-desc">Додайте першу контактну особу клієнта для зв'язку та ведення комунікацій.</div>
            </div>
        `;
    }

    return `
        <div class="portal-contacts-grid">
            ${contacts.map(c => {
                const initials = (c.first_name?.[0] || "") + (c.last_name?.[0] || "");
                const access = portalAccessList.find(a => a.contact_id === c.id);
                const accessStatus = access?.status || "none";

                let accessBadgeHtml = "";
                let accessActionsHtml = "";

                if (accessStatus === "active") {
                    accessBadgeHtml = `
                        <span class="portal-badge" style="background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3);">
                            <i data-lucide="shield-check" style="width: 11px; height: 11px;"></i> Доступ активний
                        </span>
                    `;
                    if (canManage) {
                        accessActionsHtml = `
                            <button class="btn btn-sm btn-outline btn-manage-projects" data-access-id="${access.id}" data-contact-id="${c.id}" style="padding: 3px 8px; font-size: 0.74rem;">
                                <i data-lucide="folder-check" style="width: 12px; height: 12px;"></i> Керувати проєктами
                            </button>
                            <button class="btn btn-sm btn-outline btn-revoke-access" data-access-id="${access.id}" data-contact-id="${c.id}" style="padding: 3px 8px; font-size: 0.74rem; color: var(--color-danger); border-color: rgba(239, 68, 68, 0.3);">
                                <i data-lucide="shield-off" style="width: 12px; height: 12px;"></i> Відкликати
                            </button>
                        `;
                    }
                } else if (accessStatus === "invited") {
                    accessBadgeHtml = `
                        <span class="portal-badge" style="background: rgba(245, 158, 11, 0.15); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.3);">
                            <i data-lucide="clock" style="width: 11px; height: 11px;"></i> Запрошення надіслано
                        </span>
                    `;
                    if (canManage) {
                        accessActionsHtml = `
                            <button class="btn btn-sm btn-outline btn-resend-invite" data-access-id="${access.id}" data-contact-id="${c.id}" style="padding: 3px 8px; font-size: 0.74rem; color: #FBBF24; border-color: rgba(245, 158, 11, 0.3);">
                                <i data-lucide="send" style="width: 12px; height: 12px;"></i> Повторно надіслати
                            </button>
                            <button class="btn btn-sm btn-outline btn-manage-projects" data-access-id="${access.id}" data-contact-id="${c.id}" style="padding: 3px 8px; font-size: 0.74rem;">
                                <i data-lucide="folder-check" style="width: 12px; height: 12px;"></i> Проєкти
                            </button>
                            <button class="btn btn-sm btn-outline btn-revoke-access" data-access-id="${access.id}" data-contact-id="${c.id}" style="padding: 3px 8px; font-size: 0.74rem; color: var(--color-danger); border-color: rgba(239, 68, 68, 0.3);">
                                <i data-lucide="shield-off" style="width: 12px; height: 12px;"></i> Відкликати
                            </button>
                        `;
                    }
                } else if (accessStatus === "revoked") {
                    accessBadgeHtml = `
                        <span class="portal-badge" style="background: rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.3);">
                            <i data-lucide="shield-alert" style="width: 11px; height: 11px;"></i> Доступ відкликано
                        </span>
                    `;
                    if (canManage) {
                        accessActionsHtml = `
                            <button class="btn btn-sm btn-outline btn-grant-access" data-contact-id="${c.id}" style="padding: 3px 8px; font-size: 0.74rem; color: var(--color-primary); border-color: rgba(79, 70, 229, 0.3);">
                                <i data-lucide="key" style="width: 12px; height: 12px;"></i> Надати доступ
                            </button>
                        `;
                    }
                } else {
                    accessBadgeHtml = `
                        <span class="portal-badge" style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border: 1px solid var(--border-color);">
                            <i data-lucide="shield" style="width: 11px; height: 11px;"></i> Доступ не надано
                        </span>
                    `;
                    if (canManage) {
                        accessActionsHtml = `
                            <button class="btn btn-sm btn-outline btn-grant-access" data-contact-id="${c.id}" style="padding: 3px 8px; font-size: 0.74rem; color: var(--color-primary); border-color: rgba(79, 70, 229, 0.3);">
                                <i data-lucide="key" style="width: 12px; height: 12px;"></i> Надати доступ
                            </button>
                        `;
                    }
                }

                return `
                    <div class="portal-contact-card">
                        <div>
                            <div class="portal-contact-header">
                                <div class="portal-contact-main">
                                    <div class="portal-contact-avatar">
                                        ${initials.toUpperCase() || "C"}
                                    </div>
                                    <div>
                                        <div class="portal-contact-name">${escapeHtml(c.first_name)} ${escapeHtml(c.last_name || "")}</div>
                                        <div class="portal-contact-position">${escapeHtml(c.position || "Контактна особа")}</div>
                                    </div>
                                </div>
                            </div>

                            <div class="portal-contact-badges">
                                ${c.is_primary ? `<span class="portal-badge" style="background: rgba(16,185,129,0.15); color: #34D399;"><i data-lucide="star" style="width:11px;height:11px;"></i> Головний контакт</span>` : ""}
                                ${c.is_decision_maker ? `<span class="portal-badge" style="background: rgba(168,85,247,0.15); color: #C084FC;"><i data-lucide="award" style="width:11px;height:11px;"></i> Особа, що приймає рішення</span>` : ""}
                                ${c.is_technical_contact ? `<span class="portal-badge" style="background: rgba(59,130,246,0.15); color: #60A5FA;"><i data-lucide="cpu" style="width:11px;height:11px;"></i> Технічний контакт</span>` : ""}
                            </div>

                            <div class="portal-contact-details">
                                ${c.email ? `<div class="portal-contact-detail-row"><i data-lucide="mail" style="width:14px;height:14px;color:var(--text-muted);"></i> <a href="mailto:${escapeHtml(c.email)}" style="color:var(--text-primary);">${escapeHtml(c.email)}</a></div>` : ""}
                                ${c.phone ? `<div class="portal-contact-detail-row"><i data-lucide="phone" style="width:14px;height:14px;color:var(--text-muted);"></i> <a href="tel:${escapeHtml(c.phone)}" style="color:var(--text-primary);">${escapeHtml(c.phone)}</a></div>` : ""}
                                ${c.telegram ? `<div class="portal-contact-detail-row"><i data-lucide="send" style="width:14px;height:14px;color:var(--text-muted);"></i> <a href="https://t.me/${escapeHtml(c.telegram.replace('@',''))}" target="_blank" style="color:var(--color-primary);">${escapeHtml(c.telegram)}</a></div>` : ""}
                                ${c.notes ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px;font-style:italic;">"${escapeHtml(c.notes)}"</div>` : ""}
                            </div>

                            <!-- Client Portal Access Box -->
                            <div style="margin-top: 14px; padding: 10px 12px; background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <div style="font-size: 0.76rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                                        Client Portal
                                    </div>
                                    ${accessBadgeHtml}
                                </div>
                                ${accessActionsHtml ? `
                                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
                                        ${accessActionsHtml}
                                    </div>
                                ` : ""}
                            </div>
                        </div>

                        ${canManage ? `
                            <div class="portal-contact-actions" style="margin-top: 14px;">
                                <button class="btn btn-sm btn-outline btn-edit-contact" data-contact-id="${c.id}" style="padding: 4px 10px; font-size: 0.78rem;">
                                    <i data-lucide="edit-2" style="width:12px;height:12px;"></i> Редагувати
                                </button>
                                <button class="btn btn-sm btn-outline btn-delete-contact" data-contact-id="${c.id}" title="Видалити контакт" style="padding: 4px 10px; font-size: 0.78rem; color: var(--color-danger); border-color: rgba(239,68,68,0.3);">
                                    <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
                                </button>
                            </div>
                        ` : ""}
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function attachContactActionEvents(client, contacts, portalAccessList, projects, reloadCallback) {
    document.querySelectorAll(".btn-edit-contact").forEach(btn => {
        btn.addEventListener("click", () => {
            const contactId = btn.getAttribute("data-contact-id");
            const contact = contacts.find(c => c.id === contactId);
            if (contact) {
                openContactModal(client.id, contact, reloadCallback);
            }
        });
    });

    document.querySelectorAll(".btn-delete-contact").forEach(btn => {
        btn.addEventListener("click", () => {
            const contactId = btn.getAttribute("data-contact-id");
            const contact = contacts.find(c => c.id === contactId);
            if (contact) {
                openDeleteContactModal(contact, reloadCallback);
            }
        });
    });

    // Grant Client Portal Access
    document.querySelectorAll(".btn-grant-access").forEach(btn => {
        btn.addEventListener("click", () => {
            const contactId = btn.getAttribute("data-contact-id");
            const contact = contacts.find(c => c.id === contactId);
            if (contact) {
                openGrantClientAccessModal(client, contact, projects, reloadCallback);
            }
        });
    });

    // Resend Invite
    document.querySelectorAll(".btn-resend-invite").forEach(btn => {
        btn.addEventListener("click", async () => {
            const accessId = btn.getAttribute("data-access-id");
            if (!accessId) return;

            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:12px;height:12px;display:inline-block;vertical-align:middle;"></span> Надсилання...`;

            try {
                const { error } = await DataClient.resendClientInvite(accessId);
                if (error) {
                    alert(`Помилка: ${error.message}`);
                } else {
                    alert("Запрошення успішно надіслано повторно.");
                    if (reloadCallback) await reloadCallback();
                }
            } catch (err) {
                alert(`Помилка: ${err.message}`);
            } finally {
                btn.disabled = false;
            }
        });
    });

    // Manage Projects
    document.querySelectorAll(".btn-manage-projects").forEach(btn => {
        btn.addEventListener("click", () => {
            const accessId = btn.getAttribute("data-access-id");
            const contactId = btn.getAttribute("data-contact-id");
            const contact = contacts.find(c => c.id === contactId);
            const access = portalAccessList.find(a => a.id === accessId);
            if (contact && access) {
                openManageClientProjectsModal(client, contact, access, projects, reloadCallback);
            }
        });
    });

    // Revoke Access
    document.querySelectorAll(".btn-revoke-access").forEach(btn => {
        btn.addEventListener("click", () => {
            const accessId = btn.getAttribute("data-access-id");
            const contactId = btn.getAttribute("data-contact-id");
            const contact = contacts.find(c => c.id === contactId);
            const access = portalAccessList.find(a => a.id === accessId);
            if (contact && access) {
                openRevokeClientAccessModal(client, contact, access, reloadCallback);
            }
        });
    });
}


export async function openEditClientModal(client, onSuccess) {
    const mount = document.getElementById("client-detail-modal-mount");
    if (!mount) return;

    const { data: staff } = await DataClient.getStaffProfiles();
    const pmOptions = (staff || []).map(p => `
        <option value="${p.id}" ${client.responsible_pm_id === p.id ? "selected" : ""}>
            ${escapeHtml(p.full_name || p.email)}
        </option>
    `).join("");

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="edit-client-modal-overlay">
            <div class="portal-modal">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">Редагувати клієнта</div>
                    <button id="btn-close-edit-client" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <form id="form-edit-client">
                    <div class="portal-modal-body">
                        <div class="portal-form-group">
                            <label class="portal-label">Назва компанії <span style="color: var(--color-danger);">*</span></label>
                            <input type="text" id="edit-client-name" class="portal-input" value="${escapeHtml(client.name)}" required />
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Юридична назва</label>
                                <input type="text" id="edit-client-legal-name" class="portal-input" value="${escapeHtml(client.legal_name || '')}" />
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Веб-сайт</label>
                                <input type="url" id="edit-client-website" class="portal-input" value="${escapeHtml(client.website || '')}" />
                            </div>
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Індустрія</label>
                                <input type="text" id="edit-client-industry" class="portal-input" value="${escapeHtml(client.industry || '')}" />
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Країна / Місто</label>
                                <input type="text" id="edit-client-country" class="portal-input" value="${escapeHtml(client.country || '')}" />
                            </div>
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Статус</label>
                                <select id="edit-client-status" class="portal-select">
                                    <option value="active" ${client.status === "active" ? "selected" : ""}>Активний</option>
                                    <option value="paused" ${client.status === "paused" ? "selected" : ""}>На паузі</option>
                                    <option value="completed" ${client.status === "completed" ? "selected" : ""}>Завершений</option>
                                    <option value="archived" ${client.status === "archived" ? "selected" : ""}>В архіві</option>
                                </select>
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Відповідальний PM</label>
                                <select id="edit-client-pm-id" class="portal-select">
                                    <option value="">-- Не призначено --</option>
                                    ${pmOptions}
                                </select>
                            </div>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Внутрішні нотатки (Internal Notes)</label>
                            <textarea id="edit-client-notes" class="portal-textarea">${escapeHtml(client.notes || '')}</textarea>
                        </div>

                        <div id="edit-client-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button type="button" class="btn btn-outline" id="btn-cancel-edit-client">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-edit-client">
                            <i data-lucide="check"></i> Зберегти зміни
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

    document.getElementById("btn-close-edit-client")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-edit-client")?.addEventListener("click", closeModal);
    document.getElementById("edit-client-modal-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "edit-client-modal-overlay") closeModal();
    });

    const form = document.getElementById("form-edit-client");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("edit-client-name")?.value.trim();
        const legal_name = document.getElementById("edit-client-legal-name")?.value.trim();
        const website = document.getElementById("edit-client-website")?.value.trim();
        const industry = document.getElementById("edit-client-industry")?.value.trim();
        const country = document.getElementById("edit-client-country")?.value.trim();
        const status = document.getElementById("edit-client-status")?.value;
        const responsible_pm_id = document.getElementById("edit-client-pm-id")?.value || null;
        const notes = document.getElementById("edit-client-notes")?.value.trim();
        const errBox = document.getElementById("edit-client-error");
        const btn = document.getElementById("btn-submit-edit-client");

        if (!name) return;

        if (errBox) errBox.style.display = "none";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:16px;height:16px;border-width:2px;"></span> Збереження...`;
        }

        try {
            const { error } = await DataClient.updateOrganization(client.id, {
                name,
                legal_name: legal_name || null,
                website: website || null,
                industry: industry || null,
                country: country || null,
                status,
                responsible_pm_id,
                notes: notes || null
            });

            if (error) {
                if (errBox) {
                    errBox.textContent = error.message;
                    errBox.style.display = "block";
                }
            } else {
                closeModal();
                if (onSuccess) await onSuccess();
            }
        } catch (err) {
            if (errBox) {
                errBox.textContent = err.message;
                errBox.style.display = "block";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="check"></i> Зберегти зміни`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

export function openContactModal(orgId, contact = null, onSuccess) {
    const mount = document.getElementById("client-detail-modal-mount");
    if (!mount) return;

    const isEdit = Boolean(contact);

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="contact-modal-overlay">
            <div class="portal-modal">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">${isEdit ? "Редагувати контакт" : "Додати контактну особу"}</div>
                    <button id="btn-close-contact-modal" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <form id="form-contact-modal">
                    <div class="portal-modal-body">
                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Ім'я <span style="color: var(--color-danger);">*</span></label>
                                <input type="text" id="contact-first-name" class="portal-input" value="${escapeHtml(contact?.first_name || '')}" required />
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Прізвище</label>
                                <input type="text" id="contact-last-name" class="portal-input" value="${escapeHtml(contact?.last_name || '')}" />
                            </div>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Посада</label>
                            <input type="text" id="contact-position" class="portal-input" placeholder="CEO, Head of Sales, CTO..." value="${escapeHtml(contact?.position || '')}" />
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Email</label>
                                <input type="email" id="contact-email" class="portal-input" placeholder="alex@client.com" value="${escapeHtml(contact?.email || '')}" />
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Телефон</label>
                                <input type="tel" id="contact-phone" class="portal-input" placeholder="+380 50 123 4567" value="${escapeHtml(contact?.phone || '')}" />
                            </div>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Telegram / Messenger</label>
                            <input type="text" id="contact-telegram" class="portal-input" placeholder="@alex_tg" value="${escapeHtml(contact?.telegram || '')}" />
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 10px; background: #131B2F; padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                            <label style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem; cursor: pointer;">
                                <input type="checkbox" id="contact-is-primary" ${contact?.is_primary ? "checked" : ""} />
                                <span><strong>Головний контакт організації</strong> (Primary)</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem; cursor: pointer;">
                                <input type="checkbox" id="contact-is-dm" ${contact?.is_decision_maker ? "checked" : ""} />
                                <span>Особа, яка приймає рішення (ЛПР)</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem; cursor: pointer;">
                                <input type="checkbox" id="contact-is-tech" ${contact?.is_technical_contact ? "checked" : ""} />
                                <span>Технічний контакт / IT-відповідальний</span>
                            </label>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Нотатки щодо контакту</label>
                            <textarea id="contact-notes" class="portal-textarea" placeholder="Корисні деталі або графік зв'язку...">${escapeHtml(contact?.notes || '')}</textarea>
                        </div>

                        <div id="contact-modal-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button type="button" class="btn btn-outline" id="btn-cancel-contact-modal">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-contact-modal">
                            <i data-lucide="check"></i> ${isEdit ? "Зберегти" : "Додати"}
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

    document.getElementById("btn-close-contact-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-contact-modal")?.addEventListener("click", closeModal);
    document.getElementById("contact-modal-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "contact-modal-overlay") closeModal();
    });

    const form = document.getElementById("form-contact-modal");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const first_name = document.getElementById("contact-first-name")?.value.trim();
        const last_name = document.getElementById("contact-last-name")?.value.trim();
        const position = document.getElementById("contact-position")?.value.trim();
        const email = document.getElementById("contact-email")?.value.trim();
        const phone = document.getElementById("contact-phone")?.value.trim();
        const telegram = document.getElementById("contact-telegram")?.value.trim();
        const is_primary = document.getElementById("contact-is-primary")?.checked;
        const is_decision_maker = document.getElementById("contact-is-dm")?.checked;
        const is_technical_contact = document.getElementById("contact-is-tech")?.checked;
        const notes = document.getElementById("contact-notes")?.value.trim();
        const errBox = document.getElementById("contact-modal-error");
        const btn = document.getElementById("btn-submit-contact-modal");

        if (!first_name) return;

        if (errBox) errBox.style.display = "none";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:16px;height:16px;border-width:2px;"></span> Збереження...`;
        }

        try {
            const payload = {
                organization_id: orgId,
                first_name,
                last_name: last_name || "",
                position: position || null,
                email: email || null,
                phone: phone || null,
                telegram: telegram || null,
                is_primary,
                is_decision_maker,
                is_technical_contact,
                notes: notes || null
            };

            let res;
            if (isEdit) {
                res = await DataClient.updateContact(contact.id, payload);
            } else {
                res = await DataClient.createContact(payload);
            }

            if (res.error) {
                if (errBox) {
                    errBox.textContent = res.error.message;
                    errBox.style.display = "block";
                }
            } else {
                closeModal();
                if (onSuccess) await onSuccess();
            }
        } catch (err) {
            if (errBox) {
                errBox.textContent = err.message;
                errBox.style.display = "block";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="check"></i> ${isEdit ? "Зберегти" : "Додати"}`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

export function openDeleteContactModal(contact, onSuccess) {
    const mount = document.getElementById("client-detail-modal-mount");
    if (!mount) return;

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="delete-contact-overlay">
            <div class="portal-modal" style="max-width: 440px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title" style="color: var(--color-danger); display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="alert-triangle"></i> Видалити контакт?
                    </div>
                    <button id="btn-close-delete-modal" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="portal-modal-body">
                    <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
                        Ви дійсно бажаєте видалити контактну особу <strong>${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name || '')}</strong>? Цю дію неможливо скасувати.
                    </p>
                    <div id="delete-contact-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                </div>
                <div class="portal-modal-footer">
                    <button type="button" class="btn btn-outline" id="btn-cancel-delete">Скасувати</button>
                    <button type="button" class="btn btn-danger" id="btn-confirm-delete" style="background: var(--color-danger); color: #FFF;">
                        <i data-lucide="trash-2"></i> Видалити
                    </button>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    function closeModal() {
        mount.innerHTML = "";
    }

    document.getElementById("btn-close-delete-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-delete")?.addEventListener("click", closeModal);
    document.getElementById("delete-contact-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "delete-contact-overlay") closeModal();
    });

    document.getElementById("btn-confirm-delete")?.addEventListener("click", async () => {
        const btn = document.getElementById("btn-confirm-delete");
        const errBox = document.getElementById("delete-contact-error");

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Видалення...`;
        }

        try {
            const { error } = await DataClient.deleteContact(contact.id);
            if (error) {
                if (errBox) {
                    errBox.textContent = error.message;
                    errBox.style.display = "block";
                }
            } else {
                closeModal();
                if (onSuccess) await onSuccess();
            }
        } catch (err) {
            if (errBox) {
                errBox.textContent = err.message;
                errBox.style.display = "block";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="trash-2"></i> Видалити`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

export function openGrantClientAccessModal(client, contact, projects = [], onSuccess) {
    const mount = document.getElementById("client-detail-modal-mount");
    if (!mount) return;

    if (!contact.email || !contact.email.trim()) {
        alert("Спочатку додайте email контактної особи для надання доступу до кабінету.");
        return;
    }

    const orgProjects = (projects || []).filter(p => p.status !== "archived");

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="grant-access-modal-overlay">
            <div class="portal-modal" style="max-width: 520px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title" style="display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="key" style="color: var(--color-primary);"></i>
                        <span>Надати доступ до Client Portal</span>
                    </div>
                    <button id="btn-close-grant-access-modal" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <form id="form-grant-access-modal">
                    <div class="portal-modal-body">
                        <div style="background: rgba(79, 70, 229, 0.08); border: 1px solid rgba(79, 70, 229, 0.2); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 16px;">
                            <div style="font-size: 0.88rem; font-weight: 600; color: var(--text-primary);">
                                ${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name || '')}
                            </div>
                            <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
                                Email: <strong>${escapeHtml(contact.email)}</strong>
                            </div>
                            <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;">
                                Організація: ${escapeHtml(client.name)}
                            </div>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label" style="font-weight: 600;">
                                Виберіть дозволені проєкти делівері <span style="color: var(--color-danger);">*</span>
                            </label>
                            <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0 0 8px 0;">
                                Клієнт отримає доступ до Roadmap, дій та документів тільки обраних проєктів.
                            </p>

                            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 180px; overflow-y: auto; background: #111827; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px;">
                                ${orgProjects.length === 0 ? `
                                    <div style="font-size: 0.82rem; color: var(--text-muted); padding: 6px;">
                                        У цій організації ще немає активних проєктів.
                                    </div>
                                ` : orgProjects.map(p => `
                                    <label style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem; cursor: pointer; padding: 4px;">
                                        <input type="checkbox" name="grant_project_id" value="${p.id}" checked />
                                        <span>${escapeHtml(p.name || p.title || 'Проєкт')}</span>
                                    </label>
                                `).join("")}
                            </div>
                        </div>

                        <div id="grant-access-modal-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button type="button" class="btn btn-outline" id="btn-cancel-grant-access">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-grant-access">
                            <i data-lucide="send"></i> Надіслати запрошення
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

    document.getElementById("btn-close-grant-access-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-grant-access")?.addEventListener("click", closeModal);
    document.getElementById("grant-access-modal-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "grant-access-modal-overlay") closeModal();
    });

    const form = document.getElementById("form-grant-access-modal");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errBox = document.getElementById("grant-access-modal-error");
        const btn = document.getElementById("btn-submit-grant-access");

        const selectedProjectIds = Array.from(
            document.querySelectorAll('input[name="grant_project_id"]:checked')
        ).map(cb => cb.value);

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Надсилання...`;
        }

        try {
            const { data, error } = await DataClient.inviteClientContact({
                organizationId: client.id,
                contactId: contact.id,
                projectIds: selectedProjectIds
            });

            if (error) {
                if (errBox) {
                    errBox.textContent = error.message;
                    errBox.style.display = "block";
                }
            } else {
                closeModal();
                alert(`Запрошення для ${contact.first_name} (${contact.email}) успішно надіслано!`);
                if (onSuccess) await onSuccess();
            }
        } catch (err) {
            if (errBox) {
                errBox.textContent = err.message;
                errBox.style.display = "block";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="send"></i> Надіслати запрошення`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

export function openManageClientProjectsModal(client, contact, access, projects = [], onSuccess) {
    const mount = document.getElementById("client-detail-modal-mount");
    if (!mount) return;

    const orgProjects = (projects || []).filter(p => p.status !== "archived");

    // Pre-calculate which projects currently have memberships for this client user
    const currentMemberProjectIds = orgProjects.filter(p => {
        return (p.project_memberships || []).some(m => m.user_id === access.user_id);
    }).map(p => p.id);

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="manage-projects-modal-overlay">
            <div class="portal-modal" style="max-width: 500px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title" style="display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="folder-check" style="color: var(--color-primary);"></i>
                        <span>Керування проєктами клієнта</span>
                    </div>
                    <button id="btn-close-manage-projects-modal" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <form id="form-manage-projects-modal">
                    <div class="portal-modal-body">
                        <div style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 12px;">
                            Контакт: <strong>${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name || '')}</strong> (${escapeHtml(contact.email || '')})
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label" style="font-weight: 600;">
                                Дозволені проєкти делівері
                            </label>
                            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; background: #111827; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px;">
                                ${orgProjects.length === 0 ? `
                                    <div style="font-size: 0.82rem; color: var(--text-muted); padding: 6px;">
                                        У цій організації немає активних проєктів.
                                    </div>
                                ` : orgProjects.map(p => {
                                    const isChecked = currentMemberProjectIds.length === 0 || currentMemberProjectIds.includes(p.id);
                                    return `
                                        <label style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem; cursor: pointer; padding: 4px;">
                                            <input type="checkbox" name="manage_project_id" value="${p.id}" ${isChecked ? "checked" : ""} />
                                            <span>${escapeHtml(p.name || p.title || 'Проєкт')}</span>
                                        </label>
                                    `;
                                }).join("")}
                            </div>
                        </div>

                        <div id="manage-projects-modal-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button type="button" class="btn btn-outline" id="btn-cancel-manage-projects">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-manage-projects">
                            <i data-lucide="check"></i> Зберегти доступ
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

    document.getElementById("btn-close-manage-projects-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-manage-projects")?.addEventListener("click", closeModal);
    document.getElementById("manage-projects-modal-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "manage-projects-modal-overlay") closeModal();
    });

    const form = document.getElementById("form-manage-projects-modal");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errBox = document.getElementById("manage-projects-modal-error");
        const btn = document.getElementById("btn-submit-manage-projects");

        const selectedProjectIds = Array.from(
            document.querySelectorAll('input[name="manage_project_id"]:checked')
        ).map(cb => cb.value);

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Збереження...`;
        }

        try {
            const { error } = await DataClient.updateClientProjects(access.id, selectedProjectIds);
            if (error) {
                if (errBox) {
                    errBox.textContent = error.message;
                    errBox.style.display = "block";
                }
            } else {
                closeModal();
                alert("Доступ до проєктів успішно оновлено.");
                if (onSuccess) await onSuccess();
            }
        } catch (err) {
            if (errBox) {
                errBox.textContent = err.message;
                errBox.style.display = "block";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="check"></i> Зберегти доступ`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

export function openRevokeClientAccessModal(client, contact, access, onSuccess) {
    const mount = document.getElementById("client-detail-modal-mount");
    if (!mount) return;

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="revoke-access-modal-overlay">
            <div class="portal-modal" style="max-width: 440px;">
                <div class="portal-modal-header">
                    <div class="portal-modal-title" style="color: var(--color-danger); display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="shield-alert"></i> Відкликати доступ?
                    </div>
                    <button id="btn-close-revoke-modal" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="portal-modal-body">
                    <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
                        Ви дійсно бажаєте відкликати доступ до Client Portal для <strong>${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name || '')}</strong>?
                    </p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px;">
                        Клієнт втратить можливість переглядати проєкти, документи та діяти від імені цієї організації.
                    </p>
                    <div id="revoke-access-modal-error" style="color: var(--color-danger); font-size: 0.82rem; display: none; margin-top: 10px;"></div>
                </div>
                <div class="portal-modal-footer">
                    <button type="button" class="btn btn-outline" id="btn-cancel-revoke">Скасувати</button>
                    <button type="button" class="btn btn-danger" id="btn-confirm-revoke" style="background: var(--color-danger); color: #FFF;">
                        <i data-lucide="shield-off"></i> Відкликати доступ
                    </button>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    function closeModal() {
        mount.innerHTML = "";
    }

    document.getElementById("btn-close-revoke-modal")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-revoke")?.addEventListener("click", closeModal);
    document.getElementById("revoke-access-modal-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "revoke-access-modal-overlay") closeModal();
    });

    document.getElementById("btn-confirm-revoke")?.addEventListener("click", async () => {
        const btn = document.getElementById("btn-confirm-revoke");
        const errBox = document.getElementById("revoke-access-modal-error");

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Відкликання...`;
        }

        try {
            const { error } = await DataClient.revokeClientAccess(access.id);
            if (error) {
                if (errBox) {
                    errBox.textContent = error.message;
                    errBox.style.display = "block";
                }
            } else {
                closeModal();
                alert("Доступ до Client Portal успішно відкликано.");
                if (onSuccess) await onSuccess();
            }
        } catch (err) {
            if (errBox) {
                errBox.textContent = err.message;
                errBox.style.display = "block";
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i data-lucide="shield-off"></i> Відкликати доступ`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
}

function renderClientProjectsList(projects, canManage) {
    if (!projects || projects.length === 0) {
        return `
            <div class="portal-empty-state" style="background: #0E1526; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <div class="portal-empty-icon"><i data-lucide="folder"></i></div>
                <div class="portal-empty-title">Проєктів ще немає</div>
                <div class="portal-empty-desc">Для цієї організації ще не створено жодного проєкту делівері.</div>
                ${canManage ? `
                    <button class="btn btn-primary btn-empty-add-proj" style="margin-top: 8px;">
                        <i data-lucide="plus"></i> Створити перший проєкт
                    </button>
                ` : ""}
            </div>
        `;
    }

    return `
        <div class="portal-table-container">
            <table class="portal-table">
                <thead>
                    <tr>
                        <th>Назва проєкту</th>
                        <th>Тип проєкту</th>
                        <th>Статус</th>
                        <th>Стан проєкту</th>
                        <th>Терміни</th>
                        <th>Команда</th>
                        <th style="text-align: right;">Дія</th>
                    </tr>
                </thead>
                <tbody>
                    ${projects.map(p => {
                        const name = p.name || p.title || "Проєкт без назви";
                        const status = p.status || "draft";
                        const health = p.health || p.health_status || "on_track";
                        const target = p.target_date || p.target_end_date ? new Date(p.target_date || p.target_end_date).toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" }) : "—";
                        const teamCount = p.project_memberships?.length || 0;

                        return `
                            <tr>
                                <td>
                                    <a href="#/portal/projects/${p.id}" class="portal-table-client-name" style="font-size: 0.92rem;">
                                        ${escapeHtml(name)}
                                    </a>
                                </td>
                                <td style="font-size: 0.82rem; color: var(--text-secondary);">
                                    ${getProjectTypeLabel(p.project_type)}
                                </td>
                                <td>
                                    <span class="portal-badge portal-badge-status-${status}">
                                        ${getProjectStatusLabel(status)}
                                    </span>
                                </td>
                                <td>
                                    <span class="portal-badge portal-badge-health-${health}">
                                        <span class="portal-health-dot portal-health-dot-${health}"></span>
                                        ${getHealthLabel(health) === 'On Track' ? 'В нормі' : getHealthLabel(health) === 'At Risk' ? 'Є ризик' : getHealthLabel(health) === 'Delayed' ? 'Із затримкою' : getHealthLabel(health)}
                                    </span>
                                </td>
                                <td style="font-size: 0.82rem; color: var(--text-muted);">
                                    ${target === "—" ? "Не встановлено" : "до " + target}
                                </td>
                                <td>
                                    <span class="portal-badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary);">
                                        <i data-lucide="users" style="width: 12px; height: 12px;"></i> ${teamCount} ${teamCount === 1 ? 'учасник' : ([2,3,4].includes(teamCount) ? 'учасники' : 'учасників')}
                                    </span>
                                </td>
                                <td style="text-align: right;">
                                    <a href="#/portal/projects/${p.id}" class="btn btn-sm btn-outline" style="padding: 6px 12px; font-size: 0.8rem;">
                                        Відкрити <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
                                    </a>
                                </td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function getStatusLabel(status) {
    switch (status) {
        case "active": return "Активний";
        case "paused":
        case "on_hold": return "На паузі";
        case "completed": return "Завершений";
        case "archived": return "В архіві";
        default: return status || "—";
    }
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
