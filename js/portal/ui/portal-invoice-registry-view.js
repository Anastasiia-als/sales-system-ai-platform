/* js/portal/ui/portal-invoice-registry-view.js - Invoice Registry (Phase 5C.2) */

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

let registryState = {
    search: "",
    clientId: "all",
    projectId: "all",
    currency: "all",
    status: "all",
    overdueOnly: false,
    sortBy: "newest"
};

export function renderInvoiceRegistryView() {
    return `
        <div class="portal-content" id="invoice-registry-root">
            <div class="portal-loading-container" style="padding: 40px;">
                <div class="portal-spinner"></div>
                <span>Завантаження реєстру рахунків...</span>
            </div>
        </div>
    `;
}

export async function initInvoiceRegistryEvents() {
    await loadInvoiceRegistry();
}

async function loadInvoiceRegistry() {
    const root = document.getElementById("invoice-registry-root");
    if (!root) return;

    try {
        const isOwner = PortalAuth.isGlobalOwner();
        const [invoices, clientsRes, projectsRes, billingProfiles] = await Promise.all([
            DataClient.getInvoices(),
            DataClient.getOrganizations(),
            DataClient.getProjects(),
            DataClient.getBillingProfiles()
        ]);

        const clients = Array.isArray(clientsRes) ? clientsRes : (clientsRes?.data || []);
        const projects = Array.isArray(projectsRes) ? projectsRes : (projectsRes?.data || []);

        const clientsMap = new Map(clients.map(c => [c.id, c.name]));
        const projectsMap = new Map(projects.map(p => [p.id, p]));

        // Filter and calculate totals
        const today = new Date().toISOString().split("T")[0];
        const todayDate = new Date(today);

        const filteredInvoices = invoices.filter(inv => {
            if (registryState.search) {
                const q = registryState.search.toLowerCase();
                const num = (inv.invoice_number || "draft").toLowerCase();
                const orgName = (inv.projects?.organizations?.name || "").toLowerCase();
                const projTitle = (inv.projects?.title || "").toLowerCase();
                if (!num.includes(q) && !orgName.includes(q) && !projTitle.includes(q)) return false;
            }
            if (registryState.clientId !== "all" && inv.organization_id !== registryState.clientId) return false;
            if (registryState.projectId !== "all" && inv.project_id !== registryState.projectId) return false;
            if (registryState.currency !== "all" && inv.currency !== registryState.currency) return false;
            if (registryState.status !== "all" && inv.status !== registryState.status) return false;
            if (registryState.overdueOnly) {
                const total = Number(inv.total_minor || 0);
                const paid = Number(inv.paid_minor || 0);
                const isOverdue = (total - paid > 0) && new Date(inv.due_date) < todayDate && inv.status !== "cancelled";
                if (!isOverdue) return false;
            }
            return true;
        });

        // Sorting
        filteredInvoices.sort((a, b) => {
            if (registryState.sortBy === "newest") return new Date(b.created_at) - new Date(a.created_at);
            if (registryState.sortBy === "due_soon") return new Date(a.due_date) - new Date(b.due_date);
            if (registryState.sortBy === "amount") return Number(b.total_minor) - Number(a.total_minor);
            return 0;
        });

        // Multi-currency Top KPI Summaries
        const currencySummaries = {};
        invoices.forEach(inv => {
            if (inv.status === "cancelled") return;
            const c = inv.currency || "CZK";
            if (!currencySummaries[c]) {
                currencySummaries[c] = { invoiced: 0, collected: 0, outstanding: 0, overdue: 0, count: 0 };
            }
            const total = Number(inv.total_minor || 0);
            const paid = Number(inv.paid_minor || 0);
            const out = Math.max(total - paid, 0);
            currencySummaries[c].invoiced += total;
            currencySummaries[c].collected += paid;
            currencySummaries[c].outstanding += out;
            if (out > 0 && new Date(inv.due_date) < todayDate) {
                currencySummaries[c].overdue += out;
            }
            currencySummaries[c].count += 1;
        });

        const currencies = Object.keys(currencySummaries);

        root.innerHTML = `
            <div class="portal-header-row" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
                <div>
                    <h1 class="portal-page-title" style="display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="file-text" style="color: var(--color-primary);"></i>
                        Реєстр рахунків (Invoices)
                    </h1>
                    <p class="portal-page-subtitle">
                        Виставлення, контроль оплати та статус рахунків для клієнтів.
                    </p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <a href="#/portal/finance" class="btn btn-outline">
                        <i data-lucide="pie-chart"></i> Дебіторка / AR
                    </a>
                    <button class="btn btn-primary" id="btn-open-create-invoice">
                        <i data-lucide="plus-circle"></i> Створити рахунок
                    </button>
                </div>
            </div>

            <!-- Currency Aggregation KPI Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; margin-bottom: 20px;">
                ${currencies.map(curr => {
                    const agg = currencySummaries[curr];
                    return `
                        <div class="portal-card" style="padding: 16px; border-top: 3px solid var(--color-primary);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-color);">Валюта: ${curr}</span>
                                <span class="portal-badge portal-badge-neutral" style="font-size: 0.72rem;">${agg.count} рахунків</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                <div>
                                    <div class="portal-kpi-label">Виставлено</div>
                                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--color-primary);">${DataClient.formatMoney(agg.invoiced, curr)}</div>
                                </div>
                                <div>
                                    <div class="portal-kpi-label">Отримано</div>
                                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--color-success);">${DataClient.formatMoney(agg.collected, curr)}</div>
                                </div>
                                <div>
                                    <div class="portal-kpi-label">Очікується</div>
                                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--color-warning);">${DataClient.formatMoney(agg.outstanding, curr)}</div>
                                </div>
                                <div>
                                    <div class="portal-kpi-label">Прострочено</div>
                                    <div style="font-weight: 700; font-size: 0.95rem; color: ${agg.overdue > 0 ? 'var(--color-danger)' : 'var(--text-muted)'};">
                                        ${agg.overdue > 0 ? DataClient.formatMoney(agg.overdue, curr) : '0 ' + curr}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>

            <!-- Filters Toolbar -->
            <div class="portal-card" style="margin-bottom: 20px; padding: 14px;">
                <div class="finance-toolbar-grid">
                    <div>
                        <input type="text" class="portal-form-input" id="inv-filter-search"
                            placeholder="Пошук за номером, клієнтом або проєктом..." value="${escapeHtml(registryState.search)}" style="width: 100%;">
                    </div>
                    <div>
                        <select class="portal-form-select" id="inv-filter-client" style="width: 100%;">
                            <option value="all">Всі клієнти</option>
                            ${Array.from(clientsMap.entries()).map(([id, name]) => `
                                <option value="${id}" ${registryState.clientId === id ? 'selected' : ''}>${escapeHtml(name)}</option>
                            `).join("")}
                        </select>
                    </div>
                    <div>
                        <select class="portal-form-select" id="inv-filter-currency" style="width: 100%;">
                            <option value="all" ${registryState.currency === 'all' ? 'selected' : ''}>Всі валюти</option>
                            <option value="CZK" ${registryState.currency === 'CZK' ? 'selected' : ''}>CZK</option>
                            <option value="UAH" ${registryState.currency === 'UAH' ? 'selected' : ''}>UAH</option>
                            <option value="EUR" ${registryState.currency === 'EUR' ? 'selected' : ''}>EUR</option>
                        </select>
                    </div>
                    <div>
                        <select class="portal-form-select" id="inv-filter-status" style="width: 100%;">
                            <option value="all" ${registryState.status === 'all' ? 'selected' : ''}>Всі статуси</option>
                            <option value="draft" ${registryState.status === 'draft' ? 'selected' : ''}>Чернетка (Draft)</option>
                            <option value="issued" ${registryState.status === 'issued' ? 'selected' : ''}>Виставлено (Issued)</option>
                            <option value="sent" ${registryState.status === 'sent' ? 'selected' : ''}>Відправлено (Sent)</option>
                            <option value="viewed" ${registryState.status === 'viewed' ? 'selected' : ''}>Переглянуто (Viewed)</option>
                            <option value="partially_paid" ${registryState.status === 'partially_paid' ? 'selected' : ''}>Частково оплачено</option>
                            <option value="paid" ${registryState.status === 'paid' ? 'selected' : ''}>Оплачено (Paid)</option>
                            <option value="overdue" ${registryState.status === 'overdue' ? 'selected' : ''}>Прострочено (Overdue)</option>
                            <option value="cancelled" ${registryState.status === 'cancelled' ? 'selected' : ''}>Скасовано (Cancelled)</option>
                        </select>
                    </div>
                    <div>
                        <select class="portal-form-select" id="inv-sort-by" style="width: 100%;">
                            <option value="newest" ${registryState.sortBy === 'newest' ? 'selected' : ''}>Найновіші</option>
                            <option value="due_soon" ${registryState.sortBy === 'due_soon' ? 'selected' : ''}>Термін оплати</option>
                            <option value="amount" ${registryState.sortBy === 'amount' ? 'selected' : ''}>За сумою</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Invoices Table -->
            <div class="portal-card" style="padding: 0; overflow: hidden;">
                ${filteredInvoices.length === 0 ? `
                    <div class="portal-empty-state" style="padding: 40px; text-align: center;">
                        <div class="portal-empty-icon" style="margin-bottom: 12px; color: var(--text-muted);"><i data-lucide="file-x"></i></div>
                        <div class="portal-empty-title" style="font-size: 1.1rem; font-weight: 600;">Рахунків не знайдено</div>
                        <div class="portal-empty-desc" style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">Спробуйте змінити фільтри або створіть новий рахунок.</div>
                    </div>
                ` : `
                    <div class="table-responsive">
                        <table class="portal-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr>
                                    <th>Рахунок №</th>
                                    <th>Клієнт / Проєкт</th>
                                    <th>Дата / Термін</th>
                                    <th>Сума</th>
                                    <th>Оплачено</th>
                                    <th>Залишок</th>
                                    <th>Статус</th>
                                    <th style="text-align: right;">Дії</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredInvoices.map(inv => {
                                    const total = Number(inv.total_minor || 0);
                                    const paid = Number(inv.paid_minor || 0);
                                    const outstanding = Math.max(total - paid, 0);
                                    const isDraft = inv.status === "draft";
                                    const dueDate = new Date(inv.due_date);
                                    const isOverdue = outstanding > 0 && dueDate < todayDate && inv.status !== "cancelled";

                                    let badgeCls = "portal-badge-neutral";
                                    let badgeLabel = inv.status;
                                    if (inv.status === "draft") { badgeCls = "portal-badge-neutral"; badgeLabel = "Чернетка"; }
                                    else if (inv.status === "issued") { badgeCls = "portal-badge-info"; badgeLabel = "Виставлено"; }
                                    else if (inv.status === "sent") { badgeCls = "portal-badge-info"; badgeLabel = "Відправлено"; }
                                    else if (inv.status === "viewed") { badgeCls = "portal-badge-info"; badgeLabel = "Переглянуто"; }
                                    else if (inv.status === "partially_paid") { badgeCls = "portal-badge-warning"; badgeLabel = "Частково"; }
                                    else if (inv.status === "paid") { badgeCls = "portal-badge-success"; badgeLabel = "Оплачено"; }
                                    else if (inv.status === "overdue" || isOverdue) { badgeCls = "portal-badge-danger"; badgeLabel = "Прострочено"; }
                                    else if (inv.status === "cancelled") { badgeCls = "portal-badge-neutral"; badgeLabel = "Скасовано"; }

                                    return `
                                        <tr>
                                            <td>
                                                <a href="#/portal/invoices/${inv.id}" class="portal-table-link" style="font-weight: 700;">
                                                    ${isDraft ? '<span style="color: var(--text-muted);">[Чернетка]</span>' : escapeHtml(inv.invoice_number || 'б/н')}
                                                </a>
                                            </td>
                                            <td>
                                                <a href="#/portal/clients/${inv.organization_id}" class="portal-table-sublink" style="font-weight: 600;">
                                                    ${escapeHtml(inv.projects?.organizations?.name || "Клієнт")}
                                                </a>
                                                <div style="font-size: 0.78rem; color: var(--text-muted);">
                                                    <a href="#/portal/projects/${inv.project_id}" class="portal-table-sublink">
                                                        ${escapeHtml(inv.projects?.title || "Проєкт")}
                                                    </a>
                                                </div>
                                            </td>
                                            <td>
                                                <div style="font-size: 0.85rem; color: var(--text-primary); font-weight: 500;">
                                                    ${inv.issue_date}
                                                </div>
                                                <div style="font-size: 0.78rem; color: ${isOverdue ? 'var(--color-danger)' : 'var(--text-muted)'}; font-weight: ${isOverdue ? '600' : 'normal'};">
                                                    до ${inv.due_date} ${isOverdue ? '⚠️' : ''}
                                                </div>
                                            </td>
                                            <td>
                                                <div style="font-weight: 700; font-size: 0.92rem; color: var(--text-primary);">
                                                    ${DataClient.formatMoney(total, inv.currency)}
                                                </div>
                                            </td>
                                            <td>
                                                <div style="font-weight: 600; font-size: 0.88rem; color: ${paid > 0 ? 'var(--color-success)' : 'var(--text-muted)'};">
                                                    ${DataClient.formatMoney(paid, inv.currency)}
                                                </div>
                                            </td>
                                            <td>
                                                <div style="font-weight: 700; font-size: 0.88rem; color: ${outstanding > 0 ? 'var(--color-warning)' : 'var(--text-muted)'};">
                                                    ${DataClient.formatMoney(outstanding, inv.currency)}
                                                </div>
                                            </td>
                                            <td>
                                                <span class="portal-badge ${badgeCls}">${badgeLabel}</span>
                                            </td>
                                            <td style="text-align: right;">
                                                <div style="display: inline-flex; gap: 6px;">
                                                    <a href="#/portal/invoices/${inv.id}" class="btn btn-outline btn-xs" title="Відкрити рахунок">
                                                        <i data-lucide="eye"></i>
                                                    </a>
                                                    ${!isDraft && inv.status !== 'cancelled' ? `
                                                        <a href="#/portal/invoices/${inv.id}/print" target="_blank" class="btn btn-outline btn-xs" title="Друк / PDF">
                                                            <i data-lucide="printer"></i>
                                                        </a>
                                                    ` : ''}
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join("")}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>

            <!-- Create Invoice Modal Placeholder -->
            <div id="invoice-modal-root"></div>
        `;

        if (window.lucide) window.lucide.createIcons();
        attachRegistryEvents(projects, clients, billingProfiles);
    } catch (err) {
        console.error("[InvoiceRegistry] Error:", err);
        root.innerHTML = `
            <div class="portal-empty-state" style="padding: 40px; text-align: center;">
                <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                <div class="portal-empty-title">Помилка завантаження рахунків</div>
                <div class="portal-empty-desc">${err?.message || "Спробуйте оновити сторінку."}</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}

