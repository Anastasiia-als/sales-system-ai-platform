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
                  <!-- Telegram & phone TO_CONFIRM: added when the owner provides real contacts. -->
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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.innerHTML = 'Відправлення...';
      btn.disabled = true;

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
        const [{ trackGenerateLead }, { submitLead }, { State }] = await Promise.all([
          import('../marketing/analytics.js'),
          import('../marketing/leads-api.js'),
          import('../state.js')
        ]);

        // Local copy always saved first (fallback if the server is unavailable)
        State.addLead({
          name: fields.name,
          phone: fields.phone, email: fields.email, telegram: fields.telegram,
          problem: fields.message,
          service: 'contact_message',
          status: 'new'
        });

        const eventId = trackGenerateLead('contacts');
        const result = await submitLead(fields, 'contacts', null, eventId);
        if (!result.ok) {
          console.warn('[Contacts] Server lead capture unavailable (' + result.error + '), local fallback kept.');
        }
      } catch (err) {
        console.error('Error saving contact message', err);
      }
      window.location.hash = '#/success';
    });
  }
};
