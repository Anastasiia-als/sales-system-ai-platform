// js/pages/automation.js
export const Automation = {
  render() {
    return `
      <section class="page-hero premium-dark">
        <div class="container">
          <div class="section-badge"><i data-lucide="cpu"></i> Технології</div>
          <h1>Автоматизація продажів: щоб заявки, CRM, менеджери, оплати й аналітика працювали як одна система</h1>
          <p class="hero-subtitle">Допомагаю бізнесу зв’язати сайт, форми, CRM, телефонію, Telegram, оплату, нагадування й аналітику, щоб заявки не губилися, менеджери не забували задачі, а керівник бачив реальну картину.</p>
          <div class="page-hero-cta">
            <a href="#/consultation" class="btn btn-primary btn-lg">Обговорити автоматизацію</a>
            <a href="#/cases" class="btn btn-outline btn-lg"><i data-lucide="git-merge"></i> Замовити карту процесів</a>
          </div>
          <div class="price-hero-badge">
            <span class="price-value">від 60 000 ₴</span>
            <span class="price-label">за проєкт автоматизації</span>
          </div>
        </div>
      </section>

      <section class="section bg-dark text-white" style="border-radius: var(--radius-lg); margin: 40px auto; padding: 60px 20px; max-width: 1200px;">
        <div class="container text-center">
          <h2 style="color: white; margin-bottom: 40px;">Схема автоматизації (Як це має працювати)</h2>
          <div class="schema-flow" style="background: rgba(0,0,0,0.3); padding: 30px; border-radius: var(--radius-md);">
            <div class="schema-node">Сайт / Insta / TG</div>
            <div class="schema-arrow"><i data-lucide="arrow-right"></i></div>
            <div class="schema-node">CRM (Лід)</div>
            <div class="schema-arrow"><i data-lucide="arrow-right"></i></div>
            <div class="schema-node">Менеджер (Задача)</div>
            <div class="schema-arrow"><i data-lucide="arrow-right"></i></div>
            <div class="schema-node">Оплата (Фіксація)</div>
            <div class="schema-arrow"><i data-lucide="arrow-right"></i></div>
            <div class="schema-node">Аналітика</div>
            <div class="schema-arrow"><i data-lucide="arrow-right"></i></div>
            <div class="schema-node" style="border-color: var(--accent-green);">Повторний контакт</div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-header text-center">
            <h2>Що ми автоматизуємо (15 пунктів)</h2>
          </div>
          <div class="analysis-grid" style="grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));">
            <div class="analysis-card"><h4>1. Передача заявок</h4><p>З сайту прямо в CRM без втрат.</p></div>
            <div class="analysis-card"><h4>2. Створення лідів</h4><p>Авто-розподіл між менеджерами.</p></div>
            <div class="analysis-card"><h4>3. Telegram-сповіщення</h4><p>Повідомлення про нову заявку.</p></div>
            <div class="analysis-card"><h4>4. Нагадування</h4><p>Автоматичні задачі для менеджерів.</p></div>
            <div class="analysis-card"><h4>5. Follow-up</h4><p>Ланцюжки повідомлень "дожимів".</p></div>
            <div class="analysis-card"><h4>6. Оплати</h4><p>Інтеграція mono / LiqPay / WayForPay.</p></div>
            <div class="analysis-card"><h4>7. Статуси угод</h4><p>Змінюються після факту оплати.</p></div>
            <div class="analysis-card"><h4>8. Інтеграція телефонії</h4><p>Binotel / Ringostat в картці клієнта.</p></div>
            <div class="analysis-card"><h4>9. Google Calendar</h4><p>Синхронізація зустрічей.</p></div>
            <div class="analysis-card"><h4>10. Google Sheets</h4><p>Експорт даних для резервних копій.</p></div>
            <div class="analysis-card"><h4>11. Аналітика</h4><p>Looker Studio / Power BI дашборди.</p></div>
            <div class="analysis-card"><h4>12. Контроль дзвінків</h4><p>Автозадачі на пропущені виклики.</p></div>
            <div class="analysis-card"><h4>13. Повідомлення</h4><p>SMS/Viber інформування клієнта.</p></div>
            <div class="analysis-card"><h4>14. Чат-боти</h4><p>Первинна кваліфікація лідів.</p></div>
            <div class="analysis-card"><h4>15. Онлайн-бронювання</h4><p>Авто-генерація посилань на зустріч.</p></div>
          </div>
        </div>
      </section>

      <section class="section bg-light">
        <div class="container">
          <div class="before-after-grid">
            <div class="before-col">
              <h3><i data-lucide="x-circle"></i> Типовий хаос до автоматизації</h3>
              <ul>
                <li><i data-lucide="minus"></i> Заявки падають з різних каналів (втрачаються)</li>
                <li><i data-lucide="minus"></i> Менеджери забувають передзвонити</li>
                <li><i data-lucide="minus"></i> CRM оновлюється вручну в кінці дня</li>
                <li><i data-lucide="minus"></i> Оплати перевіряються окремо в банківському додатку</li>
                <li><i data-lucide="minus"></i> Керівник питає статус у чатах ("Що по клієнту Х?")</li>
                <li><i data-lucide="minus"></i> Аналітика збирається вручну таблицями</li>
              </ul>
            </div>
            <div class="after-col">
              <h3><i data-lucide="check-circle"></i> Після автоматизації</h3>
              <ul>
                <li><i data-lucide="check"></i> Кожна заявка автоматично потрапляє в CRM</li>
                <li><i data-lucide="check"></i> Менеджер миттєво отримує задачу на дзвінок</li>
                <li><i data-lucide="check"></i> Керівник бачить статус в реальному часі</li>
                <li><i data-lucide="check"></i> Клієнт отримує авто-повідомлення (напр. рахунок)</li>
                <li><i data-lucide="check"></i> Оплата фіксується автоматично в CRM</li>
                <li><i data-lucide="check"></i> Аналітика оновлюється без участі людей</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="section final-cta-section text-center">
        <div class="container">
          <h2>Хочете автоматизувати продажі?</h2>
          <p class="cta-subtitle">Запишіться на консультацію. Я подивлюся на вашу ситуацію і підкажу, що дасть найбільший ефект.</p>
          <div class="hero-cta-group justify-content-center">
            <a href="#/consultation" class="btn btn-primary btn-lg">Забронювати консультацію</a>
          </div>
        </div>
      </section>
    `;
  },
  init() {}
};
