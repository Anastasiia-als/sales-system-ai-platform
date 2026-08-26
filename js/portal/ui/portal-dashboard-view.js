/* js/portal/ui/portal-dashboard-view.js - Phase 5A: Owner Command Center & Portfolio Dashboard */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";

export function renderPortalDashboardView() {
    return `
        <div class="portal-content portal-dashboard-content">
            <!-- Dashboard Header -->
            <div class="portal-view-header portal-dashboard-header">
                <div class="portal-view-title-group">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <h1 class="portal-view-title">Командний центр</h1>
                        <span class="portal-badge portal-badge-role-owner" style="font-size: 0.72rem; letter-spacing: 0.5px;">LIVE PORTFOLIO</span>
                    </div>
                    <p class="portal-view-subtitle">Операційний моніторинг клієнтів, термінів делівері, ризиків та навантаження команди</p>
                </div>

                <div class="portal-dashboard-actions">
                    <button class="btn btn-outline btn-sm" id="btn-refresh-dashboard" title="Оновити дані">
                        <i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i>
                        <span>Оновити</span>
                    </button>

                    ${PortalAuth.isGlobalOwner() || PortalAuth.isOrgAdmin() ? `
                        <div class="portal-quick-actions-dropdown">
                            <button class="btn btn-primary btn-sm" id="btn-quick-create-menu" style="display: flex; align-items: center; gap: 6px;">
                                <i data-lucide="plus" style="width: 15px; height: 15px;"></i>
                                <span>Швидка дія</span>
                                <i data-lucide="chevron-down" style="width: 13px; height: 13px;"></i>
                            </button>
                            <div class="portal-quick-menu" id="quick-create-menu-items" style="display: none;">
                                <a href="#/portal/clients" class="portal-quick-menu-item" onclick="window.location.hash='#/portal/clients';">
                                    <i data-lucide="briefcase"></i> Додати клієнта
                                </a>
                                <a href="#/portal/projects" class="portal-quick-menu-item" onclick="window.location.hash='#/portal/projects';">
                                    <i data-lucide="folder-plus"></i> Створити проєкт
                                </a>
                                <a href="#/portal/tasks" class="portal-quick-menu-item" onclick="window.location.hash='#/portal/tasks';">
                                    <i data-lucide="check-square"></i> Створити задачу
                                </a>
                                <a href="#/portal/meetings" class="portal-quick-menu-item" onclick="window.location.hash='#/portal/meetings';">
                                    <i data-lucide="video"></i> Запланувати зустріч
                                </a>
                                <a href="#/portal/documents" class="portal-quick-menu-item" onclick="window.location.hash='#/portal/documents';">
                                    <i data-lucide="file-plus"></i> Додати документ
                                </a>
                            </div>
                        </div>
                    ` : ""}
                </div>
            </div>

            <!-- Dynamic Dashboard Container -->
            <div id="portal-dashboard-mount">
                <div class="portal-loading-container" style="min-height: 400px;">
                    <div class="portal-spinner"></div>
                    <span>Завантаження операційних метрик портфеля...</span>
                </div>
            </div>
        </div>
    `;
}

export async function initPortalDashboardEvents() {
    if (window.lucide) window.lucide.createIcons();

    // Toggle Quick Actions Menu
    const quickMenuBtn = document.getElementById("btn-quick-create-menu");
    const quickMenuItems = document.getElementById("quick-create-menu-items");
    if (quickMenuBtn && quickMenuItems) {
        quickMenuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = quickMenuItems.style.display === "block";
            quickMenuItems.style.display = isOpen ? "none" : "block";
        });
        document.addEventListener("click", () => {
            if (quickMenuItems) quickMenuItems.style.display = "none";
        });
    }

    // Refresh Button
    const refreshBtn = document.getElementById("btn-refresh-dashboard");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            refreshBtn.disabled = true;
            const icon = refreshBtn.querySelector("i");
            if (icon) icon.classList.add("portal-spin");
            await loadDashboardData();
            refreshBtn.disabled = false;
            if (icon) icon.classList.remove("portal-spin");
        });
    }

    // Load initial data
    await loadDashboardData();
}

