/* js/portal/ui/portal-notifications-view.js - Personal Notifications Inbox (Phase 5B) */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";

export function renderPortalNotificationsView() {
    return `
        <div class="portal-content portal-notifications-container">
            <!-- 1. Header -->
            <div class="portal-view-header">
                <div class="portal-view-title-group">
                    <h1 class="portal-view-title">Центр сповіщень</h1>
                    <p class="portal-view-subtitle">Персональний потік оперативних подій, дедлайнів та завдань, що потребують вашої уваги</p>
                </div>
                <div class="portal-dashboard-actions">
                    <button class="btn btn-outline" id="btn-eval-notifications" title="Перевірити нагадування та актуалізувати сповіщення">
                        <i data-lucide="bell-ring"></i> Перевірити статус
                    </button>
                    <button class="btn btn-outline" id="btn-mark-all-read" title="Позначити всі сповіщення як прочитані">
                        <i data-lucide="check-check"></i> Позначити всі як прочитані
                    </button>
                    <button class="btn btn-primary" id="btn-refresh-notifications" title="Оновити список">
                        <i data-lucide="refresh-cw"></i> Оновити
                    </button>
                </div>
            </div>

            <!-- 2. KPI Summary Counters -->
            <div class="portal-dashboard-kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 20px;">
                <div class="portal-dashboard-kpi-card" id="kpi-card-unread">
                    <div class="portal-kpi-card-top">
                        <span class="portal-kpi-card-title">Непрочитані</span>
                        <div class="portal-kpi-card-icon" style="background: rgba(59, 130, 246, 0.12); color: var(--color-primary);">
                            <i data-lucide="bell"></i>
                        </div>
                    </div>
                    <div class="portal-kpi-card-value" id="kpi-count-unread">--</div>
                    <div class="portal-kpi-subtext">Потребують ознайомлення</div>
                </div>

                <div class="portal-dashboard-kpi-card portal-kpi-alert" id="kpi-card-critical">
                    <div class="portal-kpi-card-top">
                        <span class="portal-kpi-card-title">Критичні</span>
                        <div class="portal-kpi-card-icon" style="background: rgba(239, 68, 68, 0.12); color: var(--color-danger);">
                            <i data-lucide="alert-circle"></i>
                        </div>
                    </div>
                    <div class="portal-kpi-card-value" id="kpi-count-critical" style="color: var(--color-danger);">--</div>
                    <div class="portal-kpi-subtext">Блокери та прострочення</div>
                </div>

                <div class="portal-dashboard-kpi-card" id="kpi-card-today">
                    <div class="portal-kpi-card-top">
                        <span class="portal-kpi-card-title">Сьогодні</span>
                        <div class="portal-kpi-card-icon" style="background: rgba(16, 185, 129, 0.12); color: var(--color-success);">
                            <i data-lucide="calendar"></i>
                        </div>
                    </div>
                    <div class="portal-kpi-card-value" id="kpi-count-today">--</div>
                    <div class="portal-kpi-subtext">Події за поточну добу</div>
                </div>

                <div class="portal-dashboard-kpi-card" id="kpi-card-total">
                    <div class="portal-kpi-card-top">
                        <span class="portal-kpi-card-title">Усього</span>
                        <div class="portal-kpi-card-icon" style="background: rgba(148, 163, 184, 0.12); color: var(--text-secondary);">
                            <i data-lucide="inbox"></i>
                        </div>
                    </div>
                    <div class="portal-kpi-card-value" id="kpi-count-total">--</div>
                    <div class="portal-kpi-subtext">Всі збережені сповіщення</div>
                </div>
            </div>

            <!-- 3. Filter Tabs / Pills -->
            <div class="portal-attention-filters" id="notifications-category-pills" style="margin-bottom: 16px;">
                <button class="portal-pill active" data-filter="all">Всі</button>
                <button class="portal-pill" data-filter="unread">Непрочитані</button>
                <button class="portal-pill" data-filter="critical">Критичні</button>
                <button class="portal-pill" data-filter="tasks">Задачі</button>
                <button class="portal-pill" data-filter="projects">Проєкти</button>
                <button class="portal-pill" data-filter="documents">Документи</button>
                <button class="portal-pill" data-filter="meetings">Зустрічі</button>
                <button class="portal-pill" data-filter="clients">Клієнти</button>
            </div>

            <!-- 4. Secondary Search & Select Filters -->
            <div class="portal-card" style="padding: 14px 18px; margin-bottom: 20px;">
                <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
                    <!-- Search Input -->
                    <div class="portal-search-box" style="flex: 1; min-width: 240px; max-width: 400px;">
                        <i data-lucide="search"></i>
                        <input type="text" id="notifications-search-input" class="portal-search-input" placeholder="Пошук у сповіщеннях..." />
                    </div>

                    <!-- Dropdown Filters -->
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <select id="notifications-client-filter" class="portal-select" style="min-width: 170px; height: 36px; padding: 4px 10px; font-size: 0.84rem;">
                            <option value="all">Всі клієнти</option>
                        </select>

                        <select id="notifications-project-filter" class="portal-select" style="min-width: 170px; height: 36px; padding: 4px 10px; font-size: 0.84rem;">
                            <option value="all">Всі проєкти</option>
                        </select>

                        <select id="notifications-severity-filter" class="portal-select" style="min-width: 150px; height: 36px; padding: 4px 10px; font-size: 0.84rem;">
                            <option value="all">Всі рівні</option>
                            <option value="critical">Критичні</option>
                            <option value="warning">Важливі</option>
                            <option value="info">Інформаційні</option>
                            <option value="success">Успішні</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- 5. Notifications List Container -->
            <div id="notifications-list-container">
                <div class="portal-loading-container" style="min-height: 240px;">
                    <div class="portal-spinner"></div>
                    <span>Завантаження сповіщень...</span>
                </div>
            </div>
        </div>
    `;
}

