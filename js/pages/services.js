// js/pages/services.js
export const Services = {
  render() {
    return `
      <section class="page-hero premium-dark">
        <div class="container">
          <div class="section-badge"><i data-lucide="layers"></i> Експертиза</div>
          <h1>Послуги з побудови системи продажів</h1>
          <p class="hero-subtitle">Кожна послуга вирішує конкретний біль бізнесу: від пошуку точок втрати грошей до автоматизації рутини та побудови команди, яка виконує план.</p>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="services-grid">
            <div class="service-card-premium">
              <div class="service-icon"><i data-lucide="search"></i></div>
              <h3>Аудит відділу продажів</h3>
              <p class="service-pain">Біль: Заявок багато, а оплат мало; ліди губляться.</p>
              <p class="service-do">Що робимо: Аналізуємо воронку, CRM, швидкість, дзвінки та скрипти.</p>
              <p class="service-result">Результат: Карта точок втрати грошей та чіткий план дій.</p>
              <p style="font-size:0.85rem;color:var(--color-accent);font-weight:700;margin-bottom:12px">від 45 000 ₴</p>
              <a href="#/audit" class="btn-link">Детальніше <i data-lucide="arrow-right"></i></a>
            </div>

            <div class="service-card-premium">
              <div class="service-icon"><i data-lucide="file-text"></i></div>
              <h3>Скрипти та комунікація</h3>
              <p class="service-pain">Біль: Менеджери губляться на запереченнях і зливають ціною.</p>
              <p class="service-do">Що робимо: Створюємо логіку продажу без "шаблонних фраз".</p>
              <p class="service-result">Результат: Менеджер веде клієнта, а не просто відповідає на запитання.</p>
              <p style="font-size:0.85rem;color:var(--color-accent);font-weight:700;margin-bottom:12px">від 30 000 ₴</p>
              <a href="#/scripts" class="btn-link">Детальніше <i data-lucide="arrow-right"></i></a>
            </div>

            <div class="service-card-premium">
              <div class="service-icon"><i data-lucide="users"></i></div>
              <h3>Тренінги для команд</h3>
              <p class="service-pain">Біль: Команда не знає як продавати, або продає кожен по-своєму.</p>
              <p class="service-do">Що робимо: Практичні розбори, робота з потребами та закриттям.</p>
              <p class="service-result">Результат: Команда розуміє єдиний стандарт продажів компанії.</p>
              <p style="font-size:0.85rem;color:var(--color-accent);font-weight:700;margin-bottom:12px">від 40 000 ₴</p>
              <a href="#/trainings" class="btn-link">Детальніше <i data-lucide="arrow-right"></i></a>
            </div>

            <div class="service-card-premium">
              <div class="service-icon"><i data-lucide="cpu"></i></div>
              <h3>CRM та Автоматизація</h3>
              <p class="service-pain">Біль: Рутина, втрачені заявки, все ведеться в блокнотах.</p>
              <p class="service-do">Що робимо: Зв'язуємо сайт, CRM, телефонію, оплати.</p>
              <p class="service-result">Результат: Система, де всі дані оновлюються автоматично.</p>
              <p style="font-size:0.85rem;color:var(--color-accent);font-weight:700;margin-bottom:12px">від 60 000 ₴</p>
              <a href="#/automation" class="btn-link">Детальніше <i data-lucide="arrow-right"></i></a>
            </div>

            <div class="service-card-premium">
              <div class="service-icon"><i data-lucide="briefcase"></i></div>
              <h3>Супровід / Побудова ВП</h3>
              <p class="service-pain">Біль: Власник хоче вийти з ручного управління.</p>
              <p class="service-do">Що робимо: Регулярний аналіз KPI, контроль CRM, корекція.</p>
              <p class="service-result">Результат: Системний відділ продажів, що працює автономно.</p>
              <p style="font-size:0.85rem;color:var(--color-accent);font-weight:700;margin-bottom:12px">від 80 000 ₴/міс</p>
              <a href="#/support" class="btn-link">Детальніше <i data-lucide="arrow-right"></i></a>
            </div>

            <div class="service-card-premium">
              <div class="service-icon"><i data-lucide="bot"></i></div>
              <h3>Впровадження ШІ та Розробка</h3>
              <p class="service-pain">Біль: Стандартні рішення не працюють, багато рутини та помилок.</p>
              <p class="service-do">Що робимо: Створюємо кастомні CRM, AI-ботів, розумні графіки.</p>
              <p class="service-result">Результат: Власна IT-система, яка повністю закриває ваші процеси.</p>
              <p style="font-size:0.85rem;color:var(--color-accent);font-weight:700;margin-bottom:12px">від 150 000 ₴</p>
              <a href="#/ai-solutions" class="btn-link">Детальніше <i data-lucide="arrow-right"></i></a>
            </div>

            <div class="service-card-premium">
              <div class="service-icon"><i data-lucide="message-circle"></i></div>
              <h3>Індивідуальна консультація</h3>
              <p class="service-pain">Біль: Немає розуміння, з чого почати виправлення хаосу.</p>
              <p class="service-do">Що робимо: Детальний розбір вашої воронки за 1 зустріч.</p>
              <p class="service-result">Результат: Оцінка ситуації та список пріоритетів.</p>
              <p style="font-size:0.85rem;color:var(--color-accent);font-weight:700;margin-bottom:12px">від 6 000 ₴</p>
              <a href="#/consultation" class="btn-link">Детальніше <i data-lucide="arrow-right"></i></a>
            </div>
          </div>
        </div>
      </section>

      <section class="section final-cta-section text-center">
        <div class="container">
          <h2>Не знаєте, яка послуга потрібна саме вам?</h2>
          <p class="cta-subtitle">Запишіться на діагностичну консультацію. Ми розберемо ваш відділ продажів і я підкажу найкращий шлях.</p>
          <div class="hero-cta-group justify-content-center">
            <a href="#/consultation" class="btn btn-primary btn-lg">Забронювати зустріч</a>
          </div>
        </div>
      </section>
    `;
  },
  init() {}
};
