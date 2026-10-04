// js/pages/contacts.js
export const Contacts = {
  render() {
    return `
      <section class="page-hero premium-dark" style="padding: 100px 0 60px;">
        <div class="container text-center">
          <div class="section-badge"><i data-lucide="map-pin"></i> Контакти</div>
          <h1>Зв'яжіться зі мною</h1>
          <p class="hero-subtitle">Залиште заявку — я відповім вам на email або в месенджер, який ви вкажете.</p>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="booking-layout">
            <div class="booking-sidebar">
              <div class="sidebar-card">
                <h3>Контактні дані</h3>
                <ul style="list-style:none; padding:0;">
                  <li style="margin-bottom: 12px;"><i data-lucide="mail" style="color:var(--accent-blue);"></i> <a href="mailto:a.zaporozhetswork@gmail.com" class="btn-link" data-contact-channel="email">a.zaporozhetswork@gmail.com</a></li>
                  <li style="margin-bottom: 12px;"><i data-lucide="send" style="color:var(--accent-blue);"></i> <a href="https://t.me/an_zaaz" target="_blank" rel="noopener noreferrer" class="btn-link" data-contact-channel="telegram">@an_zaaz</a></li>
                  <li><i data-lucide="map-pin" style="color:var(--accent-blue);"></i> Київ, Україна (Онлайн по всьому світу)</li>
                </ul>
              </div>
            </div>
            <div class="booking-form-area">
              <div class="card premium-form-card" style="padding: 32px;">
                <h3 style="margin-bottom: 24px;">Швидке повідомлення</h3>
                <form id="contacts-form" class="app-form">
                  <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display:block; margin-bottom: 8px;">Ім'я</label>
                    <input type="text" id="ct-name" class="form-control" style="width: 100%; padding: 12px;" required>
                  </div>
                  <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display:block; margin-bottom: 8px;">Email / Telegram / Телефон</label>
                    <input type="text" id="ct-contact" class="form-control" style="width: 100%; padding: 12px;" required>
                  </div>
                  <div class="form-group" style="margin-bottom: 24px;">
                    <label style="display:block; margin-bottom: 8px;">Повідомлення</label>
                    <textarea id="ct-message" class="form-control" rows="4" style="width: 100%; padding: 12px;" required></textarea>
                  </div>
                  <!-- Honeypot: hidden from humans, catches bots -->
                  <input type="text" id="ct-website-hp" name="website_hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute; left:-9999px; height:0; width:0; opacity:0;">
                  <div id="ct-form-error" role="alert" style="display:none; margin-bottom: 16px; padding: 12px 16px; border: 1px solid rgba(239,68,68,0.5); border-radius: var(--radius-md); background: rgba(239,68,68,0.08); color: #FCA5A5; font-size: 0.9rem;"></div>
                  <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Відправити</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  },
  init() {
    const form = document.getElementById('contacts-form');
    if (!form) return;

    import('../marketing/analytics.js').then(({ trackFormStart, trackContactClick }) => {
      form.addEventListener('focusin', () => trackFormStart('contacts'), { once: true });
      document.querySelectorAll('[data-contact-channel]').forEach((link) => {
        link.addEventListener('click', () => trackContactClick(link.dataset.contactChannel));
      });
    }).catch(() => {});

    // Restore a short-lived draft (sessionStorage, auto-expires) after reload
    import('../marketing/leads-api.js').then(({ loadDraft }) => {
      const draft = loadDraft('contacts');
      if (draft) {
        if (draft.name) document.getElementById('ct-name').value = draft.name;
        if (draft.raw_contact) document.getElementById('ct-contact').value = draft.raw_contact;
        if (draft.message) document.getElementById('ct-message').value = draft.message;
      }
    }).catch(() => {});

    // The event_id is created once per form attempt and reused on retries
    let submitEventId = null;
    const errorBox = document.getElementById('ct-form-error');
    const showError = (error) => {
      const messages = {
        rate_limited: 'Забагато спроб надсилання. Зачекайте, будь ласка, або напишіть напряму: a.zaporozhetswork@gmail.com',
        validation: 'Перевірте, будь ласка, поля: потрібне ім\'я та контакт для відповіді.',
        network: 'Не вдалося надіслати повідомлення — схоже, проблема зі з\'єднанням. Спробуйте ще раз.',
      };
      errorBox.textContent = (messages[error] || 'Не вдалося надіслати повідомлення. Спробуйте ще раз або напишіть на a.zaporozhetswork@gmail.com') +
        ' Ваші дані збережені в цій вкладці.';
      errorBox.style.display = 'block';
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.innerHTML = 'Відправлення...';
      btn.disabled = true;
      errorBox.style.display = 'none';

      const rawContact = document.getElementById('ct-contact').value.trim();
      const fields = {
        name: document.getElementById('ct-name').value,
        // Single free-form contact field: route it to the best-guess channel
        email: rawContact.includes('@') && rawContact.includes('.') ? rawContact : '',
        telegram: rawContact.startsWith('@') ? rawContact : '',
        phone: /^[+\d(]/.test(rawContact) ? rawContact : '',
        message: document.getElementById('ct-message').value,
        website_hp: document.getElementById('ct-website-hp').value
      };
      if (!fields.email && !fields.telegram && !fields.phone) {
        fields.telegram = rawContact; // unknown format: keep it, never drop a contact
      }

      try {
        const [{ trackGenerateLead, newEventId }, api] = await Promise.all([
          import('../marketing/analytics.js'),
          import('../marketing/leads-api.js')
        ]);

        api.saveDraft('contacts', { name: fields.name, raw_contact: rawContact, message: fields.message });
        if (!submitEventId) submitEventId = newEventId();

        const result = await api.submitLead(fields, 'contacts', null, submitEventId);

        if (result.ok) {
          // generate_lead fires ONLY after the server confirmed the stored lead
          if (result.lead_id) trackGenerateLead('contacts', null, submitEventId);
          api.clearDraft('contacts');
          window.location.hash = '#/success';
          return;
        }
        showError(result.error);
      } catch (err) {
        console.error('Error submitting contact message', err);
        showError('network');
      }
      btn.innerHTML = 'Відправити (повторити)';
      btn.disabled = false;
    });
  }
};
