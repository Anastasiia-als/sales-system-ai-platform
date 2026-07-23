// js/pages/error.js
export const ErrorPage = {
  render() {
    return `
      <section class="page-hero premium-dark" style="min-height: 80vh; display: flex; align-items: center;">
        <div class="container text-center">
          <div class="error-icon" style="font-size: 64px; color: var(--danger); margin-bottom: 24px;">
            <i data-lucide="x-circle" style="width: 80px; height: 80px;"></i>
          </div>
          <h1>Помилка оплати</h1>
          <p class="hero-subtitle" style="max-width: 600px; margin: 0 auto 32px;">На жаль, під час транзакції виникла помилка. Ваша заявка збережена, але оплата не пройшла. Ви можете спробувати ще раз або обрати інший спосіб (наприклад, Crypto-invoice).</p>
          <div class="page-hero-cta justify-content-center">
            <a href="#/consultation" class="btn btn-primary btn-lg">Спробувати ще раз</a>
            <a href="https://t.me/sales_expert" target="_blank" class="btn btn-outline btn-lg"><i data-lucide="help-circle"></i> Звернутися в підтримку</a>
          </div>
        </div>
      </section>
    `;
  },
  init() {}
};
