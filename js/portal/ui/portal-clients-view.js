/* js/portal/ui/portal-clients-view.js - Clients / Organizations List */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";

export function renderClientsView() {
    return `
        <div class="portal-content">
            <div class="portal-view-header">
                <div class="portal-view-title-group">
                    <h1 class="portal-view-title">Клієнти</h1>
                    <p class="portal-view-subtitle">Управління компаніями, контрактами та закріпленими проєктними менеджерами</p>
                </div>
                ${PortalAuth.isGlobalOwner() ? `
                    <button class="btn btn-primary" id="btn-open-create-client">
                        <i data-lucide="plus"></i> Додати клієнта
                    </button>
                ` : ""}
            </div>

            <!-- Filter & Search Bar -->
            <div class="portal-filter-bar">
                <div class="portal-search-box">
                    <i data-lucide="search" style="width: 16px; height: 16px; color: var(--text-muted);"></i>
                    <input type="text" id="clients-search-input" class="portal-search-input" placeholder="Пошук компанії за назвою..." />
                </div>

                <div class="portal-status-pills" id="clients-status-pills">
                    <button class="portal-pill active" data-status="all">Всі</button>
                    <button class="portal-pill" data-status="active">Активні</button>
                    <button class="portal-pill" data-status="paused">На паузі</button>
                    <button class="portal-pill" data-status="completed">Завершені</button>
                    <button class="portal-pill" data-status="archived">Архів</button>
                </div>
            </div>

            <!-- Table Container -->
            <div id="clients-table-container">
                <div class="portal-loading-container">
                    <div class="portal-spinner"></div>
                    <span>Завантаження списку клієнтів...</span>
                </div>
            </div>
        </div>

        <!-- Create Client Modal Container -->
        <div id="create-client-modal-mount"></div>
    `;
}

export async function initClientsViewEvents() {
    let currentFilter = { status: "all", search: "" };
    let searchDebounceTimer = null;

    if (window.lucide) window.lucide.createIcons();

    // Initial Load
    await loadClientsTable(currentFilter);

    // Search Input Listener
    const searchInput = document.getElementById("clients-search-input");
    searchInput?.addEventListener("input", (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(async () => {
            currentFilter.search = e.target.value.trim();
            await loadClientsTable(currentFilter);
        }, 300);
    });

    // Status Filter Listener
    const statusPills = document.querySelectorAll("#clients-status-pills .portal-pill");
    statusPills.forEach(pill => {
        pill.addEventListener("click", async () => {
            statusPills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            currentFilter.status = pill.getAttribute("data-status") || "all";
            await loadClientsTable(currentFilter);
        });
    });

    // Open Create Client Modal
    const btnCreate = document.getElementById("btn-open-create-client");
    btnCreate?.addEventListener("click", () => {
        openCreateClientModal(async () => {
            await loadClientsTable(currentFilter);
        });
    });
}

