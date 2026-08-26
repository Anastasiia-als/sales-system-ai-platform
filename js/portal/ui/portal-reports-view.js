/* js/portal/ui/portal-reports-view.js - Management Reports Center (Phase 5D.1) */

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

let reportsState = {
    reportType: "portfolio_summary",
    periodType: "30d",
    orgId: "all",
    projectId: "all",
    pmId: "all",
    currency: "all",
    status: "all"
};

export function renderReportsView() {
    return `
        <div class="portal-content" id="reports-center-root">
            <div class="portal-loading-container" style="padding: 60px; text-align: center;">
                <div class="portal-spinner"></div>
                <span style="color: var(--text-secondary); margin-top: 12px; display: block;">Завантаження генератора звітів...</span>
            </div>
        </div>
    `;
}

export async function initReportsEvents() {
    await loadReportsData();
}

async function loadReportsData() {
    const root = document.getElementById("reports-center-root");
    if (!root) return;

    try {
        const isOwner = PortalAuth.isGlobalOwner();
        const isPM = PortalAuth.isOrgAdmin();

        if (!isOwner && !isPM) {
            root.innerHTML = `
                <div class="portal-empty-state" style="padding: 60px 20px;">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="shield-alert"></i></div>
                    <div class="portal-empty-title">Доступ обмежено</div>
                    <div class="portal-empty-desc">Розділ звітів доступний виключно для Owner та Project Manager.</div>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const [orgsRes, pmsRes, reportRes] = await Promise.all([
            DataClient.getOrganizations(),
            DataClient.getTeamMembers ? DataClient.getTeamMembers() : Promise.resolve({ data: [] }),
            DataClient.getReportsData(reportsState.reportType, {
                periodType: reportsState.periodType,
                orgId: reportsState.orgId === "all" ? null : reportsState.orgId,
                projectId: reportsState.projectId === "all" ? null : reportsState.projectId,
                pmId: reportsState.pmId === "all" ? null : reportsState.pmId,
                currency: reportsState.currency === "all" ? null : reportsState.currency,
                status: reportsState.status === "all" ? null : reportsState.status
            })
        ]);

        const orgs = orgsRes.data || [];
        const pms = (pmsRes.data || []).filter(u => ['owner', 'admin', 'pm'].includes(u.global_role || u.role));
        const reportData = reportRes.data?.report || {};

        renderReportsContent(root, reportData, orgs, pms);
        attachReportsEventListeners(root, reportData, orgs, pms);
    } catch (err) {
        console.error("[ReportsView] Load error:", err);
        root.innerHTML = `
            <div class="portal-empty-state" style="padding: 60px 20px;">
                <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                <div class="portal-empty-title">Помилка завантаження звітів</div>
                <div class="portal-empty-desc">${escapeHtml(err.message || "Не вдалося завантажити дані звіту.")}</div>
                <button class="btn btn-outline" id="btn-retry-reports" style="margin-top: 16px;">
                    <i data-lucide="refresh-cw"></i> Оновити
                </button>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        document.getElementById("btn-retry-reports")?.addEventListener("click", loadReportsData);
    }
}

function renderReportsContent(root, reportData, orgs, pms) {
    const reportType = reportsState.reportType;

    root.innerHTML = `
        <div class="portal-header" style="margin-bottom: 24px;">
            <div>
                <h1 class="portal-title">Центр звітів (Management Reports)</h1>
                <p class="portal-subtitle">Формування та експорт офіційних управлінських та клієнтських звітів</p>
            </div>
            <div class="portal-header-actions" style="display: flex; gap: 10px;">
                <button class="btn btn-outline btn-sm" id="btn-print-report" title="Роздрукувати або зберегти як PDF">
                    <i data-lucide="printer"></i> Друк / PDF
                </button>
                <button class="btn btn-outline btn-sm" id="btn-export-report-csv" title="Експорт даних звіту в CSV">
                    <i data-lucide="download"></i> CSV
                </button>
                <button class="btn btn-outline btn-sm" id="btn-export-report-xlsx" title="Експорт звіту в Microsoft Excel (.xlsx)">
                    <i data-lucide="file-spreadsheet"></i> XLSX
                </button>
                <a href="#/portal/analytics" class="btn btn-outline btn-sm">
                    <i data-lucide="bar-chart-3"></i> Аналітика
                </a>
            </div>
        </div>

        <!-- Report Selector & Filters Bar -->
        <div class="portal-card" style="padding: 16px; margin-bottom: 24px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: center;">
                <div>
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Тип звіту:</label>
                    <select id="report-type-select" class="portal-select" style="width: 100%;">
                        <option value="portfolio_summary" ${reportType === 'portfolio_summary' ? 'selected' : ''}>Portfolio Summary</option>
                        <option value="client_report" ${reportType === 'client_report' ? 'selected' : ''}>Client Report (Звіт по клієнтах)</option>
                        <option value="projects_status" ${reportType === 'projects_status' ? 'selected' : ''}>Project Status Report</option>
                        <option value="delivery_performance" ${reportType === 'delivery_performance' ? 'selected' : ''}>Delivery Performance</option>
                        <option value="finance_summary" ${reportType === 'finance_summary' ? 'selected' : ''}>Finance Summary (Фінансовий звіт)</option>
                        <option value="accounts_receivable" ${reportType === 'accounts_receivable' ? 'selected' : ''}>Accounts Receivable (Дебіторка)</option>
                        <option value="pm_workload" ${reportType === 'pm_workload' ? 'selected' : ''}>PM Workload Report (Навантаження)</option>
                    </select>
                </div>

                <div>
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Період:</label>
                    <select id="report-period-select" class="portal-select" style="width: 100%;">
                        <option value="7d" ${reportsState.periodType === '7d' ? 'selected' : ''}>Останні 7 днів</option>
                        <option value="30d" ${reportsState.periodType === '30d' ? 'selected' : ''}>Останні 30 днів</option>
                        <option value="90d" ${reportsState.periodType === '90d' ? 'selected' : ''}>Останні 90 днів</option>
                        <option value="this_month" ${reportsState.periodType === 'this_month' ? 'selected' : ''}>Поточний місяць</option>
                        <option value="this_quarter" ${reportsState.periodType === 'this_quarter' ? 'selected' : ''}>Поточний квартал</option>
                    </select>
                </div>

                <div>
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Клієнт / Організація:</label>
                    <select id="report-org-select" class="portal-select" style="width: 100%;">
                        <option value="all">Всі організації</option>
                        ${orgs.map(o => `<option value="${o.id}" ${reportsState.orgId === o.id ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join("")}
                    </select>
                </div>

                <div>
                    <label style="font-size: 0.75rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">Project Manager:</label>
                    <select id="report-pm-select" class="portal-select" style="width: 100%;">
                        <option value="all">Всі PM</option>
                        ${pms.map(pm => `<option value="${pm.id}" ${reportsState.pmId === pm.id ? 'selected' : ''}>${escapeHtml(pm.full_name || pm.email)}</option>`).join("")}
                    </select>
                </div>
            </div>
        </div>

        <!-- Rendered Report Output -->
        <div class="portal-card" id="report-render-card" style="padding: 24px; background: var(--bg-card);">
            ${renderSpecificReport(reportType, reportData)}
        </div>
    `;

    if (window.lucide) window.lucide.createIcons();
}

function renderSpecificReport(reportType, reportData) {
    const timestamp = new Date().toLocaleString("uk-UA");

    // 1. Client Report
    if (reportType === "client_report") {
        const clients = reportData.clients || [];
        return `
            <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 1.3rem;">Client Overview & Health Report</h2>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Сформовано: ${timestamp} | Клієнтів у звіті: ${clients.length}</div>
            </div>

            <table class="portal-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th>Клієнт / Організація</th>
                        <th>Статус</th>
                        <th>Проєкти (Акт/Заверш)</th>
                        <th>Overdue Задачі</th>
                        <th>Client Actions</th>
                        <th>Документи на погодженні</th>
                        <th>Наступна зустріч</th>
                    </tr>
                </thead>
                <tbody>
                    ${clients.length === 0 ? `
                        <tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-secondary);">Клієнтів не знайдено.</td></tr>
                    ` : clients.map(c => `
                        <tr>
                            <td style="font-weight: 600;">${escapeHtml(c.name)}</td>
                            <td><span class="portal-badge ${c.status === 'active' ? 'portal-badge-success' : ''}">${escapeHtml(c.status || 'active')}</span></td>
                            <td>${c.active_projects_count || 0} / ${c.completed_projects_count || 0}</td>
                            <td>${c.overdue_tasks_count > 0 ? `<span style="color: #EF4444; font-weight: 600;">${c.overdue_tasks_count}</span>` : '0'}</td>
                            <td>${c.client_actions_pending || 0}</td>
                            <td>${c.docs_awaiting_approval || 0}</td>
                            <td>${c.next_meeting_date ? new Date(c.next_meeting_date).toLocaleDateString('uk-UA') : '—'}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }

    // 2. Project Status Report
    if (reportType === "projects_status") {
        const projects = reportData.projects || [];
        return `
            <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 1.3rem;">Project Status Report</h2>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Сформовано: ${timestamp} | Проєктів у звіті: ${projects.length}</div>
            </div>

            <table class="portal-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th>Проєкт</th>
                        <th>Клієнт</th>
                        <th>PM</th>
                        <th>Статус</th>
                        <th>Health</th>
                        <th>Milestones</th>
                        <th>Задачі (Open/Overdue)</th>
                        <th>Дедлайн</th>
                    </tr>
                </thead>
                <tbody>
                    ${projects.map(p => `
                        <tr>
                            <td style="font-weight: 600;">${escapeHtml(p.title)}</td>
                            <td>${escapeHtml(p.organization_name)}</td>
                            <td>${escapeHtml(p.pm_name || '—')}</td>
                            <td><span class="portal-badge">${escapeHtml(p.status)}</span></td>
                            <td><span class="portal-badge ${p.health === 'good' ? 'portal-badge-success' : 'portal-badge-warning'}">${escapeHtml(p.health)}</span></td>
                            <td>${p.completed_milestones || 0} / ${p.total_milestones || 0}</td>
                            <td>${p.open_tasks || 0} ${p.overdue_tasks > 0 ? `<span style="color: #EF4444;">(${p.overdue_tasks} overdue)</span>` : ''}</td>
                            <td>${p.target_end_date ? new Date(p.target_end_date).toLocaleDateString('uk-UA') : '—'}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }

    // 3. Delivery Performance Report
    if (reportType === "delivery_performance") {
        const funnel = reportData.delivery_funnel || {};
        const rates = reportData.delivery_rates || {};
        const projects = reportData.projects || [];
        return `
            <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 1.3rem;">Delivery Performance & Funnel Report</h2>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Сформовано: ${timestamp}</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px;">
                <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">Milestone Rate</div>
                    <div style="font-size: 1.3rem; font-weight: 700; color: #10B981;">${rates.milestone_completion_rate || 0}%</div>
                </div>
                <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">Tasks Rate</div>
                    <div style="font-size: 1.3rem; font-weight: 700; color: #6366F1;">${rates.tasks_completion_rate || 0}%</div>
                </div>
                <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">Overdue Task Rate</div>
                    <div style="font-size: 1.3rem; font-weight: 700; color: ${rates.overdue_task_rate > 15 ? '#EF4444' : '#F59E0B'};">${rates.overdue_task_rate || 0}%</div>
                </div>
                <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">On-Time Delivery</div>
                    <div style="font-size: 1.3rem; font-weight: 700; color: #10B981;">${rates.on_time_delivery_rate || 100}%</div>
                </div>
                <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">Project Completion Rate</div>
                    <div style="font-size: 1.3rem; font-weight: 700; color: #38BDF8;">${rates.project_completion_rate || 0}%</div>
                </div>
                <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">Avg Delay</div>
                    <div style="font-size: 1.3rem; font-weight: 700; color: ${rates.avg_completion_delay_days > 0 ? '#EF4444' : '#10B981'};">${rates.avg_completion_delay_days || 0} дн.</div>
                </div>
            </div>

            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 12px;">Проєкти у воронці виконання (${projects.length})</h3>
            <table class="portal-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th>Проєкт</th>
                        <th>Клієнт</th>
                        <th>Статус</th>
                        <th>Health</th>
                        <th>Прогрес</th>
                        <th>Overdue Задачі</th>
                    </tr>
                </thead>
                <tbody>
                    ${projects.map(p => `
                        <tr>
                            <td style="font-weight: 600;">${escapeHtml(p.title)}</td>
                            <td>${escapeHtml(p.organization_name)}</td>
                            <td><span class="portal-badge">${escapeHtml(p.status)}</span></td>
                            <td><span class="portal-badge ${p.health === 'good' ? 'portal-badge-success' : 'portal-badge-warning'}">${escapeHtml(p.health)}</span></td>
                            <td>${p.progress_percent || 0}%</td>
                            <td>${p.overdue_tasks > 0 ? `<span style="color: #EF4444; font-weight: 600;">${p.overdue_tasks}</span>` : '0'}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }

    // 4. Finance Summary Report
    if (reportType === "finance_summary") {
        const finances = reportData.financial_analytics || {};
        return `
            <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 1.3rem;">Finance Summary Report (Multi-Currency)</h2>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Сформовано: ${timestamp}</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
                ${Object.keys(finances).map(curr => {
                    const f = finances[curr] || {};
                    const ar = f.ar_aging || {};
                    return `
                        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 12px;">
                                <span style="font-size: 1.1rem; font-weight: 700; color: #818CF8;">${escapeHtml(curr)}</span>
                                <span class="portal-badge portal-badge-primary">Маржа: ${f.forecast_margin_pct || 0}%</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem; margin-bottom: 12px;">
                                <div><span style="color: var(--text-secondary);">Контракт:</span> <strong>${formatMoney(f.contract_value_minor, curr)}</strong></div>
                                <div><span style="color: var(--text-secondary);">Виставлено:</span> <strong>${formatMoney(f.invoiced_minor, curr)}</strong></div>
                                <div><span style="color: var(--text-secondary);">Отримано:</span> <strong style="color: #10B981;">${formatMoney(f.received_minor, curr)}</strong></div>
                                <div><span style="color: var(--text-secondary);">Очікується:</span> <strong>${formatMoney(f.outstanding_minor, curr)}</strong></div>
                                <div><span style="color: var(--text-secondary);">Планові витрати:</span> <strong>${formatMoney(f.planned_costs_minor, curr)}</strong></div>
                                <div><span style="color: var(--text-secondary);">Прогнозний результат:</span> <strong style="color: #818CF8;">${formatMoney(f.forecast_result_minor, curr)}</strong></div>
                                <div style="grid-column: span 2;"><span style="color: var(--text-secondary);">Прострочено (Overdue):</span> <strong style="color: ${f.overdue_minor > 0 ? '#EF4444' : 'inherit'};">${formatMoney(f.overdue_minor, curr)}</strong></div>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>
        `;
    }

    // 5. Accounts Receivable Report
    if (reportType === "accounts_receivable") {
        const invoices = reportData.invoices || [];
        return `
            <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 1.3rem;">Accounts Receivable (Дебіторська заборгованість)</h2>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Сформовано: ${timestamp} | Неоплачених рахунків: ${invoices.length}</div>
            </div>

            <table class="portal-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th>Рахунок №</th>
                        <th>Клієнт / Проєкт</th>
                        <th>Сума</th>
                        <th>Оплачено</th>
                        <th>Заборгованість</th>
                        <th>Due Date</th>
                        <th>Прострочено</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoices.length === 0 ? `
                        <tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--text-secondary);">Немає простроченої або очікуваної заборгованості.</td></tr>
                    ` : invoices.map(inv => `
                        <tr>
                            <td style="font-weight: 600;">${escapeHtml(inv.invoice_number || 'Чернетка')}</td>
                            <td>
                                <div>${escapeHtml(inv.organization_name)}</div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(inv.project_title)}</div>
                            </td>
                            <td>${formatMoney(inv.total_minor, inv.currency)}</td>
                            <td>${formatMoney(inv.paid_minor, inv.currency)}</td>
                            <td style="font-weight: 700; color: #F59E0B;">${formatMoney(inv.outstanding_minor, inv.currency)}</td>
                            <td>${inv.due_date ? new Date(inv.due_date).toLocaleDateString('uk-UA') : '—'}</td>
                            <td>${inv.days_overdue > 0 ? `<span style="color: #EF4444; font-weight: 600;">${inv.days_overdue} дн.</span>` : 'В межах строку'}</td>
                            <td><span class="portal-badge ${inv.status === 'overdue' ? 'portal-badge-danger' : 'portal-badge-warning'}">${escapeHtml(inv.status)}</span></td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }

    // 6. PM Workload Report
    if (reportType === "pm_workload") {
        const workload = reportData.team_workload || [];
        return `
            <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 1.3rem;">Team & PM Operational Workload Report</h2>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Сформовано: ${timestamp} | Співробітників: ${workload.length}</div>
            </div>

            <table class="portal-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th>Спеціаліст / PM</th>
                        <th>Роль</th>
                        <th>Активні проєкти</th>
                        <th>Відкриті задачі</th>
                        <th>Overdue задачі</th>
                        <th>Пріоритетні (High/Critical)</th>
                        <th>Дедлайни в межах 7д</th>
                    </tr>
                </thead>
                <tbody>
                    ${workload.map(w => `
                        <tr>
                            <td style="font-weight: 600;">${escapeHtml(w.full_name || w.email)}</td>
                            <td style="text-transform: uppercase; font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(w.global_role)}</td>
                            <td>${w.active_projects || 0}</td>
                            <td>${w.open_tasks || 0}</td>
                            <td>${w.overdue_tasks > 0 ? `<span style="color: #EF4444; font-weight: 600;">${w.overdue_tasks}</span>` : '0'}</td>
                            <td>${w.high_priority_tasks || 0}</td>
                            <td>${w.upcoming_deadlines_7d || 0}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }

    // 7. Default: Portfolio Summary
    const summary = reportData.summary || {};
    const kpis = summary.executive_kpis || {};
    const rates = summary.delivery_rates || {};
    const finances = summary.financial_analytics || {};

    return `
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="margin: 0; font-size: 1.3rem;">Executive Portfolio Summary Report</h2>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Сформовано: ${timestamp}</div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                <div style="font-size: 0.8rem; color: var(--text-secondary);">Активні проєкти</div>
                <div style="font-size: 1.4rem; font-weight: 700;">${kpis.active_projects || 0} / ${kpis.total_projects || 0}</div>
            </div>
            <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                <div style="font-size: 0.8rem; color: var(--text-secondary);">Проєкти у ризику</div>
                <div style="font-size: 1.4rem; font-weight: 700; color: ${kpis.at_risk_projects > 0 ? '#EF4444' : 'inherit'};">${kpis.at_risk_projects || 0}</div>
            </div>
            <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                <div style="font-size: 0.8rem; color: var(--text-secondary);">On-Time Delivery</div>
                <div style="font-size: 1.4rem; font-weight: 700; color: #10B981;">${rates.on_time_delivery_rate || 100}%</div>
            </div>
            <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px;">
                <div style="font-size: 0.8rem; color: var(--text-secondary);">Прострочені задачі</div>
                <div style="font-size: 1.4rem; font-weight: 700; color: #F59E0B;">${kpis.overdue_tasks || 0}</div>
            </div>
        </div>

        <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 12px;">Фінансові підсумки за валютами</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
            ${Object.keys(finances).map(curr => {
                const f = finances[curr] || {};
                return `
                    <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.85rem;">
                        <div style="font-weight: 700; color: #818CF8; font-size: 1rem; margin-bottom: 6px;">${escapeHtml(curr)}</div>
                        <div>Контракт: <strong>${formatMoney(f.contract_value_minor, curr)}</strong></div>
                        <div>Отримано: <strong style="color: #10B981;">${formatMoney(f.received_minor, curr)}</strong></div>
                        <div>Дебіторка (AR): <strong style="color: #F59E0B;">${formatMoney(f.outstanding_minor, curr)}</strong></div>
                        <div>Прострочено: <strong style="color: #EF4444;">${formatMoney(f.overdue_minor, curr)}</strong></div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

function attachReportsEventListeners(root, reportData, orgs, pms) {
    document.getElementById("report-type-select")?.addEventListener("change", (e) => {
        reportsState.reportType = e.target.value;
        loadReportsData();
    });

    document.getElementById("report-period-select")?.addEventListener("change", (e) => {
        reportsState.periodType = e.target.value;
        loadReportsData();
    });

    document.getElementById("report-org-select")?.addEventListener("change", (e) => {
        reportsState.orgId = e.target.value;
        loadReportsData();
    });

    document.getElementById("report-pm-select")?.addEventListener("change", (e) => {
        reportsState.pmId = e.target.value;
        loadReportsData();
    });

    document.getElementById("btn-print-report")?.addEventListener("click", () => {
        window.print();
    });

    document.getElementById("btn-export-report-csv")?.addEventListener("click", () => {
        const text = document.getElementById("report-render-card")?.innerText || "";
        const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `firstwin_report_${reportsState.reportType}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    document.getElementById("btn-export-report-xlsx")?.addEventListener("click", () => {
        if (typeof XLSX === "undefined") {
            alert("XLSX generator is loading, please try CSV export.");
            return;
        }

        const wb = XLSX.utils.book_new();
        const table = document.querySelector("#report-render-card table");
        if (table) {
            const ws = XLSX.utils.table_to_sheet(table);
            XLSX.utils.book_append_sheet(wb, ws, "Report");
        } else {
            const lines = (document.getElementById("report-render-card")?.innerText || "").split("\n").map(l => [l]);
            const ws = XLSX.utils.aoa_to_sheet(lines);
            XLSX.utils.book_append_sheet(wb, ws, "Report");
        }
        XLSX.writeFile(wb, `firstwin_report_${reportsState.reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`, { bookType: "xlsx" });
    });
}
