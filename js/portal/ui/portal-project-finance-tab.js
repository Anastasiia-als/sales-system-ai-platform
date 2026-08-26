/* js/portal/ui/portal-project-finance-tab.js - Project Finance & Economics Tab */

import { DataClient } from "../api/data-client.js";
import { PortalAuth } from "../auth/auth-service.js";

export function renderProjectFinanceTab(projectId, isOwner, canManage) {
    return `
        <div id="project-finance-view-root" data-project-id="${projectId}">
            <div class="portal-loading-container" style="padding: 30px;">
                <div class="portal-spinner"></div>
                <span>Завантаження фінансових показників...</span>
            </div>
        </div>
    `;
}

export async function loadAndRenderProjectFinance(projectId) {
    const root = document.getElementById("project-finance-view-root");
    if (!root) return;

    try {
        const [financeData, invoices] = await Promise.all([
            DataClient.getProjectFinanceData(projectId),
            DataClient.getInvoices({ project_id: projectId })
        ]);
        const { terms, schedule, payments, costs, currency, kpis } = financeData;
        const isOwner = PortalAuth.isGlobalOwner();
        const canManage = isOwner || PortalAuth.isOrgAdmin(terms?.organization_id);

        const commercialModelLabels = {
            fixed_fee: "Фіксована вартість (Fixed Fee)",
            retainer: "Щомісячний Retainer",
            milestone_based: "Поетапна оплата (Milestone-based)",
            hourly: "Погодинна оплата (Time & Material)",
            custom: "Індивідуальні умови"
        };

        const contractStatusLabels = {
            draft: { label: "Чернетка", cls: "portal-badge-neutral" },
            proposed: { label: "Запропоновано", cls: "portal-badge-info" },
            active: { label: "Активний", cls: "portal-badge-success" },
            completed: { label: "Завершено", cls: "portal-badge-primary" },
            cancelled: { label: "Скасовано", cls: "portal-badge-danger" }
        };

        const trancheStatusLabels = {
            planned: { label: "Заплановано", cls: "portal-badge-neutral" },
            due: { label: "Очікується", cls: "portal-badge-warning" },
            partially_paid: { label: "Частково сплачено", cls: "portal-badge-info" },
            paid: { label: "Оплачено", cls: "portal-badge-success" },
            overdue: { label: "Прострочено", cls: "portal-badge-danger" },
            cancelled: { label: "Скасовано", cls: "portal-badge-neutral" }
        };

        const paymentMethodLabels = {
            bank_transfer: "Банківський переказ (IBAN)",
            card: "Банківська картка",
            cash: "Готівка",
            crypto: "Криптовалюта (довідково)",
            other: "Інший спосіб"
        };

        const costCategoryLabels = {
            specialist: "Робота спеціаліста / команди",
            software: "ПЗ та підписки",
            contractor: "Підрядники / аутсорс",
            marketing: "Маркетинг та реклама",
            travel: "Відрядження та транспорт",
            infrastructure: "Інфраструктура / хостинг",
            other: "Інші витрати"
        };

        let html = `
            <!-- Finance KPI Header (Responsive 4-Grid / 2x2 Tablet / 1-Col Mobile) -->
            <div class="portal-kpi-grid">
                <div class="portal-kpi-card">
                    <div class="portal-kpi-label">Вартість проєкту</div>
                    <div class="portal-kpi-value" style="color: var(--color-primary); font-size: 1.55rem;">${DataClient.formatMoney(kpis.contractValueMinor, currency)}</div>
                    <div class="portal-kpi-sub" style="font-size: 0.76rem;">${terms ? commercialModelLabels[terms.commercial_model] || "Комерційні умови" : "Не встановлено"}</div>
                </div>
                <div class="portal-kpi-card">
                    <div class="portal-kpi-label">Отримано</div>
                    <div class="portal-kpi-value" style="color: var(--color-success); font-size: 1.55rem;">${DataClient.formatMoney(kpis.collectedMinor, currency)}</div>
                    <div class="portal-kpi-sub" style="font-size: 0.76rem;">${payments.length} ${payments.length === 1 ? "платіж" : "платежів"}</div>
                </div>
                <div class="portal-kpi-card">
                    <div class="portal-kpi-label">Очікується до сплати</div>
                    <div class="portal-kpi-value" style="color: var(--color-warning); font-size: 1.55rem;">${DataClient.formatMoney(kpis.outstandingMinor, currency)}</div>
                    <div class="portal-kpi-sub" style="font-size: 0.76rem;">Залишок за договором</div>
                </div>
                <div class="portal-kpi-card ${kpis.overdueMinor > 0 ? 'portal-card-alert' : ''}">
                    <div class="portal-kpi-label">Прострочено</div>
                    <div class="portal-kpi-value" style="color: ${kpis.overdueMinor > 0 ? 'var(--color-danger)' : 'var(--text-muted)'}; font-size: 1.55rem;">
                        ${DataClient.formatMoney(kpis.overdueMinor, currency)}
                    </div>
                    <div class="portal-kpi-sub" style="font-size: 0.76rem;">${kpis.overdueMinor > 0 ? "Потребує уваги PM" : "Прострочень немає"}</div>
                </div>
            </div>
        `;

        // Owner additional KPIs
        if (isOwner) {
            html += `
                <div class="portal-card" style="margin-bottom: 24px; background: rgba(59, 130, 246, 0.03); border: 1px dashed rgba(59, 130, 246, 0.3);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <span style="font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-primary);">
                            <i data-lucide="shield-alert" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"></i>
                            Економіка проєкту (Тільки для Керівника)
                        </span>
                        <span class="portal-badge portal-badge-info" style="font-size: 0.75rem;">Конфіденційно</span>
                    </div>
                    <div class="portal-kpi-grid" style="margin-bottom: 0;">
                        <div>
                            <div class="portal-kpi-label">Планові витрати</div>
                            <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-color);">
                                ${kpis.hasCostRecords ? DataClient.formatMoney(kpis.plannedCostMinor, currency) : '<span style="color: var(--text-muted); font-weight: 500; font-size: 0.9rem;">Витрати не внесені</span>'}
                            </div>
                        </div>
                        <div>
                            <div class="portal-kpi-label">Фактичні витрати</div>
                            <div style="font-size: 1.15rem; font-weight: 700; color: var(--color-warning);">
                                ${kpis.hasCostRecords ? DataClient.formatMoney(kpis.actualCostMinor, currency) : '<span style="color: var(--text-muted); font-weight: 500; font-size: 0.9rem;">Витрати не внесені</span>'}
                            </div>
                        </div>
                        <div>
                            <div class="portal-kpi-label">Прогнозований результат</div>
                            <div style="font-size: 1.15rem; font-weight: 700; color: ${kpis.hasCostRecords ? (kpis.forecastResultMinor >= 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-muted)'};">
                                ${kpis.hasCostRecords ? DataClient.formatMoney(kpis.forecastResultMinor, currency) : '<span style="color: var(--text-muted); font-weight: 500; font-size: 0.9rem;">Маржа ще не розрахована</span>'}
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">
                                ${kpis.hasCostRecords ? `Маржинальність: ${Math.round(kpis.forecastMarginPercent)}%` : 'Маржинальність: —'}
                            </div>
                        </div>
                        <div>
                            <div class="portal-kpi-label">Поточний cash result</div>
                            <div style="font-size: 1.15rem; font-weight: 700; color: ${kpis.currentCashResultMinor >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">
                                ${DataClient.formatMoney(kpis.currentCashResultMinor, currency)}
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">(Отримано − Фактичні витрати)</div>
                        </div>
                    </div>
                </div>
            `;
        }

        html += `
            <div style="display: grid; grid-template-columns: 1fr; gap: 24px;">
                <!-- 1. Commercial Terms Card -->
                <div class="portal-card">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="portal-card-icon" style="background: rgba(59, 130, 246, 0.1); color: var(--color-primary); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
                                <i data-lucide="file-text" style="width: 18px; height: 18px;"></i>
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 600;">Комерційні умови</h3>
                                <p style="margin: 0; font-size: 0.82rem; color: var(--text-muted);">Параметри договору та порядок розрахунків</p>
                            </div>
                        </div>
                        ${canManage ? `
                            <button class="btn btn-sm btn-outline" id="btn-edit-commercial-terms">
                                <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i> Редагувати умови
                            </button>
                        ` : ''}
                    </div>

                    ${terms ? `
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; background: var(--bg-alt); padding: 16px; border-radius: 8px;">
                            <div>
                                <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase;">Модель співпраці</div>
                                <div style="font-weight: 600; font-size: 0.92rem; margin-top: 2px;">${commercialModelLabels[terms.commercial_model] || terms.commercial_model}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase;">Статус договору</div>
                                <div style="margin-top: 2px;">
                                    <span class="portal-badge ${contractStatusLabels[terms.contract_status]?.cls || 'portal-badge-neutral'}">
                                        ${contractStatusLabels[terms.contract_status]?.label || terms.contract_status}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase;">Номер та дата договору</div>
                                <div style="font-weight: 500; font-size: 0.92rem; margin-top: 2px;">
                                    ${terms.contract_number ? `№ ${terms.contract_number}` : '—'} 
                                    ${terms.contract_date ? `від ${DataClient.formatDateSimple(terms.contract_date)}` : ''}
                                </div>
                            </div>
                            <div>
                                <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase;">Валюта розрахунків</div>
                                <div style="font-weight: 600; font-size: 0.92rem; margin-top: 2px;">${terms.currency}</div>
                            </div>
                            ${terms.payment_terms_text ? `
                                <div style="grid-column: 1 / -1;">
                                    <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase;">Умови оплати</div>
                                    <div style="font-size: 0.88rem; margin-top: 2px; color: var(--text-color);">${terms.payment_terms_text}</div>
                                </div>
                            ` : ''}
                            ${terms.notes ? `
                                <div style="grid-column: 1 / -1;">
                                    <div style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase;">Внутрішні примітки</div>
                                    <div style="font-size: 0.85rem; margin-top: 2px; color: var(--text-muted);">${terms.notes}</div>
                                </div>
                            ` : ''}
                        </div>
                    ` : `
                        <div class="portal-empty-state" style="padding: 24px;">
                            <div class="portal-empty-desc">Комерційні умови для цього проєкту ще не налаштовані.</div>
                            ${canManage ? `
                                <button class="btn btn-sm btn-primary" id="btn-edit-commercial-terms" style="margin-top: 12px;">
                                    <i data-lucide="plus"></i> Задати комерційні умови
                                </button>
                            ` : ''}
                        </div>
                    `}
                </div>

                <!-- 2. Payment Schedule Card -->
                <div class="portal-card">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="portal-card-icon" style="background: rgba(16, 185, 129, 0.1); color: var(--color-success); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
                                <i data-lucide="calendar" style="width: 18px; height: 18px;"></i>
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 600;">Графік оплат (Транші)</h3>
                                <p style="margin: 0; font-size: 0.82rem; color: var(--text-muted);">Планові етапи фінансування та контроль заборгованості</p>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            ${canManage ? `
                                <button class="btn btn-sm btn-outline" id="btn-add-tranche">
                                    <i data-lucide="plus" style="width: 14px; height: 14px;"></i> Додати транш
                                </button>
                                <button class="btn btn-sm btn-primary" id="btn-record-payment-quick">
                                    <i data-lucide="check-circle" style="width: 14px; height: 14px;"></i> Зафіксувати оплату
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    ${schedule.length > 0 ? `
                        <div class="portal-table-wrapper">
                            <table class="portal-table">
                                <thead>
                                    <tr>
                                        <th style="width: 40px;">#</th>
                                        <th>Назва етапу / траншу</th>
                                        <th>Планова дата</th>
                                        <th>Сума</th>
                                        <th>Сплачено</th>
                                        <th>Залишок</th>
                                        <th>Статус</th>
                                        ${canManage ? '<th style="text-align: right;">Дії</th>' : ''}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${schedule.map((item, idx) => {
                                        const tranchePayments = payments.filter(p => p.payment_schedule_id === item.id);
                                        const paidForTranche = tranchePayments.reduce((sum, p) => sum + Number(p.amount_minor || 0), 0);
                                        const remainder = Math.max(Number(item.amount_minor || 0) - paidForTranche, 0);
                                        const isOverdue = item.status !== 'cancelled' && remainder > 0 && item.due_date < new Date().toISOString().split("T")[0];
                                        const statusObj = trancheStatusLabels[isOverdue ? 'overdue' : item.status] || { label: item.status, cls: 'portal-badge-neutral' };

                                        return `
                                            <tr data-tranche-id="${item.id}">
                                                <td style="color: var(--text-muted); font-size: 0.85rem;">${idx + 1}</td>
                                                <td>
                                                    <div style="font-weight: 600; font-size: 0.92rem;">${item.title}</div>
                                                    ${item.notes ? `<div style="font-size: 0.78rem; color: var(--text-muted);">${item.notes}</div>` : ''}
                                                </td>
                                                <td style="font-size: 0.88rem; ${isOverdue ? 'color: var(--color-danger); font-weight: 600;' : ''}">
                                                    ${DataClient.formatDateSimple(item.due_date)}
                                                    ${isOverdue ? '<span style="display: block; font-size: 0.72rem; color: var(--color-danger);">Прострочено</span>' : ''}
                                                </td>
                                                <td style="font-weight: 600;">${DataClient.formatMoney(item.amount_minor, item.currency)}</td>
                                                <td style="color: var(--color-success); font-weight: 500;">${DataClient.formatMoney(paidForTranche, item.currency)}</td>
                                                <td style="color: ${remainder > 0 ? 'var(--color-warning)' : 'var(--text-muted)'}; font-weight: 500;">
                                                    ${DataClient.formatMoney(remainder, item.currency)}
                                                </td>
                                                <td>
                                                    <span class="portal-badge ${statusObj.cls}">${statusObj.label}</span>
                                                </td>
                                                ${canManage ? `
                                                    <td style="text-align: right; white-space: nowrap;">
                                                        ${remainder > 0 && item.status !== 'cancelled' ? `
                                                            <button class="btn-action-icon btn-pay-tranche" data-tranche-id="${item.id}" data-amount="${remainder}" data-currency="${item.currency}" title="Оплатити залишок">
                                                                <i data-lucide="dollar-sign" style="width: 14px; height: 14px; color: var(--color-success);"></i>
                                                            </button>
                                                        ` : ''}
                                                        <button class="btn-action-icon btn-edit-tranche" data-tranche-id="${item.id}" title="Редагувати">
                                                            <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
                                                        </button>
                                                        <button class="btn-action-icon btn-delete-tranche" data-tranche-id="${item.id}" title="Видалити" style="color: var(--color-danger);">
                                                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                                                        </button>
                                                    </td>
                                                ` : ''}
                                            </tr>
                                        `;
                                    }).join("")}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="portal-empty-state" style="padding: 24px;">
                            <div class="portal-empty-desc">Графік оплат ще не створено. Додайте перший транш або аванс.</div>
                            ${canManage ? `
                                <button class="btn btn-sm btn-outline" id="btn-add-tranche" style="margin-top: 12px;">
                                    <i data-lucide="plus"></i> Створити транш
                                </button>
                            ` : ''}
                        </div>
                    `}
                </div>

                <!-- 2.5 Invoices Section (Phase 5C.2) -->
                <div class="portal-card" style="margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="portal-card-icon" style="background: rgba(14, 165, 233, 0.1); color: #0ea5e9; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
                                <i data-lucide="file-text" style="width: 18px; height: 18px;"></i>
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 600;">Рахунки (Invoices)</h3>
                                <p style="margin: 0; font-size: 0.82rem; color: var(--text-muted);">Виставлені рахунки-фактури та контроль сплати</p>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <a href="#/portal/invoices" class="btn btn-sm btn-outline">
                                До реєстру рахунків
                            </a>
                        </div>
                    </div>

                    ${invoices.length > 0 ? `
                        <div class="table-responsive">
                            <table class="portal-table" style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr>
                                        <th>Рахунок №</th>
                                        <th>Дата / Термін</th>
                                        <th>Сума</th>
                                        <th>Оплачено</th>
                                        <th>Залишок</th>
                                        <th>Статус</th>
                                        <th style="text-align: right;">Дії</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${invoices.map(inv => {
                                        const total = Number(inv.total_minor || 0);
                                        const paid = Number(inv.paid_minor || 0);
                                        const out = Math.max(total - paid, 0);
                                        const isDraft = inv.status === 'draft';
                                        return `
                                            <tr>
                                                <td>
                                                    <a href="#/portal/invoices/${inv.id}" class="portal-table-link" style="font-weight: 700;">
                                                        ${isDraft ? '<span style="color: var(--text-muted);">[Чернетка]</span>' : (inv.invoice_number || 'б/н')}
                                                    </a>
                                                </td>
                                                <td>
                                                    <span style="font-size: 0.85rem;">${inv.issue_date}</span>
                                                    <span style="display: block; font-size: 0.75rem; color: var(--text-muted);">до ${inv.due_date}</span>
                                                </td>
                                                <td style="font-weight: 700;">${DataClient.formatMoney(total, inv.currency)}</td>
                                                <td style="color: var(--color-success); font-weight: 600;">${DataClient.formatMoney(paid, inv.currency)}</td>
                                                <td style="color: ${out > 0 ? 'var(--color-warning)' : 'var(--text-muted)'}; font-weight: 600;">${DataClient.formatMoney(out, inv.currency)}</td>
                                                <td>
                                                    <span class="portal-badge portal-badge-neutral" style="text-transform: capitalize;">${inv.status}</span>
                                                </td>
                                                <td style="text-align: right;">
                                                    <a href="#/portal/invoices/${inv.id}" class="btn btn-outline btn-xs">Переглянути</a>
                                                </td>
                                            </tr>
                                        `;
                                    }).join("")}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="portal-empty-state" style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                            Рахунків за цим проєктом ще не виставлено.
                        </div>
                    `}
                </div>

                <!-- 3. Payments Received Card -->
                <div class="portal-card">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="portal-card-icon" style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
                                <i data-lucide="credit-card" style="width: 18px; height: 18px;"></i>
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 600;">Отримані платежі</h3>
                                <p style="margin: 0; font-size: 0.82rem; color: var(--text-muted);">Історія фактично зарахованих оплат від клієнта</p>
                            </div>
                        </div>
                        ${canManage ? `
                            <button class="btn btn-sm btn-primary" id="btn-record-payment">
                                <i data-lucide="plus" style="width: 14px; height: 14px;"></i> + Зафіксувати оплату
                            </button>
                        ` : ''}
                    </div>

                    ${payments.length > 0 ? `
                        <div class="portal-table-wrapper">
                            <table class="portal-table">
                                <thead>
                                    <tr>
                                        <th>Дата оплати</th>
                                        <th>Сума</th>
                                        <th>Спосіб оплати</th>
                                        <th>Пов'язаний транш</th>
                                        <th>Референс / Документ</th>
                                        <th>Зафіксував</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${payments.map(p => {
                                        const linkedSchedule = schedule.find(s => s.id === p.payment_schedule_id);
                                        return `
                                            <tr>
                                                <td style="font-size: 0.88rem; font-weight: 500;">
                                                    ${DataClient.formatDateSimple(p.paid_at)}
                                                    <div style="font-size: 0.72rem; color: var(--text-muted);">${new Date(p.paid_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</div>
                                                </td>
                                                <td style="font-weight: 700; color: var(--color-success); font-size: 0.95rem;">
                                                    ${DataClient.formatMoney(p.amount_minor, p.currency)}
                                                </td>
                                                <td style="font-size: 0.85rem;">
                                                    ${paymentMethodLabels[p.payment_method] || p.payment_method}
                                                </td>
                                                <td style="font-size: 0.88rem;">
                                                    ${linkedSchedule ? `<span style="font-weight: 500;">${linkedSchedule.title}</span>` : '<span style="color: var(--text-muted);">Без прив\'язки до траншу</span>'}
                                                </td>
                                                <td style="font-size: 0.85rem; color: var(--text-muted);">
                                                    ${p.reference ? `<code style="font-size: 0.78rem; background: var(--bg-alt); padding: 2px 4px; border-radius: 4px;">${p.reference}</code>` : '—'}
                                                    ${p.comment ? `<div style="font-size: 0.78rem; margin-top: 2px;">${p.comment}</div>` : ''}
                                                </td>
                                                <td style="font-size: 0.82rem; color: var(--text-muted);">
                                                    Команда FIRSTWIN
                                                </td>
                                            </tr>
                                        `;
                                    }).join("")}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <div class="portal-empty-state" style="padding: 24px;">
                            <div class="portal-empty-desc">Жодної фактичної оплати за цим проєктом ще не зафіксовано.</div>
                        </div>
                    `}
                </div>

                <!-- 4. Internal Project Costs (Strictly Owner Only) -->
                ${isOwner ? `
                    <div class="portal-card" style="border-left: 4px solid var(--color-primary);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div class="portal-card-icon" style="background: rgba(239, 68, 68, 0.1); color: var(--color-danger); width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
                                    <i data-lucide="pie-chart" style="width: 18px; height: 18px;"></i>
                                </div>
                                <div>
                                    <h3 style="margin: 0; font-size: 1.05rem; font-weight: 600;">Внутрішні витрати FIRSTWIN (Delivery Costs)</h3>
                                    <p style="margin: 0; font-size: 0.82rem; color: var(--text-muted);">Планові та фактичні витрати на реалізацію (Конфіденційно)</p>
                                </div>
                            </div>
                            <button class="btn btn-sm btn-outline" id="btn-add-cost">
                                <i data-lucide="plus" style="width: 14px; height: 14px;"></i> Додати витрату
                            </button>
                        </div>

                        ${costs.length > 0 ? `
                            <div class="portal-table-wrapper">
                                <table class="portal-table">
                                    <thead>
                                        <tr>
                                            <th>Категорія</th>
                                            <th>Назва витрати</th>
                                            <th>Тип</th>
                                            <th>Сума</th>
                                            <th>Дата</th>
                                            <th>Отримувач / Підрядник</th>
                                            <th style="text-align: right;">Дії</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${costs.map(c => `
                                            <tr data-cost-id="${c.id}">
                                                <td style="font-size: 0.85rem; font-weight: 500;">
                                                    ${costCategoryLabels[c.category] || c.category}
                                                </td>
                                                <td>
                                                    <div style="font-weight: 600; font-size: 0.9rem;">${c.title}</div>
                                                    ${c.notes ? `<div style="font-size: 0.78rem; color: var(--text-muted);">${c.notes}</div>` : ''}
                                                </td>
                                                <td>
                                                    <span class="portal-badge ${c.cost_type === 'actual' ? 'portal-badge-warning' : 'portal-badge-info'}">
                                                        ${c.cost_type === 'actual' ? 'Фактична' : 'Планова'}
                                                    </span>
                                                </td>
                                                <td style="font-weight: 600; color: var(--text-color);">
                                                    ${DataClient.formatMoney(c.amount_minor, c.currency)}
                                                </td>
                                                <td style="font-size: 0.85rem; color: var(--text-muted);">
                                                    ${c.incurred_at ? DataClient.formatDateSimple(c.incurred_at) : '—'}
                                                </td>
                                                <td style="font-size: 0.85rem; color: var(--text-muted);">
                                                    ${c.vendor_or_recipient || '—'}
                                                </td>
                                                <td style="text-align: right; white-space: nowrap;">
                                                    <button class="btn-action-icon btn-edit-cost" data-cost-id="${c.id}" title="Редагувати">
                                                        <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
                                                    </button>
                                                    <button class="btn-action-icon btn-delete-cost" data-cost-id="${c.id}" title="Видалити" style="color: var(--color-danger);">
                                                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join("")}
                                    </tbody>
                                </table>
                            </div>
                        ` : `
                            <div class="portal-empty-state" style="padding: 20px;">
                                <div class="portal-empty-desc">Внутрішніх витрат за цим проєктом ще не зафіксовано.</div>
                            </div>
                        `}
                    </div>
                ` : ''}
            </div>
        `;

        root.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();

        // Attach Event Listeners
        attachFinanceTabEvents(projectId, financeData);

    } catch (err) {
        console.error("[ProjectFinanceTab] Load error:", err);
        root.innerHTML = `
            <div class="portal-empty-state">
                <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-circle"></i></div>
                <div class="portal-empty-title">Помилка завантаження фінансів</div>
                <div class="portal-empty-desc">${err.message}</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}

function attachFinanceTabEvents(projectId, financeData) {
    const { terms, schedule, costs, currency } = financeData;

    // 1. Commercial Terms Modal
    document.querySelectorAll("#btn-edit-commercial-terms").forEach(btn => {
        btn.addEventListener("click", () => openCommercialTermsModal(projectId, terms, currency));
    });

    // 2. Add Tranche Modal
    document.querySelectorAll("#btn-add-tranche").forEach(btn => {
        btn.addEventListener("click", () => openTrancheModal(projectId, null, currency));
    });

    // 3. Edit Tranche Modal
    document.querySelectorAll(".btn-edit-tranche").forEach(btn => {
        btn.addEventListener("click", () => {
            const trancheId = btn.getAttribute("data-tranche-id");
            const tranche = schedule.find(s => s.id === trancheId);
            if (tranche) openTrancheModal(projectId, tranche, currency);
        });
    });

    // 4. Delete Tranche
    document.querySelectorAll(".btn-delete-tranche").forEach(btn => {
        btn.addEventListener("click", async () => {
            const trancheId = btn.getAttribute("data-tranche-id");
            if (confirm("Ви дійсно бажаєте видалити цей плановий транш?")) {
                const { error } = await DataClient.deletePaymentScheduleTranche(trancheId);
                if (error) alert("Помилка видалення: " + error.message);
                else loadAndRenderProjectFinance(projectId);
            }
        });
    });

    // 5. Record Payment Modal
    document.querySelectorAll("#btn-record-payment, #btn-record-payment-quick").forEach(btn => {
        btn.addEventListener("click", () => openRecordPaymentModal(projectId, schedule, null, currency));
    });

    // 6. Pay specific tranche directly
    document.querySelectorAll(".btn-pay-tranche").forEach(btn => {
        btn.addEventListener("click", () => {
            const trancheId = btn.getAttribute("data-tranche-id");
            const amountMinor = parseInt(btn.getAttribute("data-amount"), 10);
            const tranche = schedule.find(s => s.id === trancheId);
            openRecordPaymentModal(projectId, schedule, { ...tranche, remainderMinor: amountMinor }, currency);
        });
    });

    // 7. Add Cost Modal (Owner only)
    document.querySelectorAll("#btn-add-cost").forEach(btn => {
        btn.addEventListener("click", () => openCostModal(projectId, null, currency));
    });

    // 8. Edit Cost Modal
    document.querySelectorAll(".btn-edit-cost").forEach(btn => {
        btn.addEventListener("click", () => {
            const costId = btn.getAttribute("data-cost-id");
            const cost = costs.find(c => c.id === costId);
            if (cost) openCostModal(projectId, cost, currency);
        });
    });

    // 9. Delete Cost
    document.querySelectorAll(".btn-delete-cost").forEach(btn => {
        btn.addEventListener("click", async () => {
            const costId = btn.getAttribute("data-cost-id");
            if (confirm("Ви дійсно бажаєте видалити запис витрат?")) {
                const { error } = await DataClient.deleteProjectCost(costId);
                if (error) alert("Помилка видалення: " + error.message);
                else loadAndRenderProjectFinance(projectId);
            }
        });
    });
}

// -----------------------------------------------------------------------------
// Modals
// -----------------------------------------------------------------------------

function openCommercialTermsModal(projectId, terms, defaultCurrency) {
    const mount = document.getElementById("project-detail-modal-mount");
    if (!mount) return;

    mount.innerHTML = `
        <div class="portal-modal-backdrop" id="modal-terms-backdrop">
            <div class="portal-modal" style="max-width: 540px;">
                <div class="portal-modal-header">
                    <h3 class="portal-modal-title">${terms ? 'Редагувати комерційні умови' : 'Задати комерційні умови'}</h3>
                    <button class="portal-modal-close" id="btn-close-terms-modal">&times;</button>
                </div>
                <form id="form-commercial-terms" style="padding: 20px;">
                    <div class="portal-form-group" style="margin-bottom: 14px;">
                        <label class="portal-form-label">Вартість проєкту (контракту) *</label>
                        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px;">
                            <input type="number" step="1" min="0" class="portal-form-input" id="terms-contract-value" 
                                value="${terms ? Math.round(terms.contract_value_minor / 100) : '0'}" required placeholder="120000">
                            <select class="portal-form-select" id="terms-currency">
                                <option value="CZK" ${terms?.currency === 'CZK' ? 'selected' : ''}>CZK (Kč)</option>
                                <option value="UAH" ${terms?.currency === 'UAH' ? 'selected' : ''}>UAH (₴)</option>
                                <option value="EUR" ${terms?.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                                <option value="USD" ${terms?.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                                <option value="PLN" ${terms?.currency === 'PLN' ? 'selected' : ''}>PLN (zł)</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                        <div class="portal-form-group">
                            <label class="portal-form-label">Модель співпраці *</label>
                            <select class="portal-form-select" id="terms-model">
                                <option value="fixed_fee" ${terms?.commercial_model === 'fixed_fee' ? 'selected' : ''}>Фіксована (Fixed Fee)</option>
                                <option value="milestone_based" ${terms?.commercial_model === 'milestone_based' ? 'selected' : ''}>Поетапна (Milestone)</option>
                                <option value="retainer" ${terms?.commercial_model === 'retainer' ? 'selected' : ''}>Щомісячний Retainer</option>
                                <option value="hourly" ${terms?.commercial_model === 'hourly' ? 'selected' : ''}>Погодинна (T&M)</option>
                                <option value="custom" ${terms?.commercial_model === 'custom' ? 'selected' : ''}>Індивідуальна</option>
                            </select>
                        </div>
                        <div class="portal-form-group">
                            <label class="portal-form-label">Статус договору *</label>
                            <select class="portal-form-select" id="terms-status">
                                <option value="draft" ${terms?.contract_status === 'draft' ? 'selected' : ''}>Чернетка</option>
                                <option value="proposed" ${terms?.contract_status === 'proposed' ? 'selected' : ''}>Запропоновано</option>
                                <option value="active" ${terms?.contract_status === 'active' || !terms ? 'selected' : ''}>Активний</option>
                                <option value="completed" ${terms?.contract_status === 'completed' ? 'selected' : ''}>Завершено</option>
                                <option value="cancelled" ${terms?.contract_status === 'cancelled' ? 'selected' : ''}>Скасовано</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                        <div class="portal-form-group">
                            <label class="portal-form-label">Номер договору</label>
                            <input type="text" class="portal-form-input" id="terms-contract-number" value="${terms?.contract_number || ''}" placeholder="FW-2026-001">
                        </div>
                        <div class="portal-form-group">
                            <label class="portal-form-label">Дата договору</label>
                            <input type="date" class="portal-form-input" id="terms-contract-date" value="${terms?.contract_date || ''}">
                        </div>
                    </div>
                    <div class="portal-form-group" style="margin-bottom: 14px;">
                        <label class="portal-form-label">Умови оплати</label>
                        <textarea class="portal-form-input" id="terms-payment-text" rows="2" placeholder="Наприклад: 50% аванс, 50% після фінального погодження">${terms?.payment_terms_text || ''}</textarea>
                    </div>
                    <div class="portal-form-group" style="margin-bottom: 20px;">
                        <label class="portal-form-label">Внутрішні примітки</label>
                        <textarea class="portal-form-input" id="terms-notes" rows="2" placeholder="Службові коментарі">${terms?.notes || ''}</textarea>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button type="button" class="btn btn-outline" id="btn-cancel-terms">Скасувати</button>
                        <button type="submit" class="btn btn-primary" id="btn-save-terms">Зберегти умови</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const close = () => { mount.innerHTML = ""; };
    document.getElementById("btn-close-terms-modal")?.addEventListener("click", close);
    document.getElementById("btn-cancel-terms")?.addEventListener("click", close);

    document.getElementById("form-commercial-terms")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const contractValue = parseFloat(document.getElementById("terms-contract-value").value) || 0;
        const currency = document.getElementById("terms-currency").value;
        const commercialModel = document.getElementById("terms-model").value;
        const contractStatus = document.getElementById("terms-status").value;
        const contractNumber = document.getElementById("terms-contract-number").value.trim() || null;
        const contractDate = document.getElementById("terms-contract-date").value || null;
        const paymentTermsText = document.getElementById("terms-payment-text").value.trim() || null;
        const notes = document.getElementById("terms-notes").value.trim() || null;

        const payload = {
            project_id: projectId,
            contract_value_minor: Math.round(contractValue * 100),
            currency,
            commercial_model: commercialModel,
            contract_status: contractStatus,
            contract_number: contractNumber,
            contract_date: contractDate,
            payment_terms_text: paymentTermsText,
            notes
        };

        const { error } = await DataClient.upsertProjectCommercialTerms(payload);
        if (error) {
            alert("Помилка збереження: " + error.message);
        } else {
            close();
            loadAndRenderProjectFinance(projectId);
        }
    });
}

function openTrancheModal(projectId, tranche, defaultCurrency) {
    const mount = document.getElementById("project-detail-modal-mount");
    if (!mount) return;

    mount.innerHTML = `
        <div class="portal-modal-backdrop">
            <div class="portal-modal" style="max-width: 480px;">
                <div class="portal-modal-header">
                    <h3 class="portal-modal-title">${tranche ? 'Редагувати плановий транш' : 'Додати новий плановий транш'}</h3>
                    <button class="portal-modal-close" id="btn-close-tranche-modal">&times;</button>
                </div>
                <form id="form-tranche" style="padding: 20px;">
                    <div class="portal-form-group" style="margin-bottom: 14px;">
                        <label class="portal-form-label">Назва етапу / траншу *</label>
                        <input type="text" class="portal-form-input" id="tranche-title" required value="${tranche?.title || ''}" placeholder="Транш 1: Аванс 50%">
                    </div>
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 14px;">
                        <div class="portal-form-group">
                            <label class="portal-form-label">Сума траншу *</label>
                            <input type="number" step="1" min="1" class="portal-form-input" id="tranche-amount" required value="${tranche ? Math.round(tranche.amount_minor / 100) : ''}" placeholder="40000">
                        </div>
                        <div class="portal-form-group">
                            <label class="portal-form-label">Валюта *</label>
                            <select class="portal-form-select" id="tranche-currency">
                                <option value="CZK" ${tranche?.currency === 'CZK' || defaultCurrency === 'CZK' ? 'selected' : ''}>CZK</option>
                                <option value="UAH" ${tranche?.currency === 'UAH' || defaultCurrency === 'UAH' ? 'selected' : ''}>UAH</option>
                                <option value="EUR" ${tranche?.currency === 'EUR' || defaultCurrency === 'EUR' ? 'selected' : ''}>EUR</option>
                                <option value="USD" ${tranche?.currency === 'USD' || defaultCurrency === 'USD' ? 'selected' : ''}>USD</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                        <div class="portal-form-group">
                            <label class="portal-form-label">Планова дата оплати *</label>
                            <input type="date" class="portal-form-input" id="tranche-due-date" required value="${tranche?.due_date || new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="portal-form-group">
                            <label class="portal-form-label">Порядковий номер</label>
                            <input type="number" class="portal-form-input" id="tranche-sort" value="${tranche?.sort_order || 1}">
                        </div>
                    </div>
                    <div class="portal-form-group" style="margin-bottom: 20px;">
                        <label class="portal-form-label">Примітки</label>
                        <textarea class="portal-form-input" id="tranche-notes" rows="2" placeholder="Опис умов сплати траншу">${tranche?.notes || ''}</textarea>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button type="button" class="btn btn-outline" id="btn-cancel-tranche">Скасувати</button>
                        <button type="submit" class="btn btn-primary">Зберегти транш</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const close = () => { mount.innerHTML = ""; };
    document.getElementById("btn-close-tranche-modal")?.addEventListener("click", close);
    document.getElementById("btn-cancel-tranche")?.addEventListener("click", close);

    document.getElementById("form-tranche")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("tranche-title").value.trim();
        const amount = parseFloat(document.getElementById("tranche-amount").value);
        const currency = document.getElementById("tranche-currency").value;
        const dueDate = document.getElementById("tranche-due-date").value;
        const sortOrder = parseInt(document.getElementById("tranche-sort").value, 10) || 1;
        const notes = document.getElementById("tranche-notes").value.trim() || null;

        const payload = {
            project_id: projectId,
            title,
            amount_minor: Math.round(amount * 100),
            currency,
            due_date: dueDate,
            sort_order: sortOrder,
            notes
        };

        let res;
        if (tranche) {
            res = await DataClient.updatePaymentScheduleTranche(tranche.id, payload);
        } else {
            res = await DataClient.createPaymentScheduleTranche(payload);
        }

        if (res.error) {
            alert("Помилка збереження: " + res.error.message);
        } else {
            close();
            loadAndRenderProjectFinance(projectId);
        }
    });
}

function openRecordPaymentModal(projectId, schedule, preselectedTranche, defaultCurrency) {
    const mount = document.getElementById("project-detail-modal-mount");
    if (!mount) return;

    const activeTranches = schedule.filter(s => s.status !== 'cancelled' && s.status !== 'paid');
    const targetTrancheId = preselectedTranche?.id || (activeTranches[0]?.id || "");
    const defaultAmount = preselectedTranche?.remainderMinor ? (preselectedTranche.remainderMinor / 100) : "";

    mount.innerHTML = `
        <div class="portal-modal-backdrop">
            <div class="portal-modal" style="max-width: 500px;">
                <div class="portal-modal-header">
                    <h3 class="portal-modal-title">Зафіксувати отриману оплату</h3>
                    <button class="portal-modal-close" id="btn-close-payment-modal">&times;</button>
                </div>
                <form id="form-record-payment" style="padding: 20px;">
                    <div class="portal-form-group" style="margin-bottom: 14px;">
                        <label class="portal-form-label">Пов'язаний транш із графіка</label>
                        <select class="portal-form-select" id="payment-schedule-id">
                            <option value="">Без прив'язки (довільний платіж)</option>
                            ${schedule.map(s => `
                                <option value="${s.id}" ${s.id === targetTrancheId ? 'selected' : ''}>
                                    ${s.title} (${DataClient.formatMoney(s.amount_minor, s.currency)}) — ${s.status}
                                </option>
                            `).join("")}
                        </select>
                    </div>
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 14px;">
                        <div class="portal-form-group">
                            <label class="portal-form-label">Сума оплати *</label>
                            <input type="number" step="1" min="1" class="portal-form-input" id="payment-amount" required value="${defaultAmount}" placeholder="40000">
                        </div>
                        <div class="portal-form-group">
                            <label class="portal-form-label">Валюта *</label>
                            <select class="portal-form-select" id="payment-currency">
                                <option value="CZK" ${defaultCurrency === 'CZK' ? 'selected' : ''}>CZK</option>
                                <option value="UAH" ${defaultCurrency === 'UAH' ? 'selected' : ''}>UAH</option>
                                <option value="EUR" ${defaultCurrency === 'EUR' ? 'selected' : ''}>EUR</option>
                                <option value="USD" ${defaultCurrency === 'USD' ? 'selected' : ''}>USD</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                        <div class="portal-form-group">
                            <label class="portal-form-label">Дата та час зарахування *</label>
                            <input type="datetime-local" class="portal-form-input" id="payment-paid-at" required value="${new Date().toISOString().slice(0, 16)}">
                        </div>
                        <div class="portal-form-group">
                            <label class="portal-form-label">Спосіб оплати *</label>
                            <select class="portal-form-select" id="payment-method">
                                <option value="bank_transfer" selected>Банківський переказ (IBAN)</option>
                                <option value="card">Банківська картка</option>
                                <option value="cash">Готівка</option>
                                <option value="crypto">Криптовалюта</option>
                                <option value="other">Інше</option>
                            </select>
                        </div>
                    </div>
                    <div class="portal-form-group" style="margin-bottom: 14px;">
                        <label class="portal-form-label">Номер платіжки / Reference</label>
                        <input type="text" class="portal-form-input" id="payment-ref" placeholder="INV-2026-081 або ID транзакції">
                    </div>
                    <div class="portal-form-group" style="margin-bottom: 20px;">
                        <label class="portal-form-label">Коментар</label>
                        <textarea class="portal-form-input" id="payment-comment" rows="2" placeholder="Додаткові відомості про платіж"></textarea>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button type="button" class="btn btn-outline" id="btn-cancel-payment">Скасувати</button>
                        <button type="submit" class="btn btn-primary" style="background: var(--color-success); border-color: var(--color-success);">
                            <i data-lucide="check" style="width: 14px; height: 14px;"></i> Зафіксувати оплату
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const close = () => { mount.innerHTML = ""; };
    document.getElementById("btn-close-payment-modal")?.addEventListener("click", close);
    document.getElementById("btn-cancel-payment")?.addEventListener("click", close);

    document.getElementById("form-record-payment")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const scheduleId = document.getElementById("payment-schedule-id").value || null;
        const amount = parseFloat(document.getElementById("payment-amount").value);
        const currency = document.getElementById("payment-currency").value;
        const paidAt = new Date(document.getElementById("payment-paid-at").value).toISOString();
        const paymentMethod = document.getElementById("payment-method").value;
        const reference = document.getElementById("payment-ref").value.trim() || null;
        const comment = document.getElementById("payment-comment").value.trim() || null;

        const payload = {
            project_id: projectId,
            payment_schedule_id: scheduleId,
            amount_minor: Math.round(amount * 100),
            currency,
            paid_at: paidAt,
            payment_method: paymentMethod,
            reference,
            comment
        };

        const res = await DataClient.createProjectPayment(payload);
        if (res.error) {
            alert("Помилка фіксації оплати: " + res.error.message);
        } else {
            close();
            loadAndRenderProjectFinance(projectId);
        }
    });
}

function openCostModal(projectId, cost, defaultCurrency) {
    const mount = document.getElementById("project-detail-modal-mount");
    if (!mount) return;

    mount.innerHTML = `
        <div class="portal-modal-backdrop">
            <div class="portal-modal" style="max-width: 500px;">
                <div class="portal-modal-header">
                    <h3 class="portal-modal-title">${cost ? 'Редагувати внутрішню витрату' : 'Додати внутрішню витрату (Owner Only)'}</h3>
                    <button class="portal-modal-close" id="btn-close-cost-modal">&times;</button>
                </div>
                <form id="form-cost" style="padding: 20px;">
                    <div class="portal-form-group" style="margin-bottom: 14px;">
                        <label class="portal-form-label">Назва витрати *</label>
                        <input type="text" class="portal-form-input" id="cost-title" required value="${cost?.title || ''}" placeholder="Оплата роботи спеціаліста">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                        <div class="portal-form-group">
                            <label class="portal-form-label">Категорія *</label>
                            <select class="portal-form-select" id="cost-category">
                                <option value="specialist" ${cost?.category === 'specialist' ? 'selected' : ''}>Спеціаліст / команда</option>
                                <option value="software" ${cost?.category === 'software' ? 'selected' : ''}>ПЗ та сервіси</option>
                                <option value="contractor" ${cost?.category === 'contractor' ? 'selected' : ''}>Підрядники</option>
                                <option value="marketing" ${cost?.category === 'marketing' ? 'selected' : ''}>Маркетинг</option>
                                <option value="travel" ${cost?.category === 'travel' ? 'selected' : ''}>Відрядження</option>
                                <option value="infrastructure" ${cost?.category === 'infrastructure' ? 'selected' : ''}>Інфраструктура</option>
                                <option value="other" ${cost?.category === 'other' ? 'selected' : ''}>Інше</option>
                            </select>
                        </div>
                        <div class="portal-form-group">
                            <label class="portal-form-label">Тип витрати *</label>
                            <select class="portal-form-select" id="cost-type">
                                <option value="planned" ${cost?.cost_type === 'planned' ? 'selected' : ''}>Планова (Бюджет)</option>
                                <option value="actual" ${cost?.cost_type === 'actual' ? 'selected' : ''}>Фактична (Понесена)</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 14px;">
                        <div class="portal-form-group">
                            <label class="portal-form-label">Сума *</label>
                            <input type="number" step="1" min="1" class="portal-form-input" id="cost-amount" required value="${cost ? Math.round(cost.amount_minor / 100) : ''}" placeholder="15000">
                        </div>
                        <div class="portal-form-group">
                            <label class="portal-form-label">Валюта *</label>
                            <select class="portal-form-select" id="cost-currency">
                                <option value="CZK" ${cost?.currency === 'CZK' || defaultCurrency === 'CZK' ? 'selected' : ''}>CZK</option>
                                <option value="UAH" ${cost?.currency === 'UAH' || defaultCurrency === 'UAH' ? 'selected' : ''}>UAH</option>
                                <option value="EUR" ${cost?.currency === 'EUR' || defaultCurrency === 'EUR' ? 'selected' : ''}>EUR</option>
                                <option value="USD" ${cost?.currency === 'USD' || defaultCurrency === 'USD' ? 'selected' : ''}>USD</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                        <div class="portal-form-group">
                            <label class="portal-form-label">Дата витрати</label>
                            <input type="date" class="portal-form-input" id="cost-date" value="${cost?.incurred_at || new Date().toISOString().split('T')[0]}">
                        </div>
                        <div class="portal-form-group">
                            <label class="portal-form-label">Отримувач / Підрядник</label>
                            <input type="text" class="portal-form-input" id="cost-vendor" value="${cost?.vendor_or_recipient || ''}" placeholder="Олексій (Спеціаліст)">
                        </div>
                    </div>
                    <div class="portal-form-group" style="margin-bottom: 20px;">
                        <label class="portal-form-label">Примітки</label>
                        <textarea class="portal-form-input" id="cost-notes" rows="2" placeholder="Службовий опис витрати">${cost?.notes || ''}</textarea>
                    </div>
                    <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button type="button" class="btn btn-outline" id="btn-cancel-cost">Скасувати</button>
                        <button type="submit" class="btn btn-primary">Зберегти витрату</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const close = () => { mount.innerHTML = ""; };
    document.getElementById("btn-close-cost-modal")?.addEventListener("click", close);
    document.getElementById("btn-cancel-cost")?.addEventListener("click", close);

    document.getElementById("form-cost")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("cost-title").value.trim();
        const category = document.getElementById("cost-category").value;
        const costType = document.getElementById("cost-type").value;
        const amount = parseFloat(document.getElementById("cost-amount").value);
        const currency = document.getElementById("cost-currency").value;
        const incurredAt = document.getElementById("cost-date").value || null;
        const vendor = document.getElementById("cost-vendor").value.trim() || null;
        const notes = document.getElementById("cost-notes").value.trim() || null;

        const payload = {
            project_id: projectId,
            title,
            category,
            cost_type: costType,
            amount_minor: Math.round(amount * 100),
            currency,
            incurred_at: incurredAt,
            vendor_or_recipient: vendor,
            notes
        };

        let res;
        if (cost) {
            res = await DataClient.updateProjectCost(cost.id, payload);
        } else {
            res = await DataClient.createProjectCost(payload);
        }

        if (res.error) {
            alert("Помилка збереження: " + res.error.message);
        } else {
            close();
            loadAndRenderProjectFinance(projectId);
        }
    });
}
