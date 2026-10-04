// js/pages/success.js
export const Success = {
  render() {
    return `
      <section class="page-hero premium-dark" style="min-height: 80vh; display: flex; align-items: center;">
        <div class="container text-center">
          <div class="success-icon" style="font-size: 64px; color: var(--accent-green); margin-bottom: 24px;">
            <i data-lucide="check-circle" style="width: 80px; height: 80px;"></i>
          </div>
          <h1>Оплата пройшла успішно!</h1>
          <p class="hero-subtitle" style="max-width: 600px; margin: 0 auto 32px;">Ваша заявка та оплата підтверджені. Найближчим часом ми зв'яжемось з вами у Telegram або за вказаним номером телефону для узгодження деталей.</p>
          <div class="page-hero-cta justify-content-center">
            <a href="#/" class="btn btn-primary btn-lg">Повернутися на головну</a>
            <a href="https://t.me/an_zaaz" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-lg"><i data-lucide="send"></i> Написати в Telegram</a>
          </div>
        </div>
      </section>
    `;
  },
  init() {}
};