function attachRegistryEvents(projects, clients, billingProfiles) {
    const searchInput = document.getElementById("inv-filter-search");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            registryState.search = e.target.value;
            loadInvoiceRegistry();
        });
    }

    const clientSelect = document.getElementById("inv-filter-client");
    if (clientSelect) {
        clientSelect.addEventListener("change", (e) => {
            registryState.clientId = e.target.value;
            loadInvoiceRegistry();
        });
    }

    const currSelect = document.getElementById("inv-filter-currency");
    if (currSelect) {
        currSelect.addEventListener("change", (e) => {
            registryState.currency = e.target.value;
            loadInvoiceRegistry();
        });
    }

    const statusSelect = document.getElementById("inv-filter-status");
    if (statusSelect) {
        statusSelect.addEventListener("change", (e) => {
            registryState.status = e.target.value;
            loadInvoiceRegistry();
        });
    }

    const sortSelect = document.getElementById("inv-sort-by");
    if (sortSelect) {
        sortSelect.addEventListener("change", (e) => {
            registryState.sortBy = e.target.value;
            loadInvoiceRegistry();
        });
    }

    const btnCreate = document.getElementById("btn-open-create-invoice");
    if (btnCreate) {
        btnCreate.addEventListener("click", () => {
            openCreateInvoiceModal(projects, clients, billingProfiles);
        });
    }
}

