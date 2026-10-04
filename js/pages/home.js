// js/pages/home.js
export const Home = {
  render() {
    return `
      <!-- HERO -->
      <section class="hero-section premium-dark">
        <div class="container">
          <div class="hero-grid" style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 40px; align-items: center;">
            <div class="hero-content fade-in">
              <div class="hero-badge"><span class="pulse-dot"></span> Експерт з системних продажів</div>
              <h1 class="hero-title">Перетворюю хаотичні продажі на систему, яка приводить клієнтів до оплати</h1>
              <p class="hero-subtitle">11 років у продажах. Допомагаю власникам бізнесу та керівникам знаходити точки втрати грошей, посилювати команду, впроваджувати CRM, скрипти, KPI, автоматизації та доводити заявки до оплати.</p>
              
              <div class="hero-microcopy" style="margin-bottom: 32px; padding-left: 16px; border-left: 3px solid var(--accent-blue); color: var(--text-secondary); font-style: italic;">
                "Не мотивую менеджерів «продавати краще». Я знаходжу, де саме ламається процес, і будую систему, яка контролюється цифрами."
              </div>

              <div class="hero-cta-group">
                <a href="#/consultation" class="btn btn-primary btn-lg">Забронювати консультацію</a>
                <a href="#/audit" class="btn btn-outline btn-lg">Замовити аудит продажів</a>
              </div>
              <div class="hero-trust-text" style="margin-top: 16px; font-size: 0.85rem; color: var(--text-muted);">
                <i data-lucide="check" style="width:16px; display:inline-block; vertical-align:middle; color:var(--accent-green);"></i> Перший розбір — з фокусом на реальні втрати у вашій воронці
              </div>
            </div>

            <div class="hero-visual fade-in" style="animation-delay: 0.2s; position: relative;">
              <!-- Floating Cards -->
              <div class="floating-card crm-card"><i data-lucide="database"></i> CRM-аудит</div>
              <div class="floating-card script-card"><i data-lucide="message-square"></i> Скрипти</div>
              <div class="floating-card kpi-card"><i data-lucide="target"></i> KPI</div>
              <div class="floating-card auto-card"><i data-lucide="cpu"></i> Автоматизація</div>
              
              <div style="width: 100%; aspect-ratio: 4/5; border: 1px solid var(--border-dark); border-radius: var(--radius-lg); position:relative; overflow:hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                <img src="img/expert.jpg?v=20261004" alt="Експерт з системних продажів" style="width: 100%; height: 100%; object-fit: cover; object-position: center top;">
              </div>
              
              <!-- Schema Flow -->
              <div class="schema-flow-hero">
                <span>Ліди</span> <i data-lucide="arrow-right"></i>
                <span>CRM</span> <i data-lucide="arrow-right"></i>
                <span>Менеджер</span> <i data-lucide="arrow-right"></i>
                <span>Скрипт</span> <i data-lucide="arrow-right"></i>
                <span style="color:var(--color-success)">Оплата</span> <i data-lucide="arrow-right"></i>
                <span>Аналітика</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- EXPERTISE (Numbers) -->
      <section class="section">
        <div class="container">
          <div class="section-header text-center">
            <h2>Досвід, який базується на реальній операційній роботі</h2>
          </div>
          <div class="numbers-grid">
            <div class="number-card">
              <div class="number-value">11 років</div>
              <div class="number-title">У продажах</div>
              <div class="number-desc">від менеджера до управління командами та побудови процесів</div>
            </div>
            <div class="number-card">
              <div class="number-value">6+ років</div>
              <div class="number-title">Побудова ВП</div>
              <div class="number-desc">воронки, CRM, KPI, скрипти, контроль якості, навчання</div>
            </div>
            <div class="number-card">
              <div class="number-value">B2B & B2C</div>
              <div class="number-title">Різні ніші</div>
              <div class="number-desc">робота з командами, де важлива швидкість, дисципліна і конверсія</div>
            </div>
            <div class="number-card">
              <div class="number-value">System</div>
              <div class="number-title">Автоматизації</div>
              <div class="number-desc">інтеграція процесів, щоб заявки не губилися між менеджерами</div>
            </div>
          </div>
        </div>
      </section>

      <!-- PAINS (Money Leaks) -->
      <section class="section pain-section">
        <div class="container">
          <div class="section-header text-center">
            <div class="section-badge badge-danger"><i data-lucide="alert-triangle"></i> Втрати грошей</div>
            <h2>Більшість бізнесів втрачають гроші не через поганий продукт, а через хаос у продажах</h2>
            <p class="section-subtitle">Заявка може бути якісною, але якщо менеджер довго відповідає, не веде CRM або не закриває наступний крок — бізнес платить за ліда, який просто зникає.</p>
          </div>
          
          <div class="pain-grid">
            <div class="pain-card">
              <div class="pain-icon"><i data-lucide="clock"></i></div>
              <div class="pain-problem">Лід прийшов — але менеджер відповів пізно</div>
              <div class="pain-effect"><i data-lucide="alert-circle"></i> Клієнт уже залишив заявку конкурентам. Швидкість реакції = гроші.</div>
            </div>
            <div class="pain-card">
              <div class="pain-icon"><i data-lucide="database"></i></div>
              <div class="pain-problem">CRM заповнена формально</div>
              <div class="pain-effect"><i data-lucide="alert-circle"></i> Керівник не бачить реальної картини продажів і приймає рішення наосліп.</div>
            </div>
            <div class="pain-card">
              <div class="pain-icon"><i data-lucide="file-x"></i></div>
              <div class="pain-problem">Скрипт є, але ним не користуються</div>
              <div class="pain-effect"><i data-lucide="alert-circle"></i> Кожен менеджер продає як уміє, а не як потрібно бізнесу.</div>
            </div>
            <div class="pain-card">
              <div class="pain-icon"><i data-lucide="pause-circle"></i></div>
              <div class="pain-problem">Клієнт сказав «подумаю»</div>
              <div class="pain-effect"><i data-lucide="alert-circle"></i> Менеджер не закрив наступний крок і втратив угоду назавжди.</div>
            </div>
            <div class="pain-card">
              <div class="pain-icon"><i data-lucide="phone-off"></i></div>
              <div class="pain-problem">Немає контролю дзвінків</div>
              <div class="pain-effect"><i data-lucide="alert-circle"></i> Команда повторює ті самі помилки тижнями без зворотного зв'язку.</div>
            </div>
            <div class="pain-card">
              <div class="pain-icon"><i data-lucide="unplug"></i></div>
              <div class="pain-problem">Немає автоматизації</div>
              <div class="pain-effect"><i data-lucide="alert-circle"></i> Заявки, оплати, задачі живуть у різних місцях і губляться.</div>
            </div>
          </div>

          <div class="text-center" style="margin-top: 40px;">
            <a href="#/audit" class="btn btn-primary btn-lg">Хочу знайти точки втрати грошей у своєму відділі</a>
          </div>
        </div>
      </section>

      <!-- DIAGNOSTICS CHECKLIST -->
      <section class="section premium-dark" id="diagnostic-section" style="padding: 80px 0;">
        <div class="container">
          <div class="diagnostic-container">
            
            <div class="diagnostic-header">
              <div class="section-badge badge-accent" style="margin-bottom: 12px; display:inline-flex; align-items:center; gap:6px;"><i data-lucide="activity"></i> Експрес-діагностика</div>
              <h2>Перевірте, наскільки системно працює ваш відділ продажів</h2>
              <p>Дайте чесну відповідь на 8 питань. Якщо більшість відповідей — “ні”, ваш бізнес, ймовірно, щодня втрачає заявки, клієнтів і оплату.</p>
            </div>

            <div class="diag-grid">
              <label class="diag-card" tabindex="0">
                <input type="checkbox" class="diag-check">
                <div class="diag-checkbox">
                  <i data-lucide="check" class="diag-check-icon"></i>
                </div>
                <span class="diag-text">Чи всі заявки обробляються в перші 5–15 хвилин?</span>
              </label>

              <label class="diag-card" tabindex="0">
                <input type="checkbox" class="diag-check">
                <div class="diag-checkbox">
                  <i data-lucide="check" class="diag-check-icon"></i>
                </div>
                <span class="diag-text">Чи бачите ви в CRM реальний статус кожного клієнта?</span>
              </label>

              <label class="diag-card" tabindex="0">
                <input type="checkbox" class="diag-check">
                <div class="diag-checkbox">
                  <i data-lucide="check" class="diag-check-icon"></i>
                </div>
                <span class="diag-text">Чи є у менеджерів єдиний скрипт першого контакту?</span>
              </label>

              <label class="diag-card" tabindex="0">
                <input type="checkbox" class="diag-check">
                <div class="diag-checkbox">
                  <i data-lucide="check" class="diag-check-icon"></i>
                </div>
                <span class="diag-text">Чи знаєте ви топ-3 причини відмов за останній місяць?</span>
              </label>

              <label class="diag-card" tabindex="0">
                <input type="checkbox" class="diag-check">
                <div class="diag-checkbox">
                  <i data-lucide="check" class="diag-check-icon"></i>
                </div>
                <span class="diag-text">Чи слухаєте ви дзвінки менеджерів системно?</span>
              </label>

              <label class="diag-card" tabindex="0">
                <input type="checkbox" class="diag-check">
                <div class="diag-checkbox">
                  <i data-lucide="check" class="diag-check-icon"></i>
                </div>
                <span class="diag-text">Чи є KPI не тільки по оплатах, а й по діях?</span>
              </label>

              <label class="diag-card" tabindex="0">
                <input type="checkbox" class="diag-check">
                <div class="diag-checkbox">
                  <i data-lucide="check" class="diag-check-icon"></i>
                </div>
                <span class="diag-text">Чи є автоматичні нагадування по повторних контактах?</span>
              </label>

              <label class="diag-card" tabindex="0">
                <input type="checkbox" class="diag-check">
                <div class="diag-checkbox">
                  <i data-lucide="check" class="diag-check-icon"></i>
                </div>
                <span class="diag-text">Чи бачите ви, де саме клієнт випадає з воронки?</span>
              </label>
            </div>

            <!-- Dynamic Result Card -->
            <div class="diag-result-card status-init" id="diag-result-card">
              <div class="diag-result-top">
                <span class="diag-result-badge" id="diag-badge"><i data-lucide="info"></i> ДІАГНОСТИКА СИТУАЦІЇ</span>
                <span style="font-size: 0.85rem; color: var(--text-muted);" id="diag-count-text">Позначено проблем: 0 з 8</span>
              </div>
              <div class="diag-result-body" id="diag-result-body">
                Якщо ви відповіли “ні” хоча б на 3 питання — ваш відділ продажів, ймовірно, втрачає гроші щодня. Натисніть на картки із проблематикою вище, щоб розрахувати рівень ризиків.
              </div>
            </div>

            <!-- CTA Footer -->
            <div class="diag-cta-box">
              <div class="diag-cta-title">Хочете побачити, де саме ваша команда втрачає заявки?</div>
              <div class="diag-cta-buttons">
                <a href="#/audit" class="btn btn-primary btn-lg"><i data-lucide="search"></i> Замовити експрес-аудит</a>
                <a href="https://t.me/an_zaaz" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-lg"><i data-lucide="send"></i> Обговорити в Telegram</a>
              </div>
            </div>

            <!-- Process Schema Flow -->
            <div class="diag-process-schema">
              <div class="diag-schema-flow">
                <span class="diag-schema-step">Заявка</span>
                <span class="diag-schema-arrow"><i data-lucide="chevron-right"></i></span>
                <span class="diag-schema-step">CRM</span>
                <span class="diag-schema-arrow"><i data-lucide="chevron-right"></i></span>
                <span class="diag-schema-step">Менеджер</span>
                <span class="diag-schema-arrow"><i data-lucide="chevron-right"></i></span>
                <span class="diag-schema-step">Скрипт</span>
                <span class="diag-schema-arrow"><i data-lucide="chevron-right"></i></span>
                <span class="diag-schema-step">Повторний контакт</span>
                <span class="diag-schema-arrow"><i data-lucide="chevron-right"></i></span>
                <span class="diag-schema-step step-pay">Оплата</span>
              </div>
              <p class="diag-schema-subtext">Якщо хоча б один етап не контролюється — бізнес втрачає частину потенційного прибутку.</p>
            </div>

          </div>
        </div>
      </section>

      <!-- SERVICES -->
      <section class="section">
        <div class="container">
          <div class="section-header text-center">
            <h2>Послуги, які закривають не симптоми, а причини просідання продажів</h2>
            <p class="section-subtitle">Кожна послуга побудована навколо практичної задачі бізнесу: знайти втрати, посилити комунікацію, налаштувати CRM, навчити команду або автоматизувати процеси.</p>
          </div>
          <div class="services-grid">
            <div class="service-card-premium">
              <div class="service-icon"><i data-lucide="search"></i></div>
              <h3>Аудит відділу продажів</h3>
              <p class="service-pain">Біль: Заявок багато, а оплат мало; ліди губляться.</p>
              <p class="service-do">Що робимо: Аналізуємо воронку, CRM, швидкість, дзвінки та скрипти.</p>
              <p class="service-result">Результат: Карта точок втрати грошей та чіткий план дій.</p>
              <a href="#/audit" class="btn-link">Детальніше <i data-lucide="arrow-right"></i></a>
            </div>

            <div class="service-card-premium">
              <div class="service-icon"><i data-lucide="file-text"></i></div>
              <h3>Скрипти та комунікація</h3>
              <p class="service-pain">Біль: Менеджери губляться на запереченнях і зливають ціною.</p>
              <p class="service-do">Що робимо: Створюємо логіку продажу без шаблонних фраз.</p>
              <p class="service-result">Результат: Менеджер веде клієнта, а не просто відповідає.</p>
              <a href="#/scripts" class="btn-link">Детальніше <i data-lucide="arrow-right"></i></a>
            </div>

            <div class="service-card-premium">
              <div class="service-icon"><i data-lucide="users"></i></div>
              <h3>Тренінги для команд</h3>
              <p class="service-pain">Біль: Команда продає кожен по-своєму або боїться ціни.</p>
              <p class="service-do">Що робимо: Практичні розбори, робота з потребами та закриттям.</p>
              <p class="service-result">Результат: Команда розуміє єдиний стандарт продажів.</p>
              <a href="#/trainings" class="btn-link">Детальніше <i data-lucide="arrow-right"></i></a>
            </div>

            <div class="service-card-premium">
              <div class="service-icon"><i data-lucide="cpu"></i></div>
              <h3>CRM та Автоматизація</h3>
              <p class="service-pain">Біль: Рутина, втрачені заявки, все в блокнотах.</p>
              <p class="service-do">Що робимо: Зв'язуємо сайт, CRM, телефонію, оплати.</p>
              <p class="service-result">Результат: Система, де всі дані оновлюються автоматично.</p>
              <a href="#/automation" class="btn-link">Детальніше <i data-lucide="arrow-right"></i></a>
            </div>

            <div class="service-card-premium">
              <div class="service-icon"><i data-lucide="message-circle"></i></div>
              <h3>Індивідуальна консультація</h3>
              <p class="service-pain">Біль: Немає розуміння, з чого почати виправлення хаосу.</p>
              <p class="service-do">Що робимо: Детальний розбір вашої воронки за 1 зустріч.</p>
              <p class="service-result">Результат: Оцінка ситуації та список пріоритетів.</p>
              <a href="#/consultation" class="btn-link">Детальніше <i data-lucide="arrow-right"></i></a>
            </div>

            <div class="service-card-premium">
              <div class="service-icon"><i data-lucide="briefcase"></i></div>
              <h3>Супровід / Побудова ВП</h3>
              <p class="service-pain">Біль: Власник хоче вийти з ручного управління.</p>
              <p class="service-do">Що робимо: Аналіз KPI, контроль CRM, корекція.</p>
              <p class="service-result">Результат: Системний відділ продажів, що працює автономно.</p>
              <a href="#/support" class="btn-link">Детальніше <i data-lucide="arrow-right"></i></a>
            </div>
          </div>
        </div>
      </section>

      <!-- METHODOLOGY -->
      <section class="section method-section premium-dark">
        <div class="container text-center">
          <div class="section-header text-center">
            <h2>Метод Sales System</h2>
            <p class="section-subtitle">Системний підхід з 6 кроків, що гарантує результат.</p>
          </div>
          
          <div class="method-steps" style="display:flex; flex-wrap:wrap; justify-content:center; gap: 20px;">
            <div class="method-step" style="width:calc(33% - 20px); text-align:left; padding:24px; background:rgba(255,255,255,0.05); border-radius:var(--radius-md);">
              <h4 style="color:white; margin-bottom:12px;">1. Діагностика</h4>
              <p style="color:var(--text-muted); font-size:0.9rem;">Знаходимо, де саме відділ продажів втрачає гроші.</p>
            </div>
            <div class="method-step" style="width:calc(33% - 20px); text-align:left; padding:24px; background:rgba(255,255,255,0.05); border-radius:var(--radius-md);">
              <h4 style="color:white; margin-bottom:12px;">2. Структура</h4>
              <p style="color:var(--text-muted); font-size:0.9rem;">Прописуємо воронку, ролі, KPI, CRM-статуси та точки контролю.</p>
            </div>
            <div class="method-step" style="width:calc(33% - 20px); text-align:left; padding:24px; background:rgba(255,255,255,0.05); border-radius:var(--radius-md);">
              <h4 style="color:white; margin-bottom:12px;">3. Комунікація</h4>
              <p style="color:var(--text-muted); font-size:0.9rem;">Створюємо скрипти, мовні модулі, блок заперечень і стандарти.</p>
            </div>
            <div class="method-step" style="width:calc(33% - 20px); text-align:left; padding:24px; background:rgba(255,255,255,0.05); border-radius:var(--radius-md);">
              <h4 style="color:white; margin-bottom:12px;">4. Автоматизація</h4>
              <p style="color:var(--text-muted); font-size:0.9rem;">Прибираємо ручну рутину: заявки, задачі, оплати, аналітика.</p>
            </div>
            <div class="method-step" style="width:calc(33% - 20px); text-align:left; padding:24px; background:rgba(255,255,255,0.05); border-radius:var(--radius-md);">
              <h4 style="color:white; margin-bottom:12px;">5. Навчання</h4>
              <p style="color:var(--text-muted); font-size:0.9rem;">Навчаємо команду працювати за новими правилами.</p>
            </div>
            <div class="method-step" style="width:calc(33% - 20px); text-align:left; padding:24px; background:rgba(255,255,255,0.05); border-radius:var(--radius-md);">
              <h4 style="color:white; margin-bottom:12px;">6. Контроль</h4>
              <p style="color:var(--text-muted); font-size:0.9rem;">Впроваджуємо регулярну аналітику, QA, план-факт і корекцію.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- NICHES & TEAMS -->
      <section class="section premium-dark" style="padding: 70px 0;">
        <div class="container text-center">
          <div class="section-badge badge-accent" style="margin-bottom: 12px; display:inline-flex; align-items:center; gap:6px;">
            <i data-lucide="building-2"></i> НІШІ ТА КОМАНДИ
          </div>
          <h2 style="font-size: 2.2rem; font-weight: 800; color: #ffffff; margin-bottom: 16px;">З якими бізнесами працюю</h2>
          <p style="color: var(--text-secondary); max-width: 650px; margin: 0 auto 36px; font-size: 1rem; line-height: 1.6;">
            Адаптую воронку, CRM, скрипти та систему контролю під специфіку вашої ніші та масштаб команди.
          </p>

          <div class="niche-pills-grid">
            <div class="niche-pill-card">
              <div class="niche-pill-icon"><i data-lucide="graduation-cap"></i></div>
              <span class="niche-pill-text">Онлайн-школи</span>
            </div>
            <div class="niche-pill-card">
              <div class="niche-pill-icon"><i data-lucide="briefcase"></i></div>
              <span class="niche-pill-text">Сервісні бізнеси</span>
            </div>
            <div class="niche-pill-card">
              <div class="niche-pill-icon"><i data-lucide="shopping-cart"></i></div>
              <span class="niche-pill-text">E-commerce</span>
            </div>
            <div class="niche-pill-card">
              <div class="niche-pill-icon"><i data-lucide="building"></i></div>
              <span class="niche-pill-text">B2B компанії</span>
            </div>
            <div class="niche-pill-card">
              <div class="niche-pill-icon"><i data-lucide="users"></i></div>
              <span class="niche-pill-text">B2C продажі</span>
            </div>
            <div class="niche-pill-card">
              <div class="niche-pill-icon"><i data-lucide="headphones"></i></div>
              <span class="niche-pill-text">Кол-центри</span>
            </div>
            <div class="niche-pill-card">
              <div class="niche-pill-icon"><i data-lucide="trending-up"></i></div>
              <span class="niche-pill-text">Бізнеси, що масштабуються</span>
            </div>
          </div>
        </div>
      </section>

      <!-- TOOLS & INTEGRATIONS STACK -->
      <section class="section premium-dark" style="padding: 70px 0; border-top: 1px solid rgba(255,255,255,0.06);">
        <div class="container text-center">
          <div class="section-badge badge-accent" style="margin-bottom: 12px; display:inline-flex; align-items:center; gap:6px;">
            <i data-lucide="layers"></i> STACK & ІНТЕГРАЦІЇ
          </div>
          <h2 style="font-size: 2.2rem; font-weight: 800; color: #ffffff; margin-bottom: 16px;">Інструменти, які використовую</h2>
          <p style="color: var(--text-secondary); max-width: 760px; margin: 0 auto 40px; font-size: 1.05rem; line-height: 1.6;">
            Працюю з CRM, телефонією, аналітикою, оплатами та AI-інструментами, щоб зв’язати заявки, менеджерів, статуси, оплату й контроль в одну систему.
          </p>

          <div class="tools-category-grid">
            <!-- Category 1: CRM -->
            <div class="tools-cat-card">
              <div class="tools-cat-header">
                <i data-lucide="layout-grid" class="tools-cat-icon"></i>
                <span class="tools-cat-title">CRM-системи</span>
              </div>
              <div class="tools-pills-wrap">
                <span class="tool-glass-pill"><i data-lucide="database"></i> Pipedrive</span>
                <span class="tool-glass-pill"><i data-lucide="key"></i> KeyCRM</span>
                <span class="tool-glass-pill"><i data-lucide="grid"></i> HubSpot</span>
                <span class="tool-glass-pill"><i data-lucide="box"></i> Bitrix24</span>
              </div>
            </div>

            <!-- Category 2: Telephony -->
            <div class="tools-cat-card">
              <div class="tools-cat-header">
                <i data-lucide="phone-call" class="tools-cat-icon"></i>
                <span class="tools-cat-title">Телефонія & Дзвінки</span>
              </div>
              <div class="tools-pills-wrap">
                <span class="tool-glass-pill"><i data-lucide="phone"></i> Binotel</span>
                <span class="tool-glass-pill"><i data-lucide="mic"></i> Ringostat</span>
              </div>
            </div>

            <!-- Category 3: Analytics -->
            <div class="tools-cat-card">
              <div class="tools-cat-header">
                <i data-lucide="bar-chart-3" class="tools-cat-icon"></i>
                <span class="tools-cat-title">Аналітика & Дашборди</span>
              </div>
              <div class="tools-pills-wrap">
                <span class="tool-glass-pill"><i data-lucide="pie-chart"></i> Looker Studio</span>
                <span class="tool-glass-pill"><i data-lucide="line-chart"></i> Power BI</span>
              </div>
            </div>

            <!-- Category 4: Payments -->
            <div class="tools-cat-card">
              <div class="tools-cat-header">
                <i data-lucide="credit-card" class="tools-cat-icon"></i>
                <span class="tools-cat-title">Платежі & Оплати</span>
              </div>
              <div class="tools-pills-wrap">
                <span class="tool-glass-pill"><i data-lucide="wallet"></i> mono</span>
                <span class="tool-glass-pill"><i data-lucide="dollar-sign"></i> LiqPay</span>
                <span class="tool-glass-pill"><i data-lucide="arrow-right-left"></i> WayForPay</span>
                <span class="tool-glass-pill"><i data-lucide="coins"></i> Whitepay</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      <!-- FAQ -->
      <section class="section">
        <div class="container">
          <div class="section-header text-center">
            <h2>Поширені запитання</h2>
          </div>
          <div class="faq-container" style="max-width: 800px; margin: 0 auto;">
            
            <div class="faq-item" style="border-bottom: 1px solid var(--border-color); padding: 20px 0;">
              <h4 style="margin-bottom: 8px; color: var(--text-primary);">Чи можна почати з однієї консультації?</h4>
              <p style="color: var(--text-secondary); margin: 0;">Так. Якщо ви не готові одразу замовляти аудит або супровід, можна почати з разового розбору. На консультації ми визначимо, де зараз найбільша точка втрати грошей і що варто виправити першим.</p>
            </div>

            <div class="faq-item" style="border-bottom: 1px solid var(--border-color); padding: 20px 0;">
              <h4 style="margin-bottom: 8px; color: var(--text-primary);">Чи підходить це для маленького відділу продажів?</h4>
              <p style="color: var(--text-secondary); margin: 0;">Так. Навіть якщо у вас 1–3 менеджери, система продажів уже має бути зрозумілою: хто обробляє заявки, як ведеться CRM, як контролюються повторні контакти, які скрипти використовуються і де губляться клієнти.</p>
            </div>

            <div class="faq-item" style="border-bottom: 1px solid var(--border-color); padding: 20px 0;">
              <h4 style="margin-bottom: 8px; color: var(--text-primary);">Чи можна замовити тільки скрипти?</h4>
              <p style="color: var(--text-secondary); margin: 0;">Так, але перед написанням скриптів потрібно зрозуміти продукт, клієнтів, етапи воронки і типові заперечення. Скрипт без аналізу часто перетворюється на шаблон, який менеджери не використовують.</p>
            </div>

            <div class="faq-item" style="border-bottom: 1px solid var(--border-color); padding: 20px 0;">
              <h4 style="margin-bottom: 8px; color: var(--text-primary);">Чи можете ви допомогти з CRM?</h4>
              <p style="color: var(--text-secondary); margin: 0;">Так. Я можу проаналізувати поточну CRM, запропонувати структуру статусів, правила ведення угод, задачі, нагадування, аналітику та інтеграції.</p>
            </div>

            <div class="faq-item" style="border-bottom: 1px solid var(--border-color); padding: 20px 0;">
              <h4 style="margin-bottom: 8px; color: var(--text-primary);">Чи можна підключити оплату на сайті?</h4>
              <p style="color: var(--text-secondary); margin: 0;">Так. Можна інтегрувати mono, LiqPay, WayForPay, Portmone або крипто-оплату через Whitepay чи ручний crypto-invoice.</p>
            </div>

            <div class="faq-item" style="border-bottom: 1px solid var(--border-color); padding: 20px 0;">
              <h4 style="margin-bottom: 8px; color: var(--text-primary);">Що буде після аудиту?</h4>
              <p style="color: var(--text-secondary); margin: 0;">Ви отримаєте не просто список помилок, а зрозумілий план дій: що виправити в CRM, які скрипти змінити, які KPI контролювати, які процеси автоматизувати і що впроваджувати першим.</p>
            </div>

            <div class="faq-item" style="padding: 20px 0;">
              <h4 style="margin-bottom: 8px; color: var(--text-primary);">Чи працюєте ви з командою після тренінгу?</h4>
              <p style="color: var(--text-secondary); margin: 0;">Так. Можливий формат супроводу, де ми не просто проводимо навчання, а закріплюємо зміни через контроль, аналіз дзвінків, корекцію скриптів і роботу з керівником.</p>
            </div>

          </div>
        </div>
      </section>

      <section class="section final-cta-section text-center premium-dark" style="margin-top: 40px;">
        <div class="container">
          <h2>Не впевнені, з чого почати?</h2>
          <p class="cta-subtitle" style="color: var(--text-muted);">Почніть із консультації або експрес-аудиту. Я подивлюся на вашу ситуацію і підкажу, що дасть найбільший ефект: скрипти, CRM, автоматизація, навчання команди чи повний аудит.</p>
          <div class="hero-cta-group justify-content-center">
            <a href="#/consultation" class="btn btn-primary btn-lg">Забронювати консультацію</a>
            <a href="https://t.me/an_zaaz" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-lg"><i data-lucide="send"></i> Написати в Telegram</a>
          </div>
        </div>
      </section>
    `;
  },
  init() {
    const cards = document.querySelectorAll('.diag-card');
    const resultCard = document.getElementById('diag-result-card');
    const resultBadge = document.getElementById('diag-badge');
    const countText = document.getElementById('diag-count-text');
    const resultBody = document.getElementById('diag-result-body');

    if (!cards.length) return;

    function updateDiagnostic() {
      const checkedCount = document.querySelectorAll('.diag-card.is-selected').length;

      if (countText) {
        countText.textContent = `Позначено проблем: ${checkedCount} з 8`;
      }

      if (!resultCard) return;

      resultCard.className = 'diag-result-card ';

      if (checkedCount === 0) {
        resultCard.classList.add('status-init');
        if (resultBadge) resultBadge.innerHTML = '<i data-lucide="info"></i> ДІАГНОСТИКА СИТУАЦІЇ';
        if (resultBody) resultBody.textContent = 'Якщо ви відповіли “ні” хоча б на 3 питання — ваш відділ продажів, ймовірно, втрачає гроші щодня. Натисніть на картки із проблематикою вище, щоб розрахувати рівень ризиків.';
      } else if (checkedCount <= 2) {
        resultCard.classList.add('status-good');
        if (resultBadge) resultBadge.innerHTML = '<i data-lucide="check-circle"></i> НИЗЬКИЙ РІВЕНЬ РИЗИКУ';
        if (resultBody) resultBody.textContent = 'Ваш відділ має базову систему, але точковий аудит може показати, де ще можна підсилити конверсію.';
      } else if (checkedCount <= 5) {
        resultCard.classList.add('status-warning');
        if (resultBadge) resultBadge.innerHTML = '<i data-lucide="alert-triangle"></i> ПОМІРНИЙ РІВЕНЬ РИЗИКУ';
        if (resultBody) resultBody.textContent = 'У вашій системі продажів є зони ризику. Частина заявок може губитися через CRM, скрипти, контроль або повторні контакти.';
      } else {
        resultCard.classList.add('status-danger');
        if (resultBadge) resultBadge.innerHTML = '<i data-lucide="alert-octagon"></i> КРИТИЧНИЙ РІВЕНЬ РИЗИКУ';
        if (resultBody) resultBody.textContent = 'Ваш відділ продажів, ймовірно, щодня втрачає гроші через хаос у процесах. Рекомендовано почати з експрес-аудиту.';
      }

      if (window.lucide) {
        lucide.createIcons();
      }
    }

    cards.forEach(card => {
      const checkbox = card.querySelector('input[type="checkbox"]');

      const toggleCard = (e) => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        if (checkbox.checked) {
          card.classList.add('is-selected');
        } else {
          card.classList.remove('is-selected');
        }
        updateDiagnostic();
      };

      card.addEventListener('click', toggleCard);

      card.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          checkbox.checked = !checkbox.checked;
          if (checkbox.checked) {
            card.classList.add('is-selected');
          } else {
            card.classList.remove('is-selected');
          }
          updateDiagnostic();
        }
      });
    });

    updateDiagnostic();
  }
};
