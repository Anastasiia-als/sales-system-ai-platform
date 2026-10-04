// js/pages/support.js
export const Support = {
  render() {
    return `
      <section class="page-hero premium-dark">
        <div class="container">
          <div class="section-badge"><i data-lucide="briefcase"></i> High-Ticket</div>
          <h1>Супровід відділу продажів: не разова допомога, а системна робота на результат</h1>
          <p class="hero-subtitle">Регулярно працюю з власником, керівником і командою: аналізую показники, знаходжу слабкі місця, коригую процеси, скрипти, CRM, KPI та допомагаю впроваджувати зміни в реальну роботу.</p>
          <div class="page-hero-cta">
            <a href="#/consultation" class="btn btn-primary btn-lg">Обговорити супровід</a>
            <a href="https://t.me/an_zaaz" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-lg"><i data-lucide="send"></i> Написати в Telegram</a>
          </div>
          <div class="price-hero-badge">
            <span class="price-value">від 80 000 ₴/міс</span>
            <span class="price-label">щомісячний формат</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-header text-center">
            <h2>Чому разовий аудит — це не завжди достатньо</h2>
            <p class="section-subtitle">Аудит покаже проблеми. Але хто буде контролювати впровадження змін? Хто перевірить, що менеджери дійсно працюють за новими скриптами? Хто скоригує KPI через місяць? Саме для цього існує формат супроводу.</p>
          </div>

          <div class="accordion-grid" id="support-accordion">
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">1</span><h4>Щотижневі стратегічні зустрічі</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Зустрічаємося з власником або керівником ВП онлайн (Zoom/Google Meet) раз на тиждень. Розбираємо поточні цифри, аналізуємо проблемні ситуації, приймаємо рішення по оптимізації.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: Постійний фокус на проблемних зонах замість «гасіння пожеж». Рішення приймаються на основі даних.</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">2</span><h4>Аналіз KPI та конверсії</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Контролюю ключові метрики: конверсія на кожному етапі воронки, швидкість обробки заявок, середній чек, кількість результативних дзвінків. Знаходжу просідання ще до того, як вони стануть критичними.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: Ви завжди знаєте, де втрачаються гроші, і реагуєте проактивно, а не постфактум.</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">3</span><h4>Контроль CRM та дисципліни</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Перевіряю правильність заповнення карток клієнтів, актуальність статусів, наявність задач та нагадувань. Формую звіт по кожному менеджеру з рекомендаціями.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: CRM стає реальним інструментом продажів, а не формальним звітом.</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">4</span><h4>Прослуховування та аналіз дзвінків</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Щотижня прослуховую 5-10 дзвінків кожного менеджера. Оцінюю за чек-листом якості, даю персональний зворотний зв'язок, фіксую прогрес і точки росту.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: Менеджери зростають у навичках щотижня, конверсія стабільно покращується.</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">5</span><h4>Корекція скриптів та комунікації</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Оновлюю скрипти під реальні заперечення клієнтів, зміни ринку, нові продукти. Скрипт — живий документ, який має адаптуватись щомісяця.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: Скрипти завжди актуальні, менеджери готові до нових типів заперечень.</div>
              </div></div>
            </div>
            <div class="accordion-card">
              <div class="accordion-header"><div class="accordion-header-left"><span class="acc-num">6</span><h4>Впровадження автоматизацій</h4></div><i data-lucide="chevron-down" class="acc-chevron"></i></div>
              <div class="accordion-body"><div class="accordion-body-inner">
                <p class="acc-detail">Поступово автоматизуємо рутинні процеси: авто-задачі, нагадування, follow-up ланцюжки, Telegram-сповіщення, інтеграція оплат. Без шоку для команди.</p>
                <div class="acc-impact"><i data-lucide="trending-up"></i> Вплив: Менеджери витрачають час на продажі, а не на ручне перенесення даних.</div>
              </div></div>
            </div>
          </div>
        </div>
      </section>

      <section class="section bg-light">
        <div class="container">
          <div class="section-header text-center">
            <h2>Для кого підходить формат супроводу</h2>
          </div>
          <div class="symptoms-grid">
            <div class="symptom-item"><i data-lucide="check"></i> Бізнес має команду 3+ менеджерів і хоче системності</div>
            <div class="symptom-item"><i data-lucide="check"></i> Власник хоче вийти з ручного управління продажами</div>
            <div class="symptom-item"><i data-lucide="check"></i> Керівник ВП не бачить повної картини без зовнішнього погляду</div>
            <div class="symptom-item"><i data-lucide="check"></i> Команда потребує зовнішнього експертного контролю та навчання</div>
            <div class="symptom-item"><i data-lucide="check"></i> Продажі ростуть нестабільно і залежать від «зірок»</div>
            <div class="symptom-item"><i data-lucide="check"></i> Потрібна підтримка в управлінських рішеннях та наймі</div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          
          <div class="section-header text-center" style="margin-bottom: 48px;">
            <h2>Як виглядають результати нашої роботи</h2>
            <p class="section-subtitle">Ви отримуєте не просто "час експерта", а готові інструменти контролю та управління продажами, які ми впровадимо у ваш бізнес.</p>
          </div>

          <div class="examples-grid" style="display: flex; flex-direction: column; gap: 40px; margin-bottom: 80px;">
            
            <!-- Дашборд KPI -->
            <div class="example-card" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-dark); border-radius: var(--radius-lg); padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
              <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(0, 112, 243, 0.1); display: flex; align-items: center; justify-content: center;">
                  <i data-lucide="bar-chart-2" style="color: var(--accent-blue); width: 24px; height: 24px;"></i>
                </div>
                <h3 style="margin: 0; font-size: 1.4rem;">Приклад 1: Звітність та контроль конверсії</h3>
              </div>
              <p style="color: var(--text-secondary); margin-bottom: 24px; font-size: 1rem; line-height: 1.6;">Замість того, щоб в кінці місяця дізнаватись про "невиконання плану", ви щотижня будете бачити воронку кожного менеджера і де саме він втрачає клієнтів. Я створю для вас подібний дашборд і навчу ним користуватись.</p>
              
              <div class="table-responsive" style="overflow-x: auto; background: rgba(10,15,28,0.7); border-radius: var(--radius-md); border: 1px solid var(--border-dark);">
                <table style="width: 100%; text-align: left; border-collapse: collapse; min-width: 800px; font-size: 0.9rem;">
                  <thead>
                    <tr style="border-bottom: 1px solid var(--border-dark); background: rgba(255,255,255,0.03);">
                      <th style="padding: 16px; color: var(--text-muted); font-weight: 500;">Менеджер</th>
                      <th style="padding: 16px; color: var(--text-muted); font-weight: 500;">Нові ліди</th>
                      <th style="padding: 16px; color: var(--text-muted); font-weight: 500;">Кваліфіковані</th>
                      <th style="padding: 16px; color: var(--text-muted); font-weight: 500;">Конверсія (Квал.)</th>
                      <th style="padding: 16px; color: var(--text-muted); font-weight: 500;">Рахунки</th>
                      <th style="padding: 16px; color: var(--text-muted); font-weight: 500;">Оплати</th>
                      <th style="padding: 16px; color: var(--text-muted); font-weight: 500;">Загальна конв.</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom: 1px solid var(--border-dark);">
                      <td style="padding: 16px; font-weight: 600;">Олександр П.</td>
                      <td style="padding: 16px;">145</td>
                      <td style="padding: 16px;">112</td>
                      <td style="padding: 16px; color: var(--accent-blue); font-weight: 600;">77%</td>
                      <td style="padding: 16px;">45</td>
                      <td style="padding: 16px;">18</td>
                      <td style="padding: 16px; color: var(--color-success); font-weight: 600;">12.4%</td>
                    </tr>
                    <tr style="border-bottom: 1px solid var(--border-dark); background: rgba(255,255,255,0.01);">
                      <td style="padding: 16px; font-weight: 600;">Марія К.</td>
                      <td style="padding: 16px;">130</td>
                      <td style="padding: 16px;">98</td>
                      <td style="padding: 16px; color: var(--accent-blue); font-weight: 600;">75%</td>
                      <td style="padding: 16px;">22</td>
                      <td style="padding: 16px;">5</td>
                      <td style="padding: 16px; color: var(--color-danger); font-weight: 600;">3.8% <i data-lucide="arrow-down" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i></td>
                    </tr>
                    <tr>
                      <td style="padding: 16px; font-weight: 600;">Іван С.</td>
                      <td style="padding: 16px;">152</td>
                      <td style="padding: 16px;">60</td>
                      <td style="padding: 16px; color: var(--color-danger); font-weight: 600;">39% <i data-lucide="arrow-down" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i></td>
                      <td style="padding: 16px;">15</td>
                      <td style="padding: 16px;">4</td>
                      <td style="padding: 16px; color: var(--color-danger); font-weight: 600;">2.6%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style="margin-top: 24px; padding: 16px 20px; background: rgba(240, 62, 62, 0.1); border-left: 4px solid var(--color-danger); border-radius: 0 var(--radius-md) var(--radius-md) 0;">
                <h4 style="margin-bottom: 8px; color: var(--color-danger); display: flex; align-items: center; gap: 8px;"><i data-lucide="search" style="width: 18px; height: 18px;"></i> Висновок експерта (приклад):</h4>
                <p style="margin: 0; font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5;"><strong>Іван</strong> втрачає лідів на етапі кваліфікації (лише 39% проходять далі) — скоріше за все, проблема з презентацією або невміння пояснити цінність. <strong>Марія</strong> добре кваліфікує, але має проблему з "дожимом" (низька конверсія з рахунку в оплату). На стратегічній зустрічі ми скоригуємо роботу Марії з техніками закриття, а у Івана перевіримо перші хвилини діалогу.</p>
              </div>
            </div>

            <!-- QA Чек-лист -->
            <div class="example-card" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-dark); border-radius: var(--radius-lg); padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
              <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(245, 166, 35, 0.1); display: flex; align-items: center; justify-content: center;">
                  <i data-lucide="headphones" style="color: var(--color-coral); width: 24px; height: 24px;"></i>
                </div>
                <h3 style="margin: 0; font-size: 1.4rem;">Приклад 2: Об'єктивний QA-контроль дзвінків</h3>
              </div>
              <p style="color: var(--text-secondary); margin-bottom: 24px; font-size: 1rem; line-height: 1.6;">В рамках супроводу ми слухаємо дзвінки і оцінюємо їх не за принципом "погано/добре", а за чіткою бальною системою. Ваш менеджер точно знатиме, які етапи розмови він провалив, а де був молодцем.</p>
              
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                <!-- Етап 1 -->
                <div style="background: rgba(10,15,28,0.6); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-dark);">
                  <div style="font-weight: 700; color: white; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; display: flex; justify-content: space-between;">
                    <span>Встановлення контакту</span>
                    <span style="color: var(--accent-blue);">2/3 бали</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 0.9rem;">
                    <span style="color: var(--text-secondary);">Привітання за скриптом</span> 
                    <span style="color: var(--color-success); font-weight: 500; display: flex; align-items: center; gap: 4px;"><i data-lucide="check-circle" style="width: 16px; height: 16px;"></i> Так</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 0.9rem;">
                    <span style="color: var(--text-secondary);">Назвав своє ім'я</span> 
                    <span style="color: var(--color-success); font-weight: 500; display: flex; align-items: center; gap: 4px;"><i data-lucide="check-circle" style="width: 16px; height: 16px;"></i> Так</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                    <span style="color: var(--text-secondary);">Уточнив ім'я клієнта</span> 
                    <span style="color: var(--color-danger); font-weight: 500; display: flex; align-items: center; gap: 4px;"><i data-lucide="x-circle" style="width: 16px; height: 16px;"></i> Ні</span>
                  </div>
                </div>
                
                <!-- Етап 2 -->
                <div style="background: rgba(10,15,28,0.6); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-dark);">
                  <div style="font-weight: 700; color: white; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; display: flex; justify-content: space-between;">
                    <span>Виявлення потреб</span>
                    <span style="color: var(--color-danger);">1/3 бали</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 0.9rem;">
                    <span style="color: var(--text-secondary);">Поставив відкриті питання</span> 
                    <span style="color: var(--color-danger); font-weight: 500; display: flex; align-items: center; gap: 4px;"><i data-lucide="x-circle" style="width: 16px; height: 16px;"></i> Ні</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 0.9rem;">
                    <span style="color: var(--text-secondary);">Виявив бюджет та терміни</span> 
                    <span style="color: var(--color-danger); font-weight: 500; display: flex; align-items: center; gap: 4px;"><i data-lucide="x-circle" style="width: 16px; height: 16px;"></i> Ні</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                    <span style="color: var(--text-secondary);">Слухав активно</span> 
                    <span style="color: var(--color-success); font-weight: 500; display: flex; align-items: center; gap: 4px;"><i data-lucide="check-circle" style="width: 16px; height: 16px;"></i> Так</span>
                  </div>
                </div>

                <!-- Етап 3 -->
                <div style="background: rgba(10,15,28,0.6); padding: 20px; border-radius: var(--radius-md); border: 1px solid var(--border-dark);">
                  <div style="font-weight: 700; color: white; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; display: flex; justify-content: space-between;">
                    <span>Закриття</span>
                    <span style="color: var(--color-danger);">0/2 бали</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 0.9rem;">
                    <span style="color: var(--text-secondary);">Відпрацював "Дорого"</span> 
                    <span style="color: var(--color-danger); font-weight: 500; display: flex; align-items: center; gap: 4px;"><i data-lucide="x-circle" style="width: 16px; height: 16px;"></i> Ні</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                    <span style="color: var(--text-secondary);">Призначив чіткий час follow-up</span> 
                    <span style="color: var(--color-danger); font-weight: 500; display: flex; align-items: center; gap: 4px;"><i data-lucide="x-circle" style="width: 16px; height: 16px;"></i> Ні (клієнт "подумає")</span>
                  </div>
                </div>
              </div>
              
              <div style="margin-top: 24px; display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; background: linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01)); border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <i data-lucide="activity" style="color: var(--color-coral); width: 24px; height: 24px;"></i>
                  <span style="font-weight: 600; font-size: 1.1rem;">Оцінка дзвінка менеджера Івана С.:</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                  <span style="font-size: 1.5rem; font-weight: 800; color: var(--color-coral); line-height: 1;">40 / 100</span>
                  <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">Червона зона</span>
                </div>
              </div>
            </div>
            
          </div>
          
          <div class="section-header text-center">
            <h2>Формати та вартість супроводу</h2>
          </div>
          <div class="pricing-block">
            <div class="pricing-tier">
              <h4>Стартовий</h4>
              <div class="tier-price">80 000 ₴</div>
              <div class="tier-unit">на місяць / 3 місяці мінімум</div>
              <ul>
                <li><i data-lucide="check"></i> 4 стратегічні зустрічі / місяць</li>
                <li><i data-lucide="check"></i> Аналіз KPI щотижня</li>
                <li><i data-lucide="check"></i> Контроль CRM менеджерів</li>
                <li><i data-lucide="check"></i> Прослуховування 20 дзвінків / міс</li>
                <li><i data-lucide="check"></i> Рекомендації по скриптах</li>
              </ul>
              <div class="tier-artifacts" style="margin-top: 16px; margin-bottom: 24px; padding-top: 16px; border-top: 1px dashed rgba(255,255,255,0.1); text-align: left;">
                <p style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Ви отримаєте шаблони:</p>
                <ul style="margin: 0; padding: 0; list-style: none;">
                  <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-spreadsheet" style="width: 14px; height: 14px; color: var(--color-success); flex-shrink: 0; margin-top: 2px;"></i> Щоденна звітність b2b</li>
                  <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-spreadsheet" style="width: 14px; height: 14px; color: var(--color-success); flex-shrink: 0; margin-top: 2px;"></i> KQ (коефіцієнт якості) QA</li>
                  <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-spreadsheet" style="width: 14px; height: 14px; color: var(--color-success); flex-shrink: 0; margin-top: 2px;"></i> БОЛІ - РІШЕННЯ - ВИГОДИ</li>
                  <li style="display: flex; align-items: flex-start; gap: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-text" style="width: 14px; height: 14px; color: var(--accent-blue); flex-shrink: 0; margin-top: 2px;"></i> Скрипти кваліфікації</li>
                </ul>
              </div>
              <div style="display: flex; gap: 12px; margin-top: auto;">
                <button class="btn btn-outline preview-btn" style="flex: 1; padding: 12px 0;" data-tier="start">Ознайомитись</button>
                <a href="#/consultation" class="btn btn-primary" style="flex: 1; padding: 12px 0; text-align: center;">Обрати</a>
              </div>
            </div>
            <div class="pricing-tier featured">
              <h4>Оптимальний</h4>
              <div class="tier-price">120 000 ₴</div>
              <div class="tier-unit">на місяць / 3 місяці мінімум</div>
              <ul>
                <li><i data-lucide="check"></i> 4 стратегічні зустрічі / місяць</li>
                <li><i data-lucide="check"></i> Повний аналіз KPI + дашборд</li>
                <li><i data-lucide="check"></i> Контроль CRM + аудит карток</li>
                <li><i data-lucide="check"></i> Прослуховування 40 дзвінків / міс</li>
                <li><i data-lucide="check"></i> Корекція та оновлення скриптів</li>
                <li><i data-lucide="check"></i> Впровадження автоматизацій</li>
                <li><i data-lucide="check"></i> Участь у планерках команди</li>
              </ul>
              <div class="tier-artifacts" style="margin-top: 16px; margin-bottom: 24px; padding-top: 16px; border-top: 1px dashed rgba(255,255,255,0.1); text-align: left;">
                <p style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Ви отримаєте шаблони (все зі Стартового +):</p>
                <ul style="margin: 0; padding: 0; list-style: none;">
                  <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-spreadsheet" style="width: 14px; height: 14px; color: var(--color-success); flex-shrink: 0; margin-top: 2px;"></i> Аналіз продажів та процесів</li>
                  <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-spreadsheet" style="width: 14px; height: 14px; color: var(--color-success); flex-shrink: 0; margin-top: 2px;"></i> БП продажу та алгоритми до нього</li>
                  <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-spreadsheet" style="width: 14px; height: 14px; color: var(--color-success); flex-shrink: 0; margin-top: 2px;"></i> Порівняльна таблиця вибору CRM</li>
                  <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-spreadsheet" style="width: 14px; height: 14px; color: var(--color-success); flex-shrink: 0; margin-top: 2px;"></i> Розрахунок обороту</li>
                  <li style="display: flex; align-items: flex-start; gap: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-text" style="width: 14px; height: 14px; color: var(--accent-blue); flex-shrink: 0; margin-top: 2px;"></i> Карта комунікації розбору ВП</li>
                </ul>
              </div>
              <div style="display: flex; gap: 12px; margin-top: auto;">
                <button class="btn btn-outline preview-btn" style="flex: 1; padding: 12px 0; border-color: rgba(255,255,255,0.2);" data-tier="optimal">Ознайомитись</button>
                <a href="#/consultation" class="btn btn-primary" style="flex: 1; padding: 12px 0; text-align: center;">Обрати</a>
              </div>
            </div>
            <div class="pricing-tier">
              <h4>Під ключ</h4>
              <div class="tier-price">250 000 ₴</div>
              <div class="tier-unit">на місяць / індивідуально</div>
              <ul>
                <li><i data-lucide="check"></i> Все з «Оптимального»</li>
                <li><i data-lucide="check"></i> Побудова ВП з нуля</li>
                <li><i data-lucide="check"></i> Найм та адаптація менеджерів</li>
                <li><i data-lucide="check"></i> Тренінги для команди</li>
                <li><i data-lucide="check"></i> Повна CRM-інтеграція</li>
                <li><i data-lucide="check"></i> Персональний Telegram-канал</li>
              </ul>
              <div class="tier-artifacts" style="margin-top: 16px; margin-bottom: 24px; padding-top: 16px; border-top: 1px dashed rgba(255,255,255,0.1); text-align: left;">
                <p style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Ви отримаєте шаблони (все з Оптимального +):</p>
                <ul style="margin: 0; padding: 0; list-style: none;">
                  <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-spreadsheet" style="width: 14px; height: 14px; color: var(--color-success); flex-shrink: 0; margin-top: 2px;"></i> Портрет посади Менеджер / КВП</li>
                  <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-spreadsheet" style="width: 14px; height: 14px; color: var(--color-success); flex-shrink: 0; margin-top: 2px;"></i> Прототип мотивації (KPI)</li>
                  <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-spreadsheet" style="width: 14px; height: 14px; color: var(--color-success); flex-shrink: 0; margin-top: 2px;"></i> План адаптації нових менеджерів</li>
                  <li style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-spreadsheet" style="width: 14px; height: 14px; color: var(--color-success); flex-shrink: 0; margin-top: 2px;"></i> Календарне планування проєкту</li>
                  <li style="display: flex; align-items: flex-start; gap: 8px; font-size: 0.85rem; color: var(--text-muted);"><i data-lucide="file-text" style="width: 14px; height: 14px; color: var(--accent-blue); flex-shrink: 0; margin-top: 2px;"></i> Книга виробництва (продажів)</li>
                </ul>
              </div>
              <div style="display: flex; gap: 12px; margin-top: auto;">
                <button class="btn btn-outline preview-btn" style="flex: 1; padding: 12px 0;" data-tier="pro">Ознайомитись</button>
                <a href="#/consultation" class="btn btn-outline" style="flex: 1; padding: 12px 0; text-align: center; background: rgba(255,255,255,0.05);">Обговорити</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="section bg-light">
        <div class="container">
          <div class="before-after-grid">
            <div class="before-col">
              <h3><i data-lucide="x-circle"></i> Без супроводу</h3>
              <ul>
                <li><i data-lucide="minus"></i> Зміни після аудиту впроваджуються 1 тиждень, потім забуваються</li>
                <li><i data-lucide="minus"></i> Менеджери повертаються до старих звичок</li>
                <li><i data-lucide="minus"></i> Скрипти застарівають і не оновлюються</li>
                <li><i data-lucide="minus"></i> Керівник знову гасить пожежі замість управління</li>
                <li><i data-lucide="minus"></i> Немає зовнішнього контролю якості дзвінків</li>
              </ul>
            </div>
            <div class="after-col">
              <h3><i data-lucide="check-circle"></i> З супроводом</h3>
              <ul>
                <li><i data-lucide="check"></i> Зміни впроваджуються системно під контролем експерта</li>
                <li><i data-lucide="check"></i> Менеджери постійно розвиваються і отримують зворотний зв'язок</li>
                <li><i data-lucide="check"></i> Скрипти оновлюються під реальні заперечення щомісяця</li>
                <li><i data-lucide="check"></i> Керівник бачить прозору аналітику та приймає рішення на основі цифр</li>
                <li><i data-lucide="check"></i> Є зовнішній QA-контроль та об'єктивна оцінка якості</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section class="section final-cta-section text-center">
        <div class="container">
          <h2>Готові побудувати систему, а не просто «спробувати»?</h2>
          <p class="cta-subtitle">Запишіться на консультацію, обговоримо ваш відділ продажів і підберемо оптимальний формат супроводу.</p>
          <div class="hero-cta-group justify-content-center">
            <a href="#/consultation" class="btn btn-primary btn-lg">Забронювати консультацію</a>
            <a href="https://t.me/an_zaaz" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-lg"><i data-lucide="send"></i> Написати в Telegram</a>
          </div>
        </div>
      </section>

      <!-- Document Preview Modal -->
      <div id="preview-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 9999; align-items: center; justify-content: center; backdrop-filter: blur(8px);">
        <div class="modal-content" style="background: var(--bg-dark); border: 1px solid var(--border-dark); border-radius: var(--radius-lg); width: 95%; max-width: 1000px; height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          
          <div class="modal-header" style="padding: 16px 24px; border-bottom: 1px solid var(--border-dark); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02);">
            <div>
              <h3 id="modal-tier-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 12px;"><i data-lucide="folder-open" style="color: var(--accent-blue);"></i> Наповнення пакету</h3>
              <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">Ознайомтесь із реальними документами та шаблонами, які ми впроваджуємо</p>
            </div>
            <button id="close-modal" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 8px; border-radius: var(--radius-md); transition: 0.2s;"><i data-lucide="x"></i></button>
          </div>
          
          <div class="modal-body" style="padding: 0; display: flex; flex: 1; overflow: hidden;">
            <div class="modal-sidebar" style="width: 320px; border-right: 1px solid var(--border-dark); background: rgba(0,0,0,0.2); overflow-y: auto; padding: 16px;">
              <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 16px; padding-left: 8px;">Перелік артефактів</div>
              <ul id="doc-list" style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px;">
                <!-- Filled by JS -->
              </ul>
            </div>
            
            <div class="modal-preview-area" style="flex: 1; padding: 24px; overflow-y: auto; background: rgba(10,15,28,0.4); display: flex; flex-direction: column;">
              <div id="preview-content" style="background: #1e1e1e; border: 1px solid var(--border-dark); border-radius: var(--radius-md); box-shadow: 0 8px 24px rgba(0,0,0,0.3); flex: 1; overflow: hidden; display: flex; flex-direction: column;">
                <!-- Filled by JS with simulated Excel/Doc view -->
              </div>
            </div>
          </div>

        </div>
      </div>
    `;
  },
  init() {
    document.querySelectorAll('#support-accordion .accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.accordion-card').classList.toggle('open');
      });
    });

    this.initModal();
  },
  
  initModal() {
    const modal = document.getElementById('preview-modal');
    const closeBtn = document.getElementById('close-modal');
    const docList = document.getElementById('doc-list');
    const previewContent = document.getElementById('preview-content');
    const titleEl = document.getElementById('modal-tier-title');

    // Generate mock table data logic
    const generateTable = (cols, rows) => {
      let thead = '<tr>';
      cols.forEach(c => thead += `<th style="border: 1px solid #333; padding: 10px; background: #2d2d2d; font-weight: 500;">${c}</th>`);
      thead += '</tr>';

      let tbody = '';
      rows.forEach(row => {
        tbody += '<tr>';
        row.forEach(cell => {
          tbody += `<td style="border: 1px solid #333; padding: 10px;">${cell}</td>`;
        });
        tbody += '</tr>';
      });

      return `<div style="padding: 16px; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left; min-width: 700px; color: #ddd;">
          <thead>${thead}</thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>`;
    };

    const getPreviewHtml = (doc) => {
      let contentHtml = '';
      
      if (doc.type === 'excel') {
        const headerHtml = `<div style="padding: 12px 16px; background: #0f9d58; border-bottom: 1px solid #000; display: flex; align-items: center; gap: 12px; color: white;">
          <i data-lucide="file-spreadsheet" style="width: 20px; height: 20px;"></i> 
          <span style="font-weight: 500; font-size: 0.95rem;">${doc.title} - Google Sheets</span>
        </div>
        <div style="padding: 8px 16px; background: #222; border-bottom: 1px solid #333; display: flex; gap: 16px; font-size: 0.8rem; color: #aaa;">
          <span>File</span><span>Edit</span><span>View</span><span>Insert</span><span>Format</span><span>Data</span>
        </div>`;

        // Mock data based on title
        if (doc.title.includes('Щоденна звітність')) {
          contentHtml = generateTable(
            ['Дата', 'Менеджер', 'Вхідні', 'Вихідні', 'Квал', 'Рахунки', 'Оплати', 'Конверсія'],
            [
              ['12.11', 'Олександр П.', '15', '45', '8', '3', '1', '12%'],
              ['12.11', 'Марія К.', '18', '30', '10', '4', '0', '0%'],
              ['13.11', 'Олександр П.', '14', '50', '9', '5', '2', '22%'],
              ['13.11', 'Марія К.', '20', '28', '12', '6', '1', '8%'],
              ['14.11', 'Іван С.', '10', '35', '3', '1', '0', '0%']
            ]
          );
        } else if (doc.title.includes('KQ (коефіцієнт')) {
          contentHtml = generateTable(
            ['Етап розмови', 'Критерій', 'Макс. Бал', 'Оцінка', 'Коментар QA'],
            [
              ['Встановлення контакту', 'Привітання за стандартом', '10', '10', '✅ Ок'],
              ['Встановлення контакту', 'Уточнив ім\'я клієнта', '5', '0', '❌ Пропущено'],
              ['Кваліфікація', 'Виявлення болю', '20', '5', '⚠️ Не дотиснув питання'],
              ['Презентація', 'Націленість на вигоду', '30', '25', '✅ Добре'],
              ['Закриття', 'Призначив next-step', '35', '0', '❌ Клієнт пішов думати']
            ]
          );
        } else if (doc.title.includes('Прототип мотивації')) {
          contentHtml = generateTable(
            ['Посада', 'Ставка', 'Бонус за кваліфікацію', '% з продажів', 'План MIN', 'План MAX'],
            [
              ['Менеджер', '15 000 ₴', '100 ₴ / лід', '3% — 5%', '500 000 ₴', '1 000 000 ₴'],
              ['КВП (Керівник)', '30 000 ₴', '—', '1% від відділу', '1 500 000 ₴', '3 000 000 ₴'],
              ['SDR (лідоген)', '12 000 ₴', '50 ₴ / квал. лід', '—', '200 лідів/міс', '400 лідів/міс']
            ]
          );
        } else if (doc.title.includes('БОЛІ - РІШЕННЯ')) {
          contentHtml = generateTable(
            ['Біль клієнта', 'Рішення', 'Вигода для клієнта', 'Як подаємо'],
            [
              ['Менеджери не виконують план', 'Впровадження KPI + QA', 'Зростання конверсії на 15-30%', 'Через цифри та кейси'],
              ['Немає контролю дзвінків', 'Щотижневий QA-звіт', 'Зменшення відмов на 20%', 'Через демо чек-листа'],
              ['Клієнти йдуть до конкурентів', 'Оновлення скриптів + follow-up', 'Повернення до 30% клієнтів', 'Через ROI-розрахунок'],
              ['CRM не ведеться', 'Аудит та налаштування CRM', 'Прозорість воронки продажів', 'Через порівняння До/Після']
            ]
          );
        } else if (doc.title.includes('Аналіз продажів')) {
          contentHtml = generateTable(
            ['Параметр', 'Факт (поточний)', 'Норма ринку', 'Відхилення', 'Рекомендація'],
            [
              ['Конверсія лід → квал.', '35%', '60-70%', '⬇️ -25%', 'Переглянути скрипт кваліфікації'],
              ['Конверсія квал. → рахунок', '28%', '40-50%', '⬇️ -12%', 'Впровадити техніку SPIN'],
              ['Конверсія рахунок → оплата', '40%', '50-60%', '⬇️ -10%', 'Додати follow-up ланцюг'],
              ['Середній чек', '18 500 ₴', '25 000 ₴', '⬇️ -26%', 'Впровадити upsell-скрипт'],
              ['Швидкість обробки ліда', '4.5 год', '< 1 год', '⬇️ x4.5', 'Автоматизація нотифікацій']
            ]
          );
        } else if (doc.title.includes('БП продажу')) {
          contentHtml = generateTable(
            ['Етап воронки', 'Дія менеджера', 'Час (макс)', 'Результат', 'Автоматизація'],
            [
              ['1. Новий лід', 'Зателефонувати', '< 30 хв', 'Кваліфікація або відмова', 'Тригер в CRM'],
              ['2. Кваліфікований', 'Призначити зустріч', '< 24 год', 'Заплановано демо', 'Авто-нагадування'],
              ['3. Демо/Зустріч', 'Провести презентацію', 'За графіком', 'КП відправлено', 'Шаблон КП'],
              ['4. КП відправлено', 'Follow-up дзвінок', '24-48 год', 'Рахунок виставлено', 'Авто follow-up'],
              ['5. Рахунок', 'Контроль оплати', '3-5 днів', 'Оплата або відмова', 'Нотифікація'],
              ['6. Оплата', 'Передача у роботу', '< 1 год', 'Клієнт у роботі', 'Авто-передача']
            ]
          );
        } else if (doc.title.includes('Порівняльна таблиця')) {
          contentHtml = generateTable(
            ['CRM', 'Ціна / міс', 'Телефонія', 'Автоматизація', 'QA дзвінків', 'Рекомендація'],
            [
              ['Pipedrive', 'від $14', '✅ Binotel, Ringostat', '✅ Workflow', '⚠️ через інтеграцію', '⭐ Для команд 3-15'],
              ['HubSpot', 'від $0 (Free)', '✅', '✅ Sequences', '⚠️', 'Для міжнародних'],
              ['Salesforce', 'від $25', '✅', '✅ Flow', '✅', 'Для enterprise 50+'],
              ['KeyCRM', 'від 650₴', '✅', '⚠️ обмежена', '❌', 'Для e-commerce'],
              ['NetHunt', 'від $24', '✅', '✅', '⚠️', 'Для Gmail-команд']
            ]
          );
        } else if (doc.title.includes('Розрахунок обороту')) {
          contentHtml = generateTable(
            ['Показник', 'Поточний', 'Після оптимізації', 'Зміна', 'Як досягнемо'],
            [
              ['Лідів / міс', '200', '200', '—', 'Без збільшення бюджету'],
              ['Конверсія', '5%', '12%', '+140%', 'QA + скрипти + CRM'],
              ['Середній чек', '18 500 ₴', '25 000 ₴', '+35%', 'Upsell-техніки'],
              ['Угод / міс', '10', '24', '+140%', 'Системні зміни'],
              ['Оборот / міс', '185 000 ₴', '600 000 ₴', '+224%', 'Комплекс заходів'],
              ['Оборот / рік', '2.2 млн ₴', '7.2 млн ₴', '+5 млн ₴', 'При стабільних результатах']
            ]
          );
        } else if (doc.title.includes('Портрет посади')) {
          contentHtml = generateTable(
            ['Параметр', 'Менеджер з продажів', 'КВП (Керівник ВП)'],
            [
              ['Тип задач', 'Операційні продажі', 'Управління командою'],
              ['Досвід', 'від 1 року в B2B', 'від 3 років, 2+ керівником'],
              ['Навички', 'CRM, дзвінки, презентації', 'Аналітика, мотивація, найм'],
              ['KPI', 'Конверсія, кількість дзвінків', 'Оборот відділу, плинність'],
              ['Зарплата ринок', '15-25 тис + %', '30-50 тис + % від відділу'],
              ['Soft skills', 'Наполегливість, емпатія', 'Лідерство, системність']
            ]
          );
        } else if (doc.title.includes('План адаптації')) {
          contentHtml = generateTable(
            ['Тиждень', 'Тема', 'Матеріали', 'Перевірка', 'Результат'],
            [
              ['1', 'Продукт та компанія', 'Книга продукту, сайт', 'Тест 80%+', 'Знає продукт'],
              ['2', 'CRM та процеси', 'Відеоінструкція', 'Практика: 5 карток', 'Працює в CRM'],
              ['3', 'Скрипти та дзвінки', 'Скрипти, рольова гра', 'QA перших 10 дзвінків', 'Дзвонить за стандартом'],
              ['4', 'Самостійна робота', 'Реальні ліди', 'KPI: 3+ кваліфікації', 'Перші результати']
            ]
          );
        } else if (doc.title.includes('Календарне планування')) {
          contentHtml = generateTable(
            ['Місяць', 'Фаза', 'Задачі', 'Відповідальний', 'Deliverable'],
            [
              ['1', 'Аудит', 'Аналіз процесів, дзвінків, CRM', 'Експерт', 'Звіт аудиту + план'],
              ['2', 'Впровадження', 'Скрипти, CRM, KPI, QA', 'Експерт + КВП', 'Нова система продажів'],
              ['3', 'Стабілізація', 'Навчання, контроль, корекція', 'КВП + Експерт', 'Стабільні показники'],
              ['4-6', 'Масштабування', 'Найм, автоматизація, upsell', 'КВП', 'Зростання x2-3']
            ]
          );
        } else {
          contentHtml = generateTable(
            ['Колонка 1', 'Колонка 2', 'Колонка 3', 'Колонка 4'],
            [['Дані 1', 'Дані 2', 'Дані 3', 'Дані 4'], ['Дані 1', 'Дані 2', 'Дані 3', 'Дані 4']]
          );
        }
        
        return headerHtml + '<div style="flex: 1; overflow-y: auto; background: #1e1e1e;">' + contentHtml + '</div>';
        
      } else if (doc.type === 'doc') {
        return `
          <div style="padding: 12px 16px; background: #4285f4; border-bottom: 1px solid #000; display: flex; align-items: center; gap: 12px; color: white;">
            <i data-lucide="file-text" style="width: 20px; height: 20px;"></i> 
            <span style="font-weight: 500; font-size: 0.95rem;">${doc.title} - Google Docs</span>
          </div>
          <div style="padding: 8px 16px; background: #222; border-bottom: 1px solid #333; display: flex; gap: 16px; font-size: 0.8rem; color: #aaa;">
            <span>File</span><span>Edit</span><span>View</span><span>Insert</span><span>Format</span><span>Tools</span>
          </div>
          <div style="flex: 1; overflow-y: auto; background: #1e1e1e; padding: 32px; display: flex; justify-content: center;">
            <div style="background: white; width: 100%; max-width: 600px; padding: 40px; color: #333; font-family: serif; min-height: 800px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
              <h1 style="font-size: 1.5rem; text-align: center; margin-bottom: 24px;">${doc.title}</h1>
              <p style="font-size: 1rem; line-height: 1.6; margin-bottom: 16px;"><strong>Мета:</strong> Стандартизація процесу та підвищення конверсії.</p>
              <h3 style="margin-top: 24px; margin-bottom: 12px;">Етап 1. Встановлення контакту</h3>
              <p style="font-size: 0.95rem; line-height: 1.5;">- Доброго дня, мене звати [Ім'я], компанія [Компанія]. Ви залишали заявку на сайті. Зручно розмовляти?</p>
              <div style="background: #fff3cd; padding: 12px; border-left: 4px solid #ffc107; margin: 16px 0; font-size: 0.9rem;">
                <strong>💡 Правило:</strong> Обов'язково дочекатись згоди на розмову.
              </div>
            </div>
          </div>
        `;
      }
    };

    const artifactsList = {
      start: [
        { title: 'Щоденна звітність b2b', type: 'excel' },
        { title: 'KQ (коефіцієнт якості) QA', type: 'excel' },
        { title: 'БОЛІ - РІШЕННЯ - ВИГОДИ', type: 'excel' },
        { title: 'Скрипти кваліфікації', type: 'doc' }
      ],
      optimal: [
        { title: 'Аналіз продажів та процесів', type: 'excel' },
        { title: 'БП продажу та алгоритми до нього', type: 'excel' },
        { title: 'Порівняльна таблиця вибору CRM', type: 'excel' },
        { title: 'Розрахунок обороту', type: 'excel' },
        { title: 'Карта комунікації розбору ВП', type: 'doc' },
        { title: 'Щоденна звітність b2b', type: 'excel' },
        { title: 'KQ (коефіцієнт якості) QA', type: 'excel' }
      ],
      pro: [
        { title: 'Портрет посади Менеджер / КВП', type: 'excel' },
        { title: 'Прототип мотивації (KPI)', type: 'excel' },
        { title: 'План адаптації нових менеджерів', type: 'excel' },
        { title: 'Календарне планування проєкту', type: 'excel' },
        { title: 'Книга виробництва (продажів)', type: 'doc' },
        { title: 'БП продажу та алгоритми до нього', type: 'excel' }
      ]
    };

    const renderList = (tier) => {
      const items = artifactsList[tier] || artifactsList.start;
      docList.innerHTML = '';
      items.forEach((item, index) => {
        const li = document.createElement('li');
        const isDoc = item.type === 'doc';
        const color = isDoc ? 'var(--accent-blue)' : 'var(--color-success)';
        const icon = isDoc ? 'file-text' : 'file-spreadsheet';
        
        li.style.cssText = `
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: 0.2s;
          background: ${index === 0 ? 'rgba(255,255,255,0.05)' : 'transparent'};
          border: 1px solid ${index === 0 ? 'rgba(255,255,255,0.1)' : 'transparent'};
        `;
        
        li.innerHTML = `<i data-lucide="${icon}" style="color: ${color}; width: 16px; height: 16px;"></i> 
                        <span style="font-size: 0.85rem; color: ${index === 0 ? 'white' : 'var(--text-secondary)'};">${item.title}</span>`;
        
        li.addEventListener('click', () => {
          Array.from(docList.children).forEach(child => {
            child.style.background = 'transparent';
            child.style.border = '1px solid transparent';
            child.querySelector('span').style.color = 'var(--text-secondary)';
          });
          li.style.background = 'rgba(255,255,255,0.05)';
          li.style.border = '1px solid rgba(255,255,255,0.1)';
          li.querySelector('span').style.color = 'white';
          
          previewContent.innerHTML = getPreviewHtml(item);
          if(window.lucide) window.lucide.createIcons();
        });
        
        docList.appendChild(li);
      });

      // trigger first item
      previewContent.innerHTML = getPreviewHtml(items[0]);
      if(window.lucide) window.lucide.createIcons();
    };

    document.querySelectorAll('.preview-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tier = btn.getAttribute('data-tier');
        titleEl.innerHTML = `<i data-lucide="folder-open" style="color: var(--accent-blue);"></i> Наповнення пакету: ${tier === 'start' ? 'Стартовий' : tier === 'optimal' ? 'Оптимальний' : 'Під ключ'}`;
        
        renderList(tier);
        modal.style.display = 'flex';
      });
    });

    closeBtn.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

  }
};
