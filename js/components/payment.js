/* js/components/payment.js - Payment Systems Simulator */

import { State } from "../state.js";
import { Toast } from "./notifications.js";

export const Payment = {
    modalId: "payment-modal",
    contentId: "modal-body",

    open(leadId, paymentMethod) {
        const lead = State.getLeads().find(l => l.id === leadId);
        if (!lead) {
            Toast.error("Помилка", "Заявку не знайдено.");
            return;
        }

        const price = State.getServicePrice(lead.service);
        const modal = document.getElementById(this.modalId);
        const content = document.getElementById(this.contentId);
        
        if (!modal || !content) return;

        modal.classList.add("active");
        
        // Render different interfaces based on selected system
        content.innerHTML = this.getTemplate(lead, price, paymentMethod);
        
        // Initialize event listeners in modal
        this.initEventListeners(lead, price, paymentMethod);
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    },

    close() {
        const modal = document.getElementById(this.modalId);
        if (modal) {
            modal.classList.remove("active");
        }
    },

    getTemplate(lead, price, method) {
        const serviceName = State.getServiceName(lead.service);
        
        if (method === "mono") {
            return `
                <div class="payment-gateway mono-gateway">
                    <div class="gateway-header">
                        <div class="mono-logo-badge">plata by mono</div>
                        <span class="invoice-amount">${price} UAH</span>
                    </div>
                    
                    <div class="payment-details-summary">
                        <p><strong>Отримувач:</strong> ФОП Запорожець А. В.</p>
                        <p><strong>Призначення:</strong> ${serviceName}</p>
                        <p><strong>Клієнт:</strong> ${lead.name} (${lead.company || 'Фізична особа'})</p>
                    </div>

                    <div class="payment-actions-box">
                        <button class="gpay-btn"><img src="https://img.icons8.com/color/48/google-pay.png" alt="Google Pay"> Сплатити з Google Pay</button>
                        <button class="gpay-btn apple-pay-btn"><img src="https://img.icons8.com/color/48/apple-pay.png" alt="Apple Pay"> Сплатити з Apple Pay</button>
                        
                        <div class="separator-text"><span>або карткою</span></div>
                        
                        <form id="mono-card-form" class="card-checkout-form">
                            <div class="form-group">
                                <label class="form-label">Номер картки</label>
                                <input type="text" class="form-input" placeholder="4441 1111 2222 3333" required id="card-num">
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">Термін дії</label>
                                    <input type="text" class="form-input" placeholder="MM/YY" required id="card-exp">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">CVV2</label>
                                    <input type="password" class="form-input" placeholder="***" required id="card-cvv">
                                </div>
                            </div>
                            
                            <div class="simulation-controls">
                                <button type="button" class="btn btn-sm btn-outline test-autofill-btn" id="autofill-success">
                                    <i data-lucide="check" style="color:var(--color-success)"></i> Тест-Успіх
                                </button>
                                <button type="button" class="btn btn-sm btn-outline test-autofill-btn" id="autofill-fail">
                                    <i data-lucide="x" style="color:var(--color-danger)"></i> Тест-Помилка
                                </button>
                            </div>
                            
                            <button type="submit" class="btn btn-primary btn-block" id="submit-pay-btn">
                                <i data-lucide="lock"></i> Сплатити ${price} грн
                            </button>
                        </form>
                    </div>
                </div>
            `;
        }
        
        if (method === "liqpay") {
            return `
                <div class="payment-gateway liqpay-gateway">
                    <div class="gateway-header">
                        <div class="liqpay-logo-badge">LiqPay</div>
                        <span class="invoice-amount">${price} UAH</span>
                    </div>
                    
                    <div class="payment-details-summary">
                        <p><strong>Послуга:</strong> ${serviceName}</p>
                        <p><strong>Замовник:</strong> ${lead.name}</p>
                    </div>

                    <div class="liqpay-grid">
                        <div class="liqpay-qr-sec">
                            <p class="qr-info-text">Сплатіть миттєво через додаток Privat24</p>
                            <div class="mock-qr-code">
                                <i data-lucide="qr-code"></i>
                            </div>
                            <span class="qr-subtext">Скануйте QR-код</span>
                        </div>
                        
                        <div class="liqpay-form-sec">
                            <form id="liqpay-card-form" class="card-checkout-form">
                                <div class="form-group">
                                    <label class="form-label">Картка Visa / Mastercard</label>
                                    <input type="text" class="form-input" placeholder="0000 0000 0000 0000" required id="card-num">
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <input type="text" class="form-input" placeholder="ММ / ГГ" required id="card-exp">
                                    </div>
                                    <div class="form-group">
                                        <input type="password" class="form-input" placeholder="CVV" required id="card-cvv">
                                    </div>
                                </div>
                                <button type="button" class="btn btn-sm btn-outline test-autofill-btn btn-block" id="autofill-success" style="margin-bottom:12px">
                                    Симулювати успішну оплату
                                </button>
                                <button type="submit" class="btn btn-primary btn-block" style="background-color:#FFAE00;color:black;box-shadow:none">
                                    Сплатити карткою
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            `;
        }
        
        if (method === "wayforpay") {
            return `
                <div class="payment-gateway wfp-gateway">
                    <div class="gateway-header">
                        <div class="wfp-logo-badge">WayForPay</div>
                        <span class="invoice-amount">${price} UAH</span>
                    </div>
                    
                    <div class="payment-details-summary">
                        <p><strong>Рахунок:</strong> Invoice #${lead.id.substring(5, 12)}</p>
                        <p><strong>Сума:</strong> ${price} UAH</p>
                    </div>

                    <form id="wfp-form" class="card-checkout-form">
                        <div class="form-group">
                            <label class="form-label">Введіть ваш телефон (підтвердження OTP)</label>
                            <input type="tel" class="form-input" value="${lead.phone}" required id="phone-confirm">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Реквізити картки</label>
                            <input type="text" class="form-input" placeholder="Card Number" required id="card-num">
                        </div>
                        
                        <div class="simulation-controls" style="margin-bottom:15px">
                            <button type="button" class="btn btn-sm btn-outline" id="autofill-success" style="width:100%">
                                Сплатити тестовою карткою
                            </button>
                        </div>
                        
                        <button type="submit" class="btn btn-primary btn-block" style="background-color:#E35E26; box-shadow:none">
                            Підтвердити та сплатити
                        </button>
                    </form>
                </div>
            `;
        }
        
        if (method === "crypto") {
            const usdAmount = (price / 40.5).toFixed(2); // Mock UAH/USDT rate
            return `
                <div class="payment-gateway crypto-gateway">
                    <div class="gateway-header">
                        <div class="crypto-logo-badge">Whitepay Wallet</div>
                        <span class="invoice-amount">${usdAmount} USDT</span>
                    </div>
                    
                    <div class="payment-details-summary">
                        <p><strong>Мережа:</strong> Tron (TRC-20) <span class="badge badge-accent">TRX</span></p>
                        <p><strong>Сума до сплати:</strong> ${usdAmount} USDT</p>
                    </div>

                    <div class="crypto-details-card">
                        <div class="mock-qr-code crypto-qr">
                            <i data-lucide="qr-code"></i>
                        </div>
                        <div class="address-copy-group">
                            <label class="form-label">Адреса гаманця для оплати</label>
                            <div class="copy-input-row">
                                <input type="text" class="form-input" readonly value="TY2jLd9kMx8vW4HqZ3bN1cE5sA7fG9xP2z" id="wallet-addr">
                                <button type="button" class="btn btn-outline btn-sm" id="copy-addr-btn">
                                    <i data-lucide="copy"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="crypto-actions">
                        <p class="crypto-warning-text"><i data-lucide="alert-circle"></i> Відправляйте лише USDT в мережі TRC-20. Інші токени будуть втрачені назавжди.</p>
                        
                        <div class="crypto-sim-buttons">
                            <button type="button" class="btn btn-outline" id="autofill-success" style="flex-grow:1">
                                Симулювати переказ
                            </button>
                            <button type="button" class="btn btn-primary" id="verify-tx-btn">
                                Перевірити транзакцію
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        return `<p>Невідомий спосіб оплати</p>`;
    },

    initEventListeners(lead, price, method) {
        const modal = document.getElementById(this.modalId);
        
        // Close modal when clicking close button
        const closeBtn = document.getElementById("modal-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", () => this.close());
        }

        // Test auto-fill buttons
        const successBtn = document.getElementById("autofill-success");
        const failBtn = document.getElementById("autofill-fail");
        const copyAddrBtn = document.getElementById("copy-addr-btn");

        if (successBtn) {
            successBtn.addEventListener("click", () => {
                const cardNumInput = document.getElementById("card-num");
                const cardExpInput = document.getElementById("card-exp");
                const cardCvvInput = document.getElementById("card-cvv");

                if (cardNumInput) cardNumInput.value = "4441 1111 2222 3333";
                if (cardExpInput) cardExpInput.value = "12/29";
                if (cardCvvInput) cardCvvInput.value = "999";
                
                Toast.success("Тест автозаповнення", "Картку заповнено. Натисніть 'Сплатити' для успішної оплати.");
            });
        }

        if (failBtn) {
            failBtn.addEventListener("click", () => {
                const cardNumInput = document.getElementById("card-num");
                const cardExpInput = document.getElementById("card-exp");
                const cardCvvInput = document.getElementById("card-cvv");

                if (cardNumInput) cardNumInput.value = "5555 0000 0000 0000"; // Trigger error card
                if (cardExpInput) cardExpInput.value = "01/24"; // Expired
                if (cardCvvInput) cardCvvInput.value = "000";
                
                Toast.warning("Тест автозаповнення", "Введено дані картки, що викликає помилку.");
            });
        }

        if (copyAddrBtn) {
            copyAddrBtn.addEventListener("click", () => {
                const walletAddr = document.getElementById("wallet-addr");
                if (walletAddr) {
                    walletAddr.select();
                    document.execCommand("copy");
                    Toast.success("Скопійовано", "Адресу гаманця скопійовано в буфер обміну.");
                }
            });
        }

        // Form Submission Logic
        const form = document.querySelector(".card-checkout-form") || document.getElementById("wfp-form");
        const verifyTxBtn = document.getElementById("verify-tx-btn");

        const handleSuccessPayment = () => {
            Toast.success("Оплата прийнята", "Обробка транзакції платіжною системою...");
            setTimeout(() => {
                this.close();
                State.updateLeadPaymentStatus(lead.id, "paid", price);
                
                // Simulate sending webhook to Telegram channel
                Toast.info("CRM & Telegram Webhook", `Згенеровано подію: Нова сплата ${price} грн від ${lead.name}`);
                
                window.location.hash = `#/payment-success?leadId=${lead.id}`;
            }, 1500);
        };

        const handleFailPayment = () => {
            Toast.error("Оплата відхилена", "Платіжний ліміт вичерпано або недостатньо коштів.");
            setTimeout(() => {
                this.close();
                window.location.hash = `#/payment-error?leadId=${lead.id}`;
            }, 1000);
        };

        if (form) {
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                const cardNum = document.getElementById("card-num")?.value || "";
                
                // Simulating failures for specific test card numbers
                if (cardNum.startsWith("5555") || cardNum.includes("0000")) {
                    handleFailPayment();
                } else {
                    handleSuccessPayment();
                }
            });
        }

        if (verifyTxBtn) {
            verifyTxBtn.addEventListener("click", () => {
                // Crypto verification simulation
                Toast.info("Пошук транзакції", "Перевірка блокчейну Tron на наявність нових транзакцій...");
                setTimeout(() => {
                    handleSuccessPayment();
                }, 2000);
            });
        }
    }
};