async function loadClientsTable(filter) {
    const container = document.getElementById("clients-table-container");
    if (!container) return;

    container.innerHTML = `
        <div class="portal-loading-container">
            <div class="portal-spinner"></div>
            <span>Завантаження даних...</span>
        </div>
    `;

    try {
        const { data: clients, error } = await DataClient.getOrganizations(filter);

        if (error) {
            container.innerHTML = `
                <div class="portal-empty-state">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                    <div class="portal-empty-title">Помилка завантаження клієнтів</div>
                    <div class="portal-empty-desc">${error.message}</div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        if (!clients || clients.length === 0) {
            container.innerHTML = `
                <div class="portal-empty-state">
                    <div class="portal-empty-icon"><i data-lucide="briefcase"></i></div>
                    <div class="portal-empty-title">Клієнтів не знайдено</div>
                    <div class="portal-empty-desc">
                        ${filter.search || filter.status !== "all" 
                            ? "Спробуйте змінити фільтри або пошуковий запит." 
                            : "У вас поки немає доданих компаній. Створіть першого клієнта."}
                    </div>
                    ${PortalAuth.isGlobalOwner() && !filter.search && filter.status === "all" ? `
                        <button class="btn btn-primary" id="btn-empty-create-client" style="margin-top: 8px;">
                            <i data-lucide="plus"></i> Створити клієнта
                        </button>
                    ` : ""}
                </div>
            `;
            document.getElementById("btn-empty-create-client")?.addEventListener("click", () => {
                openCreateClientModal(async () => {
                    await loadClientsTable(filter);
                });
            });
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Render Table
        const rowsHtml = clients.map(client => {
            const primaryContact = client.contacts?.find(c => c.is_primary) || client.contacts?.[0];
            const pm = client.responsible_pm;
            const projectCount = client.projects?.length || 0;
            const createdDate = new Date(client.created_at).toLocaleDateString("uk-UA", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });

            return `
                <tr>
                    <td>
                        <div class="portal-table-client-cell">
                            <div class="portal-table-client-avatar">
                                ${client.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div class="portal-table-client-info">
                                <a href="#/portal/clients/${client.id}" class="portal-table-client-name">${escapeHtml(client.name)}</a>
                                <span class="portal-table-client-sub">${escapeHtml(client.legal_name || client.industry || "—")}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="portal-badge portal-badge-status-${client.status}">
                            ${getStatusLabel(client.status)}
                        </span>
                    </td>
                    <td>
                        ${primaryContact ? `
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: 500;">${escapeHtml(primaryContact.first_name)} ${escapeHtml(primaryContact.last_name || "")}</span>
                                <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(primaryContact.position || primaryContact.email || "")}</span>
                            </div>
                        ` : `<span style="color: var(--text-muted); font-size: 0.82rem;">Не призначено</span>`}
                    </td>
                    <td>
                        ${pm ? `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="width: 26px; height: 26px; border-radius: 50%; background: #1E293B; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; color: var(--color-primary);">
                                    ${pm.full_name ? pm.full_name.substring(0, 2).toUpperCase() : "PM"}
                                </div>
                                <span style="font-size: 0.85rem;">${escapeHtml(pm.full_name || pm.email)}</span>
                            </div>
                        ` : `<span style="color: var(--text-muted); font-size: 0.82rem;">Не призначено</span>`}
                    </td>
                    <td>
                        <span class="portal-badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary);">
                            <i data-lucide="folder" style="width: 12px; height: 12px;"></i> ${projectCount} проєктів
                        </span>
                    </td>
                    <td style="font-size: 0.82rem; color: var(--text-muted);">
                        ${createdDate}
                    </td>
                    <td style="text-align: right;">
                        <a href="#/portal/clients/${client.id}" class="btn btn-sm btn-outline" style="padding: 6px 12px; font-size: 0.8rem;">
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
                            <th>Компанія</th>
                            <th>Статус</th>
                            <th>Головний контакт</th>
                            <th>Відповідальний PM</th>
                            <th>Проєкти</th>
                            <th>Створено</th>
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

export async function openCreateClientModal(onSuccess) {
    const mount = document.getElementById("create-client-modal-mount");
    if (!mount) return;

    // Fetch PM staff for assignment
    const { data: staff } = await DataClient.getStaffProfiles();
    const pmOptions = (staff || []).map(p => `
        <option value="${p.id}">${escapeHtml(p.full_name || p.email)} (${p.global_role.toUpperCase()})</option>
    `).join("");

    mount.innerHTML = `
        <div class="portal-modal-overlay" id="create-client-modal-overlay">
            <div class="portal-modal">
                <div class="portal-modal-header">
                    <div class="portal-modal-title">Додати нового клієнта</div>
                    <button id="btn-close-create-client" style="color: var(--text-muted); cursor: pointer; padding: 4px;">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <form id="form-create-client">
                    <div class="portal-modal-body">
                        <div class="portal-form-group">
                            <label class="portal-label">Назва компанії <span style="color: var(--color-danger);">*</span></label>
                            <input type="text" id="client-name" class="portal-input" placeholder="Наприклад: TechCorp Solutions" required />
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Юридична назва</label>
                                <input type="text" id="client-legal-name" class="portal-input" placeholder="ТОВ 'ТекКорп Солюшнс'" />
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Веб-сайт</label>
                                <input type="url" id="client-website" class="portal-input" placeholder="https://techcorp.com" />
                            </div>
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Індустрія</label>
                                <input type="text" id="client-industry" class="portal-input" placeholder="Fintech, SaaS, Retail..." />
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Країна / Місто</label>
                                <input type="text" id="client-country" class="portal-input" placeholder="Україна, Київ" />
                            </div>
                        </div>

                        <div class="portal-form-row">
                            <div class="portal-form-group">
                                <label class="portal-label">Статус</label>
                                <select id="client-status" class="portal-select">
                                    <option value="active" selected>Активний</option>
                                    <option value="paused">На паузі</option>
                                    <option value="completed">Завершений</option>
                                    <option value="archived">В архіві</option>
                                </select>
                            </div>
                            <div class="portal-form-group">
                                <label class="portal-label">Відповідальний PM</label>
                                <select id="client-pm-id" class="portal-select">
                                    <option value="">-- Не призначено --</option>
                                    ${pmOptions}
                                </select>
                            </div>
                        </div>

                        <div class="portal-form-group">
                            <label class="portal-label">Внутрішні нотатки</label>
                            <textarea id="client-notes" class="portal-textarea" placeholder="Коментарі щодо клієнта, особливості комунікації або контрактів..."></textarea>
                        </div>

                        <div id="create-client-error" style="color: var(--color-danger); font-size: 0.82rem; display: none;"></div>
                    </div>
                    <div class="portal-modal-footer">
                        <button type="button" class="btn btn-outline" id="btn-cancel-create-client">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-submit-create-client">
                            <i data-lucide="check"></i> Створити клієнта
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

    document.getElementById("btn-close-create-client")?.addEventListener("click", closeModal);
    document.getElementById("btn-cancel-create-client")?.addEventListener("click", closeModal);
    document.getElementById("create-client-modal-overlay")?.addEventListener("click", (e) => {
        if (e.target.id === "create-client-modal-overlay") closeModal();
    });

    const form = document.getElementById("form-create-client");
    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("client-name")?.value.trim();
        const legal_name = document.getElementById("client-legal-name")?.value.trim();
        const website = document.getElementById("client-website")?.value.trim();
        const industry = document.getElementById("client-industry")?.value.trim();
        const country = document.getElementById("client-country")?.value.trim();
        const status = document.getElementById("client-status")?.value;
        const responsible_pm_id = document.getElementById("client-pm-id")?.value || null;
        const notes = document.getElementById("client-notes")?.value.trim();
        const errBox = document.getElementById("create-client-error");
        const btn = document.getElementById("btn-submit-create-client");

        if (!name) return;

        if (errBox) errBox.style.display = "none";
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<span class="portal-spinner" style="width:16px;height:16px;border-width:2px;"></span> Створення...`;
        }

        try {
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString().slice(-4);
            const { data, error } = await DataClient.createOrganization({
                name,
                slug,
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
                btn.innerHTML = `<i data-lucide="check"></i> Створити клієнта`;
                if (window.lucide) window.lucide.createIcons();
            }
        }
    });
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
