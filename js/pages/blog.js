// js/pages/blog.js
export const Blog = {
  render() {
    return `
      <section class="page-hero premium-dark">
        <div class="container">
          <div class="section-badge"><i data-lucide="book-open"></i> База знань</div>
          <h1>Блог: Про системи продажів без води</h1>
          <p class="hero-subtitle">Статті, інструкції та розбори реальних помилок, які коштують бізнесу мільйони.</p>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="cases-grid"> <!-- Reusing grid styles -->
            
            <div class="case-card">
              <div class="case-niche">Конверсія</div>
              <h3>Чому заявки є, а продажів мало?</h3>
              <p class="case-pain">Розбираємо ТОП-5 причин, чому ліди відвалюються до моменту оплати: від швидкості реакції менеджера до відсутності закриття на наступний крок.</p>
              <div style="margin-top: 16px;"><a href="#" class="btn-link" onclick="event.preventDefault()">Читати статтю <i data-lucide="arrow-right"></i></a></div>
            </div>

            <div class="case-card">
              <div class="case-niche">CRM</div>
              <h3>Як зрозуміти, що CRM у вашій компанії не працює</h3>
              <p class="case-pain">Якщо менеджери заповнюють CRM ввечері "для галочки", а ви не можете за 1 хвилину знайти причину відмови клієнта — система не працює.</p>
              <div style="margin-top: 16px;"><a href="#" class="btn-link" onclick="event.preventDefault()">Читати статтю <i data-lucide="arrow-right"></i></a></div>
            </div>

            <div class="case-card">
              <div class="case-niche">Скрипти</div>
              <h3>Що має бути у скрипті продажів?</h3>
              <p class="case-pain">Як написати скрипт, який менеджери захочуть використовувати. Структура від першого "Алло" до опрацювання "Дорого".</p>
              <div style="margin-top: 16px;"><a href="#" class="btn-link" onclick="event.preventDefault()">Читати статтю <i data-lucide="arrow-right"></i></a></div>
            </div>

            <div class="case-card">
              <div class="case-niche">Управління</div>
              <h3>Як керівнику контролювати менеджерів без ручного хаосу</h3>
              <p class="case-pain">Які KPI варто рахувати щодня, а які щотижня? Чому контроль "плану оплат" — це запізнілий показник.</p>
              <div style="margin-top: 16px;"><a href="#" class="btn-link" onclick="event.preventDefault()">Читати статтю <i data-lucide="arrow-right"></i></a></div>
            </div>

            <div class="case-card">
              <div class="case-niche">Автоматизація</div>
              <h3>Які процеси у відділі продажів варто автоматизувати першими</h3>
              <p class="case-pain">Розподіл лідів, створення задач на пропущені дзвінки, автоматичні рахунки та follow-up повідомлення.</p>
              <div style="margin-top: 16px;"><a href="#" class="btn-link" onclick="event.preventDefault()">Читати статтю <i data-lucide="arrow-right"></i></a></div>
            </div>

          </div>
        </div>
      </section>

      <section class="section final-cta-section text-center">
        <div class="container">
          <h2>Хочете перевести свій бізнес на новий рівень?</h2>
          <p class="cta-subtitle">Забронюйте консультацію, ми розберемо ваші поточні проблеми і знайдемо точки зростання.</p>
          <div class="hero-cta-group justify-content-center">
            <a href="#/consultation" class="btn btn-primary btn-lg">Забронювати консультацію</a>
          </div>
        </div>
      </section>
    `;
  },
  init() {}
};