function openCreateInvoiceModal(projects, clients, billingProfiles) {
    const modalRoot = document.getElementById("invoice-modal-root");
    if (!modalRoot) return;

    let items = [
        { description: "Послуги консалтингу та налаштування CRM", quantity: 1, unit_price_minor: 5000000, tax_rate: 0 }
    ];

    const todayStr = new Date().toISOString().split("T")[0];
    const dueStr = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const renderModalContent = () => {
        modalRoot.innerHTML = `
            <div class="portal-modal-backdrop" id="modal-invoice-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;">
                <div class="portal-card" style="width: 100%; max-width: 780px; max-height: 90vh; overflow-y: auto; padding: 24px; position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                        <h2 style="font-size: 1.25rem; font-weight: 700; margin: 0;">Створити рахунок (Invoice)</h2>
                        <button class="btn btn-outline btn-xs" id="btn-close-inv-modal"><i data-lucide="x"></i></button>
                    </div>

                    <form id="create-invoice-form" style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                            <div>
                                <label class="portal-label">Проєкт *</label>
                                <select class="portal-form-select" id="inv-modal-project" required style="width: 100%;">
                                    <option value="">Оберіть проєкт...</option>
                                    ${projects.map(p => `
                                        <option value="${p.id}" data-org="${p.organization_id}">${escapeHtml(p.title)} (${escapeHtml(p.organizations?.name || "Клієнт")})</option>
                                    `).join("")}
                                </select>
                            </div>
                            <div>
                                <label class="portal-label">Реквізити сторони (Billing Profile) *</label>
                                <select class="portal-form-select" id="inv-modal-profile" required style="width: 100%;">
                                    ${billingProfiles.map(bp => `
                                        <option value="${bp.id}">${escapeHtml(bp.name)} (${bp.default_currency} - ${escapeHtml(bp.iban)})</option>
                                    `).join("")}
                                </select>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;">
                            <div>
                                <label class="portal-label">Валюта *</label>
                                <select class="portal-form-select" id="inv-modal-currency" style="width: 100%;">
                                    <option value="CZK">CZK</option>
                                    <option value="UAH">UAH</option>
                                    <option value="EUR">EUR</option>
                                    <option value="USD">USD</option>
                                    <option value="PLN">PLN</option>
                                </select>
                            </div>
                            <div>
                                <label class="portal-label">Дата виставлення *</label>
                                <input type="date" class="portal-form-input" id="inv-modal-issue-date" value="${todayStr}" required style="width: 100%;">
                            </div>
                            <div>
                                <label class="portal-label">Термін оплати (Due date) *</label>
                                <input type="date" class="portal-form-input" id="inv-modal-due-date" value="${dueStr}" required style="width: 100%;">
                            </div>
                        </div>

                        <!-- Line Items -->
                        <div style="margin-top: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <label class="portal-label" style="margin: 0; font-weight: 700;">Позиції рахунку (Line items)</label>
                                <button type="button" class="btn btn-outline btn-xs" id="btn-add-line-item">
                                    <i data-lucide="plus"></i> Додати позицію
                                </button>
                            </div>

                            <div style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
                                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                                    <thead style="background: rgba(255,255,255,0.03);">
                                        <tr>
                                            <th style="padding: 8px 12px; text-align: left;">Опис</th>
                                            <th style="padding: 8px 12px; width: 80px; text-align: right;">К-сть</th>
                                            <th style="padding: 8px 12px; width: 140px; text-align: right;">Ціна (од.)</th>
                                            <th style="padding: 8px 12px; width: 80px; text-align: right;">ПДВ %</th>
                                            <th style="padding: 8px 12px; width: 130px; text-align: right;">Сума</th>
                                            <th style="padding: 8px; width: 40px;"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="inv-items-tbody">
                                        ${items.map((it, idx) => {
                                            const sub = it.quantity * (it.unit_price_minor / 100);
                                            const tax = sub * (it.tax_rate / 100);
                                            const tot = sub + tax;
                                            return `
                                                <tr style="border-top: 1px solid var(--border-color);">
                                                    <td style="padding: 6px 12px;">
                                                        <input type="text" class="portal-form-input item-desc" data-idx="${idx}" value="${escapeHtml(it.description)}" required style="width: 100%; font-size: 0.85rem;">
                                                    </td>
                                                    <td style="padding: 6px 12px;">
                                                        <input type="number" step="0.5" min="0.5" class="portal-form-input item-qty" data-idx="${idx}" value="${it.quantity}" required style="width: 100%; text-align: right; font-size: 0.85rem;">
                                                    </td>
                                                    <td style="padding: 6px 12px;">
                                                        <input type="number" step="1" min="0" class="portal-form-input item-price" data-idx="${idx}" value="${it.unit_price_minor / 100}" required style="width: 100%; text-align: right; font-size: 0.85rem;">
                                                    </td>
                                                    <td style="padding: 6px 12px;">
                                                        <input type="number" step="1" min="0" max="100" class="portal-form-input item-tax" data-idx="${idx}" value="${it.tax_rate}" style="width: 100%; text-align: right; font-size: 0.85rem;">
                                                    </td>
                                                    <td style="padding: 6px 12px; text-align: right; font-weight: 700;">
                                                        ${tot.toLocaleString('uk-UA', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td style="padding: 6px; text-align: center;">
                                                        ${items.length > 1 ? `
                                                            <button type="button" class="btn-remove-item" data-idx="${idx}" style="background: none; border: none; color: var(--color-danger); cursor: pointer;"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                                                        ` : ''}
                                                    </td>
                                                </tr>
                                            `;
                                        }).join("")}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 14px;">
                            <button type="button" class="btn btn-outline" id="btn-cancel-inv-modal">Скасувати</button>
                            <button type="submit" class="btn btn-primary" id="btn-submit-create-inv">
                                <i data-lucide="save"></i> Створити чернетку (Draft)
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();

        // Modal Close handlers
        document.getElementById("btn-close-inv-modal")?.addEventListener("click", () => { modalRoot.innerHTML = ""; });
        document.getElementById("btn-cancel-inv-modal")?.addEventListener("click", () => { modalRoot.innerHTML = ""; });

        // Add line item
        document.getElementById("btn-add-line-item")?.addEventListener("click", () => {
            items.push({ description: "Послуги аудиту / розробки", quantity: 1, unit_price_minor: 1000000, tax_rate: 0 });
            renderModalContent();
        });

        // Remove line item
        document.querySelectorAll(".btn-remove-item").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const idx = Number(e.currentTarget.getAttribute("data-idx"));
                items.splice(idx, 1);
                renderModalContent();
            });
        });

        // Sync inputs
        document.querySelectorAll(".item-desc").forEach(inp => {
            inp.addEventListener("change", (e) => {
                const idx = Number(e.target.getAttribute("data-idx"));
                items[idx].description = e.target.value;
            });
        });
        document.querySelectorAll(".item-qty").forEach(inp => {
            inp.addEventListener("input", (e) => {
                const idx = Number(e.target.getAttribute("data-idx"));
                items[idx].quantity = Number(e.target.value || 1);
            });
        });
        document.querySelectorAll(".item-price").forEach(inp => {
            inp.addEventListener("input", (e) => {
                const idx = Number(e.target.getAttribute("data-idx"));
                items[idx].unit_price_minor = Math.round(Number(e.target.value || 0) * 100);
            });
        });
        document.querySelectorAll(".item-tax").forEach(inp => {
            inp.addEventListener("input", (e) => {
                const idx = Number(e.target.getAttribute("data-idx"));
                items[idx].tax_rate = Number(e.target.value || 0);
            });
        });

        // Submit Form
        document.getElementById("create-invoice-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const projSelect = document.getElementById("inv-modal-project");
            const selectedOpt = projSelect.options[projSelect.selectedIndex];
            const projId = projSelect.value;
            const orgId = selectedOpt?.getAttribute("data-org");
            const profileId = document.getElementById("inv-modal-profile").value;
            const currency = document.getElementById("inv-modal-currency").value;
            const issueDate = document.getElementById("inv-modal-issue-date").value;
            const dueDate = document.getElementById("inv-modal-due-date").value;

            if (!projId || !orgId) {
                alert("Будь ласка, оберіть проєкт.");
                return;
            }

            try {
                const submitBtn = document.getElementById("btn-submit-create-inv");
                if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = "Збереження..."; }

                const inv = await DataClient.createDraftInvoice({
                    organization_id: orgId,
                    project_id: projId,
                    billing_profile_id: profileId,
                    currency,
                    issue_date: issueDate,
                    due_date: dueDate
                }, items);

                modalRoot.innerHTML = "";
                window.location.hash = `#/portal/invoices/${inv.id}`;
            } catch (err) {
                alert("Помилка створення рахунку: " + (err.message || err));
                renderModalContent();
            }
        });
    };

    renderModalContent();
}
