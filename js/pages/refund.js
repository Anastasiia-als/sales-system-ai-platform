// js/pages/refund.js
export const Refund = {
  render() {
    return `
      <section class="page-hero premium-dark" style="padding: 100px 0 60px;">
        <div class="container text-center">
          <h1>Умови оплати і повернення</h1>
        </div>
      </section>
      <section class="section">
        <div class="container" style="max-width: 800px; line-height: 1.8; color: var(--text-secondary);">
          <h3 style="color: var(--text-primary); margin-top: 32px;">1. Порядок оплати</h3>
          <p>Оплата послуг (Консультація, Аудит, Тренінг, Автоматизація) здійснюється за фактом підписання договору або через виставлений рахунок (інвойс). Для онлайн-послуг (наприклад, консультація) діє 100% передоплата.</p>
          <h3 style="color: var(--text-primary); margin-top: 32px;">2. Методи оплати</h3>
          <p>Оплату можна здійснити за допомогою: банківських карток Visa/Mastercard (через LiqPay, WayForPay, mono еквайринг), або за допомогою криптовалюти (USDT, Whitepay).</p>
          <h3 style="color: var(--text-primary); margin-top: 32px;">3. Умови повернення коштів</h3>
          <p>Якщо після першої зустрічі (до початку основного етапу робіт) ви зрозуміли, що мій підхід вам не підходить, я повертаю 100% передоплати за послуги (наприклад, аудит).<br><br>Повернення коштів не здійснюється, якщо послуга вже була надана у повному обсязі (виданий звіт, проведений тренінг).</p>
          <h3 style="color: var(--text-primary); margin-top: 32px;">4. Перенесення зустрічі</h3>
          <p>Ви можете перенести заброньовану консультацію не пізніше ніж за 24 години до її початку.</p>
        </div>
      </section>
    `;
  },
  init() {}
};