async function loadDashboardData() {
    const mount = document.getElementById("portal-dashboard-mount");
    if (!mount) return;

    try {
        const [{ data, error }, financeSummary, arSummary] = await Promise.all([
            DataClient.getOwnerDashboardData(),
            DataClient.getPortfolioFinanceSummary(),
            DataClient.getAccountsReceivableSummary()
        ]);

        if (error || !data) {
            mount.innerHTML = `
                <div class="portal-empty-state" style="padding: 40px 20px; text-align: center;">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                    <div class="portal-empty-title">Не вдалося завантажити дашборд</div>
                    <div class="portal-empty-desc">${escapeHtml(error?.message || "Помилка отримання даних.")}</div>
                    <button class="btn btn-primary" onclick="window.location.reload();" style="margin-top: 14px;">
                        <i data-lucide="refresh-cw"></i> Спробувати знову
                    </button>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        renderDashboardContent(mount, data, financeSummary, arSummary);
    } catch (err) {
        console.error("[Dashboard] Load error:", err);
        mount.innerHTML = `
            <div class="portal-empty-state" style="padding: 40px 20px; text-align: center;">
                <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                <div class="portal-empty-title">Помилка виконання запиту</div>
                <div class="portal-empty-desc">${escapeHtml(err?.message || "Непередбачена помилка.")}</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}

function renderDashboardContent(mount, dashboardData, financeSummary = {}, arSummary = {}) {
    const {
        kpis,
        portfolioProjects = [],
        attentionItems = [],
        upcomingMeetings = [],
        clientActions = [],
        teamWorkload = [],
        recentActivities = [],
        recentNotifications = [],
        organizations = [],
        staff = []
    } = dashboardData;

    const currencyAR = arSummary.currencyAR || {};
    const totalOverdueInvoices = Object.values(currencyAR).reduce((sum, ar) => sum + (ar.overdueCount || 0), 0);

    mount.innerHTML = `
        <!-- 1. KPI Summary Header Row -->
        <div class="portal-dashboard-kpi-grid">
            <div class="portal-dashboard-kpi-card">
                <div class="portal-kpi-card-top">
                    <span class="portal-kpi-card-title">Активні клієнти</span>
                    <div class="portal-kpi-card-icon" style="background: rgba(59, 130, 246, 0.12); color: var(--color-primary);">
                        <i data-lucide="briefcase"></i>
                    </div>
                </div>
                <div class="portal-kpi-card-value">${kpis.activeClientsCount}</div>
                <div class="portal-kpi-card-footer">
                    <span class="portal-kpi-subtext">Компаній у роботі</span>
                </div>
            </div>

            <div class="portal-dashboard-kpi-card">
                <div class="portal-kpi-card-top">
                    <span class="portal-kpi-card-title">Активні проєкти</span>
                    <div class="portal-kpi-card-icon" style="background: rgba(99, 102, 241, 0.12); color: #818cf8;">
                        <i data-lucide="folder"></i>
                    </div>
                </div>
                <div class="portal-kpi-card-value">${kpis.activeProjectsCount}</div>
                <div class="portal-kpi-card-footer">
                    <span class="portal-kpi-subtext">Поточний делівері пайплайн</span>
                </div>
            </div>

            <div class="portal-dashboard-kpi-card ${kpis.atRiskProjectsCount > 0 ? 'portal-kpi-alert' : ''}">
                <div class="portal-kpi-card-top">
                    <span class="portal-kpi-card-title">У зоні ризику</span>
                    <div class="portal-kpi-card-icon" style="background: rgba(239, 68, 68, 0.12); color: var(--color-danger);">
                        <i data-lucide="alert-triangle"></i>
                    </div>
                </div>
                <div class="portal-kpi-card-value ${kpis.atRiskProjectsCount > 0 ? 'text-danger' : ''}">${kpis.atRiskProjectsCount}</div>
                <div class="portal-kpi-card-footer">
                    <span class="portal-kpi-subtext">Затримка / Ризик / Блокер</span>
                </div>
            </div>

            <div class="portal-dashboard-kpi-card ${kpis.overdueTasksCount > 0 ? 'portal-kpi-warning' : ''}">
                <div class="portal-kpi-card-top">
                    <span class="portal-kpi-card-title">Прострочені задачі</span>
                    <div class="portal-kpi-card-icon" style="background: rgba(245, 158, 11, 0.12); color: var(--color-warning);">
                        <i data-lucide="clock"></i>
                    </div>
                </div>
                <div class="portal-kpi-card-value ${kpis.overdueTasksCount > 0 ? 'text-warning' : ''}">${kpis.overdueTasksCount}</div>
                <div class="portal-kpi-card-footer">
                    <span class="portal-kpi-subtext">Потребують актуалізації термінів</span>
                </div>
            </div>

            <div class="portal-dashboard-kpi-card">
                <div class="portal-kpi-card-top">
                    <span class="portal-kpi-card-title">Очікуємо від клієнтів</span>
                    <div class="portal-kpi-card-icon" style="background: rgba(16, 185, 129, 0.12); color: var(--color-success);">
                        <i data-lucide="user-check"></i>
                    </div>
                </div>
                <div class="portal-kpi-card-value">${kpis.clientActionsCount}</div>
                <div class="portal-kpi-card-footer">
                    ${kpis.overdueClientActionsCount > 0 ? `
                        <span class="portal-badge portal-badge-danger" style="font-size: 0.72rem; padding: 2px 6px;">
                            ${kpis.overdueClientActionsCount} прострочено
                        </span>
                    ` : `
                        <span class="portal-kpi-subtext">Активні клієнтські дії</span>
                    `}
                </div>
            </div>

            <div class="portal-dashboard-kpi-card">
                <div class="portal-kpi-card-top">
                    <span class="portal-kpi-card-title">Документи на погодженні</span>
                    <div class="portal-kpi-card-icon" style="background: rgba(14, 165, 233, 0.12); color: #38bdf8;">
                        <i data-lucide="file-check"></i>
                    </div>
                </div>
                <div class="portal-kpi-card-value">${kpis.pendingReviewsCount}</div>
                <div class="portal-kpi-card-footer">
                    <span class="portal-kpi-subtext">Статус Client Review</span>
                </div>
            </div>
        </div>

        <!-- 2. Main Work Area: Portfolio Health (Dominant) & Attention Center -->
        <div class="portal-dashboard-main-grid">
            <!-- Left: Dominant Portfolio Health Table -->
            <div class="portal-dashboard-portfolio-section">
                <div class="portal-card" style="padding: 20px;">
                    <div class="portal-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="portal-card-icon" style="background: rgba(59, 130, 246, 0.12); color: var(--color-primary);">
                                <i data-lucide="layers"></i>
                            </div>
                            <div>
                                <h2 class="portal-card-title" style="font-size: 1.15rem;">Портфель проєктів</h2>
                                <p class="portal-card-subtitle" style="font-size: 0.8rem;">Здоров'я проєктів, динаміка делівері та наступні віхи</p>
                            </div>
                        </div>
                        <div style="font-size: 0.82rem; color: var(--text-muted);">
                            Всього проєктів: <strong style="color: var(--text-primary);">${portfolioProjects.length}</strong>
                        </div>
                    </div>

                    <!-- Portfolio Filters Bar -->
                    <div class="portal-dashboard-filters" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px;">
                        <div style="flex: 1; min-width: 200px;">
                            <input type="text" id="dashboard-portfolio-search" class="portal-search-input" placeholder="Пошук за проєктом або клієнтом..." style="width: 100%; font-size: 0.82rem; padding: 6px 10px;" />
                        </div>

                        <div>
                            <select id="dashboard-portfolio-client-filter" class="portal-select" style="font-size: 0.82rem; padding: 6px 10px;">
                                <option value="all">Всі клієнти</option>
                                ${organizations.map(o => `<option value="${o.id}">${escapeHtml(o.name)}</option>`).join("")}
                            </select>
                        </div>

                        <div>
                            <select id="dashboard-portfolio-pm-filter" class="portal-select" style="font-size: 0.82rem; padding: 6px 10px;">
                                <option value="all">Всі PM</option>
                                ${staff.map(s => `<option value="${s.id}">${escapeHtml(s.full_name)}</option>`).join("")}
                            </select>
                        </div>

                        <div>
                            <select id="dashboard-portfolio-health-filter" class="portal-select" style="font-size: 0.82rem; padding: 6px 10px;">
                                <option value="all">Всі стани здоров'я</option>
                                <option value="on_track">В нормі (On Track)</option>
                                <option value="at_risk">У зоні ризику (At Risk)</option>
                                <option value="delayed">Затримка (Delayed)</option>
                                <option value="blocked">Заблоковано (Blocked)</option>
                            </select>
                        </div>

                        <div>
                            <select id="dashboard-portfolio-status-filter" class="portal-select" style="font-size: 0.82rem; padding: 6px 10px;">
                                <option value="active">Активні проєкти</option>
                                <option value="all">Всі статуси</option>
                                <option value="in_progress">В роботі</option>
                                <option value="discovery">Аудит / Дослідження</option>
                                <option value="onboarding">Онбординг</option>
                                <option value="client_review">Погодження</option>
                                <option value="completed">Завершені</option>
                            </select>
                        </div>
                    </div>

                    <!-- Portfolio Table Mount -->
                    <div id="dashboard-portfolio-table-mount" style="overflow-x: auto;">
                        ${renderPortfolioTableHtml(portfolioProjects)}
                    </div>
                </div>
            </div>

            <!-- Right: Attention Center (Exceptions Feed) -->
            <div class="portal-dashboard-attention-section">
                <div class="portal-card" style="padding: 20px; height: 100%; display: flex; flex-direction: column;">
                    <div class="portal-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="portal-card-icon" style="background: rgba(239, 68, 68, 0.12); color: var(--color-danger);">
                                <i data-lucide="shield-alert"></i>
                            </div>
                            <div>
                                <h2 class="portal-card-title" style="font-size: 1.05rem;">Потребує уваги</h2>
                                <p class="portal-card-subtitle" style="font-size: 0.76rem;">Операційні винятки та ризики</p>
                            </div>
                        </div>
                        <span class="portal-badge ${attentionItems.length > 0 ? 'portal-badge-danger' : 'portal-badge-success'}">
                            ${attentionItems.length}
                        </span>
                    </div>

                    <!-- Attention Pills Filter -->
                    <div class="portal-attention-pills" id="attention-severity-pills" style="display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap;">
                        <button class="portal-pill active" data-sev="all" style="font-size: 0.75rem; padding: 3px 8px;">Всі (${attentionItems.length})</button>
                        <button class="portal-pill" data-sev="critical" style="font-size: 0.75rem; padding: 3px 8px; color: var(--color-danger);">Критичні (${attentionItems.filter(i => i.severity === 'critical').length})</button>
                        <button class="portal-pill" data-sev="high" style="font-size: 0.75rem; padding: 3px 8px; color: var(--color-warning);">Високі (${attentionItems.filter(i => i.severity === 'high').length})</button>
                        <button class="portal-pill" data-sev="medium" style="font-size: 0.75rem; padding: 3px 8px;">Увага (${attentionItems.filter(i => i.severity === 'medium').length})</button>
                    </div>

                    <!-- Attention Items List -->
                    <div id="attention-items-list-mount" class="portal-attention-list" style="flex: 1; overflow-y: auto; max-height: 520px; display: flex; flex-direction: column; gap: 10px;">
                        ${renderAttentionItemsHtml(attentionItems)}
                    </div>
                </div>
            </div>
        </div>

        <!-- 3. Secondary Row: Upcoming Meetings & Client Actions Snapshot -->
        <div class="portal-dashboard-secondary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-top: 20px;">
            <!-- Upcoming Meetings Widget -->
            <div class="portal-card" style="padding: 20px;">
                <div class="portal-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="portal-card-icon" style="background: rgba(99, 102, 241, 0.12); color: var(--color-primary);">
                            <i data-lucide="calendar"></i>
                        </div>
                        <div>
                            <h3 class="portal-card-title" style="font-size: 1rem;">Найближчі зустрічі</h3>
                            <p class="portal-card-subtitle" style="font-size: 0.76rem;">Синхронізації та презентації у вашому scope</p>
                        </div>
                    </div>
                    <a href="#/portal/meetings" class="btn btn-outline btn-xs" style="font-size: 0.78rem;">Всі зустрічі</a>
                </div>

                <div class="portal-upcoming-meetings-list" style="display: flex; flex-direction: column; gap: 10px;">
                    ${upcomingMeetings.length === 0 ? `
                        <div class="portal-empty-state" style="padding: 24px; text-align: center;">
                            <p style="color: var(--text-muted); font-size: 0.85rem;">Немає запланованих зустрічей на найближчий час.</p>
                        </div>
                    ` : upcomingMeetings.map(m => {
                        const dateFormatted = DataClient.formatDateTimeSimple(m.start_at);
                        const hasMeetUrl = Boolean(m.meeting_url);
                        return `
                            <div class="portal-meeting-item-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; gap: 12px;">
                                <div style="flex: 1; min-width: 0;">
                                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
                                        <span class="portal-badge portal-badge-neutral" style="font-size: 0.7rem;">
                                            ${escapeHtml(m.organization?.name || "Клієнт")}
                                        </span>
                                        ${m.project?.name ? `<span class="portal-tag" style="font-size: 0.7rem;">${escapeHtml(m.project.name)}</span>` : ''}
                                    </div>
                                    <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary); margin-bottom: 2px;">
                                        ${escapeHtml(m.title)}
                                    </div>
                                    <div style="font-size: 0.78rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                                        <i data-lucide="clock" style="width: 12px; height: 12px;"></i>
                                        <span>${dateFormatted} (Europe/Kyiv)</span>
                                    </div>
                                </div>

                                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                                    ${hasMeetUrl ? `
                                        <a href="${escapeHtml(m.meeting_url)}" target="_blank" rel="noopener" class="btn btn-primary btn-xs" title="Приєднатися до дзвінка">
                                            <i data-lucide="video" style="width: 13px; height: 13px;"></i>
                                        </a>
                                    ` : ''}
                                    <a href="#/portal/meetings/${m.id}" class="btn btn-outline btn-xs" title="Деталі">
                                        <i data-lucide="arrow-right" style="width: 13px; height: 13px;"></i>
                                    </a>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>

            <!-- Client Actions Snapshot Widget -->
            <div class="portal-card" style="padding: 20px;">
                <div class="portal-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="portal-card-icon" style="background: rgba(16, 185, 129, 0.12); color: var(--color-success);">
                            <i data-lucide="check-square"></i>
                        </div>
                        <div>
                            <h3 class="portal-card-title" style="font-size: 1rem;">Очікуємо від клієнтів</h3>
                            <p class="portal-card-subtitle" style="font-size: 0.76rem;">Задачі, виконання яких очікується на боці клієнта</p>
                        </div>
                    </div>
                    <span class="portal-badge portal-badge-neutral" style="font-size: 0.78rem;">
                        Активних: ${clientActions.length}
                    </span>
                </div>

                <div class="portal-client-actions-list" style="display: flex; flex-direction: column; gap: 10px;">
                    ${clientActions.length === 0 ? `
                        <div class="portal-empty-state" style="padding: 24px; text-align: center;">
                            <p style="color: var(--text-muted); font-size: 0.85rem;">Немає активних задач, які очікують дій від клієнтів.</p>
                        </div>
                    ` : clientActions.slice(0, 5).map(t => {
                        const isOverdue = t.due_date && new Date(t.due_date) < new Date();
                        return `
                            <div class="portal-action-item-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; gap: 12px;">
                                <div style="flex: 1; min-width: 0;">
                                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                                        <span class="portal-badge ${isOverdue ? 'portal-badge-danger' : 'portal-badge-warning'}" style="font-size: 0.68rem;">
                                            ${isOverdue ? 'ПРОСТРОЧЕНО' : 'В ОЧІКУВАННІ'}
                                        </span>
                                        ${t.project?.name || t.project?.title ? `<span class="portal-tag" style="font-size: 0.7rem;">${escapeHtml(t.project.name || t.project.title)}</span>` : ''}
                                    </div>
                                    <div style="font-size: 0.88rem; font-weight: 600; color: var(--text-primary);">
                                        ${escapeHtml(t.title)}
                                    </div>
                                    ${t.due_date ? `
                                        <div style="font-size: 0.78rem; color: ${isOverdue ? 'var(--color-danger)' : 'var(--text-secondary)'}; margin-top: 2px;">
                                            Дедлайн: ${DataClient.formatDateSimple(t.due_date)}
                                        </div>
                                    ` : ''}
                                </div>

                                <a href="#/portal/projects/${t.project_id}" class="btn btn-outline btn-xs" title="Переглянути проєкт">
                                    <i data-lucide="external-link" style="width: 13px; height: 13px;"></i>
                                </a>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>

            <!-- Recent Personal Notifications Widget (Phase 5B) -->
            <div class="portal-card" style="padding: 20px;">
                <div class="portal-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="portal-card-icon" style="background: rgba(245, 158, 11, 0.12); color: var(--color-warning);">
                            <i data-lucide="bell"></i>
                        </div>
                        <div>
                            <h3 class="portal-card-title" style="font-size: 1rem;">Нові сповіщення</h3>
                            <p class="portal-card-subtitle" style="font-size: 0.76rem;">Персональні нагадування та алерти</p>
                        </div>
                    </div>
                    <a href="#/portal/notifications" class="btn btn-outline btn-xs" style="font-size: 0.78rem;">Переглянути всі</a>
                </div>

                <div class="portal-recent-notifications-list" style="display: flex; flex-direction: column; gap: 10px;">
                    ${recentNotifications.length === 0 ? `
                        <div class="portal-empty-state" style="padding: 24px; text-align: center;">
                            <p style="color: var(--text-muted); font-size: 0.85rem;">Немає нових сповіщень. Все під контролем.</p>
                        </div>
                    ` : recentNotifications.slice(0, 5).map(n => {
                        const isUnread = !n.is_read;
                        const iconName = n.event_type.includes("task") ? "check-square" :
                                         n.event_type.includes("meeting") ? "video" :
                                         n.event_type.includes("document") ? "file-text" :
                                         n.event_type.includes("project") ? "folder" :
                                         n.severity === "critical" ? "alert-triangle" : "bell";

                        const iconColor = n.severity === "critical" ? "var(--color-danger)" :
                                         n.severity === "warning" ? "var(--color-warning)" :
                                         n.severity === "success" ? "var(--color-success)" : "var(--color-primary)";

                        const relTime = DataClient.formatRelativeTime(n.created_at);

                        return `
                            <div class="portal-dashboard-notif-card ${isUnread ? 'portal-notif-unread' : ''}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; gap: 10px;">
                                <div style="display: flex; align-items: flex-start; gap: 10px; min-width: 0; flex: 1;">
                                    <div style="color: ${iconColor}; margin-top: 2px; flex-shrink: 0;">
                                        <i data-lucide="${iconName}" style="width: 15px; height: 15px;"></i>
                                    </div>
                                    <div style="min-width: 0; flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 6px;">
                                            <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                                ${escapeHtml(n.title)}
                                            </span>
                                            ${isUnread ? `<span class="portal-unread-dot-sm"></span>` : ''}
                                        </div>
                                        <div style="font-size: 0.76rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                            ${escapeHtml(n.message)}
                                        </div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">
                                            ${relTime} ${n.project?.name ? `• ${escapeHtml(n.project.name)}` : ''}
                                        </div>
                                    </div>
                                </div>

                                ${n.deep_link ? `
                                    <a href="${n.deep_link}" class="btn btn-outline btn-xs" style="padding: 4px 8px;" title="Перейти">
                                        <i data-lucide="arrow-right" style="width: 12px; height: 12px;"></i>
                                    </a>
                                ` : ''}
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>

            <!-- Financial State Widget (Phase 5C.1) -->
            <div class="portal-card" style="padding: 20px;">
                <div class="portal-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="portal-card-icon" style="background: rgba(16, 185, 129, 0.12); color: var(--color-success);">
                            <i data-lucide="dollar-sign"></i>
                        </div>
                        <div>
                            <h3 class="portal-card-title" style="font-size: 1rem;">Фінансовий стан</h3>
                            <p class="portal-card-subtitle" style="font-size: 0.76rem;">Отримані кошти, очікування та результат</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <a href="#/portal/invoices" class="btn btn-outline btn-xs" style="font-size: 0.78rem;">
                            Рахунки ${totalOverdueInvoices > 0 ? `<span class="portal-badge portal-badge-danger" style="font-size: 0.65rem; padding: 1px 5px; margin-left: 4px;">${totalOverdueInvoices}</span>` : ''}
                        </a>
                        <a href="#/portal/finance" class="btn btn-outline btn-xs" style="font-size: 0.78rem;">Фінанси</a>
                    </div>
                </div>

                <div class="portal-financial-summary-list" style="display: flex; flex-direction: column; gap: 10px;">
                    ${Object.keys(financeSummary?.currencyAggregates || {}).length === 0 ? `
                        <div class="portal-empty-state" style="padding: 24px; text-align: center;">
                            <p style="color: var(--text-muted); font-size: 0.85rem;">Фінансові дані відсутні.</p>
                        </div>
                    ` : Object.keys(financeSummary.currencyAggregates).map(curr => {
                        const agg = financeSummary.currencyAggregates[curr];
                        return `
                            <div style="padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary);">
                                        Валюта: ${curr} (${agg.projectCount} ${agg.projectCount === 1 ? 'проєкт' : 'проєкти'})
                                    </span>
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px;">
                                    <div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Отримано</div>
                                        <div style="font-weight: 700; font-size: 0.92rem; color: var(--color-success);">${DataClient.formatMoney(agg.collectedMinor, curr)}</div>
                                    </div>
                                    <div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Очікується</div>
                                        <div style="font-weight: 700; font-size: 0.92rem; color: var(--color-warning);">${DataClient.formatMoney(agg.outstandingMinor, curr)}</div>
                                    </div>
                                    <div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Прострочено</div>
                                        <div style="font-weight: 700; font-size: 0.92rem; color: ${agg.overdueMinor > 0 ? 'var(--color-danger)' : 'var(--text-muted)'};">
                                            ${agg.overdueMinor > 0 ? DataClient.formatMoney(agg.overdueMinor, curr) : '0 ' + curr}
                                        </div>
                                    </div>
                                    ${PortalAuth.isGlobalOwner() ? `
                                        <div>
                                            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Прогноз результат</div>
                                            <div style="font-weight: 700; font-size: 0.92rem; color: ${agg.hasCostRecords ? (agg.forecastResultMinor >= 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)'};">
                                                ${agg.hasCostRecords ? DataClient.formatMoney(agg.forecastResultMinor, curr) : '—'}
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>
        </div>

        <!-- 4. Tertiary Row: Team Workload Snapshot & Recent Activity -->
        <div class="portal-dashboard-tertiary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-top: 20px;">
            <!-- Team Workload Snapshot -->
            <div class="portal-card" style="padding: 20px;">
                <div class="portal-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="portal-card-icon" style="background: rgba(14, 165, 233, 0.12); color: #0ea5e9;">
                            <i data-lucide="users"></i>
                        </div>
                        <div>
                            <h3 class="portal-card-title" style="font-size: 1rem;">Навантаження команди</h3>
                            <p class="portal-card-subtitle" style="font-size: 0.76rem;">Операційний розподіл проєктів та задач</p>
                        </div>
                    </div>
                </div>

                <div class="portal-team-workload-list" style="display: flex; flex-direction: column; gap: 10px;">
                    ${teamWorkload.length === 0 ? `
                        <p style="color: var(--text-muted); font-size: 0.85rem;">Дані про команду відсутні.</p>
                    ` : teamWorkload.map(member => {
                        const initials = (member.fullName?.substring(0, 2) || "FW").toUpperCase();
                        return `
                            <div class="portal-workload-member-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; gap: 12px;">
                                <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
                                    <div class="portal-user-avatar" style="width: 32px; height: 32px; font-size: 0.75rem;">
                                        ${initials}
                                    </div>
                                    <div style="min-width: 0;">
                                        <div style="font-size: 0.88rem; font-weight: 600; color: var(--text-primary);">${escapeHtml(member.fullName)}</div>
                                        <div style="font-size: 0.74rem; color: var(--text-muted); text-transform: uppercase;">${escapeHtml(member.role || 'Команда')}</div>
                                    </div>
                                </div>

                                <div style="display: flex; align-items: center; gap: 16px; font-size: 0.8rem;">
                                    <div style="text-align: center;">
                                        <div style="font-weight: 700; color: var(--text-primary);">${member.activeProjectsCount}</div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted);">Проєкти</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-weight: 700; color: var(--text-primary);">${member.openTasksCount}</div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted);">Задачі</div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-weight: 700; color: ${member.overdueTasksCount > 0 ? 'var(--color-danger)' : 'var(--text-primary)'};">
                                            ${member.overdueTasksCount}
                                        </div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted);">Прострочені</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>

            <!-- Recent Activity Timeline -->
            <div class="portal-card" style="padding: 20px;">
                <div class="portal-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="portal-card-icon" style="background: rgba(168, 85, 247, 0.12); color: #c084fc;">
                            <i data-lucide="activity"></i>
                        </div>
                        <div>
                            <h3 class="portal-card-title" style="font-size: 1rem;">Останні події</h3>
                            <p class="portal-card-subtitle" style="font-size: 0.76rem;">Хронологія оновлень, погоджень та задач</p>
                        </div>
                    </div>
                </div>

                <div class="portal-recent-activity-list" style="display: flex; flex-direction: column; gap: 12px;">
                    ${recentActivities.length === 0 ? `
                        <p style="color: var(--text-muted); font-size: 0.85rem;">Подій поки що немає.</p>
                    ` : recentActivities.map(act => `
                        <div class="portal-activity-timeline-item" style="display: flex; gap: 12px; align-items: flex-start;">
                            <div class="portal-activity-icon" style="background: rgba(255, 255, 255, 0.05); color: ${act.iconColor || 'var(--color-primary)'}; padding: 6px; border-radius: 6px; margin-top: 2px;">
                                <i data-lucide="${act.icon}" style="width: 14px; height: 14px;"></i>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 0.85rem; color: var(--text-primary); font-weight: 500;">
                                    <a href="${act.targetUrl}" style="color: var(--text-primary); text-decoration: none;">
                                        ${escapeHtml(act.title)}
                                    </a>
                                </div>
                                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; display: flex; gap: 8px;">
                                    <span>${escapeHtml(act.actor)}</span>
                                    <span>•</span>
                                    <span>${act.dateStr}</span>
                                </div>
                                ${act.comment ? `
                                    <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px; font-style: italic; background: rgba(255, 255, 255, 0.02); padding: 4px 8px; border-radius: 4px;">
                                        «${escapeHtml(act.comment)}»
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join("")}
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    initPortfolioFilteringEvents(portfolioProjects);
    initAttentionFilteringEvents(attentionItems);
}

function renderPortfolioTableHtml(projects) {
    if (projects.length === 0) {
        return `
            <div class="portal-empty-state" style="padding: 30px; text-align: center;">
                <p style="color: var(--text-muted); font-size: 0.88rem;">Не знайдено проєктів за вибраними фільтрами.</p>
            </div>
        `;
    }

    return `
        <table class="portal-table portal-dashboard-portfolio-table" style="width: 100%; border-collapse: collapse; font-size: 0.84rem;">
            <thead>
                <tr style="border-bottom: 1px solid var(--border-color); text-align: left; color: var(--text-muted);">
                    <th style="padding: 10px 12px; font-weight: 600;">Клієнт та Проєкт</th>
                    <th style="padding: 10px 12px; font-weight: 600;">PM</th>
                    <th style="padding: 10px 12px; font-weight: 600;">Здоров'я</th>
                    <th style="padding: 10px 12px; font-weight: 600;">Прогрес</th>
                    <th style="padding: 10px 12px; font-weight: 600;">Поточний етап</th>
                    <th style="padding: 10px 12px; font-weight: 600;">Наступна віха</th>
                    <th style="padding: 10px 12px; font-weight: 600; text-align: center;">Задачі</th>
                    <th style="padding: 10px 12px; font-weight: 600; text-align: right;">Дії</th>
                </tr>
            </thead>
            <tbody>
                ${projects.map(proj => {
                    const healthBadge = getHealthBadge(proj.health);
                    const statusLabel = getProjectStatusLabel(proj.status);
                    const clientName = proj.organization?.name || "Клієнт";
                    const pmName = proj.responsible_pm?.full_name || "Не закріплено";
                    const stageName = proj.currentStage?.name || "Планування";
                    const nextMilestoneName = proj.nextMilestone?.name || "Не визначено";

                    return `
                        <tr class="portal-dashboard-table-row" onclick="window.location.hash='#/portal/projects/${proj.id}'" style="cursor: pointer; border-bottom: 1px solid rgba(255, 255, 255, 0.04); transition: background 0.15s;">
                            <td style="padding: 12px;">
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">
                                    ${escapeHtml(proj.name || proj.title)}
                                </div>
                                <div style="font-size: 0.76rem; color: var(--color-primary); margin-top: 2px;">
                                    ${escapeHtml(clientName)}
                                </div>
                            </td>
                            <td style="padding: 12px; color: var(--text-secondary);">
                                ${escapeHtml(pmName)}
                            </td>
                            <td style="padding: 12px;">
                                <span class="portal-health-badge ${healthBadge.cssClass}">
                                    ${healthBadge.label}
                                </span>
                            </td>
                            <td style="padding: 12px; min-width: 110px;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div class="portal-progress-bar" style="flex: 1; height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 3px; overflow: hidden;">
                                        <div style="width: ${proj.progress_percent || 0}%; height: 100%; background: var(--color-primary);"></div>
                                    </div>
                                    <span style="font-size: 0.76rem; color: var(--text-muted); font-weight: 600;">${proj.progress_percent || 0}%</span>
                                </div>
                            </td>
                            <td style="padding: 12px; color: var(--text-secondary); max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${escapeHtml(stageName)}
                            </td>
                            <td style="padding: 12px; color: var(--text-secondary); max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${escapeHtml(nextMilestoneName)}
                            </td>
                            <td style="padding: 12px; text-align: center;">
                                <div style="display: inline-flex; gap: 6px; align-items: center;">
                                    <span class="portal-badge portal-badge-neutral" title="Відкриті задачі" style="font-size: 0.72rem;">
                                        ${proj.openTasksCount || 0}
                                    </span>
                                    ${proj.overdueTasksCount > 0 ? `
                                        <span class="portal-badge portal-badge-danger" title="Прострочені задачі" style="font-size: 0.72rem;">
                                            ${proj.overdueTasksCount}
                                        </span>
                                    ` : ''}
                                </div>
                            </td>
                            <td style="padding: 12px; text-align: right;">
                                <a href="#/portal/projects/${proj.id}" class="btn btn-outline btn-xs" onclick="event.stopPropagation();">
                                    <span>Паспорт</span>
                                    <i data-lucide="arrow-right" style="width: 12px; height: 12px;"></i>
                                </a>
                            </td>
                        </tr>
                    `;
                }).join("")}
            </tbody>
        </table>
    `;
}

function renderAttentionItemsHtml(items) {
    if (items.length === 0) {
        return `
            <div class="portal-empty-state" style="padding: 30px; text-align: center;">
                <div class="portal-empty-icon" style="color: var(--color-success);"><i data-lucide="check-circle"></i></div>
                <div style="font-size: 0.88rem; font-weight: 600; color: var(--text-primary); margin-top: 8px;">Все під контролем</div>
                <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 4px;">Критичних ризиків чи прострочених задач не виявлено.</p>
            </div>
        `;
    }

    return items.map(item => {
        const severityClass = item.severity === 'critical' ? 'portal-attention-crit' : (item.severity === 'high' ? 'portal-attention-high' : 'portal-attention-med');
        const severityLabel = item.severity === 'critical' ? 'Критично' : (item.severity === 'high' ? 'Високий' : 'Увага');
        const badgeClass = item.severity === 'critical' ? 'portal-badge-danger' : (item.severity === 'high' ? 'portal-badge-warning' : 'portal-badge-neutral');

        return `
            <div class="portal-attention-card ${severityClass}" style="padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span class="portal-badge ${badgeClass}" style="font-size: 0.68rem; text-transform: uppercase;">
                            ${severityLabel}
                        </span>
                        <span class="portal-tag" style="font-size: 0.72rem;">
                            ${escapeHtml(item.typeLabel)}
                        </span>
                    </div>
                    ${item.dateLabel ? `
                        <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">
                            ${escapeHtml(item.dateLabel)}
                        </span>
                    ` : ''}
                </div>

                <div style="font-size: 0.86rem; color: var(--text-primary); font-weight: 600; line-height: 1.4;">
                    ${escapeHtml(item.description)}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; gap: 8px;">
                    <div style="font-size: 0.74rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                        <span>${escapeHtml(item.clientName)}</span>
                        <span>•</span>
                        <span>${escapeHtml(item.responsible)}</span>
                    </div>

                    <a href="${item.targetUrl}" class="btn btn-outline btn-xs" style="font-size: 0.74rem; padding: 3px 8px;">
                        ${escapeHtml(item.ctaLabel)}
                    </a>
                </div>
            </div>
        `;
    }).join("");
}

function initPortfolioFilteringEvents(allProjects) {
    const searchInput = document.getElementById("dashboard-portfolio-search");
    const clientSelect = document.getElementById("dashboard-portfolio-client-filter");
    const pmSelect = document.getElementById("dashboard-portfolio-pm-filter");
    const healthSelect = document.getElementById("dashboard-portfolio-health-filter");
    const statusSelect = document.getElementById("dashboard-portfolio-status-filter");
    const tableMount = document.getElementById("dashboard-portfolio-table-mount");

    function applyFilters() {
        const query = (searchInput?.value || "").trim().toLowerCase();
        const clientId = clientSelect?.value || "all";
        const pmId = pmSelect?.value || "all";
        const health = healthSelect?.value || "all";
        const status = statusSelect?.value || "active";

        let filtered = [...allProjects];

        // 1. Search Query
        if (query) {
            filtered = filtered.filter(p => 
                (p.name && p.name.toLowerCase().includes(query)) ||
                (p.title && p.title.toLowerCase().includes(query)) ||
                (p.organization?.name && p.organization.name.toLowerCase().includes(query))
            );
        }

        // 2. Client Filter
        if (clientId !== "all") {
            filtered = filtered.filter(p => p.organization_id === clientId);
        }

        // 3. PM Filter
        if (pmId !== "all") {
            filtered = filtered.filter(p => p.responsible_pm_id === pmId);
        }

        // 4. Health Filter
        if (health !== "all") {
            filtered = filtered.filter(p => p.health === health);
        }

        // 5. Status Filter
        if (status === "active") {
            filtered = filtered.filter(p => !["completed", "archived", "paused"].includes(p.status));
        } else if (status !== "all") {
            filtered = filtered.filter(p => p.status === status);
        }

        // 6. Sorting: Blocked -> Delayed -> At Risk -> Target Date -> Rest
        const healthRank = { blocked: 1, delayed: 2, at_risk: 3, on_track: 4 };
        filtered.sort((a, b) => {
            const rankA = healthRank[a.health] || 99;
            const rankB = healthRank[b.health] || 99;
            if (rankA !== rankB) return rankA - rankB;
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });

        if (tableMount) {
            tableMount.innerHTML = renderPortfolioTableHtml(filtered);
            if (window.lucide) window.lucide.createIcons();
        }
    }

    searchInput?.addEventListener("input", applyFilters);
    clientSelect?.addEventListener("change", applyFilters);
    pmSelect?.addEventListener("change", applyFilters);
    healthSelect?.addEventListener("change", applyFilters);
    statusSelect?.addEventListener("change", applyFilters);
}

function initAttentionFilteringEvents(allItems) {
    const pills = document.querySelectorAll("#attention-severity-pills button");
    const listMount = document.getElementById("attention-items-list-mount");

    pills.forEach(pill => {
        pill.addEventListener("click", () => {
            pills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            const sev = pill.getAttribute("data-sev");

            let filtered = allItems;
            if (sev !== "all") {
                filtered = allItems.filter(i => i.severity === sev);
            }

            if (listMount) {
                listMount.innerHTML = renderAttentionItemsHtml(filtered);
                if (window.lucide) window.lucide.createIcons();
            }
        });
    });
}

function getHealthBadge(health) {
    switch (health) {
        case "blocked":
            return { label: "Заблоковано", cssClass: "portal-health-blocked" };
        case "delayed":
            return { label: "Затримка", cssClass: "portal-health-delayed" };
        case "at_risk":
            return { label: "У зоні ризику", cssClass: "portal-health-risk" };
        case "on_track":
        default:
            return { label: "В нормі", cssClass: "portal-health-ok" };
    }
}

function getProjectStatusLabel(status) {
    const labels = {
        draft: "Чернетка",
        discovery: "Аудит / Дослідження",
        onboarding: "Онбординг",
        in_progress: "В роботі",
        client_review: "Погодження",
        waiting_client: "Очікує клієнта",
        blocked: "Заблоковано",
        completed: "Завершено",
        archived: "Архів"
    };
    return labels[status] || status;
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
