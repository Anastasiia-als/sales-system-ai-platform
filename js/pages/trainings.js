// js/pages/trainings.js
export const Trainings = {
  render() {
    return `
      <section class="page-hero premium-dark">
        <div class="container">
          <div class="section-badge"><i data-lucide="users"></i> Навчання команди</div>
          <h1>Тренінги з продажів, після яких менеджери розуміють не тільки що казати, а навіщо</h1>
          <p class="hero-subtitle">Навчаю команди працювати з клієнтом у реальних ситуаціях: перший контакт, виявлення потреби, презентація, ціна, заперечення, "подумаю", повторний контакт і закриття в оплату.</p>
          <div class="page-hero-cta">
            <a href="#/consultation" class="btn btn-primary btn-lg">Замовити тренінг для команди</a>
            <a href="https://t.me/sales_expert" target="_blank" class="btn btn-outline btn-lg"><i data-lucide="send"></i> Обговорити програму</a>
          </div>
          <div class="price-hero-badge">
            <span class="price-value">від 40 000 ₴</span>
            <span class="price-label">за тренінг-день</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-header text-center">
            <h2>Формати тренінгів</h2>
          </div>
          <div class="analysis-grid">
            <div class="analysis-card"><h4>1. Етапи продажу</h4><p>Базова структура ефективного діалогу від А до Я.</p></div>
            <div class="analysis-card"><h4>2. Робота із запереченнями</h4><p>Як не зливати клієнтів на етапі сумнівів.</p></div>
            <div class="analysis-card"><h4>3. Закриття на оплату</h4><p>Як впевнено називати ціну і вести до транзакції.</p></div>
            <div class="analysis-card"><h4>4. Продаж через потребу</h4><p>SPIN-технології та виявлення прихованих мотивів.</p></div>
            <div class="analysis-card"><h4>5. CRM-дисципліна</h4><p>Як вести клієнта в системі, щоб ніхто не губився.</p></div>
            <div class="analysis-card"><h4>6. Тренінг для Team Lead</h4><p>Навчання керівників контролю якості та коучингу.</p></div>
            <div class="analysis-card"><h4>7. Для нових менеджерів</h4><p>Швидка адаптація та вихід на план продажів.</p></div>
            <div class="analysis-card"><h4>8. Практичний розбір</h4><p>Прослуховування та аналіз реальних дзвінків онлайн.</p></div>
          </div>
        </div>
      </section>

      <section class="section bg-light">
        <div class="container">
          <div class="section-header text-center">
            <h2>Що входить у навчання</h2>
          </div>
          <div class="deliverables-grid">
            <div class="deliverable-item"><i data-lucide="check-circle"></i> Аналіз поточних проблем команди</div>
            <div class="deliverable-item"><i data-lucide="check-circle"></i> Програма під конкретний бізнес</div>
            <div class="deliverable-item"><i data-lucide="check-circle"></i> Теорія без зайвої води</div>
            <div class="deliverable-item"><i data-lucide="check-circle"></i> Рольові діалоги</div>
            <div class="deliverable-item"><i data-lucide="check-circle"></i> Розбір реальних ситуацій</div>
            <div class="deliverable-item"><i data-lucide="check-circle"></i> Практичні вправи</div>
            <div class="deliverable-item"><i data-lucide="check-circle"></i> Шаблони фраз та чек-листи</div>
            <div class="deliverable-item"><i data-lucide="check-circle"></i> Рекомендації для керівника після тренінгу</div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="before-after-grid">
            <div class="before-col">
              <h3><i data-lucide="x-circle"></i> До тренінгу</h3>
              <ul>
                <li><i data-lucide="minus"></i> Менеджери бояться називати високу ціну</li>
                <li><i data-lucide="minus"></i> Не ведуть розмову (працюють довідковим бюро)</li>
                <li><i data-lucide="minus"></i> Губляться на запереченнях клієнта</li>
                <li><i data-lucide="minus"></i> Не закривають на наступний крок</li>
                <li><i data-lucide="minus"></i> По-різному комунікують із клієнтами</li>
              </ul>
            </div>
            <div class="after-col">
              <h3><i data-lucide="check-circle"></i> Після тренінгу</h3>
              <ul>
                <li><i data-lucide="check"></i> Розуміють структуру діалогу</li>
                <li><i data-lucide="check"></i> Вміють ставити правильні питання</li>
                <li><i data-lucide="check"></i> Презентують цінність, а не просто ціну</li>
                <li><i data-lucide="check"></i> Працюють із запереченнями професійно</li>
                <li><i data-lucide="check"></i> Керівник має основу для контролю якості</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="section final-cta-section text-center">
        <div class="container">
          <h2>Не впевнені, з чого почати?</h2>
          <p class="cta-subtitle">Почніть із консультації або експрес-аудиту. Я подивлюся на вашу ситуацію і підкажу, що дасть найбільший ефект.</p>
          <div class="hero-cta-group justify-content-center">
            <a href="#/consultation" class="btn btn-primary btn-lg">Забронювати консультацію</a>
          </div>
        </div>
      </section>
    `;
  },
  init() {}
};
