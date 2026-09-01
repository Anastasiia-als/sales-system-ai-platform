// js/pages/consultation.js
export const Consultation = {
  render() {
    return `
      <section class="page-hero premium-dark">
        <div class="container">
          <div class="section-badge"><i data-lucide="calendar"></i> Бронювання</div>
          <h1>Індивідуальна консультація: розберемо, що саме заважає вашим продажам рости</h1>
          <p class="hero-subtitle">За одну зустріч ви отримаєте не загальні поради, а конкретний розбір вашої ситуації: воронка, менеджери, CRM, скрипти, заявки, оплати, контроль і наступні кроки.</p>
          <div class="price-hero-badge" style="margin-top: 32px;">
            <span class="price-value">від 6 000 ₴</span>
            <span class="price-label">за консультацію</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="booking-layout">
            
            <!-- Booking Form -->
            <div class="booking-form-area">
              <div class="card premium-form-card" style="padding: 32px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-dark); border-radius: var(--radius-lg);">
                <h3 style="margin-bottom: 8px;">Забронюйте консультацію</h3>
                <p style="margin-bottom: 24px; color: var(--text-secondary); font-size: 0.9rem;">Перед зустріччю я попрошу коротко описати вашу ситуацію, щоб розмова була максимально предметною.</p>
                
                <form id="consultation-form" class="app-form">
                  <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div class="form-group">
                      <label style="display:block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Ім'я</label>
                      <input type="text" id="c-name" class="form-control" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;" required>
                    </div>
                    <div class="form-group">
                      <label style="display:block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Телефон</label>
                      <input type="text" id="c-phone" class="form-control" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;" required>
                    </div>
                  </div>

                  <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div class="form-group">
                      <label style="display:block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Email</label>
                      <input type="email" id="c-email" class="form-control" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;" required>
                    </div>
                    <div class="form-group">
                      <label style="display:block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Telegram</label>
                      <input type="text" id="c-telegram" class="form-control" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;" placeholder="@username">
                    </div>
                  </div>

                  <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div class="form-group">
                      <label style="display:block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Компанія / Сайт</label>
                      <input type="text" id="c-company" class="form-control" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;">
                    </div>
                    <div class="form-group">
                      <label style="display:block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Ніша</label>
                      <input type="text" id="c-niche" class="form-control" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;">
                    </div>
                  </div>

                  <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                    <div class="form-group">
                      <label style="display:block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Кількість менеджерів</label>
                      <select id="c-managers" class="form-control" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;">
                        <option value="Немає (продаю сам)">Немає (продаю сам)</option>
                        <option value="1-3">1-3</option>
                        <option value="4-10">4-10</option>
                        <option value="Більше 10">Більше 10</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label style="display:block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Чи є CRM?</label>
                      <select id="c-crm" class="form-control" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;">
                        <option value="Так">Так</option>
                        <option value="Ні">Ні</option>
                        <option value="В процесі впровадження">В процесі впровадження</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display:block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Основна проблема</label>
                    <textarea id="c-problem" class="form-control" rows="2" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;" required></textarea>
                  </div>

                  <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display:block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Що хочете отримати після консультації?</label>
                    <textarea id="c-goal" class="form-control" rows="2" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;"></textarea>
                  </div>

                  <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                    <div class="form-group">
                      <label style="display:block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Бажаний формат</label>
                      <select id="c-format" class="form-control" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;">
                        <option value="Zoom">Zoom</option>
                        <option value="Google Meet">Google Meet</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label style="display:block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Бажана дата</label>
                      <input type="date" id="c-date" class="form-control" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;" required>
                    </div>
                    <div class="form-group">
                      <label style="display:block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-secondary);">Час</label>
                      <select id="c-time" class="form-control" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;">
                        <option value="10:00 - 12:00">10:00 - 12:00</option>
                        <option value="12:00 - 15:00">12:00 - 15:00</option>
                        <option value="15:00 - 18:00">15:00 - 18:00</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-group payment-selection" style="margin-bottom: 24px; padding: 16px; background: rgba(0,0,0,0.2); border-radius: var(--radius-md);">
                    <h4 style="margin-bottom: 12px; font-size: 1rem;">Спосіб оплати</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">Оплату можна здійснити карткою, за інвойсом або криптовалютою.</p>
                    <select id="c-payment" class="form-control" style="width: 100%; padding: 12px 16px; background: rgba(10,15,28,0.5); border: 1px solid var(--border-dark); border-radius: var(--radius-md); color: white;">
                      <option value="mono">monobank (еквайринг)</option>
                      <option value="LiqPay">LiqPay</option>
                      <option value="WayForPay">WayForPay</option>
                      <option value="Portmone">Portmone</option>
                      <option value="crypto">Crypto (USDT / Whitepay)</option>
                      <option value="invoice">Ручний crypto-invoice</option>
                    </select>
                  </div>
                  
                  <!-- Honeypot: hidden from humans, catches bots -->
                  <input type="text" id="c-website-hp" name="website_hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute; left:-9999px; height:0; width:0; opacity:0;">

                  <div id="c-form-error" role="alert" style="display:none; margin-bottom: 16px; padding: 12px 16px; border: 1px solid rgba(239,68,68,0.5); border-radius: var(--radius-md); background: rgba(239,68,68,0.08); color: #FCA5A5; font-size: 0.9rem;"></div>

                  <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Залишити заявку та перейти до оплати</button>
                  <p style="margin-top: 16px; font-size: 0.8rem; color: var(--text-muted); text-align: center;">Натискаючи кнопку, ви погоджуєтесь з політикою конфіденційності.</p>
                </form>
              </div>
            </div>

            <!-- Booking Info -->
            <div class="booking-sidebar">
              <div class="sidebar-card">
                <h3>Для кого консультація?</h3>
                <ul>
                  <li><i data-lucide="check"></i> Власник бізнесу</li>
                  <li><i data-lucide="check"></i> Керівник відділу продажів (РОП)</li>
                  <li><i data-lucide="check"></i> Team Lead</li>
                  <li><i data-lucide="check"></i> Засновник онлайн-школи</li>
                  <li><i data-lucide="check"></i> Керівник кол-центру</li>
                  <li><i data-lucide="check"></i> Сервісний бізнес, B2B / B2C</li>
                </ul>
              </div>

              <div class="sidebar-card">
                <h3>Що розбираємо на зустрічі:</h3>
                <ul>
                  <li><i data-lucide="target"></i> Чому заявки не доходять до оплати</li>
                  <li><i data-lucide="target"></i> Як менеджери ведуть клієнта</li>
                  <li><i data-lucide="target"></i> Що не так із вашою CRM</li>
                  <li><i data-lucide="target"></i> Де просідає конверсія</li>
                  <li><i data-lucide="target"></i> Як закривати "я подумаю"</li>
                  <li><i data-lucide="target"></i> Які KPI справді потрібні</li>
                  <li><i data-lucide="target"></i> Що автоматизувати першим ділом</li>
                </ul>
              </div>
              
              <div class="sidebar-card">
                <h3>Результат консультації</h3>
                <ul>
                  <li><i data-lucide="file-check"></i> Зрозуміла діагностика проблеми</li>
                  <li><i data-lucide="list"></i> Список пріоритетів та наступні кроки</li>
                  <li><i data-lucide="zap"></i> Розуміння, що виправляти першим</li>
                  <li><i data-lucide="arrow-right"></i> Можливість перейти в аудит / супровід</li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </section>
    `;
  },
  init() {
    const form = document.getElementById('consultation-form');
    if (!form) return;

    const FIELD_IDS = {
      name: 'c-name', phone: 'c-phone', email: 'c-email', telegram: 'c-telegram',
      company: 'c-company', niche: 'c-niche', managers: 'c-managers', has_crm: 'c-crm',
      problem: 'c-problem', goal: 'c-goal', preferred_format: 'c-format',
      preferred_date: 'c-date', preferred_time: 'c-time', payment_method: 'c-payment'
    };
    const readFields = () => {
      const fields = {};
      Object.keys(FIELD_IDS).forEach(k => { fields[k] = document.getElementById(FIELD_IDS[k]).value; });
      fields.website_hp = document.getElementById('c-website-hp').value;
      return fields;
    };

    // The event_id is created once per form attempt and reused on retries,
    // so the server's event_id dedup absorbs double sends.
    let submitEventId = null;

    import('../marketing/leads-api.js').then(({ loadDraft }) => {
      // Restore a short-lived draft (sessionStorage, auto-expires) after reload
      const draft = loadDraft('consultation');
      if (draft) {
        Object.keys(FIELD_IDS).forEach(k => {
          if (draft[k]) { const el = document.getElementById(FIELD_IDS[k]); if (el && !el.value) el.value = draft[k]; }
        });
      }
    }).catch(() => {});

    import('../marketing/analytics.js').then(({ trackFormStart }) => {
      form.addEventListener('focusin', () => trackFormStart('consultation', 'consult'), { once: true });
    }).catch(() => {});

    const errorBox = document.getElementById('c-form-error');
    const showError = (error) => {
      const messages = {
        rate_limited: 'Забагато спроб надсилання. Зачекайте, будь ласка, або напишіть напряму: a.zaporozhetswork@gmail.com',
        validation: 'Перевірте, будь ласка, заповнені поля: потрібне ім\'я та хоча б один спосіб зв\'язку.',
        network: 'Не вдалося надіслати заявку — схоже, проблема зі з\'єднанням. Спробуйте ще раз.',
      };
      errorBox.textContent = (messages[error] || 'Не вдалося надіслати заявку. Спробуйте ще раз або напишіть на a.zaporozhetswork@gmail.com') +
        ' Ваші дані збережені в цій вкладці.';
      errorBox.style.display = 'block';
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const originalLabel = 'Залишити заявку та перейти до оплати';
      btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Надсилання заявки...';
      btn.disabled = true;
      errorBox.style.display = 'none';
      if (window.lucide) window.lucide.createIcons();

      const fields = readFields();

      try {
        const [{ trackGenerateLead, newEventId }, api] = await Promise.all([
          import('../marketing/analytics.js'),
          import('../marketing/leads-api.js')
        ]);

        // Keep a short-lived draft so an accidental reload doesn't lose the form
        api.saveDraft('consultation', fields);
        if (!submitEventId) submitEventId = newEventId();

        const result = await api.submitLead(fields, 'consultation', 'consult', submitEventId);

        if (result.ok) {
          // Server confirmed (result.lead_id) or honeypot fake-success (no lead_id).
          // generate_lead fires ONLY for a confirmed stored lead.
          if (result.lead_id) trackGenerateLead('consultation', 'consult', submitEventId);
          api.clearDraft('consultation');
          window.location.hash = '#/success';
          return;
        }
        showError(result.error);
      } catch (err) {
        console.error('Error submitting lead', err);
        showError('network');
      }
      btn.innerHTML = originalLabel + ' (повторити)';
      btn.disabled = false;
    });
  }
};

