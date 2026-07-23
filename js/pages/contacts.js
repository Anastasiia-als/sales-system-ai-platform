// js/pages/contacts.js
export const Contacts = {
  render() {
    return `
      <section class="page-hero premium-dark" style="padding: 100px 0 60px;">
        <div class="container text-center">
          <div class="section-badge"><i data-lucide="map-pin"></i> Контакти</div>
          <h1>Зв'яжіться зі мною</h1>
          <p class="hero-subtitle">Залиште заявку або напишіть напряму в Telegram для швидкої відповіді.</p>
        </div>
      </section>
      
      <section class="section">
        <div class="container">
          <div class="booking-layout">
            <div class="booking-sidebar">
              <div class="sidebar-card">
                <h3>Контактні дані</h3>
                <ul style="list-style:none; padding:0;">
                  <li style="margin-bottom: 12px;"><i data-lucide="send" style="color:var(--accent-blue);"></i> <a href="https://t.me/sales_expert" target="_blank" class="btn-link">@sales_expert</a> (Telegram)</li>
                  <li style="margin-bottom: 12px;"><i data-lucide="mail" style="color:var(--accent-blue);"></i> <a href="mailto:contact@example.com" class="btn-link">contact@example.com</a></li>
                  <li style="margin-bottom: 12px;"><i data-lucide="phone" style="color:var(--accent-blue);"></i> <a href="tel:+380990000000" class="btn-link">+38 (099) 000-00-00</a></li>
                  <li><i data-lucide="map-pin" style="color:var(--accent-blue);"></i> Київ, Україна (Онлайн по всьому світу)</li>
                </ul>
              </div>
            </div>
            <div class="booking-form-area">
              <div class="card premium-form-card" style="padding: 32px;">
                <h3 style="margin-bottom: 24px;">Швидке повідомлення</h3>
                <form class="app-form" onsubmit="event.preventDefault(); window.location.hash='#/success';">
                  <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display:block; margin-bottom: 8px;">Ім'я</label>
                    <input type="text" class="form-control" style="width: 100%; padding: 12px;" required>
                  </div>
                  <div class="form-group" style="margin-bottom: 16px;">
                    <label style="display:block; margin-bottom: 8px;">Telegram / Телефон</label>
                    <input type="text" class="form-control" style="width: 100%; padding: 12px;" required>
                  </div>
                  <div class="form-group" style="margin-bottom: 24px;">
                    <label style="display:block; margin-bottom: 8px;">Повідомлення</label>
                    <textarea class="form-control" rows="4" style="width: 100%; padding: 12px;" required></textarea>
                  </div>
                  <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Відправити</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  },
  init() {}
};
