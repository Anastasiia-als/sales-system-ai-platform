// js/pages/audit.js
export const Audit = {
  render() {
    return `
      <section class="page-hero premium-dark">
        <div class="container">
          <div class="section-badge"><i data-lucide="search"></i> Глибока аналітика</div>
          <h1>Аудит відділу продажів: покажу, де саме ваш бізнес втрачає заявки, клієнтів і оплату</h1>
          <p class="hero-subtitle">Розберу вашу CRM, воронку, дзвінки, скрипти, швидкість обробки заявок, роботу менеджерів і контроль керівника. На виході ви отримаєте не загальні поради, а карту конкретних точок втрати грошей.</p>
          <div class="page-hero-cta">
            <a href="#/consultation" class="btn btn-primary btn-lg">Замовити аудит</a>
            <a href="https://t.me/an_zaaz" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-lg"><i data-lucide="send"></i> Запитати в Telegram</a>
          </div>
          <div class="price-hero-badge">
            <span class="price-value">від 45 000 ₴</span>
            <span class="price-label">за комплексний аудит</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-header text-center">
            <h2>Коли бізнесу потрібен аудит?</h2>
          </div>
          <div class="symptoms-grid">
            <div class="symptom-item"><i data-lucide="alert-circle"></i> Заявок багато, а оплат мало</div>
            <div class="symptom-item"><i data-lucide="alert-circle"></i> Клієнти зникають після презентації ціни</div>
            <div class="symptom-item"><i data-lucide="alert-circle"></i> Менеджери не ведуть CRM системно</div>
            <div class="symptom-item"><i data-lucide="alert-circle"></i> Немає розуміння, чому просідає конверсія</div>
            <div class="symptom-item"><i data-lucide="alert-circle"></i> Керівник не знає, хто реально продає якісно</div>
            <div class="symptom-item"><i data-lucide="alert-circle"></i> Менеджери не закривають на наступний крок</div>
            <div class="symptom-item"><i data-lucide="alert-circle"></i> Повторні контакти та задачі губляться</div>
            <div class="symptom-item"><i data-lucide="alert-circle"></i> Немає прозорих причин відмов</div>
            <div class="symptom-item" style="grid-column: 1 / -1;"><i data-lucide="alert-triangle" style="color:var(--danger)"></i> Бізнес витрачає гроші на рекламу, але не контролює шлях ліда до оплати</div>
          </div>
        </div>
      </section>

      <section class="section bg-light">
        <div class="container">
          <div class="section-header text-center">
            <h2>Що саме аналізується (10 напрямків)</h2>
            <p class="section-subtitle">Натисніть на кожен пункт, щоб побачити деталі та вплив на результат</p>
          </div>
          <div class="accordion-grid" id="audit-accordion">
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">1</span><h4>Воронка продажів</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Аналізую логіку етапів воронки: скільки їх, чи відповідають вони реальному шляху клієнта, чи є «сміттєві» статуси типу «В роботі» або «Думає». Перевіряю відсоток переходу між етапами.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: дозволяє знайти етап, де «зливається» найбільше клієнтів і сфокусувати зусилля саме там.</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">2</span><h4>CRM-статуси</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Перевіряю, чи коректно менеджери ведуть картки клієнтів: чи заповнені поля, чи оновлюються статуси, чи є дублікати. Дивлюсь, чи дає CRM реальну картину або це «мертва база».</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: чиста CRM = реальна аналітика, правильні рішення керівника і жодного загубленого ліда.</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">3</span><h4>Швидкість обробки</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Вимірюю реальний час від моменту заявки до першого контакту менеджера. Стандарт — до 5 хвилин. У більшості бізнесів — від 30 хвилин до декількох годин.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: скорочення часу реакції з 2 годин до 5 хвилин підвищує конверсію на 30-50%.</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">4</span><h4>Дзвінки менеджерів</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Прослуховую мінімум 20 дзвінків кожного менеджера. Оцінюю привітання, кваліфікацію, презентацію, роботу з запереченнями, закриття. Виявляю типові помилки.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: конкретна оцінка якості кожного менеджера та розуміння, кого навчати, а кого — замінювати.</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">5</span><h4>Скрипти та модулі</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Перевіряю, чи існують скрипти, чи актуальні вони, чи відповідають реальним запереченням клієнтів. Чи є модулі для різних типів клієнтів і ситуацій.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: правильний скрипт = єдиний стандарт продажів і стабільна конверсія незалежно від менеджера.</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">6</span><h4>Робота із запереченнями</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Аналізую, як менеджери реагують на «дорого», «подумаю», «вже працюємо з іншими». Чи є банк аргументів, чи вони імпровізують щоразу.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: системна робота із запереченнями збільшує конверсію з етапу «Думає» на 20-35%.</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">7</span><h4>Причини відмов</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Збираю та класифікую реальні причини, чому клієнти не купують. Часто виявляється, що 70% відмов — це 2-3 повторювані причини, які можна усунути.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: знання причин відмов дозволяє точково усунути бар'єри та повернути частину втрачених клієнтів.</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">8</span><h4>KPI та контроль</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Перевіряю, які показники контролює керівник. Чи є KPI не тільки по оплатах, а й по діях: кількість дзвінків, швидкість, якість CRM, конверсія на кожному етапі.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: правильні KPI дають керівнику інструмент управління, а не просто «звіт про виручку».</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">9</span><h4>Повторні контакти</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Перевіряю, чи дожимаються «теплі» ліди через тиждень/місяць. Чи є система follow-up: автоматичні нагадування, задачі в CRM, ланцюжки повідомлень.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: до 40% продажів відбуваються після 3-5 повторних контактів. Без follow-up ви їх втрачаєте.</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">10</span><h4>Автоматизації</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Аналізую, де ваші менеджери витрачають час на ручну рутину: перенос даних, виставлення рахунків, нагадування. Визначаю точки, які можна автоматизувати вже зараз.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: автоматизація рутини вивільняє 2-3 години менеджера щодня для реальних продажів.</div>
              </div></div>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="before-after-grid">
            <div class="before-col">
              <h3><i data-lucide="x-circle"></i> До аудиту</h3>
              <ul>
                <li><i data-lucide="minus"></i> Заявки губляться</li>
                <li><i data-lucide="minus"></i> CRM не дає прозорості</li>
                <li><i data-lucide="minus"></i> Менеджери працюють по-різному</li>
                <li><i data-lucide="minus"></i> Немає контролю причин відмов</li>
                <li><i data-lucide="minus"></i> Керівник гасить пожежі вручну</li>
              </ul>
            </div>
            <div class="after-col">
              <h3><i data-lucide="check-circle"></i> Після аудиту</h3>
              <ul>
                <li><i data-lucide="check"></i> Видно кожен етап воронки</li>
                <li><i data-lucide="check"></i> Зрозуміло, де втрачаються клієнти</li>
                <li><i data-lucide="check"></i> Є список пріоритетів</li>
                <li><i data-lucide="check"></i> Зрозуміло, що виправляти першим</li>
                <li><i data-lucide="check"></i> Команда отримує чіткі правила роботи</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="section bg-light">
        <div class="container">
          <div class="section-header text-center">
            <h2>Що клієнт отримує на виході</h2>
          </div>
          <div class="deliverables-grid">
            <div class="deliverable-item"><i data-lucide="file-text"></i> PDF-звіт аудиту</div>
            <div class="deliverable-item"><i data-lucide="map"></i> Карта точок втрати грошей</div>
            <div class="deliverable-item"><i data-lucide="alert-triangle"></i> Список критичних помилок</div>
            <div class="deliverable-item"><i data-lucide="list-ordered"></i> Пріоритети впровадження</div>
            <div class="deliverable-item"><i data-lucide="settings"></i> Рекомендації по CRM</div>
            <div class="deliverable-item"><i data-lucide="message-square"></i> Рекомендації по скриптах</div>
            <div class="deliverable-item"><i data-lucide="target"></i> Рекомендації по KPI</div>
            <div class="deliverable-item"><i data-lucide="calendar"></i> План дій на 14 / 30 днів</div>
            <div class="deliverable-item"><i data-lucide="video"></i> Фінальна онлайн-зустріч із поясненням</div>
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
  init() {
    document.querySelectorAll('#audit-accordion .accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const card = header.closest('.accordion-card');
        card.classList.toggle('open');
      });
    });
  }
};
