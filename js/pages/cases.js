// js/pages/cases.js
export const Cases = {
  render() {
    return `
      <section class="page-hero premium-dark">
        <div class="container">
          <div class="section-badge"><i data-lucide="folder-check"></i> Результати</div>
          <h1>Кейси та вирішені задачі</h1>
          <p class="hero-subtitle">Реальні приклади того, як системний підхід до продажів збільшує прибуток компанії, зменшує відсоток відмов та звільняє час власника.</p>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="cases-grid">
            
            <div class="case-card">
              <div class="case-niche">Онлайн-школа (EdTech)</div>
              <h3>Впровадження CRM та скриптів для відділу з 4 менеджерів</h3>
              <p class="case-pain"><strong>Ситуація:</strong> Заявки губилися в Telegram. Менеджери довго відповідали, конверсія з ліда в оплату була низькою через невміння працювати із запереченням "дорого".</p>
              <p class="case-action"><strong>Що зроблено:</strong> Підключено KeyCRM. Налаштовано авто-розподіл лідів. Розроблено скрипт кваліфікації та обробки заперечень. Введено KPI на швидкість першого контакту.</p>
              <div class="case-metrics">
                <div class="case-metric">
                  <div class="metric-val">+35%</div>
                  <div class="metric-lbl">Конверсія</div>
                </div>
                <div class="case-metric">
                  <div class="metric-val">< 5 хв</div>
                  <div class="metric-lbl">Швидкість відповіді</div>
                </div>
              </div>
            </div>

            <div class="case-card">
              <div class="case-niche">B2B Послуги</div>
              <h3>Побудова системи продажів "з нуля" для власника</h3>
              <p class="case-pain"><strong>Ситуація:</strong> Власник продавав сам. Не міг делегувати, бо "менеджери не розуміють продукт". Бізнес перестав рости через нестачу часу засновника.</p>
              <p class="case-action"><strong>Що зроблено:</strong> Оцифровано процес продажу власника. Створено воронку в Pipedrive. Написана "Книга продажів". Найнято та навчено 2 менеджерів.</p>
              <div class="case-metrics">
                <div class="case-metric">
                  <div class="metric-val">-80%</div>
                  <div class="metric-lbl">Часу власника на продажі</div>
                </div>
                <div class="case-metric">
                  <div class="metric-val">x2</div>
                  <div class="metric-lbl">Кількість нових угод</div>
                </div>
              </div>
            </div>

            <div class="case-card">
              <div class="case-niche">E-commerce</div>
              <h3>Аудит та оптимізація воронки інтернет-магазину</h3>
              <p class="case-pain"><strong>Ситуація:</strong> Багато "кинутих кошиків". Менеджери просто підтверджували замовлення, не роблячи апсейлів (допродажів).</p>
              <p class="case-action"><strong>Що зроблено:</strong> Налаштовано тригерні повідомлення в Viber/Telegram для кинутих кошиків. Впроваджено матрицю допродажів (сценарії крос-селу).</p>
              <div class="case-metrics">
                <div class="case-metric">
                  <div class="metric-val">+22%</div>
                  <div class="metric-lbl">Середній чек</div>
                </div>
                <div class="case-metric">
                  <div class="metric-val">+15%</div>
                  <div class="metric-lbl">Повернення клієнтів</div>
                </div>
              </div>
            </div>

            <div class="case-card">
              <div class="case-niche">Медичний центр</div>
              <h3>Тренінг з комунікації для адміністраторів</h3>
              <p class="case-pain"><strong>Ситуація:</strong> Адміністратори працювали як "довідкове бюро" — просто називали ціни на послуги, після чого пацієнти йшли "думати".</p>
              <p class="case-action"><strong>Що зроблено:</strong> Проведено практичний тренінг. Змінено скрипт відповіді на вхідний дзвінок: перехід від "консультування" до "запису на прийом".</p>
              <div class="case-metrics">
                <div class="case-metric">
                  <div class="metric-val">+40%</div>
                  <div class="metric-lbl">Записів на прийом</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section class="section final-cta-section text-center">
        <div class="container">
          <h2>Хочете подібних результатів?</h2>
          <p class="cta-subtitle">Давайте розберемо ваш процес продажів на консультації.</p>
          <div class="hero-cta-group justify-content-center">
            <a href="#/consultation" class="btn btn-primary btn-lg">Забронювати зустріч</a>
          </div>
        </div>
      </section>
    `;
  },
  init() {}
};
