// js/pages/ai-solutions.js
export const AiSolutions = {
  render() {
    return `
      <style>
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        @media (max-width: 992px) {
          .hero-split .container {
            grid-template-columns: 1fr !important;
          }
          .hero-visual {
            margin-top: 40px;
          }
        }
      </style>
      <section class="page-hero premium-dark hero-split" style="padding-top: 140px; padding-bottom: 80px; overflow: hidden;">
        <div class="container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center;">
          <div class="hero-content" style="z-index: 2;">
            <div class="section-badge" style="margin-bottom: 24px; display: inline-flex;"><i data-lucide="zap"></i> AI + CRM + Автоматизація продажів</div>
            <h1 style="font-size: clamp(2rem, 4vw, 3rem); line-height: 1.2; margin-bottom: 24px;">Автоматизую продажі та операційні процеси, щоб бізнес не втрачав заявки, час і гроші</h1>
            <p class="hero-subtitle" style="font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 32px; max-width: 90%;">Створюю custom-рішення під ваш бізнес: AI QA-боти, CRM-інтеграції, Telegram-сповіщення, системи графіків, логістики, контролю менеджерів, оплат і аналітики. Не просто 'боти', а робочі інструменти для керівника, які щодня зменшують хаос у команді.</p>
            
            <div class="hero-ctas" style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 32px;">
              <a href="#/consultation" class="btn btn-primary">Розібрати мій процес</a>
              <a href="#/consultation" class="btn btn-outline">Отримати карту автоматизації</a>
              <a href="#/consultation" class="btn btn-outline">Забронювати консультацію</a>
            </div>
            
            <div class="trust-text" style="font-size: 0.95rem; color: var(--text-muted); border-left: 3px solid var(--color-primary); padding-left: 16px; max-width: 90%; line-height: 1.6;">
              <strong>Починаємо з технічного й бізнес-аудиту процесу:</strong> що зараз робиться вручну, де губляться заявки, хто відповідальний, які дані потрібно передавати і що можна автоматизувати першим.
            </div>
          </div>
          
          <div class="hero-visual" style="position: relative; z-index: 1;">
            <div class="browser-mockup" style="border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 40px rgba(37,99,235,0.1); overflow: hidden; background: var(--bg-secondary); border: 1px solid var(--border-color);">
              <div class="browser-header" style="background: var(--bg-tertiary); padding: 12px 16px; display: flex; align-items: center; border-bottom: 1px solid var(--border-color);">
                <div class="browser-dots" style="display: flex; gap: 6px;">
                  <div class="browser-dot" style="width: 12px; height: 12px; border-radius: 50%; background: #FF5F56;"></div>
                  <div class="browser-dot" style="width: 12px; height: 12px; border-radius: 50%; background: #FFBD2E;"></div>
                  <div class="browser-dot" style="width: 12px; height: 12px; border-radius: 50%; background: #27C93F;"></div>
                </div>
                <div class="browser-title" style="margin: 0 auto; font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Executive Control Dashboard</div>
              </div>
              <div class="browser-content" style="background: #0A0F1C; padding: 24px; position: relative; display:flex; flex-direction:column; gap:20px; height: 380px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="font-size:1.2rem; font-weight:bold; color:white;">Sales & Operations</div>
                  <div style="display:flex; gap:8px;">
                    <span style="background:rgba(39, 201, 63, 0.15); color:#27C93F; padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight: 600; border: 1px solid rgba(39,201,63,0.3);">System Online</span>
                  </div>
                </div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                  <div style="background:var(--bg-tertiary); padding:20px; border-radius:8px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px; display:flex; align-items:center; gap:6px;"><i data-lucide="users" style="width:14px;"></i> Active Leads</div>
                    <div style="font-size:1.8rem; font-weight:bold; color:var(--text-primary);">1,492</div>
                  </div>
                  <div style="background:var(--bg-tertiary); padding:20px; border-radius:8px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px; display:flex; align-items:center; gap:6px;"><i data-lucide="trending-up" style="width:14px;"></i> Monthly MRR</div>
                    <div style="font-size:1.8rem; font-weight:bold; color:var(--color-primary);">$124,500</div>
                  </div>
                </div>
                
                <div style="background:var(--bg-tertiary); padding:20px; border-radius:8px; display:flex; flex-direction:column; gap:16px; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="font-size:0.85rem; color:var(--text-muted); font-weight: 500;">Automation Pipeline</div>
                  <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.85rem;">
                    <span style="color:var(--text-primary); font-weight:500;">Сайт</span> <i data-lucide="chevron-right" style="width:16px; color:var(--color-primary)"></i>
                    <span style="color:var(--text-primary); font-weight:500;">CRM</span> <i data-lucide="chevron-right" style="width:16px; color:var(--color-primary)"></i>
                    <span style="color:var(--text-primary); font-weight:500;">Телефонія</span> <i data-lucide="chevron-right" style="width:16px; color:var(--color-primary)"></i>
                    <span style="color:var(--text-primary); font-weight:500;">Аналітика</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Floating Cards -->
            <div class="floating-card d-none d-md-flex" style="position:absolute; top:-20px; left:-40px; background:var(--bg-secondary); padding:12px 20px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 10px 30px rgba(0,0,0,0.6); display:flex; align-items:center; gap:10px; animation: float 6s ease-in-out infinite;">
              <div style="background:rgba(37,99,235,0.1); padding:8px; border-radius:8px;"><i data-lucide="bot" style="color:var(--color-primary); width:18px; height:18px;"></i></div> 
              <span style="font-weight:600; font-size:0.95rem; color:var(--text-primary);">AI QA</span>
            </div>
            <div class="floating-card d-none d-md-flex" style="position:absolute; top:40px; right:-40px; background:var(--bg-secondary); padding:12px 20px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 10px 30px rgba(0,0,0,0.6); display:flex; align-items:center; gap:10px; animation: float 5s ease-in-out infinite alternate;">
              <div style="background:rgba(16,185,129,0.1); padding:8px; border-radius:8px;"><i data-lucide="refresh-cw" style="color:#10B981; width:18px; height:18px;"></i></div> 
              <span style="font-weight:600; font-size:0.95rem; color:var(--text-primary);">CRM Sync</span>
            </div>
            <div class="floating-card d-none d-md-flex" style="position:absolute; bottom:80px; left:-50px; background:var(--bg-secondary); padding:12px 20px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 10px 30px rgba(0,0,0,0.6); display:flex; align-items:center; gap:10px; animation: float 7s ease-in-out infinite reverse;">
              <div style="background:rgba(0,136,204,0.1); padding:8px; border-radius:8px;"><i data-lucide="send" style="color:#0088cc; width:18px; height:18px;"></i></div> 
              <span style="font-weight:600; font-size:0.95rem; color:var(--text-primary);">Telegram Alerts</span>
            </div>
            <div class="floating-card d-none d-md-flex" style="position:absolute; bottom:-20px; right:-20px; background:var(--bg-secondary); padding:12px 20px; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 10px 30px rgba(0,0,0,0.6); display:flex; align-items:center; gap:10px; animation: float 4s ease-in-out infinite alternate;">
              <div style="background:rgba(139,92,246,0.1); padding:8px; border-radius:8px;"><i data-lucide="credit-card" style="color:#8B5CF6; width:18px; height:18px;"></i></div> 
              <span style="font-weight:600; font-size:0.95rem; color:var(--text-primary);">Payment Status</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 6. Why business needs custom AI solutions -->
      <section class="section" style="background: var(--bg-primary);">
        <div class="container">
          <div class="text-center" style="max-width: 900px; margin: 0 auto 64px;">
            <h2 style="font-size: 2.2rem; margin-bottom: 24px;">Стандартні сервіси закривають базові задачі.<br><span style="color:var(--color-primary)">Ваші реальні втрати часто ховаються в специфіці процесу</span></h2>
            <p style="font-size: 1.15rem; color: var(--text-secondary); line-height: 1.6;">У кожному бізнесі є процеси, які неможливо нормально закрити стандартною CRM або таблицею: контроль дзвінків, перевірка якості комунікації, логістика виїздів, графіки фахівців, нагадування менеджерам, статуси оплат, повторні контакти, ручні звіти. Саме там команда втрачає час, а бізнес — гроші.</p>
          </div>
          
          <div class="grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;">
            <div class="card" style="padding: 40px 32px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; transition: transform 0.3s ease;">
              <div style="width: 56px; height: 56px; background: rgba(37,99,235,0.1); border-radius: 12px; display:flex; align-items:center; justify-content:center; margin-bottom: 24px;">
                <i data-lucide="eye" style="color: var(--color-primary); width: 28px; height: 28px;"></i>
              </div>
              <h3 style="margin-bottom: 16px; font-size: 1.3rem;">Менше ручного контролю</h3>
              <p style="color: var(--text-secondary); font-size: 1rem; line-height: 1.6;">Система сама збирає дані, нагадує, передає статуси й показує керівнику проблемні місця.</p>
            </div>
            
            <div class="card" style="padding: 40px 32px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; transition: transform 0.3s ease;">
              <div style="width: 56px; height: 56px; background: rgba(37,99,235,0.1); border-radius: 12px; display:flex; align-items:center; justify-content:center; margin-bottom: 24px;">
                <i data-lucide="user-x" style="color: var(--color-primary); width: 28px; height: 28px;"></i>
              </div>
              <h3 style="margin-bottom: 16px; font-size: 1.3rem;">Менше людського фактору</h3>
              <p style="color: var(--text-secondary); font-size: 1rem; line-height: 1.6;">Менеджери не забувають задачі, повторні контакти, оплату або зміну статусу в CRM.</p>
            </div>
            
            <div class="card" style="padding: 40px 32px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; transition: transform 0.3s ease;">
              <div style="width: 56px; height: 56px; background: rgba(37,99,235,0.1); border-radius: 12px; display:flex; align-items:center; justify-content:center; margin-bottom: 24px;">
                <i data-lucide="bar-chart-2" style="color: var(--color-primary); width: 28px; height: 28px;"></i>
              </div>
              <h3 style="margin-bottom: 16px; font-size: 1.3rem;">Прозора аналітика</h3>
              <p style="color: var(--text-secondary); font-size: 1rem; line-height: 1.6;">Керівник бачить не здогадки, а реальну картину: заявки, дзвінки, статуси, якість, оплату, конверсію.</p>
            </div>
            
            <div class="card" style="padding: 40px 32px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; transition: transform 0.3s ease;">
              <div style="width: 56px; height: 56px; background: rgba(37,99,235,0.1); border-radius: 12px; display:flex; align-items:center; justify-content:center; margin-bottom: 24px;">
                <i data-lucide="zap" style="color: var(--color-primary); width: 28px; height: 28px;"></i>
              </div>
              <h3 style="margin-bottom: 16px; font-size: 1.3rem;">Швидша робота команди</h3>
              <p style="color: var(--text-secondary); font-size: 1rem; line-height: 1.6;">Рутина автоматизується, а команда витрачає час на клієнтів, а не на ручне перенесення інформації.</p>
            </div>
            
            <div class="card" style="padding: 40px 32px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; transition: transform 0.3s ease;">
              <div style="width: 56px; height: 56px; background: rgba(37,99,235,0.1); border-radius: 12px; display:flex; align-items:center; justify-content:center; margin-bottom: 24px;">
                <i data-lucide="shield-check" style="color: var(--color-primary); width: 28px; height: 28px;"></i>
              </div>
              <h3 style="margin-bottom: 16px; font-size: 1.3rem;">Контроль якості</h3>
              <p style="color: var(--text-secondary); font-size: 1rem; line-height: 1.6;">AI може аналізувати дзвінки, перевіряти чек-листи, знаходити помилки і формувати рекомендації.</p>
            </div>
            
            <div class="card" style="padding: 40px 32px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 16px; transition: transform 0.3s ease;">
              <div style="width: 56px; height: 56px; background: rgba(37,99,235,0.1); border-radius: 12px; display:flex; align-items:center; justify-content:center; margin-bottom: 24px;">
                <i data-lucide="layers" style="color: var(--color-primary); width: 28px; height: 28px;"></i>
              </div>
              <h3 style="margin-bottom: 16px; font-size: 1.3rem;">Єдина система</h3>
              <p style="color: var(--text-secondary); font-size: 1rem; line-height: 1.6;">CRM, телефонія, Telegram, календарі, графіки, оплати й аналітика працюють в одній логіці.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 7. What processes can be automated -->
      <section class="section" style="background: var(--bg-tertiary); padding-top: 80px; padding-bottom: 80px;">
        <div class="container">
          <div class="text-center" style="margin-bottom: 56px;">
            <h2 style="font-size: 2.5rem;">Що можна автоматизувати у вашому бізнесі</h2>
          </div>
          
          <div class="automation-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 32px;">
            
            <!-- Продажі -->
            <div class="auto-category" style="background: var(--bg-secondary); padding: 40px; border-radius: 16px; border-top: 4px solid var(--color-primary); box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
              <h3 style="display:flex; align-items:center; gap:16px; margin-bottom:28px; font-size:1.4rem;"><div style="background:rgba(37,99,235,0.1); padding:10px; border-radius:10px;"><i data-lucide="trending-up" style="color:var(--color-primary)"></i></div> Продажі</h3>
              <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:16px;">
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:var(--color-primary); flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">передача заявок у CRM</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:var(--color-primary); flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">автоматичне створення лідів</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:var(--color-primary); flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">нагадування менеджерам</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:var(--color-primary); flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">контроль повторних контактів</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:var(--color-primary); flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">фіксація статусів</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:var(--color-primary); flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">контроль оплат</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:var(--color-primary); flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">Telegram-сповіщення керівнику</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:var(--color-primary); flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">автоматичні задачі по угодах</span></li>
              </ul>
            </div>
            
            <!-- Контроль якості -->
            <div class="auto-category" style="background: var(--bg-secondary); padding: 40px; border-radius: 16px; border-top: 4px solid #F59E0B; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
              <h3 style="display:flex; align-items:center; gap:16px; margin-bottom:28px; font-size:1.4rem;"><div style="background:rgba(245,158,11,0.1); padding:10px; border-radius:10px;"><i data-lucide="headphones" style="color:#F59E0B"></i></div> Контроль якості</h3>
              <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:16px;">
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#F59E0B; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">AI-аналіз дзвінків</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#F59E0B; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">перевірка скрипту</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#F59E0B; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">перевірка обов’язкових фраз</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#F59E0B; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">оцінка роботи менеджера</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#F59E0B; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">автоматичний фідбек</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#F59E0B; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">звіт керівнику</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#F59E0B; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">пошук типових помилок</span></li>
              </ul>
            </div>
            
            <!-- CRM і аналітика -->
            <div class="auto-category" style="background: var(--bg-secondary); padding: 40px; border-radius: 16px; border-top: 4px solid #10B981; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
              <h3 style="display:flex; align-items:center; gap:16px; margin-bottom:28px; font-size:1.4rem;"><div style="background:rgba(16,185,129,0.1); padding:10px; border-radius:10px;"><i data-lucide="pie-chart" style="color:#10B981"></i></div> CRM і аналітика</h3>
              <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:16px;">
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#10B981; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">кастомні статуси</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#10B981; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">автоматичні звіти</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#10B981; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">dashboard керівника</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#10B981; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">план-факт</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#10B981; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">конверсія по етапах</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#10B981; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">джерела заявок</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#10B981; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">причини відмов</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#10B981; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">ефективність менеджерів</span></li>
              </ul>
            </div>
            
            <!-- Логістика і графіки -->
            <div class="auto-category" style="background: var(--bg-secondary); padding: 40px; border-radius: 16px; border-top: 4px solid #8B5CF6; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
              <h3 style="display:flex; align-items:center; gap:16px; margin-bottom:28px; font-size:1.4rem;"><div style="background:rgba(139,92,246,0.1); padding:10px; border-radius:10px;"><i data-lucide="map" style="color:#8B5CF6"></i></div> Логістика і графіки</h3>
              <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:16px;">
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#8B5CF6; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">графіки фахівців</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#8B5CF6; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">розподіл виїздів</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#8B5CF6; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">календарі</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#8B5CF6; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">оптимізація маршрутів</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#8B5CF6; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">контроль завантаження</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#8B5CF6; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">вибір найбільш релевантного фахівця</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#8B5CF6; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">автоматичні рекомендації</span></li>
              </ul>
            </div>
            
            <!-- Оплати -->
            <div class="auto-category" style="background: var(--bg-secondary); padding: 40px; border-radius: 16px; border-top: 4px solid #EC4899; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
              <h3 style="display:flex; align-items:center; gap:16px; margin-bottom:28px; font-size:1.4rem;"><div style="background:rgba(236,72,153,0.1); padding:10px; border-radius:10px;"><i data-lucide="credit-card" style="color:#EC4899"></i></div> Оплати</h3>
              <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:16px;">
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#EC4899; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">статуси оплат</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#EC4899; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">передоплата</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#EC4899; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">повторні нагадування</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#EC4899; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">платіжні посилання</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#EC4899; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">інтеграція mono / LiqPay / WayForPay</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#EC4899; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">повідомлення клієнту</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#EC4899; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">повідомлення менеджеру</span></li>
              </ul>
            </div>
            
            <!-- Комунікація -->
            <div class="auto-category" style="background: var(--bg-secondary); padding: 40px; border-radius: 16px; border-top: 4px solid #06B6D4; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
              <h3 style="display:flex; align-items:center; gap:16px; margin-bottom:28px; font-size:1.4rem;"><div style="background:rgba(6,182,212,0.1); padding:10px; border-radius:10px;"><i data-lucide="message-circle" style="color:#06B6D4"></i></div> Комунікація</h3>
              <ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:16px;">
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#06B6D4; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">Telegram-боти</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#06B6D4; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">автоматичні повідомлення</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#06B6D4; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">follow-up</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#06B6D4; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">повідомлення після дзвінка</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#06B6D4; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">повідомлення після оплати</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#06B6D4; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">нагадування клієнтам</span></li>
                <li style="display:flex; gap:12px;"><i data-lucide="check-circle-2" style="color:#06B6D4; flex-shrink:0;"></i> <span style="color:var(--text-primary); font-size: 1.05rem;">сповіщення керівнику</span></li>
              </ul>
            </div>
            
          </div>
        </div>
      </section>

      <!-- 8. Examples and Pricing -->
      <section class="section" style="background: var(--bg-primary);">
        <div class="container">
          <div class="content-grid">
            <div class="main-content">
              <h2 class="mt-4" style="font-size: 2.2rem; margin-bottom: 32px;">Приклади інтеграцій та Custom-рішень</h2>
              
              <!-- Example 1 -->
              <div class="case-card mb-4" style="background: var(--bg-card); padding: 2rem; border-radius: 1rem; border: 1px solid var(--border-color);">
                <h3>1. AI-Бот контролю якості та аналізу дзвінків</h3>
                <p style="color:var(--text-secondary); line-height: 1.6; margin-bottom: 16px;">Штучний інтелект прослуховує 100% дзвінків ваших менеджерів одразу після завершення розмови. Він аналізує розмову за чек-листом, виставляє оцінку та миттєво надсилає детальний звіт у Telegram.</p>
                <ul class="mb-3" style="list-style:none; padding:0; display:flex; flex-direction:column; gap:8px;">
                  <li style="display:flex; gap:10px;"><i data-lucide="check" style="color:var(--color-primary);"></i> <span style="color:var(--text-secondary)">Замінює штатних фахівців з контролю якості (QA).</span></li>
                  <li style="display:flex; gap:10px;"><i data-lucide="check" style="color:var(--color-primary);"></i> <span style="color:var(--text-secondary)">Формує рекомендації: що забув сказати менеджер.</span></li>
                  <li style="display:flex; gap:10px;"><i data-lucide="check" style="color:var(--color-primary);"></i> <span style="color:var(--text-secondary)">Надає об'єктивну оцінку для прив'язки до KPI.</span></li>
                </ul>
                <div class="browser-mockup mt-4" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); overflow: hidden; background: var(--bg-secondary); border: 1px solid var(--border-color);">
                  <div class="browser-header" style="background: var(--bg-tertiary); padding: 10px 16px; display: flex; align-items: center; border-bottom: 1px solid var(--border-color);">
                    <div class="browser-dots" style="display: flex; gap: 6px;">
                      <div class="browser-dot" style="width: 12px; height: 12px; border-radius: 50%; background: #FF5F56;"></div>
                      <div class="browser-dot" style="width: 12px; height: 12px; border-radius: 50%; background: #FFBD2E;"></div>
                      <div class="browser-dot" style="width: 12px; height: 12px; border-radius: 50%; background: #27C93F;"></div>
                    </div>
                    <div class="browser-title" style="margin: 0 auto; font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Telegram AI QA Bot — Anonymized Demo</div>
                  </div>
                  <div class="browser-content" style="position: relative; background: #0A0F1C; padding: 20px; display: flex; justify-content: center;">
                    <div class="demo-badge" style="position: absolute; top: 16px; right: 16px; background: rgba(37, 99, 235, 0.1); backdrop-filter: blur(8px); border: 1px solid rgba(37, 99, 235, 0.3); color: var(--color-primary); padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; z-index: 10; display: flex; align-items: center; gap: 6px;">
                      <i data-lucide="shield-check" style="width: 14px; height: 14px;"></i> DEMO DATA
                    </div>
                    <img src="https://placehold.co/800x500/1E293B/fff?text=Synthetic+Data:+AI+Analysis+Report%0A--------------------------------%0AМенеджер:+Demo+User%0AКлієнт:+Anonymized+Lead%0AОцінка:+85/100%0A%0A%5BАналіз+та+Рекомендації%5D" alt="Demo AI Bot" style="max-width: 100%; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
                  </div>
                </div>
              </div>

              <!-- Example 2 -->
              <div class="case-card mb-4" style="background: var(--bg-card); padding: 2rem; border-radius: 1rem; border: 1px solid var(--border-color);">
                <h3>2. Розумна система логістики та управління графіками</h3>
                <p style="color:var(--text-secondary); line-height: 1.6; margin-bottom: 16px;">Кастомний веб-додаток для компаній з виїзними спеціалістами. Система автоматично розподіляє виїзди (наприклад, по зонах міста), оптимізує маршрути та синхронізує розклад у реальному часі.</p>
                <div class="browser-mockup mt-4" style="border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); overflow: hidden; background: var(--bg-secondary); border: 1px solid var(--border-color);">
                  <div class="browser-header" style="background: var(--bg-tertiary); padding: 10px 16px; display: flex; align-items: center; border-bottom: 1px solid var(--border-color);">
                    <div class="browser-dots" style="display: flex; gap: 6px;">
                      <div class="browser-dot" style="width: 12px; height: 12px; border-radius: 50%; background: #FF5F56;"></div>
                      <div class="browser-dot" style="width: 12px; height: 12px; border-radius: 50%; background: #FFBD2E;"></div>
                      <div class="browser-dot" style="width: 12px; height: 12px; border-radius: 50%; background: #27C93F;"></div>
                    </div>
                    <div class="browser-title" style="margin: 0 auto; font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Logistics App — Anonymized Demo</div>
                  </div>
                  <div class="browser-content" style="position: relative; background: #0A0F1C; padding: 20px;">
                    <div class="demo-badge" style="position: absolute; top: 16px; right: 16px; background: rgba(37, 99, 235, 0.1); backdrop-filter: blur(8px); border: 1px solid rgba(37, 99, 235, 0.3); color: var(--color-primary); padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; z-index: 10; display: flex; align-items: center; gap: 6px;">
                      <i data-lucide="shield-check" style="width: 14px; height: 14px;"></i> DEMO DATA
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                      <img src="https://placehold.co/800x600/1E293B/fff?text=Map+Region:+Zone+A%0A-----------------%0ASpecialist:+Demo+Specialist+1%0AStatus:+Assigned" alt="Demo Logistics" style="width: 100%; border-radius: 4px;">
                      <img src="https://placehold.co/800x600/1E293B/fff?text=Schedule+Calendar%0A-----------------%0AMon:+09:00+-+18:00%0ATue:+Booked%0AWed:+Available" alt="Demo Schedule" style="width: 100%; border-radius: 4px;">
                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            <div class="sidebar">
              <div class="service-pricing-card sticky">
                <h3>Custom-рішення під ключ</h3>
                <div class="price">від $4000</div>
                <p class="price-desc">Точна вартість формується після технічного аудиту та узгодження бізнес-результатів.</p>
                
                <ul class="pricing-features">
                  <li><i data-lucide="check"></i> Аудит бізнес-процесів</li>
                  <li><i data-lucide="check"></i> Проектування архітектури</li>
                  <li><i data-lucide="check"></i> Інтеграція AI та CRM</li>
                  <li><i data-lucide="check"></i> Розробка адмін-панелей</li>
                  <li><i data-lucide="check"></i> Впровадження в команду</li>
                  <li><i data-lucide="check"></i> Підтримка та розвиток</li>
                </ul>
                
                <a href="#/consultation" class="btn btn-primary w-100 mb-2">Обговорити проект</a>
                <p style="font-size: 0.8rem; text-align: center; color: var(--text-muted);">Індивідуальний підхід. Повна конфіденційність (NDA).</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- CTA Section -->
      <section class="section final-cta-section text-center" style="background: var(--bg-card);">
        <div class="container" style="max-width: 800px;">
          <h2 style="font-size: 2.5rem; margin-bottom: 24px;">Готові навести лад у процесах та масштабувати бізнес?</h2>
          <p class="cta-subtitle" style="font-size: 1.15rem; color: var(--text-secondary); margin-bottom: 40px; line-height: 1.6;">Забронюйте дзвінок, ми розберемо ваші процеси і знайдемо точки для автоматизації, що дадуть найбільший фінансовий ефект.</p>
          <a href="#/consultation" class="btn btn-primary btn-lg" style="font-size: 1.1rem; padding: 16px 40px;">Забронювати зустріч</a>
        </div>
      </section>
    `;
  },
  
  init() {
    // Initialization for AiSolutions page
  }
};
