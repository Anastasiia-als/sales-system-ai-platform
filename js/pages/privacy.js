// js/pages/privacy.js
export const Privacy = {
  render() {
    return `
      <section class="page-hero premium-dark" style="padding: 100px 0 60px;">
        <div class="container text-center">
          <h1>Політика конфіденційності</h1>
          <p class="hero-subtitle">Останнє оновлення: Червень 2026</p>
        </div>
      </section>
      <section class="section">
        <div class="container" style="max-width: 800px; line-height: 1.8; color: var(--text-secondary);">
          <p>Ця Політика конфіденційності описує, як ми збираємо, використовуємо та захищаємо вашу особисту інформацію під час користування сайтом Sales System.</p>
          <h3 style="color: var(--text-primary); margin-top: 32px;">1. Збір інформації</h3>
          <p>Ми збираємо дані, які ви надаєте під час заповнення форм на сайті: ім'я, телефон, email, Telegram, назву компанії та опис вашої задачі. Ці дані використовуються виключно для надання консалтингових послуг.</p>
          <h3 style="color: var(--text-primary); margin-top: 32px;">2. Використання даних</h3>
          <p>Ваші дані передаються у внутрішню CRM-систему експерта. Ми не передаємо, не продаємо і не розголошуємо ваші дані третім особам (за винятком платіжних систем для проведення оплат).</p>
          <h3 style="color: var(--text-primary); margin-top: 32px;">3. Аналітика</h3>
          <p>Ми використовуємо Google Analytics 4 та Google Tag Manager для відстеження анонімної статистики відвідувань (які сторінки ви переглядаєте, які кнопки натискаєте) для покращення конверсії сайту.</p>
          <h3 style="color: var(--text-primary); margin-top: 32px;">4. Захист даних</h3>
          <p>Ми вживаємо відповідних технічних заходів безпеки для захисту ваших даних від несанкціонованого доступу.</p>
        </div>
      </section>
    `;
  },
  init() {}
};
