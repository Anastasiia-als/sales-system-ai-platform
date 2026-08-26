/* js/client/ui/client-billing-view.js - Client Billing Workspace (Phase 5C.2) */

import { DataClient } from "../../portal/api/data-client.js";

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

let billingState = {
    search: "",
    status: "all"
};

export function renderClientBillingView(activeOrg) {
    return `
        <div class="client-container" id="client-billing-root" data-org-id="${activeOrg?.id || ''}">
            <div class="portal-loading-container" style="padding: 40px; text-align: center;">
                <div class="portal-spinner"></div>
                <span>Завантаження рахунків та оплат...</span>
            </div>
        </div>
    `;
}

export async function initClientBillingEvents(activeOrg) {
    await loadClientBilling(activeOrg);
}

async function loadClientBilling(activeOrg) {
    const root = document.getElementById("client-billing-root");
    if (!root || !activeOrg?.id) return;

    try {
        const invoices = await DataClient.getInvoices({
            organization_id: activeOrg.id,
            excludeDrafts: true
        });

        const today = new Date().toISOString().split("T")[0];
        const todayDate = new Date(today);

        const filtered = invoices.filter(inv => {
            if (billingState.search) {
                const q = billingState.search.toLowerCase();
                const num = (inv.invoice_number || "").toLowerCase();
                const proj = (inv.projects?.title || "").toLowerCase();
                if (!num.includes(q) && !proj.includes(q)) return false;
            }
            if (billingState.status !== "all" && inv.status !== billingState.status) return false;
            return true;
        });

        // Calculate summaries grouped by currency
        const summaries = {};
        invoices.forEach(inv => {
            if (inv.status === "cancelled") return;
            const c = inv.currency || "CZK";
            if (!summaries[c]) {
                summaries[c] = { total: 0, paid: 0, outstanding: 0, count: 0 };
            }
            const tot = Number(inv.total_minor || 0);
            const pd = Number(inv.paid_minor || 0);
            summaries[c].total += tot;
            summaries[c].paid += pd;
            summaries[c].outstanding += Math.max(tot - pd, 0);
            summaries[c].count += 1;
        });

        const currencies = Object.keys(summaries);

        root.innerHTML = `
            <div class="client-page-header" style="margin-bottom: 24px;">
                <h1 class="client-page-title" style="display: flex; align-items: center; gap: 10px;">
                    <i data-lucide="credit-card" style="color: var(--color-primary);"></i>
                    Оплати та рахунки
                </h1>
                <p class="client-page-subtitle">
                    Перелік виставлених рахунків-фактур, статус їх оплати та банківські реквізити для переказу.
                </p>
            </div>

            <!-- Client Billing Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
                ${currencies.length === 0 ? `
                    <div class="portal-card" style="padding: 16px; color: var(--text-muted);">
                        Виставлених рахунків для вашої організації ще немає.
                    </div>
                ` : currencies.map(c => {
                    const s = summaries[c];
                    return `
                        <div class="portal-card" style="padding: 16px; border-top: 3px solid var(--color-primary);">
                            <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 10px; color: var(--text-primary);">
                                Валюта розрахунків: ${c}
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
                                <div>
                                    <span style="color: var(--text-muted); font-size: 0.72rem; display: block;">Сплачено:</span>
                                    <strong style="color: var(--color-success); font-size: 1rem;">${DataClient.formatMoney(s.paid, c)}</strong>
                                </div>
                                <div>
                                    <span style="color: var(--text-muted); font-size: 0.72rem; display: block;">До сплати:</span>
                                    <strong style="color: ${s.outstanding > 0 ? 'var(--color-warning)' : 'var(--text-muted)'}; font-size: 1rem;">
                                        ${DataClient.formatMoney(s.outstanding, c)}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    `;
                }).join("")}
            </div>

            <!-- Invoices List -->
            <div class="portal-card" style="padding: 0; overflow: hidden;">
                <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <h3 style="margin: 0; font-size: 1rem; font-weight: 700;">Рахунки-фактури</h3>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" id="client-inv-search" class="portal-form-input" placeholder="Пошук за номером..." value="${escapeHtml(billingState.search)}" style="padding: 6px 12px; font-size: 0.85rem; width: 200px;">
                        <select id="client-inv-status" class="portal-form-select" style="padding: 6px 12px; font-size: 0.85rem;">
                            <option value="all" ${billingState.status === 'all' ? 'selected' : ''}>Всі статуси</option>
                            <option value="issued" ${billingState.status === 'issued' ? 'selected' : ''}>Очікує оплати</option>
                            <option value="partially_paid" ${billingState.status === 'partially_paid' ? 'selected' : ''}>Частково оплачено</option>
                            <option value="paid" ${billingState.status === 'paid' ? 'selected' : ''}>Оплачено</option>
                        </select>
                    </div>
                </div>

                ${filtered.length === 0 ? `
                    <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                        Рахунків за обраними фільтрами не знайдено.
                    </div>
                ` : `
                    <div class="table-responsive">
                        <table class="portal-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr>
                                    <th>Рахунок №</th>
                                    <th>Проєкт</th>
                                    <th>Дата виставлення</th>
                                    <th>Термін сплати</th>
                                    <th>Сума</th>
                                    <th>Сплачено</th>
                                    <th>Залишок</th>
                                    <th>Статус</th>
                                    <th style="text-align: right;">Дія</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.map(inv => {
                                    const tot = Number(inv.total_minor || 0);
                                    const pd = Number(inv.paid_minor || 0);
                                    const out = Math.max(tot - pd, 0);
                                    const isDue = out > 0 && new Date(inv.due_date) < todayDate;

                                    let badgeCls = "portal-badge-info";
                                    let badgeText = "Очікує оплати";
                                    if (inv.status === "paid") { badgeCls = "portal-badge-success"; badgeText = "Оплачено"; }
                                    else if (inv.status === "partially_paid") { badgeCls = "portal-badge-warning"; badgeText = "Частково"; }
                                    else if (inv.status === "overdue" || isDue) { badgeCls = "portal-badge-danger"; badgeText = "Прострочено"; }

                                    return `
                                        <tr>
                                            <td>
                                                <a href="#/client/billing/${inv.id}" class="portal-table-link" style="font-weight: 700;">
                                                    ${escapeHtml(inv.invoice_number || 'б/н')}
                                                </a>
                                            </td>
                                            <td>
                                                <span style="font-weight: 600;">${escapeHtml(inv.projects?.title || "Проєкт")}</span>
                                            </td>
                                            <td>${inv.issue_date}</td>
                                            <td style="${isDue ? 'color: var(--color-danger); font-weight: 600;' : ''}">
                                                ${inv.due_date} ${isDue ? '⚠️' : ''}
                                            </td>
                                            <td style="font-weight: 700;">${DataClient.formatMoney(tot, inv.currency)}</td>
                                            <td style="color: var(--color-success); font-weight: 600;">${DataClient.formatMoney(pd, inv.currency)}</td>
                                            <td style="color: ${out > 0 ? 'var(--color-warning)' : 'var(--text-muted)'}; font-weight: 700;">
                                                ${DataClient.formatMoney(out, inv.currency)}
                                            </td>
                                            <td><span class="portal-badge ${badgeCls}">${badgeText}</span></td>
                                            <td style="text-align: right;">
                                                <a href="#/client/billing/${inv.id}" class="btn btn-outline btn-xs">
                                                    Реквізити / Друк
                                                </a>
                                            </td>
                                        </tr>
                                    `;
                                }).join("")}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();

        document.getElementById("client-inv-search")?.addEventListener("input", (e) => {
            billingState.search = e.target.value;
            loadClientBilling(activeOrg);
        });

        document.getElementById("client-inv-status")?.addEventListener("change", (e) => {
            billingState.status = e.target.value;
            loadClientBilling(activeOrg);
        });

    } catch (err) {
        console.error("[ClientBilling] Error:", err);
        root.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--color-danger);">Помилка завантаження рахунків.</div>`;
    }
}
