/* js/client/ui/client-invoice-detail-view.js - Client Invoice Detail View (Phase 5C.2) */

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

export function renderClientInvoiceDetailView(invoiceId, activeOrg) {
    return `
        <div class="client-container" id="client-invoice-detail-root" data-invoice-id="${invoiceId}" data-org-id="${activeOrg?.id || ''}">
            <div class="portal-loading-container" style="padding: 40px; text-align: center;">
                <div class="portal-spinner"></div>
                <span>Завантаження даних рахунку...</span>
            </div>
        </div>
    `;
}

export async function initClientInvoiceDetailEvents(invoiceId, activeOrg) {
    await loadClientInvoiceDetail(invoiceId, activeOrg);
}

async function loadClientInvoiceDetail(invoiceId, activeOrg) {
    const root = document.getElementById("client-invoice-detail-root");
    if (!root) return;

    try {
        const inv = await DataClient.getInvoiceById(invoiceId);

        if (!inv || inv.status === "draft") {
            root.innerHTML = `
                <div class="portal-card" style="padding: 40px; text-align: center;">
                    <div style="font-size: 1.2rem; font-weight: 700; margin-bottom: 8px;">Рахунок не знайдено</div>
                    <p style="color: var(--text-muted);">Рахунок не існує або недоступний для перегляду.</p>
                    <a href="#/client/billing" class="btn btn-primary" style="margin-top: 14px;">Повернутися до оплат</a>
                </div>
            `;
            return;
        }

        // Automatically mark as viewed if in status 'sent' or 'issued'
        if (inv.status === "sent" || inv.status === "issued") {
            try {
                await DataClient.markInvoiceViewed(invoiceId);
            } catch (e) {
                console.warn("[ClientInvoiceDetail] markViewed warning:", e);
            }
        }

        const seller = inv.seller_snapshot || inv.billing_profiles || {};
        const buyer = inv.buyer_snapshot || {
            organization_name: inv.projects?.organizations?.name,
            billing_email: inv.projects?.organizations?.billing_email,
            address: inv.projects?.organizations?.address
        };

        const total = Number(inv.total_minor || 0);
        const paid = Number(inv.paid_minor || 0);
        const outstanding = Math.max(total - paid, 0);

        let badgeCls = "portal-badge-info";
        let badgeText = "Очікує оплати";
        if (inv.status === "paid") { badgeCls = "portal-badge-success"; badgeText = "Оплачено"; }
        else if (inv.status === "partially_paid") { badgeCls = "portal-badge-warning"; badgeText = "Частково сплачено"; }
        else if (inv.status === "overdue") { badgeCls = "portal-badge-danger"; badgeText = "Прострочено"; }

        root.innerHTML = `
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                    <a href="#/client/billing" style="color: var(--text-muted); font-size: 0.85rem; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                        <i data-lucide="arrow-left" style="width:14px;height:14px;"></i> До списку рахунків
                    </a>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <h1 class="client-page-title" style="margin: 0;">
                            Рахунок ${escapeHtml(inv.invoice_number || 'б/н')}
                        </h1>
                        <span class="portal-badge ${badgeCls}">${badgeText}</span>
                    </div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <a href="#/portal/invoices/${inv.id}/print" target="_blank" class="btn btn-outline">
                        <i data-lucide="printer"></i> Друк / Зберегти як PDF
                    </a>
                </div>
            </div>

            <!-- Main Layout -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;" class="invoice-detail-grid">
                <!-- Left Body -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <!-- Seller & Buyer -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="portal-card" style="padding: 16px;">
                            <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">
                                Виконавець:
                            </div>
                            <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                                ${escapeHtml(seller.legal_name || seller.name || "FIRSTWIN Consulting")}
                            </div>
                            <div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;">
                                ${escapeHtml(seller.legal_address || "")}<br>
                                ${seller.registration_number ? `IČO: ${escapeHtml(seller.registration_number)}<br>` : ''}
                                ${seller.vat_number ? `ПДВ / VAT: ${escapeHtml(seller.vat_number)}<br>` : ''}
                                Email: ${escapeHtml(seller.billing_email || "")}
                            </div>
                        </div>

                        <div class="portal-card" style="padding: 16px;">
                            <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">
                                Замовник:
                            </div>
                            <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">
                                ${escapeHtml(buyer.organization_name || "Ваша компанія")}
                            </div>
                            <div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;">
                                ${buyer.address ? `${escapeHtml(buyer.address)}<br>` : ''}
                                Email: ${escapeHtml(buyer.contact_email || buyer.billing_email || "—")}
                            </div>
                        </div>
                    </div>

                    <!-- Items Table -->
                    <div class="portal-card" style="padding: 0; overflow: hidden;">
                        <div style="padding: 16px; border-bottom: 1px solid var(--border-color);">
                            <h3 style="margin: 0; font-size: 0.95rem; font-weight: 700;">Позиції рахунку</h3>
                        </div>
                        <div class="table-responsive">
                            <table class="portal-table" style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Опис робіт</th>
                                        <th style="text-align: right;">К-сть</th>
                                        <th style="text-align: right;">Ціна (од.)</th>
                                        <th style="text-align: right;">Сума</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(inv.items || []).map((it, idx) => `
                                        <tr>
                                            <td style="color: var(--text-muted); width: 30px;">${idx + 1}</td>
                                            <td style="font-weight: 600;">${escapeHtml(it.description)}</td>
                                            <td style="text-align: right;">${it.quantity}</td>
                                            <td style="text-align: right;">${DataClient.formatMoney(it.unit_price_minor, inv.currency)}</td>
                                            <td style="text-align: right; font-weight: 700;">${DataClient.formatMoney(it.total_minor, inv.currency)}</td>
                                        </tr>
                                    `).join("")}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Payment Bank Details Box -->
                    <div class="portal-card" style="padding: 18px; border-left: 4px solid var(--color-primary);">
                        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 12px;">Реквізити для банківського переказу</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 0.85rem;">
                            <div>
                                <span style="color: var(--text-muted); display: block; font-size: 0.72rem; text-transform: uppercase;">Банк одержувача</span>
                                <strong style="color: var(--text-primary);">${escapeHtml(seller.bank_name || "—")}</strong>
                            </div>
                            <div>
                                <span style="color: var(--text-muted); display: block; font-size: 0.72rem; text-transform: uppercase;">IBAN</span>
                                <strong style="color: var(--text-primary); font-family: monospace;">${escapeHtml(seller.iban || "—")}</strong>
                            </div>
                            <div>
                                <span style="color: var(--text-muted); display: block; font-size: 0.72rem; text-transform: uppercase;">SWIFT / BIC</span>
                                <strong style="color: var(--text-primary); font-family: monospace;">${escapeHtml(seller.swift || "—")}</strong>
                            </div>
                            <div>
                                <span style="color: var(--text-muted); display: block; font-size: 0.72rem; text-transform: uppercase;">Призначення платежу / VS</span>
                                <strong style="color: var(--color-primary);">${escapeHtml(inv.invoice_number || '')}</strong>
                            </div>
                        </div>
                        ${seller.payment_instructions ? `
                            <div style="margin-top: 10px; font-size: 0.8rem; color: var(--text-muted); padding-top: 8px; border-top: 1px dashed var(--border-color);">
                                ${escapeHtml(seller.payment_instructions)}
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Right Sidebar -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <div class="portal-card" style="padding: 20px;">
                        <h3 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 14px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                            Сума до сплати
                        </h3>
                        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.88rem;">
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: var(--text-muted);">Сума без ПДВ:</span>
                                <span>${DataClient.formatMoney(inv.subtotal_minor, inv.currency)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: var(--text-muted);">ПДВ (${inv.tax_rate || 0}%):</span>
                                <span>${DataClient.formatMoney(inv.tax_minor, inv.currency)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 800; border-top: 1px solid var(--border-color); padding-top: 8px; color: var(--color-primary);">
                                <span>Загалом:</span>
                                <span>${DataClient.formatMoney(total, inv.currency)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: var(--color-success); font-weight: 600;">
                                <span>Сплачено:</span>
                                <span>${DataClient.formatMoney(paid, inv.currency)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 1rem; font-weight: 700; border-top: 1px dashed var(--border-color); padding-top: 8px; color: ${outstanding > 0 ? 'var(--color-warning)' : 'var(--text-muted)'};">
                                <span>Залишок:</span>
                                <span>${DataClient.formatMoney(outstanding, inv.currency)}</span>
                            </div>
                        </div>

                        <div style="margin-top: 16px; font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
                            Термін оплати: <strong>${inv.due_date}</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();
    } catch (err) {
        console.error("[ClientInvoiceDetail] Error:", err);
        root.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--color-danger);">Помилка завантаження рахунку.</div>`;
    }
}
