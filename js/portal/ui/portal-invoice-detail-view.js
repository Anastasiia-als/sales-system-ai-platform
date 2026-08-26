/* js/portal/ui/portal-invoice-detail-view.js - Invoice Detail View (Phase 5C.2) */

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

export function renderInvoiceDetailView(invoiceId) {
    return `
        <div class="portal-content" id="invoice-detail-root" data-invoice-id="${invoiceId}">
            <div class="portal-loading-container" style="padding: 40px;">
                <div class="portal-spinner"></div>
                <span>Завантаження картки рахунку...</span>
            </div>
        </div>
    `;
}

export async function initInvoiceDetailEvents(invoiceId) {
    await loadInvoiceDetail(invoiceId);
}

async function loadInvoiceDetail(invoiceId) {
    const root = document.getElementById("invoice-detail-root");
    if (!root) return;

    try {
        const isOwner = PortalAuth.isGlobalOwner();
        const [inv, auditEvents] = await Promise.all([
            DataClient.getInvoiceById(invoiceId),
            DataClient.getInvoiceAuditEvents(invoiceId)
        ]);

        if (!inv) {
            root.innerHTML = `
                <div class="portal-empty-state" style="padding: 40px; text-align: center;">
                    <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                    <div class="portal-empty-title">Рахунок не знайдено</div>
                    <div class="portal-empty-desc">Можливо, рахунок було видалено або у вас немає прав на його перегляд.</div>
                    <a href="#/portal/invoices" class="btn btn-outline" style="margin-top: 14px;">До реєстру рахунків</a>
                </div>
            `;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const isDraft = inv.status === "draft";
        const isPaid = inv.status === "paid";
        const isCancelled = inv.status === "cancelled";
        const total = Number(inv.total_minor || 0);
        const paid = Number(inv.paid_minor || 0);
        const outstanding = Math.max(total - paid, 0);

        const seller = inv.seller_snapshot || inv.billing_profiles || {};
        const buyer = inv.buyer_snapshot || {
            organization_name: inv.projects?.organizations?.name,
            billing_email: inv.projects?.organizations?.billing_email,
            address: inv.projects?.organizations?.address
        };

        const today = new Date().toISOString().split("T")[0];
        const isOverdue = outstanding > 0 && new Date(inv.due_date) < new Date(today) && !isCancelled;

        let badgeCls = "portal-badge-neutral";
        let badgeLabel = inv.status;
        if (inv.status === "draft") { badgeCls = "portal-badge-neutral"; badgeLabel = "Чернетка (Draft)"; }
        else if (inv.status === "issued") { badgeCls = "portal-badge-info"; badgeLabel = "Виставлено (Issued)"; }
        else if (inv.status === "sent") { badgeCls = "portal-badge-info"; badgeLabel = "Відправлено (Sent)"; }
        else if (inv.status === "viewed") { badgeCls = "portal-badge-info"; badgeLabel = "Переглянуто клієнтом"; }
        else if (inv.status === "partially_paid") { badgeCls = "portal-badge-warning"; badgeLabel = "Частково оплачено"; }
        else if (inv.status === "paid") { badgeCls = "portal-badge-success"; badgeLabel = "Оплачено (Paid)"; }
        else if (inv.status === "overdue" || isOverdue) { badgeCls = "portal-badge-danger"; badgeLabel = "Прострочено (Overdue)"; }
        else if (inv.status === "cancelled") { badgeCls = "portal-badge-neutral"; badgeLabel = "Скасовано (Cancelled)"; }

        root.innerHTML = `
            <!-- Header Breadcrumbs & Actions -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 14px;">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <a href="#/portal/invoices" class="portal-table-link" style="font-size: 0.85rem; color: var(--text-muted);">
                            <i data-lucide="arrow-left" style="width:14px;height:14px;vertical-align:middle;"></i> До реєстру рахунків
                        </a>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <h1 class="portal-page-title" style="margin: 0; display: flex; align-items: center; gap: 10px;">
                            ${isDraft ? 'Чернетка рахунку' : `Рахунок ${escapeHtml(inv.invoice_number || 'б/н')}`}
                        </h1>
                        <span class="portal-badge ${badgeCls}" style="font-size: 0.82rem; padding: 4px 10px;">${badgeLabel}</span>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${isDraft ? `
                        <button class="btn btn-primary" id="btn-issue-invoice">
                            <i data-lucide="check-circle"></i> Виставити рахунок (Issue)
                        </button>
                    ` : `
                        <a href="#/portal/invoices/${inv.id}/print" target="_blank" class="btn btn-outline">
                            <i data-lucide="printer"></i> Друк / PDF
                        </a>
                        ${(inv.status === 'issued' || inv.status === 'viewed') ? `
                            <button class="btn btn-outline" id="btn-mark-sent">
                                <i data-lucide="send"></i> Позначити відправленим
                            </button>
                        ` : ''}
                        ${outstanding > 0 && !isCancelled ? `
                            <button class="btn btn-primary" id="btn-open-payment-modal">
                                <i data-lucide="credit-card"></i> Зафіксувати оплату
                            </button>
                        ` : ''}
                    `}
                    ${!isPaid && !isCancelled && paid === 0 ? `
                        <button class="btn btn-outline" id="btn-cancel-invoice" style="color: var(--color-danger); border-color: rgba(239, 68, 68, 0.4);">
                            <i data-lucide="slash"></i> Скасувати
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Main Layout (2 Columns) -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;" class="invoice-detail-grid">
                <!-- Left Column: Document Body -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <!-- Seller & Buyer Cards -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <!-- Seller Card -->
                        <div class="portal-card" style="padding: 16px;">
                            <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">
                                Постачальник (Виконавець)
                            </div>
                            <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary); margin-bottom: 4px;">
                                ${escapeHtml(seller.legal_name || seller.name || "FIRSTWIN Consulting")}
                            </div>
                            <div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;">
                                ${escapeHtml(seller.legal_address || "")}<br>
                                ${seller.registration_number ? `IČO / Реєстрація: ${escapeHtml(seller.registration_number)}<br>` : ''}
                                ${seller.tax_id ? `DIČ / Tax ID: ${escapeHtml(seller.tax_id)}<br>` : ''}
                                ${seller.vat_number ? `ПДВ / VAT: ${escapeHtml(seller.vat_number)}<br>` : ''}
                                Email: ${escapeHtml(seller.billing_email || "")}
                            </div>
                        </div>

                        <!-- Buyer Card -->
                        <div class="portal-card" style="padding: 16px;">
                            <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">
                                Замовник (Клієнт)
                            </div>
                            <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary); margin-bottom: 4px;">
                                <a href="#/portal/clients/${inv.organization_id}" class="portal-table-link">
                                    ${escapeHtml(buyer.organization_name || inv.projects?.organizations?.name || "Клієнт")}
                                </a>
                            </div>
                            <div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;">
                                ${buyer.address ? `${escapeHtml(buyer.address)}<br>` : ''}
                                ${buyer.contact_name ? `Контакт: ${escapeHtml(buyer.contact_name)}<br>` : ''}
                                Email: ${escapeHtml(buyer.contact_email || buyer.billing_email || "—")}
                                ${buyer.contact_phone ? `<br>Тел: ${escapeHtml(buyer.contact_phone)}` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Line Items Table -->
                    <div class="portal-card" style="padding: 0; overflow: hidden;">
                        <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="font-size: 0.95rem; font-weight: 700; margin: 0;">Позиції рахунку (Line items)</h3>
                            ${isDraft ? `
                                <button class="btn btn-outline btn-xs" id="btn-edit-items">
                                    <i data-lucide="edit-3"></i> Редагувати позиції
                                </button>
                            ` : ''}
                        </div>
                        <div class="table-responsive">
                            <table class="portal-table" style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Опис робіт / послуг</th>
                                        <th style="text-align: right;">К-сть</th>
                                        <th style="text-align: right;">Ціна (од.)</th>
                                        <th style="text-align: right;">ПДВ %</th>
                                        <th style="text-align: right;">Сума</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(inv.items || []).map((it, idx) => `
                                        <tr>
                                            <td style="color: var(--text-muted); font-size: 0.8rem; width: 30px;">${idx + 1}</td>
                                            <td style="font-weight: 600; color: var(--text-primary);">${escapeHtml(it.description)}</td>
                                            <td style="text-align: right;">${it.quantity}</td>
                                            <td style="text-align: right;">${DataClient.formatMoney(it.unit_price_minor, inv.currency)}</td>
                                            <td style="text-align: right;">${Number(it.tax_rate) > 0 ? it.tax_rate + '%' : '0%'}</td>
                                            <td style="text-align: right; font-weight: 700;">${DataClient.formatMoney(it.total_minor, inv.currency)}</td>
                                        </tr>
                                    `).join("")}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Payment Instructions & Bank Details -->
                    <div class="portal-card" style="padding: 18px; border-left: 4px solid var(--color-primary);">
                        <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 10px;">Реквізити для оплати</h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 0.85rem;">
                            <div>
                                <span style="color: var(--text-muted); display: block; font-size: 0.72rem; text-transform: uppercase;">Банк</span>
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
                                <span style="color: var(--text-muted); display: block; font-size: 0.72rem; text-transform: uppercase;">Призначення / VS</span>
                                <strong style="color: var(--color-primary);">${inv.invoice_number ? escapeHtml(inv.invoice_number) : 'Номер рахунку після виставлення'}</strong>
                            </div>
                        </div>
                        ${seller.payment_instructions ? `
                            <div style="margin-top: 10px; font-size: 0.8rem; color: var(--text-muted); padding-top: 8px; border-top: 1px dashed var(--border-color);">
                                ${escapeHtml(seller.payment_instructions)}
                            </div>
                        ` : ''}
                    </div>

                    <!-- Payment Allocations History -->
                    <div class="portal-card" style="padding: 0; overflow: hidden;">
                        <div style="padding: 16px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="font-size: 0.95rem; font-weight: 700; margin: 0;">Історія зарахування оплат</h3>
                            ${outstanding > 0 && !isCancelled ? `
                                <button class="btn btn-outline btn-xs" id="btn-add-pay-quick">
                                    <i data-lucide="plus"></i> Додати платіж
                                </button>
                            ` : ''}
                        </div>
                        ${(!inv.payments || inv.payments.length === 0) ? `
                            <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                                Оплат за цим рахунком ще не зафіксовано.
                            </div>
                        ` : `
                            <div class="table-responsive">
                                <table class="portal-table" style="width: 100%; border-collapse: collapse;">
                                    <thead>
                                        <tr>
                                            <th>Дата зарахування</th>
                                            <th>Метод</th>
                                            <th>Референс / Референс банку</th>
                                            <th>Коментар</th>
                                            <th style="text-align: right;">Сума</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${inv.payments.map(p => `
                                            <tr>
                                                <td style="font-weight: 600;">${new Date(p.paid_at).toLocaleDateString('uk-UA')}</td>
                                                <td><span class="portal-badge portal-badge-neutral">${escapeHtml(p.payment_method)}</span></td>
                                                <td style="font-family: monospace; font-size: 0.82rem;">${escapeHtml(p.reference || '—')}</td>
                                                <td style="font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(p.comment || '—')}</td>
                                                <td style="text-align: right; font-weight: 700; color: var(--color-success);">${DataClient.formatMoney(p.amount_minor, p.currency)}</td>
                                            </tr>
                                        `).join("")}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Right Column: Sidebar Meta & Timeline -->
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    <!-- Financial Summary Card -->
                    <div class="portal-card" style="padding: 20px;">
                        <h3 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 14px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                            Розрахунок суми
                        </h3>
                        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.88rem;">
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: var(--text-muted);">Сума без ПДВ:</span>
                                <span style="font-weight: 600;">${DataClient.formatMoney(inv.subtotal_minor, inv.currency)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: var(--text-muted);">ПДВ (${inv.tax_rate || 0}%):</span>
                                <span style="font-weight: 600;">${DataClient.formatMoney(inv.tax_minor, inv.currency)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 800; border-top: 1px solid var(--border-color); padding-top: 8px; color: var(--color-primary);">
                                <span>Загалом:</span>
                                <span>${DataClient.formatMoney(total, inv.currency)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; color: var(--color-success); font-weight: 600;">
                                <span>Оплачено:</span>
                                <span>${DataClient.formatMoney(paid, inv.currency)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 1rem; font-weight: 700; border-top: 1px dashed var(--border-color); padding-top: 8px; color: ${outstanding > 0 ? 'var(--color-warning)' : 'var(--text-muted)'};">
                                <span>Залишок до сплати:</span>
                                <span>${DataClient.formatMoney(outstanding, inv.currency)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Linked Project & Tranche -->
                    <div class="portal-card" style="padding: 16px;">
                        <h4 style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">
                            Прив'язка до делівері
                        </h4>
                        <div style="font-size: 0.85rem; line-height: 1.5;">
                            <div><strong>Проєкт:</strong> <a href="#/portal/projects/${inv.project_id}" class="portal-table-link">${escapeHtml(inv.projects?.title || "—")}</a></div>
                            ${inv.project_payment_schedule ? `
                                <div style="margin-top: 6px;">
                                    <strong>Транш:</strong> ${escapeHtml(inv.project_payment_schedule.title)}<br>
                                    <span style="color: var(--text-muted); font-size: 0.8rem;">Плановий термін: ${inv.project_payment_schedule.due_date}</span>
                                </div>
                            ` : '<div style="color: var(--text-muted); margin-top: 4px; font-size: 0.8rem;">Окремий рахунок (поза графіком)</div>'}
                        </div>
                    </div>

                    <!-- Audit Events Timeline -->
                    <div class="portal-card" style="padding: 16px;">
                        <h4 style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 12px;">
                            Аудит подій (Audit Timeline)
                        </h4>
                        <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.82rem;">
                            ${auditEvents.length === 0 ? `
                                <div style="color: var(--text-muted);">Подій ще не зафіксовано.</div>
                            ` : auditEvents.map(ev => `
                                <div style="border-left: 2px solid var(--border-color); padding-left: 10px;">
                                    <div style="font-weight: 700; color: var(--text-primary); text-transform: capitalize;">
                                        ${escapeHtml(ev.action)}
                                    </div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">
                                        ${new Date(ev.created_at).toLocaleString('uk-UA')} ${ev.profiles?.full_name ? `• ${escapeHtml(ev.profiles.full_name)}` : ''}
                                    </div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Record Payment Modal Root -->
            <div id="invoice-payment-modal-root"></div>
        `;

        if (window.lucide) window.lucide.createIcons();
        attachDetailEvents(inv, outstanding);
    } catch (err) {
        console.error("[InvoiceDetail] Error:", err);
        root.innerHTML = `
            <div class="portal-empty-state" style="padding: 40px; text-align: center;">
                <div class="portal-empty-icon" style="color: var(--color-danger);"><i data-lucide="alert-triangle"></i></div>
                <div class="portal-empty-title">Помилка завантаження картки рахунку</div>
                <div class="portal-empty-desc">${err?.message || "Спробуйте оновити сторінку."}</div>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }
}

