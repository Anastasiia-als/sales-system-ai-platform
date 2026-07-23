/* js/pages/status.js - Success and Error status screens */

import { State } from "../state.js";

export const Status = {
    ThankYou: {
        render() {
            return `
                <div class="container" style="padding: 100px 0; text-align: center; max-width: 600px;">
                    <div class="pain-icon" style="background-color:rgba(16, 185, 129, 0.1); color:var(--color-success); width:80px; height:80px; margin: 0 auto 24px auto;">
                        <i data-lucide="check-circle" style="width:40px; height:40px"></i>
                    </div>
                    
                    <h1 style="margin-bottom:16px">Дякуємо! Ваша заявка прийнята.</h1>
                    <p style="color:var(--text-secondary); font-size:1.1rem; line-height:1.6; margin-bottom:40px">
                        Я уважно перегляну опис вашої задачі та зв'яжусь з вами у месенджерах або за телефоном протягом години для узгодження наступних кроків.
                    </p>
                    
                    <div style="display:flex; justify-content:center; gap:16px">
                        <a href="#/" class="btn btn-primary">Повернутись на головну</a>
                        <a href="#/blog" class="btn btn-outline">Читати блог</a>
                    </div>
                </div>
            `;
        },
        init() {}
    },

    PaymentSuccess: {
        render(params) {
            const leadId = params.leadId;
            const lead = State.getLeads().find(l => l.id === leadId);
            const serviceName = lead ? State.getServiceName(lead.service) : "Консультація з продажів";
            
            const formattedDate = lead && lead.bookingDate 
                ? new Date(lead.bookingDate).toLocaleDateString("uk-UA", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                : "Найближчий час";
            
            const time = lead ? lead.bookingTime : "";

            return `
                <div class="container" style="padding: 80px 0; text-align: center; max-width: 700px;">
                    <div class="pain-icon" style="background-color:rgba(16, 185, 129, 0.1); color:var(--color-success); width:80px; height:80px; margin: 0 auto 24px auto;">
                        <i data-lucide="shield-check" style="width:40px; height:40px"></i>
                    </div>
                    
                    <span class="badge badge-success" style="margin-bottom:12px">Оплата успішна</span>
                    <h1 style="margin-bottom:16px">Зустріч успішно заброньовано та сплачено!</h1>
                    <p style="color:var(--text-secondary); font-size:1.05rem; line-height:1.6; margin-bottom:32px">
                        Підтвердження оплати та посилання на зустріч надіслані вам на пошту <strong>${lead ? lead.email : ''}</strong> та в Telegram.
                    </p>

                    <div class="card" style="padding:32px; text-align:left; margin-bottom:40px; background-color:#F8FAFC">
                        <h4 style="border-bottom:1px solid var(--border-color); padding-bottom:12px; margin-bottom:16px; font-size:1.1rem">
                            <i data-lucide="calendar" style="width:18px; height:18px; display:inline; vertical-align:middle; margin-right:6px"></i> 
                            Параметри зустрічі
                        </h4>
                        
                        <div style="display:flex; flex-direction:column; gap:12px; font-size:0.95rem">
                            <p><strong>Послуга:</strong> ${serviceName}</p>
                            <p><strong>Дата:</strong> ${formattedDate}</p>
                            <p><strong>Час:</strong> ${time || 'Очікує підтвердження'} (за київським часом)</p>
                            <p><strong>Посилання на відео-дзвінок:</strong> <a href="https://zoom.us/mock-link" target="_blank" style="color:var(--color-accent); font-weight:700">zoom.us/j/92daac925465 <i data-lucide="external-link" style="width:14px; height:14px; display:inline; vertical-align:middle"></i></a></p>
                        </div>
                    </div>
                    
                    <div style="display:flex; justify-content:center; gap:16px; flex-wrap:wrap">
                        <button class="btn btn-primary" id="add-to-calendar-btn">
                            <i data-lucide="calendar-plus"></i> Додати в Google Календар
                        </button>
                        <a href="#/" class="btn btn-outline">На головну сторінку</a>
                    </div>
                </div>
            `;
        },
        
        init() {
            const calBtn = document.getElementById("add-to-calendar-btn");
            if (calBtn) {
                calBtn.addEventListener("click", () => {
                    Toast.success("Календар", "Подію успішно експортовано в Google Calendar!");
                });
            }
        }
    },

    PaymentError: {
        render(params) {
            const leadId = params.leadId;
            const lead = State.getLeads().find(l => l.id === leadId);
            const serviceSlug = lead ? lead.service : "express";

            return `
                <div class="container" style="padding: 100px 0; text-align: center; max-width: 600px;">
                    <div class="pain-icon" style="background-color:rgba(239, 68, 68, 0.1); color:var(--color-danger); width:80px; height:80px; margin: 0 auto 24px auto;">
                        <i data-lucide="x-circle" style="width:40px; height:40px"></i>
                    </div>
                    
                    <span class="badge badge-danger" style="margin-bottom:12px">Помилка транзакції</span>
                    <h1 style="margin-bottom:16px">Оплату не завершено</h1>
                    <p style="color:var(--text-secondary); font-size:1.1rem; line-height:1.6; margin-bottom:40px">
                        На жаль, платіжна система відхилила транзакцію. Перевірте ліміт на оплату в інтернеті, наявність коштів на картці або спробуйте інший спосіб оплати.
                    </p>
                    
                    <div style="display:flex; justify-content:center; gap:16px; flex-wrap:wrap">
                        <a href="#/consultation?service=${serviceSlug}" class="btn btn-primary">Спробувати ще раз <i data-lucide="rotate-ccw"></i></a>
                        <a href="https://t.me/sales_expert" target="_blank" class="btn btn-outline"><i data-lucide="send"></i> Зв'язатися в Telegram</a>
                    </div>
                </div>
            `;
        },
        init() {}
    }
};
