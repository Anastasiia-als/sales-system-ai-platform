/* js/portal/ui/portal-analytics-view.js - Centralized Executive Analytics Center (Phase 5D) */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatMoney(amountMinor, currency) {
    const val = (Number(amountMinor || 0) / 100).toLocaleString("uk-UA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return `${val} ${currency || ""}`.trim();
}

function formatRate(val, unit = "%") {
    if (val === null || val === undefined || isNaN(Number(val))) {
        return '<span style="color: var(--text-secondary); font-size: 0.95rem; font-weight: 500;">—</span>';
    }
    return `${val}${unit}`;
}

function formatMarginBadge(val) {
    if (val === null || val === undefined || isNaN(Number(val))) {
        return '<span class="portal-badge" style="opacity: 0.7;">Маржа: —</span>';
    }
    return `<span class="portal-badge portal-badge-primary">Маржа: ${val}%</span>`;
}

let analyticsState = {
    periodType: "30d",
    startDate: null,
    endDate: null,
    orgId: "all",
    projectId: "all",
    pmId: "all",
    health: "all",
    status: "all",
    search: "",
    savedViews: [],
    selectedViewId: "default"
};

export function renderAnalyticsView() {
    return `
        <div class="portal-content" id="analytics-center-root">
            <div class="portal-loading-container" style="padding: 60px; text-align: center;">
                <div class="portal-spinner"></div>
                <span style="color: var(--text-secondary); margin-top: 12px; display: block;">Завантаження Executive Analytics Center...</span>
            </div>
        </div>
    `;
}

export async function initAnalyticsEvents() {
    await loadAnalyticsData();
}

async function loadAnalyticsData() {
    const root = document.getElementById("analytics-center-root");
    if (!root) return;

    try {
        const isOwner = PortalAuth.isGlobalOwner();
        const isPM = PortalAuth.isOrgAdmin();

        if (!isOwner && !isPM) {
            root.innerHTML = `
                <div class="portal-empty-state" style="padding: 60px 20px;">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="shield-alert"></i></div>
                    <div class="portal-empty-title">Доступ обмежено</div>
                    <div class="portal-empty-desc">Розділ аналітики доступний виключно для Owner та Project Manager.</div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Fetch Saved Views and Analytics Data in parallel
        const [viewsRes, orgsRes, pmsRes, analyticsRes] = await Promise.all([
            DataClient.getAnalyticsSavedViews("analytics"),
            DataClient.getOrganizations(),
            DataClient.getTeamMembers ? DataClient.getTeamMembers() : Promise.resolve({ data: [] }),
            DataClient.getPortfolioAnalytics({
                periodType: analyticsState.periodType,
                startDate: analyticsState.startDate,
                endDate: analyticsState.endDate,
                orgId: analyticsState.orgId === "all" ? null : analyticsState.orgId,
                projectId: analyticsState.projectId === "all" ? null : analyticsState.projectId,
                pmId: analyticsState.pmId === "all" ? null : analyticsState.pmId
            })
        ]);

        analyticsState.savedViews = viewsRes.data || [];
        const orgs = orgsRes.data || [];
        const pms = (pmsRes.data || []).filter(u => ['owner', 'admin', 'pm'].includes(u.global_role || u.role));
        const payload = analyticsRes.data || {};

        renderAnalyticsContent(root, payload, orgs, pms);
        attachAnalyticsEventListeners(root, payload, orgs, pms);
    } catch (err) {
        console.error("[AnalyticsView] Load error:", err);
        root.innerHTML = `
            <div class="portal-empty-state" style="padding: 60px 20px;">
                <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                <div class="portal-empty-title">Помилка завантаження аналітики</div>
                <div class="portal-empty-desc">${escapeHtml(err.message || "Не вдалося завантажити аналітичні дані.")}</div>
                <button class="btn btn-outline" id="btn-retry-analytics" style="margin-top: 16px;">
                    <i data-lucide="refresh-cw"></i> Оновити
                </button>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        document.getElementById("btn-retry-analytics")?.addEventListener("click", loadAnalyticsData);
    }
}

function renderAnalyticsContent(root, payload, orgs, pms) {
    const kpis = payload.executive_kpis || {};
    const funnel = payload.delivery_funnel || {};
    const rates = payload.delivery_rates || {};
    const finances = payload.financial_analytics || {};
    const trends = payload.trends || {};
    const projects = payload.projects || [];
    const clients = payload.clients || [];
    const workload = payload.team_workload || [];

    // Filter projects locally by status/health/search if needed
    const filteredProjects = projects.filter(p => {
        if (analyticsState.health !== "all" && p.health !== analyticsState.health) return false;
        if (analyticsState.status !== "all" && p.status !== analyticsState.status) return false;
        if (analyticsState.search) {
            const q = analyticsState.search.toLowerCase();
            const titleMatch = (p.title || "").toLowerCase().includes(q);
            const orgMatch = (p.organization_name || "").toLowerCase().includes(q);
            const pmMatch = (p.pm_name || "").toLowerCase().includes(q);
            if (!titleMatch && !orgMatch && !pmMatch) return false;
        }
        return true;
    });

    const currencies = Object.keys(finances);

    root.innerHTML = `
        <!-- Header & Top Actions -->
        <div class="portal-header" style="margin-bottom: 24px;">
            <div>
                <h1 class="portal-title">Аналітика & Executive Insights</h1>
                <p class="portal-subtitle">Управлінська аналітика портфеля проектів, виконання, дебіторської заборгованості та ресурсів</p>
            </div>
            <div class="portal-header-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                <!-- Saved Views Selector -->
                <div class="portal-select-wrapper" style="min-width: 180px;">
                    <select id="analytics-saved-views-select" class="portal-select">
                        <option value="default">Збережені фільтри...</option>
                        ${analyticsState.savedViews.map(v => `
                            <option value="${v.id}" ${analyticsState.selectedViewId === v.id ? 'selected' : ''}>
                                ${escapeHtml(v.name)}
                            </option>
                        `).join("")}
                    </select>
                </div>
                <button class="btn btn-outline btn-sm" id="btn-save-analytics-view" title="Зберегти поточні фільтри як пресет">
                    <i data-lucide="bookmark-plus"></i> Зберегти вигляд
                </button>
                <button class="btn btn-outline btn-sm" id="btn-export-csv" title="Експортувати в CSV">
                    <i data-lucide="download"></i> CSV
                </button>
                <button class="btn btn-outline btn-sm" id="btn-export-xlsx" title="Експортувати в XLSX">
                    <i data-lucide="file-spreadsheet"></i> XLSX
                </button>
                <a href="#/portal/reports" class="btn btn-primary btn-sm">
                    <i data-lucide="file-text"></i> Звіти
                </a>
            </div>
        </div>

        <!-- Filter & Trends Bar -->
        <div class="portal-card" style="padding: 16px; margin-bottom: 24px;">
            <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;">
                <!-- Period Quick Buttons -->
                <div class="portal-btn-group" id="period-btn-group" style="display: flex; gap: 4px; flex-wrap: wrap;">
                    <button class="btn btn-sm ${analyticsState.periodType === '7d' ? 'btn-primary' : 'btn-outline'}" data-period="7d">7 днів</button>
                    <button class="btn btn-sm ${analyticsState.periodType === '30d' ? 'btn-primary' : 'btn-outline'}" data-period="30d">30 днів</button>
                    <button class="btn btn-sm ${analyticsState.periodType === '90d' ? 'btn-primary' : 'btn-outline'}" data-period="90d">90 днів</button>
                    <button class="btn btn-sm ${analyticsState.periodType === 'this_month' ? 'btn-primary' : 'btn-outline'}" data-period="this_month">Цей місяць</button>
                    <button class="btn btn-sm ${analyticsState.periodType === 'last_month' ? 'btn-primary' : 'btn-outline'}" data-period="last_month">Попер. місяць</button>
                    <button class="btn btn-sm ${analyticsState.periodType === 'this_quarter' ? 'btn-primary' : 'btn-outline'}" data-period="this_quarter">Квартал</button>
                </div>

                <!-- Filters -->
                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                    <select id="filter-org-select" class="portal-select" style="min-width: 150px;">
                        <option value="all">Всі клієнти</option>
                        ${orgs.map(o => `<option value="${o.id}" ${analyticsState.orgId === o.id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join("")}
                    </select>

                    <select id="filter-pm-select" class="portal-select" style="min-width: 140px;">
                        <option value="all">Всі PM</option>
                        ${pms.map(pm => `<option value="${pm.id}" ${analyticsState.pmId === pm.id ? 'selected' : ''}>${escapeHtml(pm.full_name || pm.email)}</option>`).join("")}
                    </select>

                    <select id="filter-health-select" class="portal-select" style="min-width: 130px;">
                        <option value="all">Всі Health</option>
                        <option value="good" ${analyticsState.health === 'good' ? 'selected' : ''}>В нормі</option>
                        <option value="warning" ${analyticsState.health === 'warning' ? 'selected' : ''}>Увага</option>
                        <option value="at_risk" ${analyticsState.health === 'at_risk' ? 'selected' : ''}>У ризику</option>
                        <option value="critical" ${analyticsState.health === 'critical' ? 'selected' : ''}>Критичний</option>
                    </select>

                    <button class="btn btn-outline btn-sm" id="btn-reset-filters" title="Скинути фільтри">
                        <i data-lucide="rotate-ccw"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- 1. Executive KPI Summary Cards -->
        <div class="portal-kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div class="portal-card portal-kpi-card">
                <div class="portal-kpi-header">
                    <span class="portal-kpi-title">Клієнти / Проєкти</span>
                    <i data-lucide="briefcase" style="color: #6366F1;"></i>
                </div>
                <div class="portal-kpi-value">${kpis.active_clients || 0} <span style="font-size: 1rem; color: var(--text-secondary);">/ ${kpis.total_clients || 0} клієнтів</span></div>
                <div class="portal-kpi-meta" style="color: var(--text-secondary);">${kpis.active_projects || 0} активних проєктів (${kpis.total_projects || 0} всього)</div>
            </div>

            <div class="portal-card portal-kpi-card ${kpis.at_risk_projects > 0 ? 'portal-kpi-alert' : ''}">
                <div class="portal-kpi-header">
                    <span class="portal-kpi-title">Проєкти в ризику</span>
                    <i data-lucide="alert-triangle" style="color: ${kpis.at_risk_projects > 0 ? '#EF4444' : '#10B981'};"></i>
                </div>
                <div class="portal-kpi-value" style="color: ${kpis.at_risk_projects > 0 ? '#EF4444' : 'var(--text-primary)'};">${kpis.at_risk_projects || 0}</div>
                <div class="portal-kpi-meta" style="color: var(--text-secondary);">Потребують термінової уваги PM/Owner</div>
            </div>

            <div class="portal-card portal-kpi-card">
                <div class="portal-kpi-header">
                    <span class="portal-kpi-title">Прострочені задачі & дії</span>
                    <i data-lucide="clock" style="color: #F59E0B;"></i>
                </div>
                <div class="portal-kpi-value">${kpis.overdue_tasks || 0} <span style="font-size: 1rem; color: var(--text-secondary);">задач</span></div>
                <div class="portal-kpi-meta" style="color: var(--text-secondary);">${kpis.overdue_client_actions || 0} прострочених дій клієнтів</div>
            </div>

            <div class="portal-card portal-kpi-card">
                <div class="portal-kpi-header">
                    <span class="portal-kpi-title">Контрольні точки & Документи</span>
                    <i data-lucide="check-circle" style="color: #10B981;"></i>
                </div>
                <div class="portal-kpi-value">${kpis.completed_milestones || 0} <span style="font-size: 1rem; color: var(--text-secondary);">/ ${kpis.total_milestones || 0}</span></div>
                <div class="portal-kpi-meta" style="color: var(--text-secondary);">${kpis.docs_awaiting_approval || 0} документів на погодженні</div>
            </div>
        </div>

        <!-- 2. Multi-Currency Financial Executive Overview -->
        <div class="portal-card" style="padding: 20px; margin-bottom: 24px;">
            <div class="portal-card-header" style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="font-size: 1.1rem; font-weight: 600; margin: 0;">Фінансова аналітика & Дебіторська заборгованість</h3>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Роздільні агрегації за кожною валютою (UAH / CZK / EUR) без змішування сум</p>
                </div>
                <a href="#/portal/finance" class="btn btn-outline btn-sm">Фінансовий центр →</a>
            </div>

            ${currencies.length === 0 ? `
                <div class="portal-empty-state" style="padding: 20px;">
                    <div class="portal-empty-desc">Немає зафіксованих фінансових умов або рахунків для обраного періоду.</div>
                </div>
            ` : `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
                    ${currencies.map(curr => {
                        const f = finances[curr] || {};
                        const ar = f.ar_aging || {};
                        return `
                            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 12px;">
                                    <span style="font-size: 1.1rem; font-weight: 700; color: #818CF8;">${escapeHtml(curr)}</span>
                                    ${formatMarginBadge(f.forecast_margin_pct)}
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.85rem; margin-bottom: 12px;">
                                    <div><span style="color: var(--text-secondary);">Контракт:</span> <strong>${formatMoney(f.contract_value_minor, curr)}</strong></div>
                                    <div><span style="color: var(--text-secondary);">Виставлено:</span> <strong>${formatMoney(f.invoiced_minor, curr)}</strong></div>
                                    <div><span style="color: var(--text-secondary);">Отримано:</span> <strong style="color: #10B981;">${formatMoney(f.received_minor, curr)}</strong></div>
                                    <div><span style="color: var(--text-secondary);">Очікується:</span> <strong>${formatMoney(f.outstanding_minor, curr)}</strong></div>
                                    <div style="grid-column: span 2;"><span style="color: var(--text-secondary);">Прострочено (Overdue):</span> <strong style="color: ${f.overdue_minor > 0 ? '#EF4444' : 'inherit'};">${formatMoney(f.overdue_minor, curr)}</strong></div>
                                </div>

                                <!-- AR Aging 6 Buckets -->
                                <div style="border-top: 1px dashed var(--border-color); padding-top: 10px;">
                                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600;">AR Aging Distribution</div>
                                    <div style="display: flex; gap: 4px; font-size: 0.75rem; flex-wrap: wrap;">
                                        <span class="portal-badge" style="background: rgba(16, 185, 129, 0.1); color: #34D399;" title="Not Due">0d: ${formatMoney(ar.not_due_minor, curr)}</span>
                                        <span class="portal-badge" style="background: rgba(245, 158, 11, 0.1); color: #FBBF24;" title="1-7d">1-7d: ${formatMoney(ar.days_1_7_minor, curr)}</span>
                                        <span class="portal-badge" style="background: rgba(239, 68, 68, 0.1); color: #F87171;" title="8-30d">8-30d: ${formatMoney(ar.days_8_30_minor, curr)}</span>
                                        <span class="portal-badge" style="background: rgba(239, 68, 68, 0.15); color: #EF4444;" title="31-60d">31-60d: ${formatMoney(ar.days_31_60_minor, curr)}</span>
                                        <span class="portal-badge" style="background: rgba(239, 68, 68, 0.2); color: #DC2626;" title="61-90d">61-90d: ${formatMoney(ar.days_61_90_minor, curr)}</span>
                                        <span class="portal-badge" style="background: rgba(239, 68, 68, 0.3); color: #B91C1C;" title="90+d">90+d: ${formatMoney(ar.days_90_plus_minor, curr)}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            `}
        </div>

        <!-- 3. Delivery Funnel & Performance Rates -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <!-- Funnel -->
            <div class="portal-card" style="padding: 20px;">
                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 12px;">Delivery Funnel (Життєвий цикл проєктів)</h3>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                            <span>Discovery & Onboarding (${funnel.discovery || 0})</span>
                            <span>${funnel.discovery_pct || 0}%</span>
                        </div>
                        <div class="portal-progress-bar"><div class="portal-progress-fill" style="width: ${funnel.discovery_pct || 0}%; background: #6366F1;"></div></div>
                    </div>
                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                            <span>In Progress / Активні (${funnel.in_progress || 0})</span>
                            <span>${funnel.in_progress_pct || 0}%</span>
                        </div>
                        <div class="portal-progress-bar"><div class="portal-progress-fill" style="width: ${funnel.in_progress_pct || 0}%; background: #10B981;"></div></div>
                    </div>
                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                            <span>Очікує клієнта (${funnel.waiting_client || 0})</span>
                            <span>${funnel.waiting_client_pct || 0}%</span>
                        </div>
                        <div class="portal-progress-bar"><div class="portal-progress-fill" style="width: ${funnel.waiting_client_pct || 0}%; background: #F59E0B;"></div></div>
                    </div>
                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                            <span>У ризику / Блоковані (${(funnel.at_risk || 0) + (funnel.blocked || 0)})</span>
                            <span>${(funnel.at_risk_pct || 0)}%</span>
                        </div>
                        <div class="portal-progress-bar"><div class="portal-progress-fill" style="width: ${funnel.at_risk_pct || 0}%; background: #EF4444;"></div></div>
                    </div>
                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 4px;">
                            <span>Успішно завершено (${funnel.completed || 0})</span>
                            <span>${funnel.completed_pct || 0}%</span>
                        </div>
                        <div class="portal-progress-bar"><div class="portal-progress-fill" style="width: ${funnel.completed_pct || 0}%; background: #059669;"></div></div>
                    </div>
                </div>
            </div>

            <!-- Performance Rates -->
            <div class="portal-card" style="padding: 20px;">
                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 12px;">Показники виконання (Delivery Rates)</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="portal-kpi-subcard" style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--border-color);">
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Milestone Completion</div>
                        <div style="font-size: 1.3rem; font-weight: 700; color: #10B981;">${formatRate(rates.milestone_completion_rate)}</div>
                    </div>
                    <div class="portal-kpi-subcard" style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--border-color);">
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Tasks Completion</div>
                        <div style="font-size: 1.3rem; font-weight: 700; color: #6366F1;">${formatRate(rates.tasks_completion_rate)}</div>
                    </div>
                    <div class="portal-kpi-subcard" style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--border-color);">
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Overdue Task Rate</div>
                        <div style="font-size: 1.3rem; font-weight: 700; color: ${rates.overdue_task_rate > 15 ? '#EF4444' : '#F59E0B'};">${formatRate(rates.overdue_task_rate)}</div>
                    </div>
                    <div class="portal-kpi-subcard" style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--border-color);">
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">On-Time Delivery</div>
                        <div style="font-size: 1.3rem; font-weight: 700; color: #10B981;">${formatRate(rates.on_time_delivery_rate)}</div>
                    </div>
                    <div class="portal-kpi-subcard" style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--border-color);">
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Project Completion Rate</div>
                        <div style="font-size: 1.3rem; font-weight: 700; color: #38BDF8;">${formatRate(rates.project_completion_rate)}</div>
                    </div>
                    <div class="portal-kpi-subcard" style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--border-color);">
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Avg Completion Delay</div>
                        <div style="font-size: 1.3rem; font-weight: 700; color: ${rates.avg_completion_delay_days > 0 ? '#EF4444' : '#10B981'};">${formatRate(rates.avg_completion_delay_days, ' дн.')}</div>
                    </div>
                </div>
                <div style="margin-top: 12px; font-size: 0.8rem; color: var(--text-secondary);">
                    Client Action Completion: <strong>${formatRate(rates.client_action_completion_rate)}</strong>
                </div>
            </div>
        </div>

        <!-- 4. Projects Performance Analytics Table -->
        <div class="portal-card" style="padding: 20px; margin-bottom: 24px;">
            <div class="portal-card-header" style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                    <h3 style="font-size: 1.1rem; font-weight: 600; margin: 0;">Аналітика виконання проєктів (${filteredProjects.length})</h3>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Детальний статус виконання, дедлайни, задачі та фінансовий стан</p>
                </div>
                <div style="width: 250px;">
                    <input type="text" id="analytics-search-input" class="portal-input" placeholder="Пошук проєкту або клієнта..." value="${escapeHtml(analyticsState.search)}">
                </div>
            </div>

            <div class="portal-table-container" style="overflow-x: auto;">
                <table class="portal-table" style="width: 100%; border-collapse: collapse; min-width: 900px;">
                    <thead>
                        <tr>
                            <th>Проєкт / Клієнт</th>
                            <th>PM</th>
                            <th>Health</th>
                            <th>Прогрес</th>
                            <th>Задачі (Open/Overdue)</th>
                            <th>Client Actions</th>
                            <th>Дедлайн</th>
                            <th>Фінанси</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredProjects.length === 0 ? `
                            <tr>
                                <td colspan="8" style="text-align: center; padding: 30px; color: var(--text-secondary);">
                                    Не знайдено проєктів за обраними критеріями.
                                </td>
                            </tr>
                        ` : filteredProjects.map(p => `
                            <tr>
                                <td>
                                    <div style="font-weight: 600;">
                                        <a href="#/portal/projects/${p.id}" style="color: inherit; text-decoration: none; border-bottom: 1px dashed var(--text-secondary);">
                                            ${escapeHtml(p.title)}
                                        </a>
                                    </div>
                                    <div style="font-size: 0.8rem; color: var(--text-secondary);">
                                        <a href="#/portal/clients/${p.organization_id}" style="color: inherit;">
                                            ${escapeHtml(p.organization_name)}
                                        </a>
                                    </div>
                                </td>
                                <td><span style="font-size: 0.85rem;">${escapeHtml(p.pm_name || 'Не призначено')}</span></td>
                                <td>
                                    <span class="portal-badge ${p.health === 'good' ? 'portal-badge-success' : p.health === 'warning' ? 'portal-badge-warning' : 'portal-badge-danger'}">
                                        ${p.health === 'good' ? 'В нормі' : p.health === 'warning' ? 'Увага' : 'Ризик'}
                                    </span>
                                </td>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <div class="portal-progress-bar" style="width: 60px; height: 6px;">
                                            <div class="portal-progress-fill" style="width: ${p.progress_percent || 0}%;"></div>
                                        </div>
                                        <span style="font-size: 0.8rem;">${p.progress_percent || 0}%</span>
                                    </div>
                                    <div style="font-size: 0.75rem; color: var(--text-secondary);">${p.completed_milestones || 0}/${p.total_milestones || 0} точок</div>
                                </td>
                                <td>
                                    <span style="font-size: 0.85rem;">${p.open_tasks || 0}</span>
                                    ${p.overdue_tasks > 0 ? `<span class="portal-badge portal-badge-danger" style="margin-left: 4px;">${p.overdue_tasks} overdue</span>` : ''}
                                </td>
                                <td>
                                    <span style="font-size: 0.85rem;">${p.client_actions_total || 0}</span>
                                    ${p.client_actions_overdue > 0 ? `<span class="portal-badge portal-badge-warning" style="margin-left: 4px;">${p.client_actions_overdue}</span>` : ''}
                                </td>
                                <td>
                                    <div style="font-size: 0.85rem;">${p.target_date ? new Date(p.target_date).toLocaleDateString('uk-UA') : '—'}</div>
                                    ${p.days_remaining !== null ? `
                                        <div style="font-size: 0.75rem; color: ${p.days_remaining < 0 ? '#EF4444' : 'var(--text-secondary)'};">
                                            ${p.days_remaining < 0 ? `Прострочено на ${Math.abs(p.days_remaining)} дн.` : `Залишилось ${p.days_remaining} дн.`}
                                        </div>
                                    ` : ''}
                                </td>
                                <td>
                                    <span class="portal-badge ${p.financial_status === 'paid' ? 'portal-badge-success' : p.financial_status === 'overdue' ? 'portal-badge-danger' : p.financial_status === 'pending_payment' ? 'portal-badge-warning' : ''}">
                                        ${p.financial_status === 'paid' ? 'Оплачено' : p.financial_status === 'overdue' ? 'Прострочено' : p.financial_status === 'pending_payment' ? 'Очікує' : '—'}
                                    </span>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- 5. Client Analytics & Operational Workload Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <!-- Client Analytics -->
            <div class="portal-card" style="padding: 20px;">
                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 12px;">Зріз по клієнтах (${clients.length})</h3>
                <div class="portal-table-container" style="overflow-x: auto;">
                    <table class="portal-table" style="width: 100%; font-size: 0.85rem;">
                        <thead>
                            <tr>
                                <th>Клієнт</th>
                                <th>Проєкти (Акт/Заверш)</th>
                                <th>Overdue Задачі</th>
                                <th>Client Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${clients.map(c => `
                                <tr>
                                    <td>
                                        <a href="#/portal/clients/${c.id}" style="font-weight: 600; color: inherit;">
                                            ${escapeHtml(c.name)}
                                        </a>
                                    </td>
                                    <td>${c.active_projects_count || 0} / ${c.completed_projects_count || 0}</td>
                                    <td>${c.overdue_tasks_count > 0 ? `<span style="color: #EF4444; font-weight: 600;">${c.overdue_tasks_count}</span>` : '0'}</td>
                                    <td>${c.client_actions_pending || 0}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Team Workload -->
            <div class="portal-card" style="padding: 20px;">
                <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 12px;">Операційне навантаження команди (Workload)</h3>
                <div class="portal-table-container" style="overflow-x: auto;">
                    <table class="portal-table" style="width: 100%; font-size: 0.85rem;">
                        <thead>
                            <tr>
                                <th>Спеціаліст / PM</th>
                                <th>Проєкти</th>
                                <th>Відкриті задачі</th>
                                <th>Overdue</th>
                                <th>Дедлайни 7д</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${workload.map(w => `
                                <tr>
                                    <td>
                                        <div style="font-weight: 600;">${escapeHtml(w.full_name || w.email)}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">${escapeHtml(w.global_role)}</div>
                                    </td>
                                    <td>${w.active_projects || 0}</td>
                                    <td>${w.open_tasks || 0}</td>
                                    <td>${w.overdue_tasks > 0 ? `<span style="color: #EF4444; font-weight: 600;">${w.overdue_tasks}</span>` : '0'}</td>
                                    <td>${w.upcoming_deadlines_7d || 0}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 6. Trends & Period Comparisons -->
        <div class="portal-card" style="padding: 20px; margin-bottom: 24px;">
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 12px;">Тенденції за обраний період (${trends.period_type || '30d'})</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--border-color);">
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Нові клієнти</div>
                    <div style="font-size: 1.2rem; font-weight: 700;">${trends.new_clients || 0} <span style="font-size: 0.75rem; color: var(--text-secondary);">(попер: ${trends.prev_new_clients || 0})</span></div>
                </div>
                <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--border-color);">
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Нові проєкти</div>
                    <div style="font-size: 1.2rem; font-weight: 700;">${trends.new_projects || 0} <span style="font-size: 0.75rem; color: var(--text-secondary);">(попер: ${trends.prev_new_projects || 0})</span></div>
                </div>
                <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--border-color);">
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Завершені задачі</div>
                    <div style="font-size: 1.2rem; font-weight: 700; color: #10B981;">${trends.completed_tasks || 0}</div>
                </div>
                <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--border-color);">
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Виставлені рахунки</div>
                    <div style="font-size: 1.2rem; font-weight: 700;">${trends.invoices_issued || 0}</div>
                </div>
                <div style="padding: 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid var(--border-color);">
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">Отримані платежі</div>
                    <div style="font-size: 1.2rem; font-weight: 700; color: #10B981;">${trends.payments_count || 0}</div>
                </div>
            </div>
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();
}

function attachAnalyticsEventListeners(root, payload, orgs, pms) {
    // Period buttons
    root.querySelectorAll("#period-btn-group button").forEach(btn => {
        btn.addEventListener("click", () => {
            analyticsState.periodType = btn.getAttribute("data-period");
            loadAnalyticsData();
        });
    });

    // Filters
    document.getElementById("filter-org-select")?.addEventListener("change", (e) => {
        analyticsState.orgId = e.target.value;
        loadAnalyticsData();
    });

    document.getElementById("filter-pm-select")?.addEventListener("change", (e) => {
        analyticsState.pmId = e.target.value;
        loadAnalyticsData();
    });

    document.getElementById("filter-health-select")?.addEventListener("change", (e) => {
        analyticsState.health = e.target.value;
        renderAnalyticsContent(root, payload, orgs, pms);
        attachAnalyticsEventListeners(root, payload, orgs, pms);
    });

    document.getElementById("analytics-search-input")?.addEventListener("input", (e) => {
        analyticsState.search = e.target.value;
        renderAnalyticsContent(root, payload, orgs, pms);
        attachAnalyticsEventListeners(root, payload, orgs, pms);
    });

    document.getElementById("btn-reset-filters")?.addEventListener("click", () => {
        analyticsState = {
            ...analyticsState,
            periodType: "30d",
            orgId: "all",
            projectId: "all",
            pmId: "all",
            health: "all",
            status: "all",
            search: ""
        };
        loadAnalyticsData();
    });

    // Saved Views
    document.getElementById("analytics-saved-views-select")?.addEventListener("change", (e) => {
        const viewId = e.target.value;
        analyticsState.selectedViewId = viewId;
        if (viewId === "default") return;

        const view = analyticsState.savedViews.find(v => v.id === viewId);
        if (view && view.filters) {
            analyticsState = {
                ...analyticsState,
                ...view.filters
            };
            loadAnalyticsData();
        }
    });

    document.getElementById("btn-save-analytics-view")?.addEventListener("click", async () => {
        const viewName = prompt("Введіть назву пресету фільтрів (наприклад: 'Проєкти в ризику'):");
        if (!viewName) return;

        const currentFilters = {
            periodType: analyticsState.periodType,
            orgId: analyticsState.orgId,
            pmId: analyticsState.pmId,
            health: analyticsState.health,
            status: analyticsState.status
        };

        const { data, error } = await DataClient.createAnalyticsSavedView(viewName, "analytics", currentFilters);
        if (error) {
            alert("Помилка збереження: " + error.message);
        } else {
            alert("Пресет збережено!");
            loadAnalyticsData();
        }
    });

    // CSV & XLSX Exports
    document.getElementById("btn-export-csv")?.addEventListener("click", () => {
        exportAnalyticsCSV(payload);
    });

    document.getElementById("btn-export-xlsx")?.addEventListener("click", () => {
        exportAnalyticsXLSX(payload);
    });
}

function exportAnalyticsCSV(payload) {
    const projects = payload.projects || [];
    let csv = "ID,Title,Client,PM,Health,Status,Progress %,Open Tasks,Overdue Tasks,Target Date,Financial Status\n";

    projects.forEach(p => {
        csv += `"${p.id}","${(p.title || '').replace(/"/g, '""')}","${(p.organization_name || '').replace(/"/g, '""')}","${(p.pm_name || '').replace(/"/g, '""')}","${p.health}","${p.status}","${p.progress_percent || 0}%","${p.open_tasks || 0}","${p.overdue_tasks || 0}","${p.target_date || ''}","${p.financial_status || ''}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `firstwin_portfolio_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportAnalyticsXLSX(payload) {
    if (typeof XLSX === "undefined") {
        console.error("XLSX library not loaded. Falling back to CSV.");
        exportAnalyticsCSV(payload);
        return;
    }

    const wb = XLSX.utils.book_new();
    const parseDate = (d) => {
        if (!d) return null;
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? null : dt;
    };

    // 1. Sheet: Summary
    const kpis = payload.executive_kpis || {};
    const rates = payload.delivery_rates || {};
    const summaryData = [
        ["FIRSTWIN Executive Analytics Summary", ""],
        ["Generated At", new Date()],
        ["Period", payload.period?.type || "30d"],
        ["Period Start", parseDate(payload.period?.start_date)],
        ["Period End", parseDate(payload.period?.end_date)],
        ["", ""],
        ["Metric", "Value"],
        ["Total Clients", kpis.total_clients || 0],
        ["Active Clients", kpis.active_clients || 0],
        ["Total Projects", kpis.total_projects || 0],
        ["Active Projects", kpis.active_projects || 0],
        ["At Risk Projects", kpis.at_risk_projects || 0],
        ["Completed Projects", kpis.completed_projects || 0],
        ["Total Tasks", kpis.total_tasks || 0],
        ["Open Tasks", kpis.open_tasks || 0],
        ["Overdue Tasks", kpis.overdue_tasks || 0],
        ["Overdue Client Actions", kpis.overdue_client_actions || 0],
        ["Completed Milestones", kpis.completed_milestones || 0],
        ["Total Milestones", kpis.total_milestones || 0],
        ["Docs Awaiting Approval", kpis.docs_awaiting_approval || 0],
        ["", ""],
        ["Delivery Rate Metric", "Rate % / Days"],
        ["Milestone Completion Rate", rates.milestone_completion_rate !== null ? rates.milestone_completion_rate : null],
        ["Tasks Completion Rate", rates.tasks_completion_rate !== null ? rates.tasks_completion_rate : null],
        ["Overdue Task Rate", rates.overdue_task_rate !== null ? rates.overdue_task_rate : null],
        ["Client Action Completion Rate", rates.client_action_completion_rate !== null ? rates.client_action_completion_rate : null],
        ["On-Time Delivery Rate", rates.on_time_delivery_rate !== null ? rates.on_time_delivery_rate : null],
        ["Project Completion Rate", rates.project_completion_rate !== null ? rates.project_completion_rate : null],
        ["Avg Completion Delay (days)", rates.avg_completion_delay_days !== null ? rates.avg_completion_delay_days : null]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData, { cellDates: true, dateNF: "yyyy-mm-dd" });
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // 2. Sheet: Projects
    const projects = payload.projects || [];
    const projectsData = [
        ["Project ID", "Title", "Client", "PM", "Status", "Health", "Progress %", "Open Tasks", "Overdue Tasks", "Client Actions Total", "Client Actions Overdue", "Start Date", "Target Date", "Financial Status", "Contract Currency", "Contract Value"]
    ];
    projects.forEach(p => {
        projectsData.push([
            p.id,
            p.title || "",
            p.organization_name || "",
            p.pm_name || "",
            p.status || "",
            p.health || "",
            p.progress_percent !== null ? Number(p.progress_percent) : null,
            p.open_tasks !== null ? Number(p.open_tasks) : 0,
            p.overdue_tasks !== null ? Number(p.overdue_tasks) : 0,
            p.client_actions_total !== null ? Number(p.client_actions_total) : 0,
            p.client_actions_overdue !== null ? Number(p.client_actions_overdue) : 0,
            parseDate(p.start_date),
            parseDate(p.target_date),
            p.financial_status || "",
            p.contract_currency || "",
            p.contract_value_minor !== null ? Number(p.contract_value_minor) / 100 : null
        ]);
    });
    const wsProjects = XLSX.utils.aoa_to_sheet(projectsData, { cellDates: true, dateNF: "yyyy-mm-dd" });
    XLSX.utils.book_append_sheet(wb, wsProjects, "Projects");

    // 3. Sheet: Tasks & Workload
    const workload = payload.team_workload || [];
    const tasksData = [
        ["User ID", "Name", "Role", "Active Projects", "Open Tasks", "Overdue Tasks", "High Priority Tasks", "Upcoming Deadlines 7d"]
    ];
    workload.forEach(w => {
        tasksData.push([
            w.user_id,
            w.full_name || w.email || "",
            w.global_role || "",
            w.active_projects !== null ? Number(w.active_projects) : 0,
            w.open_tasks !== null ? Number(w.open_tasks) : 0,
            w.overdue_tasks !== null ? Number(w.overdue_tasks) : 0,
            w.high_priority_tasks !== null ? Number(w.high_priority_tasks) : 0,
            w.upcoming_deadlines_7d !== null ? Number(w.upcoming_deadlines_7d) : 0
        ]);
    });
    const wsTasks = XLSX.utils.aoa_to_sheet(tasksData, { cellDates: true, dateNF: "yyyy-mm-dd" });
    XLSX.utils.book_append_sheet(wb, wsTasks, "Tasks");

    // 4. Sheet: Client Actions & Clients
    const clients = payload.clients || [];
    const clientsData = [
        ["Client ID", "Client Name", "Status", "Total Projects", "Active Projects", "Completed Projects", "Overdue Tasks", "Pending Client Actions", "Docs Awaiting Approval", "Next Meeting Date"]
    ];
    clients.forEach(c => {
        clientsData.push([
            c.id,
            c.name || "",
            c.status || "",
            c.total_projects_count !== null ? Number(c.total_projects_count) : 0,
            c.active_projects_count !== null ? Number(c.active_projects_count) : 0,
            c.completed_projects_count !== null ? Number(c.completed_projects_count) : 0,
            c.overdue_tasks_count !== null ? Number(c.overdue_tasks_count) : 0,
            c.client_actions_pending !== null ? Number(c.client_actions_pending) : 0,
            c.docs_awaiting_approval !== null ? Number(c.docs_awaiting_approval) : 0,
            parseDate(c.next_meeting_date)
        ]);
    });
    const wsClients = XLSX.utils.aoa_to_sheet(clientsData, { cellDates: true, dateNF: "yyyy-mm-dd" });
    XLSX.utils.book_append_sheet(wb, wsClients, "Client Actions");

    // 5. Sheet: Finance (Strict Multi-Currency Isolation)
    const finances = payload.financial_analytics || {};
    const financeData = [
        ["Currency", "Contract Value", "Invoiced", "Received", "Outstanding", "Overdue", "Planned Costs", "Actual Costs", "Forecast Result", "Forecast Margin %", "Not Due (AR)", "1-7d (AR)", "8-30d (AR)", "31-60d (AR)", "61-90d (AR)", "90+d (AR)"]
    ];
    Object.keys(finances).forEach(curr => {
        const f = finances[curr] || {};
        const ar = f.ar_aging || {};
        financeData.push([
            curr,
            f.contract_value_minor !== null ? Number(f.contract_value_minor) / 100 : 0,
            f.invoiced_minor !== null ? Number(f.invoiced_minor) / 100 : 0,
            f.received_minor !== null ? Number(f.received_minor) / 100 : 0,
            f.outstanding_minor !== null ? Number(f.outstanding_minor) / 100 : 0,
            f.overdue_minor !== null ? Number(f.overdue_minor) / 100 : 0,
            f.planned_costs_minor !== null ? Number(f.planned_costs_minor) / 100 : 0,
            f.actual_costs_minor !== null ? Number(f.actual_costs_minor) / 100 : 0,
            f.forecast_result_minor !== null ? Number(f.forecast_result_minor) / 100 : 0,
            f.forecast_margin_pct !== null ? Number(f.forecast_margin_pct) : null,
            ar.not_due_minor !== null ? Number(ar.not_due_minor) / 100 : 0,
            ar.days_1_7_minor !== null ? Number(ar.days_1_7_minor) / 100 : 0,
            ar.days_8_30_minor !== null ? Number(ar.days_8_30_minor) / 100 : 0,
            ar.days_31_60_minor !== null ? Number(ar.days_31_60_minor) / 100 : 0,
            ar.days_61_90_minor !== null ? Number(ar.days_61_90_minor) / 100 : 0,
            ar.days_90_plus_minor !== null ? Number(ar.days_90_plus_minor) / 100 : 0
        ]);
    });
    const wsFinance = XLSX.utils.aoa_to_sheet(financeData, { cellDates: true, dateNF: "yyyy-mm-dd" });
    XLSX.utils.book_append_sheet(wb, wsFinance, "Finance");

    // Write binary OOXML XLSX
    XLSX.writeFile(wb, `firstwin_portfolio_analytics_${new Date().toISOString().slice(0, 10)}.xlsx`, { bookType: "xlsx" });
}
