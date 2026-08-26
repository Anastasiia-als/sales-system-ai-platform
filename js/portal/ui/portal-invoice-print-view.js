/* js/portal/ui/portal-invoice-print-view.js - Printable Invoice Representation (Phase 5C.2) */

import { DataClient } from "../api/data-client.js";

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function renderInvoicePrintView(invoiceId) {
    return `
        <div id="invoice-print-root" data-invoice-id="${invoiceId}" style="min-height: 100vh; background: #0A0F1C; padding: 20px; color: #FFFFFF;">
            <div style="text-align: center; padding: 40px;">
                <div class="portal-spinner"></div>
                <p style="margin-top: 10px; color: #94A3B8;">Підготовка друкованої форми рахунку...</p>
            </div>
        </div>
    `;
}

export async function initInvoicePrintEvents(invoiceId) {
    const root = document.getElementById("invoice-print-root");
    if (!root) return;

    try {
        const inv = await DataClient.getInvoiceById(invoiceId);
        if (!inv) {
            root.innerHTML = `<div style="text-align: center; padding: 40px; color: #EF4444;">Рахунок не знайдено.</div>`;
            return;
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

        root.innerHTML = `
            <style>
                @media print {
                    body, html {
                        background: #FFFFFF !important;
                        color: #000000 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .invoice-print-container {
                        box-shadow: none !important;
                        border: none !important;
                        max-width: 100% !important;
                        padding: 0 !important;
                        background: #FFFFFF !important;
                        color: #000000 !important;
                    }
                    .invoice-print-table th {
                        background: #F1F5F9 !important;
                        color: #0F172A !important;
                        border-bottom: 2px solid #CBD5E1 !important;
                    }
                    .invoice-print-table td {
                        border-bottom: 1px solid #E2E8F0 !important;
                        color: #0F172A !important;
                    }
                    .text-muted-print {
                        color: #64748B !important;
                    }
                    .brand-print {
                        color: #0284C7 !important;
                    }
                }
            </style>

            <div class="no-print" style="max-width: 800px; margin: 0 auto 16px; display: flex; justify-content: space-between; align-items: center;">
                <a href="#/portal/invoices/${inv.id}" style="color: #94A3B8; text-decoration: none; font-size: 0.9rem;">
                    ← Повернутися до картки рахунку
                </a>
                <button onclick="window.print()" class="btn btn-primary" style="padding: 8px 18px; font-weight: 600; cursor: pointer;">
                    🖨️ Друк / Зберегти як PDF
                </button>
            </div>

            <div class="invoice-print-container" style="max-width: 800px; margin: 0 auto; background: #FFFFFF; color: #0F172A; padding: 40px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); font-family: 'Plus Jakarta Sans', Arial, sans-serif;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #E2E8F0; padding-bottom: 24px; margin-bottom: 24px;">
                    <div>
                        <div class="brand-print" style="font-size: 1.6rem; font-weight: 800; color: #0284C7; letter-spacing: -0.5px;">FIRSTWIN</div>
                        <div style="font-size: 0.85rem; color: #64748B; margin-top: 2px;">Системні продажі & Консалтинг</div>
                    </div>
                    <div style="text-align: right;">
                        <h1 style="font-size: 1.5rem; font-weight: 800; margin: 0; color: #0F172A;">РАХУНОК-ФАКТУРА</h1>
                        <div style="font-size: 1rem; font-weight: 700; color: #0284C7; margin-top: 4px;">${escapeHtml(inv.invoice_number || 'ЧЕРНЕТКА')}</div>
                    </div>
                </div>

                <!-- Issuer & Client Meta Grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 28px;">
                    <!-- Issuer / Seller -->
                    <div>
                        <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #64748B; margin-bottom: 6px;">Постачальник:</div>
                        <div style="font-weight: 700; font-size: 1rem; color: #0F172A;">${escapeHtml(seller.legal_name || seller.name || "FIRSTWIN Consulting s.r.o.")}</div>
                        <div style="font-size: 0.85rem; color: #334155; line-height: 1.45; margin-top: 4px;">
                            ${escapeHtml(seller.legal_address || "")}<br>
                            ${seller.registration_number ? `IČO: <strong>${escapeHtml(seller.registration_number)}</strong><br>` : ''}
                            ${seller.tax_id ? `DIČ: <strong>${escapeHtml(seller.tax_id)}</strong><br>` : ''}
                            ${seller.vat_number ? `ПДВ / VAT: <strong>${escapeHtml(seller.vat_number)}</strong><br>` : ''}
                            Email: ${escapeHtml(seller.billing_email || "")}
                        </div>
                    </div>

                    <!-- Client / Buyer -->
                    <div>
                        <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #64748B; margin-bottom: 6px;">Замовник:</div>
                        <div style="font-weight: 700; font-size: 1rem; color: #0F172A;">${escapeHtml(buyer.organization_name || "Клієнт")}</div>
                        <div style="font-size: 0.85rem; color: #334155; line-height: 1.45; margin-top: 4px;">
                            ${buyer.address ? `${escapeHtml(buyer.address)}<br>` : ''}
                            ${buyer.contact_name ? `Контактна особа: ${escapeHtml(buyer.contact_name)}<br>` : ''}
                            Email: ${escapeHtml(buyer.contact_email || buyer.billing_email || "—")}
                        </div>
                    </div>
                </div>

                <!-- Invoice Dates & Details -->
                <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 16px; margin-bottom: 24px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 0.85rem;">
                    <div>
                        <span style="color: #64748B; display: block; font-size: 0.75rem;">Дата виставлення:</span>
                        <strong>${inv.issue_date}</strong>
                    </div>
                    <div>
                        <span style="color: #64748B; display: block; font-size: 0.75rem;">Термін сплати (Due date):</span>
                        <strong style="color: #0F172A;">${inv.due_date}</strong>
                    </div>
                    <div>
                        <span style="color: #64748B; display: block; font-size: 0.75rem;">Валюта рахунку:</span>
                        <strong>${inv.currency}</strong>
                    </div>
                </div>

                <!-- Line Items Table -->
                <table class="invoice-print-table" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 0.88rem;">
                    <thead>
                        <tr style="background: #F1F5F9; text-align: left;">
                            <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1; width: 30px;">#</th>
                            <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1;">Опис робіт / послуг</th>
                            <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1; text-align: right; width: 60px;">К-сть</th>
                            <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1; text-align: right; width: 120px;">Ціна (од.)</th>
                            <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1; text-align: right; width: 70px;">ПДВ</th>
                            <th style="padding: 10px 12px; border-bottom: 2px solid #CBD5E1; text-align: right; width: 130px;">Сума</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(inv.items || []).map((it, idx) => `
                            <tr>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; color: #64748B;">${idx + 1}</td>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #0F172A;">${escapeHtml(it.description)}</td>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: right;">${it.quantity}</td>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: right;">${DataClient.formatMoney(it.unit_price_minor, inv.currency)}</td>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: right;">${Number(it.tax_rate) > 0 ? it.tax_rate + '%' : '0%'}</td>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 700;">${DataClient.formatMoney(it.total_minor, inv.currency)}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>

                <!-- Summary & Totals -->
                <div style="display: flex; justify-content: flex-end; margin-bottom: 28px;">
                    <div style="width: 280px; font-size: 0.9rem;">
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #475569;">
                            <span>Сума без ПДВ:</span>
                            <span>${DataClient.formatMoney(inv.subtotal_minor, inv.currency)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #475569;">
                            <span>ПДВ (${inv.tax_rate || 0}%):</span>
                            <span>${DataClient.formatMoney(inv.tax_minor, inv.currency)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 2px solid #0F172A; font-size: 1.15rem; font-weight: 800; color: #0F172A;">
                            <span>РАЗОМ ДО СПЛАТИ:</span>
                            <span>${DataClient.formatMoney(total, inv.currency)}</span>
                        </div>
                        ${paid > 0 ? `
                            <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #16A34A; font-weight: 600;">
                                <span>Сплачено:</span>
                                <span>${DataClient.formatMoney(paid, inv.currency)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 6px 0; border-top: 1px dashed #CBD5E1; color: #D97706; font-weight: 700;">
                                <span>Залишок:</span>
                                <span>${DataClient.formatMoney(outstanding, inv.currency)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Bank Instructions Box -->
                <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 16px; margin-bottom: 28px; font-size: 0.85rem;">
                    <div style="font-weight: 700; margin-bottom: 8px; color: #0F172A; text-transform: uppercase; font-size: 0.78rem;">Банківські реквізити для оплати:</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; line-height: 1.5;">
                        <div>Банк: <strong>${escapeHtml(seller.bank_name || "Fio banka, a.s.")}</strong></div>
                        <div>IBAN: <strong style="font-family: monospace;">${escapeHtml(seller.iban || "—")}</strong></div>
                        <div>SWIFT / BIC: <strong style="font-family: monospace;">${escapeHtml(seller.swift || "—")}</strong></div>
                        <div>Призначення / VS: <strong style="color: #0284C7;">${inv.invoice_number ? escapeHtml(inv.invoice_number) : 'Номер рахунку'}</strong></div>
                    </div>
                </div>

                <!-- Footer Signatures Note -->
                <div style="border-top: 1px solid #E2E8F0; padding-top: 16px; font-size: 0.75rem; color: #94A3B8; text-align: center;">
                    Рахунок сформовано в електронній платформі FIRSTWIN Platform. Дякуємо за співпрацю!
                </div>
            </div>
        `;
    } catch (err) {
        console.error("[InvoicePrint] Error:", err);
        root.innerHTML = `<div style="text-align: center; padding: 40px; color: #EF4444;">Помилка завантаження рахунку.</div>`;
    }
}