function attachDetailEvents(inv, outstanding) {
    // 1. Issue Invoice
    const btnIssue = document.getElementById("btn-issue-invoice");
    if (btnIssue) {
        btnIssue.addEventListener("click", async () => {
            if (!confirm("Ви впевнені, що хочете виставити цей рахунок? Після виставлення реквізити та позиції стануть незмінними.")) return;
            try {
                btnIssue.disabled = true;
                btnIssue.innerHTML = "Виставлення...";
                await DataClient.issueInvoice(inv.id);
                loadInvoiceDetail(inv.id);
            } catch (err) {
                alert("Помилка виставлення рахунку: " + (err.message || err));
                loadInvoiceDetail(inv.id);
            }
        });
    }

    // 2. Mark Sent
    const btnSent = document.getElementById("btn-mark-sent");
    if (btnSent) {
        btnSent.addEventListener("click", async () => {
            try {
                btnSent.disabled = true;
                await DataClient.markInvoiceSent(inv.id);
                loadInvoiceDetail(inv.id);
            } catch (err) {
                alert("Помилка: " + (err.message || err));
                loadInvoiceDetail(inv.id);
            }
        });
    }

    // 3. Cancel Invoice
    const btnCancel = document.getElementById("btn-cancel-invoice");
    if (btnCancel) {
        btnCancel.addEventListener("click", async () => {
            const reason = prompt("Вкажіть причину скасування рахунку:", "Скасовано за домовленістю з клієнтом");
            if (!reason) return;
            try {
                await DataClient.cancelInvoice(inv.id, reason);
                loadInvoiceDetail(inv.id);
            } catch (err) {
                alert("Помилка скасування: " + (err.message || err));
            }
        });
    }

    // 4. Record Payment Modal
    const openPaymentModal = () => {
        const modalRoot = document.getElementById("invoice-payment-modal-root");
        if (!modalRoot) return;

        const maxAmount = outstanding / 100;
        const todayStr = new Date().toISOString().split("T")[0];

        modalRoot.innerHTML = `
            <div class="portal-modal-backdrop" id="modal-pay-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;">
                <div class="portal-card" style="width: 100%; max-width: 480px; padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                        <h3 style="font-size: 1.15rem; font-weight: 700; margin: 0;">Зафіксувати оплату</h3>
                        <button class="btn btn-outline btn-xs" id="btn-close-pay-modal"><i data-lucide="x"></i></button>
                    </div>

                    <form id="record-payment-form" style="display: flex; flex-direction: column; gap: 14px;">
                        <div>
                            <label class="portal-label">Сума оплати (${inv.currency}) *</label>
                            <input type="number" step="0.01" min="0.01" max="${maxAmount}" class="portal-form-input" id="pay-amount" value="${maxAmount}" required style="width: 100%; font-size: 1.1rem; font-weight: 700;">
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Максимально до сплати за цим рахунком: ${DataClient.formatMoney(outstanding, inv.currency)}</span>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <label class="portal-label">Дата зарахування *</label>
                                <input type="date" class="portal-form-input" id="pay-date" value="${todayStr}" required style="width: 100%;">
                            </div>
                            <div>
                                <label class="portal-label">Метод оплати *</label>
                                <select class="portal-form-select" id="pay-method" style="width: 100%;">
                                    <option value="bank_transfer">Банківський переказ</option>
                                    <option value="card">Картка</option>
                                    <option value="cash">Готівка</option>
                                    <option value="crypto">Криптовалюта</option>
                                    <option value="other">Інше</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label class="portal-label">Номер платіжки / Референс</label>
                            <input type="text" class="portal-form-input" id="pay-ref" placeholder="напр. INV-${inv.invoice_number || '2026'}-PAY1" style="width: 100%;">
                        </div>

                        <div>
                            <label class="portal-label">Коментар</label>
                            <textarea class="portal-form-textarea" id="pay-comment" rows="2" placeholder="Додаткові примітки..." style="width: 100%;"></textarea>
                        </div>

                        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px;">
                            <button type="button" class="btn btn-outline" id="btn-cancel-pay-modal">Скасувати</button>
                            <button type="submit" class="btn btn-primary" id="btn-submit-payment">
                                <i data-lucide="check"></i> Зарахувати платіж
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        if (window.lucide) window.lucide.createIcons();

        document.getElementById("btn-close-pay-modal")?.addEventListener("click", () => { modalRoot.innerHTML = ""; });
        document.getElementById("btn-cancel-pay-modal")?.addEventListener("click", () => { modalRoot.innerHTML = ""; });

        document.getElementById("record-payment-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const amt = Number(document.getElementById("pay-amount").value);
            const paidDate = document.getElementById("pay-date").value;
            const method = document.getElementById("pay-method").value;
            const ref = document.getElementById("pay-ref").value;
            const comment = document.getElementById("pay-comment").value;

            if (!amt || amt <= 0) {
                alert("Вкажіть коректну суму оплати.");
                return;
            }

            try {
                const submitBtn = document.getElementById("btn-submit-payment");
                if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = "Збереження..."; }

                await DataClient.recordInvoicePayment({
                    organization_id: inv.organization_id,
                    project_id: inv.project_id,
                    invoice_id: inv.id,
                    payment_schedule_id: inv.payment_schedule_id || null,
                    amount_minor: Math.round(amt * 100),
                    currency: inv.currency,
                    paid_at: paidDate ? new Date(paidDate).toISOString() : new Date().toISOString(),
                    payment_method: method,
                    reference: ref,
                    comment: comment
                });

                modalRoot.innerHTML = "";
                loadInvoiceDetail(inv.id);
            } catch (err) {
                alert("Помилка зарахування платежу: " + (err.message || err));
                modalRoot.innerHTML = "";
                loadInvoiceDetail(inv.id);
            }
        });
    };

    document.getElementById("btn-open-payment-modal")?.addEventListener("click", openPaymentModal);
    document.getElementById("btn-add-pay-quick")?.addEventListener("click", openPaymentModal);
}
