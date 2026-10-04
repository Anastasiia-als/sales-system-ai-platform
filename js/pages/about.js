// js/pages/about.js
export const About = {
  render() {
    return `
      <section class="page-hero premium-dark">
        <div class="container">
          <div class="about-hero">
            <div class="about-bio fade-in">
              <div class="section-badge"><i data-lucide="award"></i> Експерт</div>
              <h2>Я не продаю мотивацію. Я будую системи, які дають результат.</h2>
              <p>Мій шлях у продажах почався 11 років тому. Я пройшла всі етапи: від менеджера на холодних дзвінках до керівника відділу та незалежного консультанта.</p>
              <p>Я знаю, як це — коли клієнт каже "дорого", коли план "горить", і коли CRM не працює так, як треба. Саме тому мій підхід базується виключно на практиці, а не на теоретичних книжках.</p>
              <div class="hero-cta-group" style="margin-top: 24px;">
                <a href="#/consultation" class="btn btn-primary">Зв'язатися зі мною</a>
                <a href="#/cases" class="btn btn-outline">Подивитись кейси</a>
                <a href="https://github.com/Anastasiia-als/sales-system-ai-platform" target="_blank" class="btn btn-outline" style="display:inline-flex; align-items:center; gap:6px;"><i data-lucide="github"></i> GitHub</a>
              </div>
            </div>
            <div class="about-photo fade-in" style="animation-delay: 0.2s; max-width: 420px; border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border-dark); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
              <img src="img/expert.jpg?v=20261004" alt="Експерт з системних продажів" style="width: 100%; height: 100%; object-fit: cover; display: block;">
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="numbers-grid">
            <div class="number-card"><div class="number-value">11 років</div><div class="number-title">У продажах</div></div>
            <div class="number-card"><div class="number-value">6+ років</div><div class="number-title">Управління командами</div></div>
            <div class="number-card"><div class="number-value">50+</div><div class="number-title">Налаштованих CRM</div></div>
            <div class="number-card"><div class="number-value">B2B/B2C</div><div class="number-title">Досвід у нішах</div></div>
          </div>
        </div>
      </section>

      <section class="section bg-light">
        <div class="container">
          <div class="section-header text-center">
            <h2>Мої принципи роботи</h2>
          </div>
          <div class="why-me-grid">
            <div class="why-card">
              <i data-lucide="bar-chart-2"></i>
              <div>
                <h4>Цифри, а не відчуття</h4>
                <p>Не можна покращити те, що ви не рахуєте. Я завжди починаю з аналітики воронки, конверсії та швидкості обробки.</p>
              </div>
            </div>
            <div class="why-card">
              <i data-lucide="settings"></i>
              <div>
                <h4>Система, а не люди</h4>
                <p>Якщо продажі тримаються тільки на "зірковому" менеджері — це ризик. Я будую процеси, які працюють незалежно від кадрів.</p>
              </div>
            </div>
            <div class="why-card">
              <i data-lucide="shield"></i>
              <div>
                <h4>Продаж без "впарювання"</h4>
                <p>Правильний продаж — це допомога клієнту у вирішенні його проблеми. Я навчаю екологічній комунікації.</p>
              </div>
            </div>
            <div class="why-card">
              <i data-lucide="cpu"></i>
              <div>
                <h4>Автоматизація рутини</h4>
                <p>Менеджер має говорити з клієнтом, а не переписувати дані. Усе, що можна автоматизувати — має бути автоматизовано.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  },
  init() {}
};
