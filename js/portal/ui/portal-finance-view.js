/* js/portal/ui/portal-finance-view.js - Finance Center & Portfolio Economics (Phase 5C.1) */

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

export function renderFinanceView() {
    return `
        <div class="portal-content" id="finance-center-root">
            <div class="portal-loading-container" style="padding: 40px;">
                <div class="portal-spinner"></div>
                <span>Завантаження фінансового центру...</span>
            </div>
        </div>
    `;
}

export async function initFinanceEvents() {
    await loadFinanceCenter();
}

async function loadFinanceCenter() {
    const root = document.getElementById("finance-center-root");
    if (!root) return;

    try {
        const isOwner = PortalAuth.isGlobalOwner();
        const user = PortalAuth.getUser();

        const [summary, arSummary] = await Promise.all([
            DataClient.getPortfolioFinanceSummary(),
            DataClient.getAccountsReceivableSummary()
        ]);
        const { rows, currencyAggregates } = summary;
        const { currencyAR } = arSummary;

        const currencies = Object.keys(currencyAggregates);
        const arCurrencies = Object.keys(currencyAR);

        // State for filters
        let state = {
            search: "",
            clientId: "all",
            pmId: "all",
            currency: "all",
            contractStatus: "all",
            paymentState: "all", // all, fully_paid, has_outstanding, only_overdue
            sortBy: "overdue_first" // overdue_first, largest_outstanding, nearest_payment, name
        };

        function renderUI() {
            // Extract unique clients and PMs for filters
            const clientsMap = new Map();
            const pmsMap = new Map();

            rows.forEach(r => {
                if (r.project.organization) {
                    clientsMap.set(r.project.organization.id, r.project.organization.name);
                }
                if (r.project.responsible_pm) {
                    pmsMap.set(r.project.responsible_pm.id, r.project.responsible_pm.full_name || r.project.responsible_pm.email);
                }
            });

            // Filter rows
            let filtered = rows.filter(r => {
                // Text search
                if (state.search) {
                    const q = state.search.toLowerCase();
                    const pName = (r.project.name || r.project.title || "").toLowerCase();
                    const orgName = (r.project.organization?.name || "").toLowerCase();
                    if (!pName.includes(q) && !orgName.includes(q)) return false;
                }
                // Client filter
                if (state.clientId !== "all" && r.project.organization_id !== state.clientId) return false;
                // PM filter
                if (state.pmId !== "all" && r.project.responsible_pm?.id !== state.pmId) return false;
                // Currency filter
                if (state.currency !== "all" && r.currency !== state.currency) return false;
                // Contract status
                if (state.contractStatus !== "all" && r.terms?.contract_status !== state.contractStatus) return false;
                // Financial Status filter
                if (state.financialStatus && state.financialStatus !== "all" && r.financialStatus.key !== state.financialStatus) return false;
                // Payment state filter
                if (state.paymentState === "fully_paid" && r.outstandingMinor > 0) return false;
                if (state.paymentState === "has_outstanding" && r.outstandingMinor <= 0) return false;
                if (state.paymentState === "only_overdue" && r.overdueMinor <= 0) return false;

                return true;
            });

            // Sort rows
            filtered.sort((a, b) => {
                if (state.sortBy === "overdue_first") {
                    if (b.overdueMinor !== a.overdueMinor) return b.overdueMinor - a.overdueMinor;
                    return b.outstandingMinor - a.outstandingMinor;
                }
                if (state.sortBy === "largest_outstanding") {
                    return b.outstandingMinor - a.outstandingMinor;
                }
                if (state.sortBy === "nearest_payment") {
                    if (!a.nextPayment && !b.nextPayment) return 0;
                    if (!a.nextPayment) return 1;
                    if (!b.nextPayment) return -1;
                    return a.nextPayment.due_date.localeCompare(b.nextPayment.due_date);
                }
                if (state.sortBy === "name") {
                    return (a.project.name || "").localeCompare(b.project.name || "");
                }
                return 0;
            });

            const contractStatusLabels = {
                draft: { label: "Чернетка", cls: "portal-badge-neutral" },
                proposed: { label: "Запропоновано", cls: "portal-badge-info" },
                active: { label: "Активний", cls: "portal-badge-success" },
                completed: { label: "Завершено", cls: "portal-badge-primary" },
                cancelled: { label: "Скасовано", cls: "portal-badge-danger" }
            };

            const allAvailableCurrencies = Array.from(new Set([...currencies, "CZK", "UAH", "EUR"]));

            let html = `
                <!-- Header -->
                <div class="portal-header-section" style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
                    <div>
                        <h1 class="portal-page-title" style="display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="dollar-sign" style="color: var(--color-primary);"></i>
                            Фінансовий центр (Finance Center)
                        </h1>
                        <p class="portal-page-subtitle">
                            Контроль комерційних умов, графіків оплат, дебіторської заборгованості та економіки делівері.
                        </p>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <a href="#/portal/invoices" class="btn btn-primary">
                            <i data-lucide="file-text"></i> Реєстр рахунків (Invoices)
                        </a>
                    </div>
                </div>

                <!-- Accounts Receivable & Aging Buckets Block (Phase 5C.2) -->
                <div class="portal-card" style="margin-bottom: 24px; padding: 20px; border-left: 4px solid var(--color-warning);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <h2 style="font-size: 1.05rem; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px;">
                                <i data-lucide="clock" style="color: var(--color-warning);"></i>
                                Дебіторська заборгованість та Aging Buckets
                            </h2>
                            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 2px 0 0;">
                                Структура очікуваних та прострочених платежів за віком заборгованості (окремо за валютами).
                            </p>
                        </div>
                        <a href="#/portal/invoices" class="btn btn-outline btn-xs">
                            Переглянути всі рахунки →
                        </a>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
                        ${arCurrencies.length === 0 ? `
                            <div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">Виставлених рахунків ще немає.</div>
                        ` : arCurrencies.map(curr => {
                            const ar = currencyAR[curr];
                            return `
                                <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                        <strong style="color: var(--text-primary); font-size: 0.95rem;">Валюта: ${curr}</strong>
                                        <span class="portal-badge ${ar.totalOverdueMinor > 0 ? 'portal-badge-danger' : 'portal-badge-neutral'}" style="font-size: 0.72rem;">
                                            ${ar.overdueCount > 0 ? `${ar.overdueCount} прострочено` : 'Прострочок немає'}
                                        </span>
                                    </div>

                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 0.82rem;">
                                        <div>
                                            <span style="color: var(--text-muted); display: block; font-size: 0.7rem;">Виставлено:</span>
                                            <strong style="color: var(--color-primary);">${DataClient.formatMoney(ar.totalInvoicedMinor, curr)}</strong>
                                        </div>
                                        <div>
                                            <span style="color: var(--text-muted); display: block; font-size: 0.7rem;">Отримано:</span>
                                            <strong style="color: var(--color-success);">${DataClient.formatMoney(ar.totalCollectedMinor, curr)}</strong>
                                        </div>
                                        <div>
                                            <span style="color: var(--text-muted); display: block; font-size: 0.7rem;">Очікується (Not due):</span>
                                            <strong style="color: var(--color-warning);">${DataClient.formatMoney(ar.agingBuckets.notDueMinor, curr)}</strong>
                                        </div>
                                        <div>
                                            <span style="color: var(--text-muted); display: block; font-size: 0.7rem;">Прострочено:</span>
                                            <strong style="color: ${ar.totalOverdueMinor > 0 ? 'var(--color-danger)' : 'var(--text-muted)'};">
                                                ${DataClient.formatMoney(ar.totalOverdueMinor, curr)}
                                            </strong>
                                        </div>
                                    </div>

                                    <!-- Aging Breakdown -->
                                    <div style="border-top: 1px dashed var(--border-color); padding-top: 10px; font-size: 0.75rem;">
                                        <div style="font-weight: 700; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase;">Aging Buckets:</div>
                                        <div style="display: flex; flex-direction: column; gap: 4px;">
                                            <div style="display: flex; justify-content: space-between;">
                                                <span style="color: var(--text-muted);">1–7 днів:</span>
                                                <span style="font-weight: 600; color: ${ar.agingBuckets.days1_7Minor > 0 ? 'var(--color-danger)' : 'var(--text-muted)'};">${DataClient.formatMoney(ar.agingBuckets.days1_7Minor, curr)}</span>
                                            </div>
                                            <div style="display: flex; justify-content: space-between;">
                                                <span style="color: var(--text-muted);">8–30 днів:</span>
                                                <span style="font-weight: 600; color: ${ar.agingBuckets.days8_30Minor > 0 ? 'var(--color-danger)' : 'var(--text-muted)'};">${DataClient.formatMoney(ar.agingBuckets.days8_30Minor, curr)}</span>
                                            </div>
                                            <div style="display: flex; justify-content: space-between;">
                                                <span style="color: var(--text-muted);">31–60 днів:</span>
                                                <span style="font-weight: 600; color: ${ar.agingBuckets.days31_60Minor > 0 ? 'var(--color-danger)' : 'var(--text-muted)'};">${DataClient.formatMoney(ar.agingBuckets.days31_60Minor, curr)}</span>
                                            </div>
                                            <div style="display: flex; justify-content: space-between;">
                                                <span style="color: var(--text-muted);">61–90 днів:</span>
                                                <span style="font-weight: 600; color: ${ar.agingBuckets.days61_90Minor > 0 ? 'var(--color-danger)' : 'var(--text-muted)'};">${DataClient.formatMoney(ar.agingBuckets.days61_90Minor, curr)}</span>
                                            </div>
                                            <div style="display: flex; justify-content: space-between;">
                                                <span style="color: var(--text-muted);">90+ днів:</span>
                                                <span style="font-weight: 700; color: ${ar.agingBuckets.days90PlusMinor > 0 ? 'var(--color-danger)' : 'var(--text-muted)'};">${DataClient.formatMoney(ar.agingBuckets.days90PlusMinor, curr)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </div>

                <!-- Currency Aggregation KPI Cards (Strict Multi-Currency Isolation) -->
                <div style="margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <span style="font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">
                            Агреговані показники портфеля (за валютами)
                        </span>
                    </div>

                    ${currencies.length > 0 ? `
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
                            ${currencies.map(curr => {
                                const agg = currencyAggregates[curr];
                                return `
                                    <div class="portal-card" style="border-top: 3px solid var(--color-primary); padding: 18px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                                            <span style="font-size: 1.1rem; font-weight: 700; color: var(--text-color);">
                                                Валюта: ${curr}
                                            </span>
                                            <span class="portal-badge portal-badge-neutral" style="font-size: 0.75rem;">
                                                ${agg.projectCount} ${agg.projectCount === 1 ? 'проєкт' : 'проєкти'}
                                            </span>
                                        </div>

                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px;">
                                            <div>
                                                <div class="portal-kpi-label">Вартість портфеля</div>
                                                <div style="font-weight: 700; font-size: 1.05rem; color: var(--color-primary);">
                                                    ${DataClient.formatMoney(agg.contractValueMinor, curr)}
                                                </div>
                                            </div>
                                            <div>
                                                <div class="portal-kpi-label">Отримано</div>
                                                <div style="font-weight: 700; font-size: 1.05rem; color: var(--color-success);">
                                                    ${DataClient.formatMoney(agg.collectedMinor, curr)}
                                                </div>
                                            </div>
                                            <div>
                                                <div class="portal-kpi-label">Очікується</div>
                                                <div style="font-weight: 700; font-size: 1.05rem; color: var(--color-warning);">
                                                    ${DataClient.formatMoney(agg.outstandingMinor, curr)}
                                                </div>
                                            </div>
                                            <div>
                                                <div class="portal-kpi-label">Прострочено</div>
                                                <div style="font-weight: 700; font-size: 1.05rem; color: ${agg.overdueMinor > 0 ? 'var(--color-danger)' : 'var(--text-muted)'};">
                                                    ${DataClient.formatMoney(agg.overdueMinor, curr)}
                                                </div>
                                            </div>
                                        </div>

                                        ${isOwner ? `
                                            <div style="border-top: 1px dashed var(--border-color); padding-top: 10px; margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                                <div>
                                                    <div class="portal-kpi-label">Витрати (План / Факт)</div>
                                                    <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-color);">
                                                        ${agg.hasCostRecords ? `${DataClient.formatMoney(agg.plannedCostMinor, curr)} / <span style="color: var(--color-warning);">${DataClient.formatMoney(agg.actualCostMinor, curr)}</span>` : '<span style="color: var(--text-muted); font-size: 0.8rem;">Витрати не внесені</span>'}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div class="portal-kpi-label">Прогнозований результат</div>
                                                    <div style="font-size: 0.95rem; font-weight: 700; color: ${agg.hasCostRecords ? (agg.forecastResultMinor >= 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)'};">
                                                        ${agg.hasCostRecords ? DataClient.formatMoney(agg.forecastResultMinor, curr) : '—'}
                                                    </div>
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }).join("")}
                        </div>
                    ` : `
                        <div class="portal-empty-state" style="padding: 24px;">
                            <div class="portal-empty-desc">Фінансові дані портфеля відсутні.</div>
                        </div>
                    `}
                </div>

                <!-- Filters & Search Toolbar (Responsive Compact Grid) -->
                <div class="portal-card" style="margin-bottom: 24px; padding: 16px;">
                    <div class="finance-toolbar-grid">
                        <div>
                            <input type="text" class="portal-form-input" id="finance-filter-search" 
                                placeholder="Пошук за проєктом чи клієнтом..." value="${escapeHtml(state.search || '')}" style="width: 100%;">
                        </div>
                        <div>
                            <select class="portal-form-select" id="finance-filter-client" style="width: 100%;">
                                <option value="all">Всі клієнти</option>
                                ${Array.from(clientsMap.entries()).map(([id, name]) => `
                                    <option value="${id}" ${state.clientId === id ? 'selected' : ''}>${escapeHtml(name)}</option>
                                `).join("")}
                            </select>
                        </div>
                        <div>
                            <select class="portal-form-select" id="finance-filter-pm" style="width: 100%;">
                                <option value="all">Всі PM</option>
                                ${Array.from(pmsMap.entries()).map(([id, name]) => `
                                    <option value="${id}" ${state.pmId === id ? 'selected' : ''}>${escapeHtml(name)}</option>
                                `).join("")}
                            </select>
                        </div>
                        <div>
                            <select class="portal-form-select" id="finance-filter-currency" style="width: 100%;">
                                <option value="all">Всі валюти</option>
                                ${allAvailableCurrencies.map(c => `<option value="${c}" ${state.currency === c ? 'selected' : ''}>${c}</option>`).join("")}
                            </select>
                        </div>
                        <div>
                            <select class="portal-form-select" id="finance-filter-status" style="width: 100%;">
                                <option value="all" ${!state.financialStatus || state.financialStatus === 'all' ? 'selected' : ''}>Всі фін. стани</option>
                                <option value="overdue" ${state.financialStatus === 'overdue' ? 'selected' : ''}>Є прострочка</option>
                                <option value="fully_paid" ${state.financialStatus === 'fully_paid' ? 'selected' : ''}>Оплачено</option>
                                <option value="partially_paid" ${state.financialStatus === 'partially_paid' ? 'selected' : ''}>Частково оплачено</option>
                                <option value="due_soon" ${state.financialStatus === 'due_soon' ? 'selected' : ''}>Очікується</option>
                                <option value="in_norm" ${state.financialStatus === 'in_norm' ? 'selected' : ''}>Оплати в нормі</option>
                            </select>
                        </div>
                        <div>
                            <select class="portal-form-select" id="finance-sort-by" style="width: 100%;">
                                <option value="overdue_first" ${state.sortBy === 'overdue_first' ? 'selected' : ''}>Спочатку прострочені</option>
                                <option value="largest_outstanding" ${state.sortBy === 'largest_outstanding' ? 'selected' : ''}>Найбільший залишок</option>
                                <option value="nearest_payment" ${state.sortBy === 'nearest_payment' ? 'selected' : ''}>Найближчий платіж</option>
                                <option value="name" ${state.sortBy === 'name' ? 'selected' : ''}>За назвою</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Portfolio Finance Table -->
                <div class="portal-card" style="padding: 0; overflow: hidden;">
                    <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 1rem; font-weight: 600;">
                            Економіка проєктів (${filtered.length})
                        </h3>
                    </div>

                    ${filtered.length > 0 ? `
                        <div class="portal-table-wrapper">
                            <table class="portal-table">
                                <thead>
                                    <tr>
                                        <th>Клієнт / Проєкт</th>
                                        <th>PM</th>
                                        <th>Вартість проєкту</th>
                                        <th>Отримано</th>
                                        <th>Очікується</th>
                                        <th>Прострочено</th>
                                        <th>Наступний платіж</th>
                                        ${isOwner ? `
                                            <th>Витрати (План / Факт)</th>
                                            <th>Прогноз маржі</th>
                                        ` : ''}
                                        <th>Фін. стан</th>
                                        <th>Статус</th>
                                        <th style="text-align: right;">Дії</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filtered.map(r => {
                                        const p = r.project;
                                        const statusObj = contractStatusLabels[r.terms?.contract_status] || { label: r.terms?.contract_status || 'draft', cls: 'portal-badge-neutral' };
                                        const finStatus = r.financialStatus || { key: "draft", label: "Умови не задані", cls: "portal-badge-neutral" };

                                        return `
                                            <tr data-project-id="${p.id}">
                                                <td>
                                                    <div style="font-weight: 600; font-size: 0.92rem;">
                                                        <a href="#/portal/projects/${p.id}" class="portal-table-link">
                                                            ${escapeHtml(p.name || p.title || 'Без назви')}
                                                        </a>
                                                    </div>
                                                    <div style="font-size: 0.78rem; margin-top: 2px;">
                                                        <a href="#/portal/clients/${p.organization_id}" class="portal-table-sublink">
                                                            ${escapeHtml(p.organization?.name || '—')}
                                                        </a>
                                                    </div>
                                                </td>
                                                <td style="font-size: 0.85rem;">
                                                    ${p.responsible_pm ? escapeHtml(p.responsible_pm.full_name || p.responsible_pm.email) : '<span style="color: var(--text-muted);">Не призначено</span>'}
                                                </td>
                                                <td style="font-weight: 600; font-size: 0.92rem;">
                                                    ${DataClient.formatMoney(r.contractValueMinor, r.currency)}
                                                </td>
                                                <td style="color: var(--color-success); font-weight: 600; font-size: 0.92rem;">
                                                    ${DataClient.formatMoney(r.collectedMinor, r.currency)}
                                                </td>
                                                <td style="color: ${r.outstandingMinor > 0 ? 'var(--color-warning)' : 'var(--text-muted)'}; font-weight: 500; font-size: 0.92rem;">
                                                    ${DataClient.formatMoney(r.outstandingMinor, r.currency)}
                                                </td>
                                                <td style="color: ${r.overdueMinor > 0 ? 'var(--color-danger)' : 'var(--text-muted)'}; font-weight: ${r.overdueMinor > 0 ? '700' : '400'}; font-size: 0.92rem;">
                                                    ${r.overdueMinor > 0 ? DataClient.formatMoney(r.overdueMinor, r.currency) : '—'}
                                                </td>
                                                <td style="font-size: 0.85rem;">
                                                    ${r.nextPayment ? `
                                                        <div style="font-weight: 500;">${DataClient.formatDateSimple(r.nextPayment.due_date)}</div>
                                                        <div style="font-size: 0.75rem; color: var(--text-muted);">${DataClient.formatMoney(r.nextPayment.remainderMinor, r.currency)}</div>
                                                    ` : '<span style="color: var(--text-muted);">Немає</span>'}
                                                </td>
                                                ${isOwner ? `
                                                    <td style="font-size: 0.85rem;">
                                                        ${r.hasCostRecords ? `
                                                            <div>${DataClient.formatMoney(r.plannedCostMinor, r.currency)} (план)</div>
                                                            <div style="color: var(--color-warning); font-size: 0.78rem;">${DataClient.formatMoney(r.actualCostMinor, r.currency)} (факт)</div>
                                                        ` : `
                                                            <div style="color: var(--text-muted); font-size: 0.8rem;">Витрати не внесені</div>
                                                        `}
                                                    </td>
                                                    <td style="font-size: 0.88rem;">
                                                        ${r.hasCostRecords && r.forecastMarginPercent !== null ? `
                                                            <span style="font-weight: 700; color: ${r.forecastResultMinor >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">
                                                                ${Math.round(r.forecastMarginPercent)}%
                                                            </span>
                                                            <div style="font-size: 0.72rem; color: var(--text-muted);">${DataClient.formatMoney(r.forecastResultMinor, r.currency)}</div>
                                                        ` : `
                                                            <span style="color: var(--text-muted); font-size: 0.82rem;" title="Маржа ще не розрахована">—</span>
                                                        `}
                                                    </td>
                                                ` : ''}
                                                <td>
                                                    <span class="portal-badge ${finStatus.cls}">${finStatus.label}</span>
                                                </td>
                                                <td>
                                                    <span class="portal-badge ${statusObj.cls}">${statusObj.label}</span>
                                                </td>
                                                <td style="text-align: right;">
                                                    <a href="#/portal/projects/${p.id}" class="btn btn-xs btn-outline" title="Відкрити паспорт проєкту">
                                                        <i data-lucide="arrow-up-right" style="width: 13px; height: 13px;"></i>
                                                    </a>
                                                </td>
                                            </tr>
                                        `;
                                    }).join("")}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="portal-empty-state" style="padding: 32px;">
                            <div class="portal-empty-icon"><i data-lucide="filter-x"></i></div>
                            <div class="portal-empty-title">Проєктів за обраними фільтрами не знайдено</div>
                            <div class="portal-empty-desc">Спробуйте скинути фільтри або змінити пошуковий запит.</div>
                        </div>
                    `}
                </div>
            `;

            root.innerHTML = html;
            if (window.lucide) window.lucide.createIcons();

            // Attach filter listeners
            document.getElementById("finance-filter-search")?.addEventListener("input", (e) => {
                state.search = e.target.value;
                renderUI();
            });
            document.getElementById("finance-filter-client")?.addEventListener("change", (e) => {
                state.clientId = e.target.value;
                renderUI();
            });
            document.getElementById("finance-filter-pm")?.addEventListener("change", (e) => {
                state.pmId = e.target.value;
                renderUI();
            });
            document.getElementById("finance-filter-currency")?.addEventListener("change", (e) => {
                state.currency = e.target.value;
                renderUI();
            });
            document.getElementById("finance-filter-status")?.addEventListener("change", (e) => {
                state.financialStatus = e.target.value;
                renderUI();
            });
            document.getElementById("finance-sort-by")?.addEventListener("change", (e) => {
                state.sortBy = e.target.value;
                renderUI();
            });
        }

        renderUI();

    } catch (err) {
        console.error("[FinanceCenter] Error loading:", err);
        root.innerHTML = `
            <div class="portal-empty-state">
                <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                <div class="portal-empty-title">Помилка завантаження фінансового центру</div>
                <div class="portal-empty-desc">${err.message}</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}