export async function initPortalNotificationsEvents() {
    let currentFilter = {
        category: "all",
        status: "all", // "all", "unread", "read"
        severity: "all",
        organization_id: "all",
        project_id: "all",
        search: ""
    };

    let allNotificationsCache = [];
    let organizationsCache = [];
    let projectsCache = [];

    // Parse URL query parameter if present (e.g. #/portal/notifications?filter=unread)
    const hash = window.location.hash || "";
    if (hash.includes("filter=unread")) {
        currentFilter.status = "unread";
        currentFilter.category = "unread";
    } else if (hash.includes("filter=critical")) {
        currentFilter.severity = "critical";
        currentFilter.category = "critical";
    }

    // Initialize UI Elements
    const searchInput = document.getElementById("notifications-search-input");
    const clientSelect = document.getElementById("notifications-client-filter");
    const projectSelect = document.getElementById("notifications-project-filter");
    const severitySelect = document.getElementById("notifications-severity-filter");
    const pillsContainer = document.getElementById("notifications-category-pills");
    const btnRefresh = document.getElementById("btn-refresh-notifications");
    const btnMarkAll = document.getElementById("btn-mark-all-read");
    const btnEval = document.getElementById("btn-eval-notifications");

    // Update initial active pill
    if (pillsContainer) {
        pillsContainer.querySelectorAll("button").forEach(b => {
            b.classList.toggle("active", b.dataset.filter === currentFilter.category);
        });
    }

    // Load filter options (organizations and projects)
    async function loadFilterOptions() {
        try {
            const [orgsRes, projsRes] = await Promise.all([
                DataClient.getOrganizations(),
                DataClient.getProjects()
            ]);

            organizationsCache = orgsRes.data || [];
            projectsCache = projsRes.data || [];

            if (clientSelect) {
                clientSelect.innerHTML = `<option value="all">Всі клієнти</option>` +
                    organizationsCache.map(o => `<option value="${o.id}">${o.name}</option>`).join("");
            }

            if (projectSelect) {
                projectSelect.innerHTML = `<option value="all">Всі проєкти</option>` +
                    projectsCache.map(p => `<option value="${p.id}">${p.name || p.title}</option>`).join("");
            }
        } catch (e) {
            console.warn("[NotificationsView] Error loading filter options:", e);
        }
    }

    // Update Counters
    async function updateCounters() {
        try {
            const counters = await DataClient.getNotificationCounters();
            const elUnread = document.getElementById("kpi-count-unread");
            const elCrit = document.getElementById("kpi-count-critical");
            const elToday = document.getElementById("kpi-count-today");
            const elTotal = document.getElementById("kpi-count-total");

            if (elUnread) elUnread.textContent = counters.unread ?? 0;
            if (elCrit) elCrit.textContent = counters.critical ?? 0;
            if (elToday) elToday.textContent = counters.today ?? 0;
            if (elTotal) elTotal.textContent = counters.total ?? 0;

            // Sync Header Bell Badge
            updateShellBellBadge(counters.unread || 0);
        } catch (e) {
            console.warn("[NotificationsView] Error updating counters:", e);
        }
    }

    // Fetch and render notification list
    async function loadNotifications() {
        const container = document.getElementById("notifications-list-container");
        if (!container) return;

        try {
            const queryParams = {
                limit: 100
            };

            if (currentFilter.status === "unread") {
                queryParams.is_read = false;
            } else if (currentFilter.status === "read") {
                queryParams.is_read = true;
            }

            if (currentFilter.severity !== "all") {
                queryParams.severity = currentFilter.severity;
            }

            if (currentFilter.organization_id !== "all") {
                queryParams.organization_id = currentFilter.organization_id;
            }

            if (currentFilter.project_id !== "all") {
                queryParams.project_id = currentFilter.project_id;
            }

            if (!["all", "unread", "critical"].includes(currentFilter.category)) {
                queryParams.category = currentFilter.category;
            }

            if (currentFilter.search) {
                queryParams.search = currentFilter.search;
            }

            const { data, error } = await DataClient.getNotifications(queryParams);
            if (error) throw error;

            allNotificationsCache = data || [];
            renderList(allNotificationsCache);
            await updateCounters();
        } catch (err) {
            console.error("[NotificationsView] load error:", err);
            container.innerHTML = `
                <div class="portal-empty-state" style="padding: 40px 20px; text-align: center;">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                    <div class="portal-empty-title">Помилка завантаження сповіщень</div>
                    <div class="portal-empty-desc">${err.message || 'Не вдалося підключитися до сервісу сповіщень.'}</div>
                    <button class="btn btn-outline" id="btn-retry-load" style="margin-top: 12px;">
                        <i data-lucide="refresh-cw"></i> Спробувати знову
                    </button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            document.getElementById("btn-retry-load")?.addEventListener("click", loadNotifications);
        }
    }

    // Render list into DOM
    function renderList(notifications) {
        const container = document.getElementById("notifications-list-container");
        if (!container) return;

        if (notifications.length === 0) {
            container.innerHTML = `
                <div class="portal-card portal-empty-state" style="padding: 48px 20px; text-align: center;">
                    <div class="portal-empty-icon" style="color: var(--text-muted);"><i data-lucide="bell-off"></i></div>
                    <div class="portal-empty-title" style="font-size: 1.1rem; margin-bottom: 6px;">Сповіщень не знайдено</div>
                    <div class="portal-empty-desc" style="max-width: 380px; margin: 0 auto;">
                        ${currentFilter.search || currentFilter.status !== "all" || currentFilter.category !== "all"
                            ? "За обраними фільтрами немає активних сповіщень. Спробуйте змінити критерії пошуку."
                            : "У вас немає нових сповіщень. Всі процеси та дедлайни під контролем."}
                    </div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const itemsHtml = notifications.map(n => {
            const isUnread = !n.is_read;
            const sevClass = n.severity === "critical" ? "portal-notif-crit" :
                             n.severity === "warning" ? "portal-notif-warn" :
                             n.severity === "success" ? "portal-notif-succ" : "portal-notif-info";

            const sevBadge = n.severity === "critical" ? `<span class="portal-badge portal-badge-danger" style="font-size:0.7rem;">КРИТИЧНО</span>` :
                             n.severity === "warning" ? `<span class="portal-badge portal-badge-warning" style="font-size:0.7rem;">ВАЖЛИВО</span>` :
                             n.severity === "success" ? `<span class="portal-badge portal-badge-success" style="font-size:0.7rem;">УСПІХ</span>` :
                             `<span class="portal-badge portal-badge-info" style="font-size:0.7rem;">ІНФО</span>`;

            const iconName = n.event_type.includes("task") ? "check-square" :
                             n.event_type.includes("meeting") ? "video" :
                             n.event_type.includes("document") ? "file-text" :
                             n.event_type.includes("project") ? "folder" :
                             n.severity === "critical" ? "alert-triangle" : "bell";

            const iconBg = n.severity === "critical" ? "rgba(239, 68, 68, 0.12)" :
                           n.severity === "warning" ? "rgba(245, 158, 11, 0.12)" :
                           n.severity === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(59, 130, 246, 0.12)";

            const iconColor = n.severity === "critical" ? "var(--color-danger)" :
                             n.severity === "warning" ? "var(--color-warning)" :
                             n.severity === "success" ? "var(--color-success)" : "var(--color-primary)";

            const relTime = DataClient.formatRelativeTime(n.created_at);

            return `
                <div class="portal-card portal-notif-item ${sevClass} ${isUnread ? 'portal-notif-unread' : ''}" data-id="${n.id}" data-link="${n.deep_link || '#'}">
                    <div style="display: flex; gap: 14px; align-items: flex-start;">
                        <!-- Icon -->
                        <div class="portal-notif-icon-box" style="background: ${iconBg}; color: ${iconColor};">
                            <i data-lucide="${iconName}"></i>
                        </div>

                        <!-- Content -->
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 4px; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    ${isUnread ? `<span class="portal-unread-dot" title="Непрочитане сповіщення"></span>` : ''}
                                    <span style="font-weight: 600; font-size: 0.94rem; color: var(--text-primary);">${n.title}</span>
                                    ${sevBadge}
                                </div>
                                <span style="font-size: 0.76rem; color: var(--text-muted);">${relTime}</span>
                            </div>

                            <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 10px; line-height: 1.45;">
                                ${n.message}
                            </p>

                            <!-- Metadata context pills & CTAs -->
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                                    ${n.organization?.name ? `<span class="portal-tag" style="font-size: 0.72rem;"><i data-lucide="briefcase" style="width:11px;height:11px;"></i> ${n.organization.name}</span>` : ''}
                                    ${n.project?.name ? `<span class="portal-tag" style="font-size: 0.72rem;"><i data-lucide="folder" style="width:11px;height:11px;"></i> ${n.project.name}</span>` : ''}
                                </div>

                                <div style="display: flex; gap: 8px; align-items: center;">
                                    ${isUnread ? `
                                        <button class="btn btn-outline btn-notif-mark-read" data-id="${n.id}" style="padding: 4px 10px; font-size: 0.78rem;" title="Позначити прочитаним">
                                            <i data-lucide="check"></i> Прочитано
                                        </button>
                                    ` : ''}
                                    ${n.deep_link ? `
                                        <a href="${n.deep_link}" class="btn btn-primary btn-notif-open" data-id="${n.id}" style="padding: 4px 12px; font-size: 0.78rem;">
                                            <i data-lucide="arrow-right"></i> Перейти
                                        </a>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        container.innerHTML = `<div style="display: flex; flex-direction: column; gap: 10px;">${itemsHtml}</div>`;
        if (window.lucide) window.lucide.createIcons();

        // Attach Card Click & Action Events
        container.querySelectorAll(".btn-notif-mark-read").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                btn.disabled = true;
                await DataClient.markNotificationAsRead(id);
                await loadNotifications();
            });
        });

        container.querySelectorAll(".btn-notif-open").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.dataset.id;
                await DataClient.markNotificationAsRead(id);
            });
        });
    }

    // Category Pill Filters
    if (pillsContainer) {
        pillsContainer.addEventListener("click", async (e) => {
            const btn = e.target.closest("button");
            if (!btn) return;

            pillsContainer.querySelectorAll("button").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const filter = btn.dataset.filter;
            currentFilter.category = filter;

            if (filter === "unread") {
                currentFilter.status = "unread";
                currentFilter.severity = "all";
            } else if (filter === "critical") {
                currentFilter.status = "all";
                currentFilter.severity = "critical";
            } else {
                currentFilter.status = "all";
                if (severitySelect?.value) {
                    currentFilter.severity = severitySelect.value;
                }
            }

            await loadNotifications();
        });
    }

    // Search Input Debounced
    let searchDebounceTimer = null;
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(async () => {
                currentFilter.search = e.target.value.trim();
                await loadNotifications();
            }, 250);
        });
    }

    // Dropdown Filters
    if (clientSelect) {
        clientSelect.addEventListener("change", async (e) => {
            currentFilter.organization_id = e.target.value;
            await loadNotifications();
        });
    }

    if (projectSelect) {
        projectSelect.addEventListener("change", async (e) => {
            currentFilter.project_id = e.target.value;
            await loadNotifications();
        });
    }

    if (severitySelect) {
        severitySelect.addEventListener("change", async (e) => {
            currentFilter.severity = e.target.value;
            await loadNotifications();
        });
    }

    // Action Buttons
    if (btnRefresh) {
        btnRefresh.addEventListener("click", async () => {
            const icon = btnRefresh.querySelector("i");
            if (icon) icon.classList.add("portal-spin");
            await loadNotifications();
            setTimeout(() => {
                if (icon) icon.classList.remove("portal-spin");
            }, 600);
        });
    }

    if (btnMarkAll) {
        btnMarkAll.addEventListener("click", async () => {
            btnMarkAll.disabled = true;
            await DataClient.markAllNotificationsAsRead();
            btnMarkAll.disabled = false;
            await loadNotifications();
        });
    }

    if (btnEval) {
        btnEval.addEventListener("click", async () => {
            btnEval.disabled = true;
            btnEval.innerHTML = `<span class="portal-spinner" style="width:14px;height:14px;border-width:2px;"></span> Перевірка...`;
            await DataClient.evaluateNotifications();
            btnEval.disabled = false;
            btnEval.innerHTML = `<i data-lucide="bell-ring"></i> Перевірити статус`;
            if (window.lucide) window.lucide.createIcons();
            await loadNotifications();
        });
    }

    // Initial load
    await loadFilterOptions();
    await loadNotifications();
}

function updateShellBellBadge(unreadCount) {
    const badge = document.getElementById("portal-shell-bell-badge");
    if (!badge) return;

    if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
        badge.style.display = "flex";
    } else {
        badge.textContent = "0";
        badge.style.display = "none";
    }
}