// CSS specific to payment simulation injected on load
(() => {
    const style = document.createElement("style");
    style.textContent = `
        .payment-gateway {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        .gateway-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 16px;
        }
        .invoice-amount {
            font-size: 1.5rem;
            font-weight: 800;
            color: var(--text-primary);
        }
        .mono-logo-badge {
            background-color: black;
            color: white;
            padding: 6px 12px;
            font-weight: 800;
            border-radius: var(--radius-sm);
        }
        .liqpay-logo-badge {
            background-color: #FFAE00;
            color: black;
            padding: 6px 12px;
            font-weight: 800;
            border-radius: var(--radius-sm);
        }
        .wfp-logo-badge {
            background-color: #E35E26;
            color: white;
            padding: 6px 12px;
            font-weight: 800;
            border-radius: var(--radius-sm);
        }
        .crypto-logo-badge {
            background-color: #2563EB;
            color: white;
            padding: 6px 12px;
            font-weight: 800;
            border-radius: var(--radius-sm);
        }
        .payment-details-summary {
            background-color: var(--bg-primary);
            padding: 16px;
            border-radius: var(--radius-md);
            font-size: 0.9rem;
            border: 1px solid var(--border-color);
        }
        .payment-details-summary p {
            margin-bottom: 4px;
        }
        .payment-details-summary p:last-child {
            margin-bottom: 0;
        }
        .gpay-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background-color: white;
            border: 1px solid var(--border-color);
            width: 100%;
            padding: 12px;
            border-radius: var(--radius-md);
            font-weight: 700;
            font-size: 0.95rem;
            cursor: pointer;
            margin-bottom: 10px;
        }
        .gpay-btn img {
            height: 20px;
        }
        .apple-pay-btn {
            background-color: black;
            color: white;
            border-color: black;
        }
        .separator-text {
            text-align: center;
            position: relative;
            margin: 20px 0;
        }
        .separator-text::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            width: 100%;
            height: 1px;
            background-color: var(--border-color);
            z-index: 1;
        }
        .separator-text span {
            background-color: white;
            padding: 0 10px;
            position: relative;
            z-index: 2;
            font-size: 0.8rem;
            color: var(--text-secondary);
        }
        .simulation-controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        .test-autofill-btn {
            flex-grow: 1;
            font-size: 0.8rem !important;
            padding: 8px !important;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        }
        .liqpay-grid {
            display: grid;
            grid-template-columns: 1fr 1.2fr;
            gap: 24px;
        }
        .liqpay-qr-sec {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-right: 1px solid var(--border-color);
            padding-right: 24px;
        }
        .qr-info-text {
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--text-secondary);
            margin-bottom: 12px;
        }
        .mock-qr-code {
            width: 120px;
            height: 120px;
            background-color: var(--bg-primary);
            border: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: var(--radius-md);
            margin-bottom: 12px;
        }
        .mock-qr-code i {
            width: 80px;
            height: 80px;
            stroke-width: 1;
        }
        .qr-subtext {
            font-size: 0.75rem;
            color: var(--text-muted);
        }
        .crypto-details-card {
            display: flex;
            align-items: center;
            gap: 20px;
            background-color: var(--bg-primary);
            padding: 16px;
            border-radius: var(--radius-md);
            border: 1px solid var(--border-color);
        }
        .crypto-qr {
            width: 100px;
            height: 100px;
            margin-bottom: 0;
        }
        .crypto-qr i {
            width: 60px;
            height: 60px;
        }
        .address-copy-group {
            flex-grow: 1;
        }
        .copy-input-row {
            display: flex;
            gap: 8px;
        }
        .crypto-warning-text {
            font-size: 0.75rem;
            color: var(--color-danger);
            display: flex;
            align-items: flex-start;
            gap: 6px;
            line-height: 1.3;
            margin-bottom: 16px;
        }
        .crypto-warning-text i {
            width: 14px;
            height: 14px;
            flex-shrink: 0;
            margin-top: 2px;
        }
        .crypto-sim-buttons {
            display: flex;
            gap: 10px;
        }
        @media (max-width: 580px) {
            .liqpay-grid {
                grid-template-columns: 1fr;
            }
            .liqpay-qr-sec {
                border-right: none;
                border-bottom: 1px solid var(--border-color);
                padding-right: 0;
                padding-bottom: 24px;
            }
            .crypto-details-card {
                flex-direction: column;
                text-align: center;
            }
        }
    `;
    document.head.appendChild(style);
})();
