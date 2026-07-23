// js/pages/scripts.js
export const Scripts = {
  render() {
    return `
      <section class="page-hero premium-dark">
        <div class="container">
          <div class="section-badge"><i data-lucide="message-square"></i> Комунікація</div>
          <h1>Скрипти продажів, які звучать живо і ведуть клієнта до рішення</h1>
          <p class="hero-subtitle">Я не пишу шаблони, які менеджери читають як роботи. Я створюю логіку діалогу: як почати розмову, виявити потребу, презентувати цінність, відпрацювати сумніви й закрити клієнта на оплату або наступний крок.</p>
          <div class="page-hero-cta">
            <a href="#/consultation" class="btn btn-primary btn-lg">Замовити скрипти</a>
            <a href="https://t.me/sales_expert" target="_blank" class="btn btn-outline btn-lg"><i data-lucide="eye"></i> Показати приклад структури</a>
          </div>
          <div class="price-hero-badge">
            <span class="price-value">від 30 000 ₴</span>
            <span class="price-label">за комплект скриптів</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-header text-center">
            <h2>Чому ваші поточні скрипти не працюють?</h2>
          </div>
          <div class="symptoms-grid">
            <div class="symptom-item"><i data-lucide="x-circle"></i> Звучать штучно (клієнт чує, що йому читають з папірця)</div>
            <div class="symptom-item"><i data-lucide="x-circle"></i> Не адаптовані під реальні заперечення</div>
            <div class="symptom-item"><i data-lucide="x-circle"></i> Менеджери їх самі не використовують</div>
            <div class="symptom-item"><i data-lucide="x-circle"></i> Немає логіки закриття на наступний крок</div>
            <div class="symptom-item"><i data-lucide="x-circle"></i> Немає правильних питань для виявлення потреби</div>
            <div class="symptom-item"><i data-lucide="x-circle"></i> Немає follow-up повідомлень (дожимів)</div>
            <div class="symptom-item"><i data-lucide="x-circle"></i> Немає сценаріїв для різних типів клієнтів</div>
            <div class="symptom-item"><i data-lucide="x-circle"></i> Скрипт не прив’язаний до етапів у CRM</div>
          </div>
        </div>
      </section>

      <section class="section bg-dark text-white" style="border-radius: var(--radius-lg); margin: 40px auto; padding: 60px 20px; max-width: 1200px;">
        <div class="container text-center">
          <h2 style="color: white; margin-bottom: 16px;">Скрипт — це не текст. Це система прийняття рішення.</h2>
          <p style="color: var(--text-secondary); margin-bottom: 40px;">Логіка, яка веде клієнта від недовіри до покупки.</p>
          
          <!-- Вау-блок: Схема -->
          <div class="schema-flow" style="background: rgba(0,0,0,0.3); padding: 30px; border-radius: var(--radius-md);">
            <div class="schema-node">Контакт</div>
            <div class="schema-arrow"><i data-lucide="arrow-right"></i></div>
            <div class="schema-node">Довіра</div>
            <div class="schema-arrow"><i data-lucide="arrow-right"></i></div>
            <div class="schema-node">Потреба</div>
            <div class="schema-arrow"><i data-lucide="arrow-right"></i></div>
            <div class="schema-node">Цінність</div>
            <div class="schema-arrow"><i data-lucide="arrow-right"></i></div>
            <div class="schema-node">Заперечення</div>
            <div class="schema-arrow"><i data-lucide="arrow-right"></i></div>
            <div class="schema-node">Наступний крок</div>
            <div class="schema-arrow"><i data-lucide="arrow-right"></i></div>
            <div class="schema-node" style="border-color: var(--accent-green);">Оплата</div>
          </div>
        </div>
      </section>

      <section class="section bg-light">
        <div class="container">
          <div class="section-header">
            <h2>Що входить у послугу (12 кроків)</h2>
          </div>
          <div class="analysis-grid">
            <div class="analysis-card"><h4>1. Аналіз продукту</h4><p>Вивчаємо ваш продукт зсередини.</p></div>
            <div class="analysis-card"><h4>2. Аналіз клієнтів</h4><p>Хто вони, чого бояться, що цінують.</p></div>
            <div class="analysis-card"><h4>3. Аналіз діалогів</h4><p>Слухаємо поточні дзвінки менеджерів.</p></div>
            <div class="analysis-card"><h4>4. Перший контакт</h4><p>Структура перших секунд розмови.</p></div>
            <div class="analysis-card"><h4>5. Кваліфікація</h4><p>Питання для розуміння потенціалу клієнта.</p></div>
            <div class="analysis-card"><h4>6. Презентація цінності</h4><p>Продаж вигод, а не характеристик.</p></div>
            <div class="analysis-card"><h4>7. Робота із запереченнями</h4><p>Логіка відповідей на "дорого", "подумаю".</p></div>
            <div class="analysis-card"><h4>8. Закриття</h4><p>Перехід до оплати чи зустрічі.</p></div>
            <div class="analysis-card"><h4>9. Повторний контакт</h4><p>Як нагадати про себе без "набридання".</p></div>
            <div class="analysis-card"><h4>10. Повідомлення</h4><p>Шаблони для месенджерів (Viber/Telegram).</p></div>
            <div class="analysis-card"><h4>11. Чек-лист якості</h4><p>Критерії оцінки дзвінка для керівника.</p></div>
            <div class="analysis-card"><h4>12. Інструкція</h4><p>Правила роботи зі скриптом для команди.</p></div>
          </div>
        </div>
      </section>

      <section class="section final-cta-section text-center">
        <div class="container">
          <h2>Хочете скрипти, які менеджери реально використовують?</h2>
          <p class="cta-subtitle">Запишіться на консультацію, ми розберемо ваш продукт та цільову аудиторію, щоб зрозуміти, яка структура підійде найкраще.</p>
          <div class="hero-cta-group justify-content-center">
            <a href="#/consultation" class="btn btn-primary btn-lg">Забронювати консультацію</a>
          </div>
        </div>
      </section>
    `;
  },
  init() {}
};
