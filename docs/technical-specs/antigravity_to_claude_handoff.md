# Технічний Handoff-звіт: Antigravity → Claude Code
**Проєкт:** Sales System (SalesSystem AI Platform / FIRSTWIN)  
**Дата формування:** 01 вересня 2026 року  
**Автор передачі:** Antigravity (Advanced Agentic AI)  
**Цільовий виконавець:** Claude Code  
**Призначення:** Повна передача актуального технічного контексту сайту, CRM, клієнтського порталу, бази даних, аналітики, інтеграцій та рекламної підготовки без виконання несанкціонованих змін.

---

## 1. Ідентифікація проєкту

* **Точна назва проєкту:** `sales-system-ai-platform` (Кодове ім'я внутрішнього клієнтського порталу: `FIRSTWIN`).
* **Абсолютний шлях до папки на комп'ютері:** `D:\AI ALL\FIRSTWIN`
* **Наявність Git-репозиторію:** Так, локальний репозиторій Git ініціалізовано.
* **GitHub / Git remote URL:** `https://github.com/Anastasiia-als/sales-system-ai-platform.git`
* **Поточна гілка:** `main`
* **Останній commit:** `f58f180073535689a04b82d3a3f0ba54a33971d1` (*"Phase 6C.2 GAP Closure - Final fixes for E2E and idempotent canonical regression"*).
* **Стан робочого дерева:** Робоче дерево чисте (`working tree clean`). Гілка випереджає `origin/main` на 18 комітів (локальні стабільні коміти Phase 4B – Phase 6C).
* **Точна папка, яку необхідно відкрити в Claude Code:** `D:\AI ALL\FIRSTWIN`

### Дерево основних папок і файлів (до 4 рівнів)

```txt
D:\AI ALL\FIRSTWIN\
├── .env.example
├── .gitignore
├── .vercel/
│   └── project.json
├── ARCHITECTURE.md
├── DATABASE.md
├── DECISIONS.md
├── LICENSE
├── PERMISSIONS.md
├── PROJECT_NOTES.md
├── README.md
├── ROADMAP.md
├── index.html
├── package.json
├── package-lock.json
├── server.ps1
├── vercel.json
├── css/
│   ├── components.css
│   ├── main.css
│   ├── pages.css
│   └── portal.css
├── docs/
│   ├── client-portal/
│   │   ├── ARCHITECTURE.md
│   │   ├── DATABASE.md
│   │   ├── DECISIONS.md
│   │   ├── PERMISSIONS.md
│   │   ├── PRODUCT_SPEC.md
│   │   └── ROADMAP.md
│   ├── screenshots/
│   │   ├── admin-dashboard.png
│   │   ├── ai-automation.png
│   │   ├── home.png
│   │   └── services.png
│   └── technical-specs/
│       └── antigravity_to_claude_handoff.md
├── img/
│   ├── admin-panel.png
│   ├── ai-qa.png
│   ├── expert.jpg
│   ├── logistics.png
│   └── schedule.png
├── js/
│   ├── app.js
│   ├── config.js
│   ├── router.js
│   ├── state.js
│   ├── client/
│   │   └── ui/
│   │       ├── client-actions-view.js
│   │       ├── client-auth-view.js
│   │       ├── client-billing-view.js
│   │       ├── client-dashboard-view.js
│   │       ├── client-document-detail-view.js
│   │       ├── client-documents-view.js
│   │       ├── client-invoice-detail-view.js
│   │       ├── client-meeting-detail-view.js
│   │       ├── client-meetings-view.js
│   │       ├── client-project-detail-view.js
│   │       ├── client-projects-view.js
│   │       └── client-shell.js
│   ├── components/
│   │   ├── chat.js
│   │   ├── notifications.js
│   │   └── payment.js
│   ├── pages/
│   │   ├── about.js
│   │   ├── admin.js
│   │   ├── ai-solutions.js
│   │   ├── audit.js
│   │   ├── blog.js
│   │   ├── cases.js
│   │   ├── client-page.js
│   │   ├── consultation.js
│   │   ├── contacts.js
│   │   ├── error.js
│   │   ├── home.js
│   │   ├── portal-page.js
│   │   ├── privacy.js
│   │   ├── refund.js
│   │   ├── scripts.js
│   │   ├── services.js
│   │   ├── status.js
│   │   ├── success.js
│   │   ├── support.js
│   │   ├── terms.js
│   │   └── trainings.js
│   ├── portal/
│   │   ├── api/
│   │   │   ├── data-client.js
│   │   │   └── supabase-client.js
│   │   ├── auth/
│   │   │   └── auth-service.js
│   │   ├── config/
│   │   │   └── supabase-config.js
│   │   ├── state/
│   │   │   └── portal-state.js
│   │   └── ui/
│   │       ├── portal-analytics-view.js
│   │       ├── portal-auth-view.js
│   │       ├── portal-automation-view.js
│   │       ├── portal-client-detail-view.js
│   │       ├── portal-clients-view.js
│   │       ├── portal-dashboard-view.js
│   │       ├── portal-document-detail-view.js
│   │       ├── portal-documents-view.js
│   │       ├── portal-finance-view.js
│   │       ├── portal-global-automation-view.js
│   │       ├── portal-invoice-detail-view.js
│   │       ├── portal-invoice-print-view.js
│   │       ├── portal-invoice-registry-view.js
│   │       ├── portal-meeting-detail-view.js
│   │       ├── portal-meetings-view.js
│   │       ├── portal-notifications-view.js
│   │       ├── portal-project-detail-view.js
│   │       ├── portal-project-finance-tab.js
│   │       ├── portal-project-tasks-view.js
│   │       ├── portal-project-wizard.js
│   │       ├── portal-projects-view.js
│   │       ├── portal-reports-view.js
│   │       ├── portal-roadmap-view.js
│   │       ├── portal-rule-builder-ui.js
│   │       ├── portal-shell.js
│   │       ├── portal-tasks-view.js
│   │       ├── portal-template-builder-view.js
│   │       └── portal-templates-view.js
│   └── vendor/
│       └── xlsx.full.min.js
└── supabase/
    ├── functions/
    │   └── client-access-admin/
    │       └── index.ts
    └── migrations/
        ├── 20260822000001_phase0_1a_foundation.sql
        ├── 20260822000002_contacts_schema.sql
        ├── ... (24 SQL migrations)
        └── 20260831000024_phase6c_fix_transition.sql
```

---

## 2. Публічний сайт

* **Production / Live URL:** `https://firstwin-livid.vercel.app/`  
  > **Результат перевірки URL:** **АКТУАЛЬНИЙ ТА РОБОЧИЙ**. Перевірено прямим HTTP-запитом: сервіс повертає HTTP 200 OK з повною HTML/CSS/JS структурою Sales System.
* **Preview / Local URLs:**
  * Local Dev: `http://localhost:3000` (через `npx serve -s . -p 3000`) або через `powershell -ExecutionPolicy Bypass -File ./server.ps1` (порт 8080/3000).
* **Основний домен:** Наразі використовується дефолтний домен Vercel `firstwin-livid.vercel.app`. Власний кастомний домен (наприклад, `sales-system.ua` або `firstwin.io`) ще не підключено.
* **Хостинг:** **Vercel** (Проєкт ID: `prj_yZQqNi3NQIUuR5W0jspSXG4eyiuf`, Org ID: `team_Yq74a1EoOUxrnLRwlIlSlSJI`, Project Name: `firstwin`).
* **Технологічний стек та версії залежностей:**
  * Frontend: Vanilla JavaScript (ES6 Modules, Zero-Build SPA), HTML5, Vanilla CSS3 (Custom Design System, CSS Variables, Glassmorphism, Responsive Grid).
  * Іконки: CDN Lucide Icons (`https://unpkg.com/lucide@latest`).
  * Експорт даних: SheetJS / XLSX v0.18.5 (`js/vendor/xlsx.full.min.js`).
  * Backend / Database: Supabase (PostgreSQL 15+, PL/pgSQL RPCs, RLS, Edge Functions Deno, Supabase Auth).
  * NPM Залежності (`package.json`):
    * `@supabase/supabase-js`: `^2.112.3`
    * `pg`: `^8.23.0`
    * `xlsx`: `^0.18.5`
    * `puppeteer` (dev): `^25.8.0`
* **Шлях до коду публічного сайту:** `D:\AI ALL\FIRSTWIN\` (`index.html`, `js/pages/*.js`, `js/components/*.js`, `css/*.css`).
* **Entry point:** `index.html` → `js/app.js` → `js/router.js`.
* **Перелік сторінок і маршрутів:**
  1. `#/` — Головна сторінка + інтерактивний Sales Diagnostic Tool (`js/pages/home.js`).
  2. `#/services` — Каталог послуг та тарифні сітки (`js/pages/services.js`).
  3. `#/audit` — Лендінг комплексного аудиту відділу продажів (`js/pages/audit.js`).
  4. `#/scripts` — Лендінг розробки скриптів та мовних карт (`js/pages/scripts.js`).
  5. `#/trainings` — Лендінг корпоративних тренінгів для команд (`js/pages/trainings.js`).
  6. `#/automation` — Лендінг впровадження CRM та автоматизацій (`js/pages/automation.js`).
  7. `#/ai-solutions` — Лендінг ШІ-рішень та AI QA-ботів (`js/pages/ai-solutions.js`).
  8. `#/consultation` — Сторінка бронювання консультації та форми лідогенерації (`js/pages/consultation.js`).
  9. `#/support` — Лендінг щомісячного консалтингового супроводу (`js/pages/support.js`).
  10. `#/about` — Сторінка про експерта з досвідом 11 років (`js/pages/about.js`).
  11. `#/cases` — Сторінка розбору бізнес-кейсів з метриками (`js/pages/cases.js`).
  12. `#/blog` — Блог зі статтями про продажі та CRM (`js/pages/blog.js`).
  13. `#/contacts` — Сторінка контактів та форми зворотного зв'язку (`js/pages/contacts.js`).
  14. `#/privacy` — Політика конфіденційності (`js/pages/privacy.js`).
  15. `#/refund` — Правила повернення коштів (`js/pages/refund.js`).
  16. `#/terms` — Умови надання послуг (`js/pages/terms.js`).
  17. `#/success` — Thank-you page після успішної заявки (`js/pages/success.js`).
  18. `#/error` — Сторінка 404 / помилки (`js/pages/error.js`).
  19. `#/admin` — Демонстраційна адмін/CRM панель (`js/pages/admin.js`).
  20. `#/portal` — Повноцінний робочий Client & Project Delivery Portal (`js/pages/portal-page.js` + `js/portal/*`).
  21. `#/client` — Клієнтський кабінет замовника (`js/pages/client-page.js` + `js/client/*`).
* **Які сторінки реально працюють:** Усі 21 маршрут повністю реалізовані та працюють без помилок роутингу.
* **Де розташовані Landing Pages:** `js/pages/audit.js`, `js/pages/scripts.js`, `js/pages/trainings.js`, `js/pages/automation.js`, `js/pages/ai-solutions.js`, `js/pages/consultation.js`, `js/pages/support.js`.
* **CTA, форми та кнопки зв'язку:**
  * Header CTA: *"Забронювати зустріч"* → `#/consultation`.
  * Top Notice Bar: *"Візьму 2 проекти на аудит..."* → `#/audit`.
  * Hero Section: *"Пройти експрес-діагностику"* (плавний скрол до віджета), *"Замовити аудит"* → `#/audit`.
  * Diagnostic Tool: Інтерактивний чекліст із динамічним скорингом ризиків та кнопкою переходу до замовлення.
  * Форма консультації (`#/consultation`): поля Ім'я, Телефон, Email, Telegram, Компанія, Ніша, Кількість менеджерів, Наявність CRM, Проблема, Мета, Формат зв'язку, Дата, Час, Метод оплати.
  * Форма контактів (`#/contacts`): Ім'я, Телефон, Повідомлення.
  * Віджет онлайн-чату (`js/components/chat.js`): Симулятор Telegram-асистента / підтримки.
  * Платіжні модали (`js/components/payment.js`): Інтерфейси оплати Monobank, LiqPay, Криптовалюта.
  * Mobile Sticky Bar: Кнопки *"Консультація"* (`#/consultation`) та *"Telegram"*.
* **Куди і які дані надсилають форми:**
  * Публічні форми сайту (`#/consultation`, `#/contacts`, `chat.js`) наразі зберігають ліди в браузерний `localStorage` (ключ `sales_app_leads`) через `js/state.js` та перенаправляють на `#/success`. Вони **ще не мають прямого POST-запиту** на бекенд/Supabase/webhook.
  * Форми внутрішнього порталу (`#/portal`, `#/client`) надсилають реальні мутації безпосередньо в Supabase PostgreSQL через `@supabase/supabase-js`.
* **Deployment-конфігурація:** `vercel.json` (`{"outputDirectory": "."}`).
* **Перелік назв Environment Variables (без значень):**
  * `NEXT_PUBLIC_SITE_URL`
  * `DATABASE_URL`
  * `SUPABASE_URL`
  * `SUPABASE_ANON_KEY`
  * `SUPABASE_PUBLISHABLE_KEY`
  * `SUPABASE_SERVICE_ROLE_KEY`
  * `ADMIN_EMAIL`
  * `ADMIN_PASSWORD`
  * `TELEGRAM_BOT_TOKEN`
  * `TELEGRAM_CHAT_ID`
  * `MONO_API_KEY`
  * `LIQPAY_PUBLIC_KEY`
  * `LIQPAY_PRIVATE_KEY`
  * `WAYFORPAY_MERCHANT_ACCOUNT`
  * `WAYFORPAY_SECRET_KEY`
  * `GOOGLE_CLIENT_ID`
  * `GOOGLE_CLIENT_SECRET`
  * `GOOGLE_CALENDAR_ID`
  * `NEXT_PUBLIC_GA_ID`
* **Відомі технічні проблеми сайту:**
  1. Заявки з публічних форм зберігаються локально в браузері клієнта (`localStorage`), а не записуються автоматично в Supabase `contacts`/`leads` або Telegram Webhook.
  2. У `index.html` встановлено тестовий GA4 ID `G-XXXXXXXXXX` замість реального лічильника.
  3. Усі зовнішні посилання на соцмережі та месенджери містять плейсхолдери (`@sales_expert`, `contact@example.com`, `+38 (099) 000-00-00`).
  4. Платіжні вікна публічного сайту імітують успішну оплату через `setTimeout` без виклику реального еквайрингу.

---

## 3. CRM і клієнтський портал

### Чітке розмежування систем

| Система | Категорія | Призначення | Фактичний стан у проєкті |
| :--- | :--- | :--- | :--- |
| **FIRSTWIN Delivery Portal (`#/portal`, `#/client`)** | **Власна production CRM / Клієнтський портал** | Управління проєктами, клієнтами, етапами, задачами, інвойсами, фінансами, SLA, шаблонами та автоматизаціями | **Повністю реалізовано та працює на Supabase PostgreSQL** |
| **Sales System Public Demo Admin (`#/admin`)** | **Демонстраційна вітрина для портфоліо** | Показ концепції воронки лідів, UTM-статистики та мокових оплат у браузері | Працює на `localStorage` / `js/state.js` |
| **HubSpot** | **Стороння CRM** | Згадується як референс у тарифах та як disconnected badge у demo admin | **Не підключено** (активних API/OAuth ключів немає) |
| **Pipedrive** | **Стороння CRM** | Згадується в демо-адмінці та в документації логістики | **Не підключено** (токенів немає) |
| **Корпоративні акаунти ALSER** | **Чужий / Корпоративний бізнес** | Акаунт `sales2@alser.ua` та логістика замірів СЗС | **Категорично заборонено використовувати в Sales System** |

### Детальний опис власної CRM / Клієнтського порталу FIRSTWIN

* **Шлях до коду:**
  * Адмін-портал: `js/portal/*`
  * Клієнтський кабінет: `js/client/*`
  * База даних та RPC: `supabase/migrations/*` (24 міграції)
  * Edge Functions: `supabase/functions/client-access-admin/index.ts`
* **Реалізовані модулі:**
  1. **Клієнти та Організації (`#/portal/clients`):** Реєстр контрагентів, контактні особи, історія співпраці, налаштування доступу до кабінету.
  2. **Проєкти та Пайплайни (`#/portal/projects`):** Створення проєктів, візард створення з шаблонів (Playbooks), етапи, майлстоуни, відстеження прогресу.
  3. **Задачі та Залежності (`#/portal/tasks`):** Канбан/список задач, залежності (`requires`), блокери, пріоритети, дедлайни.
  4. **Клієнтські дії та Документи (`#/portal/documents`):** Погодження документів, версіонування файлів, запити правок, акти, договори.
  5. **Зустрічі та Календар (`#/portal/meetings`):** Фіксація зустрічей, протоколи рішень, повторювані події, синхронізація з календарем.
  6. **Фінанси, Білінг та Інвойси (`#/portal/finance`):** Мультивалютні комерційні умови, графіки платежів, атомарна нумерація інвойсів (`FW-YYYY-NNNNNN`), незмінні зліпки реквізитів (`JSONB snapshots`), контроль переплат, звітність заборгованостей за 6 aging-бакетами (`Not Due`, `1–7d`, `8–30d`, `31–60d`, `61–90d`, `90+d`).
  7. **Аналітика та Звітність (`#/portal/analytics`, `#/portal/reports`):** Єдиний високопродуктивний SQL RPC розрахунку KPI, 7 регламентних звітів, збережені пресети фільтрів (`analytics_saved_views`), експорт у валідний бінарний Excel OOXML XLSX з 5 структурованими аркушами.
  8. **Шаблони Проєктів (Phase 6A/6B):** Версіоновані плейбуки (`draft`/`published`/`archived`), захист від подвійного створення через `idempotency_keys`.
  9. **Двигун Автоматизацій та SLA (Phase 6C):** JSONB Rule Engine (`evaluate_automation_rules`), тригери переходу етапів, захист від зациклення (глибина до 5), розрахунок SLA у робочих днях (`add_business_days`), журнал виконання `automation_execution_events`.
  10. **Клієнтський Кабінет (`#/client/*`):** Ізольований захищений простір для представника замовника без доступу до внутрішньої собівартості та маржі.
* **Чи працює CRM фактично:** **ТАК**, це повноцінно працюючий застосунок, підключений до Supabase PostgreSQL із 24 міграціями та повним циклом RLS.
* **Джерело даних:** Supabase PostgreSQL через `js/portal/api/supabase-client.js` з автоматичним кешуванням і fallback на `data-client.js`.
* **Статуси сутностей:**
  * Проєкти: `planned`, `active`, `on_hold`, `completed`, `cancelled`.
  * Етапи: `planned`, `active`, `completed`, `blocked`.
  * Задачі: `backlog`, `todo`, `in_progress`, `in_review`, `done`, `blocked`.
  * Інвойси: `draft`, `issued`, `sent`, `viewed`, `partially_paid`, `paid`, `overdue`, `cancelled`.
  * Доступ клієнта: `invited`, `active`, `revoked`.
* **Авторизація та ролі:**
  * Supabase Auth (Email + Password, Magic Link, OTP).
  * Ролі (RBAC на рівні БД): `owner`, `admin`, `pm`, `specialist`, `client`.
* **Наявність UTM та рекламної атрибуції:**
  * У `js/state.js` реалізовано автозахоплення `utm_source`, `utm_medium`, `utm_campaign` із URL та збереження в лідах.
  * У Supabase схемі FIRSTWIN зараз реалізовані білінгові та операційні сутності. Таблицю для зовнішніх маркетингових лідів із рекламною атрибуцією (`click_id`, `campaign_id`, `lead_cost`, `qualification_status`) рекомендовано додати окремим кроком для синхронізації з сайтом.

### Фіксація зовнішніх конекторів та акаунтів

* **HubSpot:** Portal ID відсутній, підключення немає (лише моковий запис у демо-адмінці).
* **Pipedrive:** Токенів та підключень для Sales System немає.
* **ALSER CRM та пошта `sales2@alser.ua`:**
  * У репозиторії виявлено допоміжний аналітичний документ `szs_logic_explained.md`, який описує сторонню логіку розподілу вимірів (СЗС) та прізвища замірників ALSER (Юрасов, Коломієць тощо).
  * **Висновок:** Цей документ і будь-які акаунти компанії ALSER (включаючи `sales2@alser.ua`) є сторонніми / референсними і **НЕ ПОВИННІ** використовуватись або інтегруватись у Sales System.

---

## 4. Supabase і база даних

* **Project Name:** `firstwin-platform`
* **Project Reference:** `aayqydcdfxhlwizhfjun`
* **Supabase API URL:** `https://aayqydcdfxhlwizhfjun.supabase.co`
* **Регіон:** Supabase Cloud (AWS EU).
* **Пов'язані застосунки:** Внутрішній портал FIRSTWIN (`#/portal`) та Клієнтський кабінет (`#/client`).
* **Таблиці бази даних (30+ таблиць):**
  * `profiles` (користувачі та глобальні ролі)
  * `organizations`, `organization_memberships` (мультитенентність)
  * `contacts`, `client_portal_access` (клієнтські контакти та доступи)
  * `projects`, `project_memberships` (проєкти та призначені команди)
  * `project_stages`, `project_milestones` (структура роадмапу)
  * `tasks`, `task_dependencies`, `task_actions` (задачі та зв'язки)
  * `documents`, `document_versions`, `client_actions` (файли та погодження)
  * `meetings`, `meeting_notes`, `meeting_decisions` (зустрічі та рішення)
  * `billing_profiles`, `invoice_sequences` (реквізити та лічильники)
  * `invoices`, `invoice_items`, `project_payments` (інвойси та оплати)
  * `project_commercial_terms`, `project_payment_schedule` (комерційні умови)
  * `invoice_audit_events`, `template_audit_events` (аудит-логи)
  * `notifications`, `notification_preferences` (центр сповіщень)
  * `analytics_saved_views` (персональні збережені фільтри аналітики)
  * `project_templates`, `template_versions`, `template_stages`, `template_milestones`, `template_tasks` (шаблони плейбуків)
  * `automation_rules`, `automation_execution_events`, `project_dependencies`, `project_blockers` (двигун автоматизацій)
  * `idempotency_keys` (захист від дублювання транзакцій)
* **Міграції:** 24 файли SQL у `supabase/migrations/` (повністю покривають архітектуру від фази 0 до 6C).
* **Row-Level Security (RLS):** Увімкнено на кожній таблиці (`ENABLE ROW LEVEL SECURITY`). Реалізовано повну ізоляцію клієнтів від внутрішніх фінансових маржинальностей та чернеток інвойсів.
* **Edge Functions:**
  * `client-access-admin` (`supabase/functions/client-access-admin/index.ts`): обробка дій `invite`, `resend`, `update_projects`, `revoke` з перевіркою JWT-токена та прав адміна.
* **Storage Buckets:** `project-documents` (для файлів та версій документів).
* **Авторизація:** Supabase Auth (Email/Password, Magic Link, OTP).
* **Environment Variables:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.
* **Працюючі модулі vs Заглушки:**
  * Працюють на 100%: Усі модулі бекенду FIRSTWIN (БД, RLS, RPC аналітики, генерація проєктів з шаблонів, білінг, автоматизації).
  * Заглушка: Пряма лідогенерація з публічного сайту в Supabase ще не пов'язана тригером.

---

## 5. Форми, календар і оплати

| Елемент | Статус | Опис та поточний стан |
| :--- | :--- | :--- |
| **Форми заявки (`#/contacts`, `#/audit` тощо)** | **ЧАСТКОВО** | Форма валідує поля та зберігає дані в локальний `State` (`localStorage`). Відсутній POST-вебхук у CRM/Telegram. |
| **Форма бронювання консультації (`#/consultation`)** | **ЧАСТКОВО** | Збирає повний набір даних (14 полів), фіксує дату та час, зберігає в `State` і перенаправляє на `#/success`. |
| **Calendly** | **ВІДСУТНІЙ** | Не підключено (`NOT_CONFIGURED`). |
| **HubSpot Meetings** | **ВІДСУТНІЙ** | Не підключено (`NOT_CONFIGURED`). |
| **Google Calendar** | **ЧАСТКОВО / MOCK** | Є вибір дати/часу на фронтенді, змінні в `.env.example`. Пряма інтеграція через Google API відсутня. |
| **Telegram** | **ЧАСТКОВО / MOCK** | Реалізовано симулятор чат-бота (`js/components/chat.js`). Бот сповіщень про нові ліди потребує налаштування токена. |
| **WhatsApp** | **ВІДСУТНІЙ** | Не підключено (`NOT_CONFIGURED`). |
| **Email** | **ЧАСТКОВО** | Плейсхолдер у футері (`contact@example.com`). Працюють системні транзакційні email-запрошення Supabase Auth. |
| **Платіжна сторінка** | **ЧАСТКОВО** | Модальне вікно вибору шлюзу (`js/components/payment.js`) та інвойси у порталі (`#/portal/finance`). |
| **Оплата карткою (Mono / LiqPay / WayForPay)** | **ВІДСУТНІЙ** | Реалізовано UI-імітатор оплати. Реальні банківські API-ключі та callback webhooks не підключені. |
| **Оплата в криптовалюті (Whitepay / USDT)** | **ВІДСУТНІЙ** | Реалізовано UI-імітатор переказу на криптогаманець. Шлюз не підключено. |
| **Thank-you page (`#/success`)** | **ПРАЦЮЄ** | Повноцінна сторінка подяки з поясненням наступних кроків та посиланням на Telegram. |
| **Повідомлення після заявки** | **ПРАЦЮЄ** | Миттєве відображення статусу в UI та у віджеті чату. |
| **Передача заявки в CRM** | **ВІДСУТНІЙ** | Заявки з сайту не передаються у зовнішню CRM або Supabase автоматично. |

---

## 6. Аналітика і реклама

| Інструмент / Подія | Стан | Коментар |
| :--- | :--- | :--- |
| **Google Analytics 4** | **ЧАСТКОВО** | Код підключено в `index.html`, але встановлено плейсхолдер `G-XXXXXXXXXX`. Реальний потік даних не налаштовано. |
| **Google Tag Manager** | **NOT_CONFIGURED** | Контейнер GTM відсутній. |
| **Google Search Console** | **NOT_CONFIGURED** | Метатег підтвердження або DNS-запис відсутні. |
| **Google Ads** | **NOT_CONFIGURED** | Тег ремаркетингу та конверсій не підключено. |
| **Meta Business Portfolio** | **NOT_CONFIGURED** | Акаунт не прив'язаний. |
| **Meta Pixel / Dataset** | **NOT_CONFIGURED** | Базовий код пікселя відсутній. |
| **Meta Conversions API (CAPI)** | **NOT_CONFIGURED** | Серверне відстеження відсутнє. |
| **Consent / Cookie Banner** | **NOT_CONFIGURED** | Банер згоди на кукі відсутній. |
| **dataLayer** | **ЧАСТКОВО** | `window.dataLayer = window.dataLayer || []` ініціалізовано для Google gtag. |
| **UTM Tracking** | **ПРАЦЮЄ** | Модуль `js/state.js` автоматично зчитує `utm_source`, `utm_medium`, `utm_campaign` із URL та додає до лідів. |
| **Подія `page_view`** | **NOT_CONFIGURED** | Працює лише стандартний виклик gtag без прив'язки до SPA-роутера. |
| **Події `view_offer`, `cta_click`, `form_start`** | **NOT_CONFIGURED** | Кастомні тригери та відправка подій у dataLayer не прописані. |
| **Подія `generate_lead`** | **NOT_CONFIGURED** | Не надсилається при сабміті форм. |
| **Подія `book_call`** | **NOT_CONFIGURED** | Не надсилається при виборі слоту в консультації. |
| **Події `qualified_lead`, `closed_won`** | **NOT_CONFIGURED** | Офлайн-конверсії не налаштовані. |
| **Передача рекламної атрибуції в CRM** | **NOT_CONFIGURED** | Зв'язок між UTM та базою даних Supabase відсутній. |

---

## 7. Інші інтеграції

| Інтеграція | Для чого потрібна | Акаунт-власник | Статус | Де налаштована | Ризик / Проблема |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Supabase** | База даних, Auth, Storage, Edge Functions | `aayqydcdfxhlwizhfjun` | **Активна** | `js/config.js`, `supabase/` | Необхідно тримати Service Role Key в секреті |
| **Vercel** | Хостинг публічного сайту та SPA | `team_Yq74a1EoOUxrnLRwlIlSlSJI` | **Активна** | `.vercel/project.json`, `vercel.json` | Потрібно підключити основний домен |
| **Pipedrive** | Референс логістики СЗС | ALSER (сторонній) | **Відключено** | `szs_logic_explained.md`, `admin.js` | **Ризик:** Не можна підключати акаунти ALSER |
| **HubSpot** | Демо-референс у тарифах | Відсутній | **Відключено** | `js/pages/admin.js`, `support.js` | Відсутній |
| **Telegram Bot** | Сповіщення про ліди / Чат | Плейсхолдер | **Симуляція** | `js/components/chat.js`, `.env.example` | Потрібно створити власного бота через BotFather |
| **Monobank** | Прийом оплат карткою | Плейсхолдер | **Симуляція** | `js/components/payment.js`, `.env.example` | Потрібен персональний мерчант-токен |
| **LiqPay** | Прийом оплат (Приват24/картки) | Плейсхолдер | **Симуляція** | `js/components/payment.js`, `.env.example` | Необхідні публічний та приватний ключі |
| **Google Calendar** | Бронювання консультацій | Плейсхолдер | **Симуляція** | `js/pages/consultation.js`, `.env.example` | Потрібно налаштувати Google Cloud OAuth Console |
| **Google Analytics** | Вебаналітика сайту | Плейсхолдер `G-XXXXXXXXXX` | **Не активна** | `index.html` | Потрібно створити власний лічильник GA4 |
| **Zapier / Make** | Автоматизація вебхуків | Не підключено | **NOT_CONFIGURED** | — | Відсутній |
| **Notion / Slack** | Внутрішні документи | Не підключено | **NOT_CONFIGURED** | — | Відсутній |

---

## 8. Наявні матеріали та асети

* **Кейси клієнтів з цифрами:**
  * Файл: [`js/state.js`](file:///d:/AI%20ALL/FIRSTWIN/js/state.js#L3-L58), [`js/pages/cases.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/cases.js).
  * Кейс 1: B2B гуртові поставки (+42% конверсія, 2.4x ріст прибутку, відповідь за 8 хв).
  * Кейс 2: EdTech онлайн-школа (обробка лідів за 3 хв, 99% автооплат, -35% рутини).
  * Кейс 3: Виробник меблів (найм 3 менеджерів, вихід власника з операційки, +85% часу).
* **Відгуки:** Тексти відгуків клієнтів (Дмитро, Олена, Сергій) у [`js/state.js`](file:///d:/AI%20ALL/FIRSTWIN/js/state.js#L20-L56) та [`js/pages/cases.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/cases.js).
* **Ключові цифри та позиціонування:** [`js/pages/home.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/home.js) (*11 років досвіду, 40+ побудованих відділів продажів, 2.4x середній ріст конверсії, 500+ навчених менеджерів*).
* **Фото експерта:** [`img/expert.jpg`](file:///d:/AI%20ALL/FIRSTWIN/img/expert.jpg).
* **Скріншоти та графічні асети:**
  * `docs/screenshots/home.png`
  * `docs/screenshots/services.png`
  * `docs/screenshots/ai-automation.png`
  * `docs/screenshots/admin-dashboard.png`
  * `img/admin-panel.png`, `img/ai-qa.png`, `img/logistics.png`, `img/schedule.png`.
* **Тексти послуг та ціни:**
  * Експрес-діагностика: 6 000 грн ([`js/pages/consultation.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/consultation.js)).
  * Аудит відділу продажів: 45 000 грн ([`js/pages/audit.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/audit.js)).
  * Скрипти продажів та стандарти: 30 000 грн ([`js/pages/scripts.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/scripts.js)).
  * Корпоративні тренінги: 40 000 грн ([`js/pages/trainings.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/trainings.js)).
  * CRM та Автоматизація: 60 000 грн ([`js/pages/automation.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/automation.js)).
  * Впровадження ШІ та Custom-розробка: 150 000 грн ([`js/pages/ai-solutions.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/ai-solutions.js)).
  * Консалтинговий супровід: 80 000 грн ([`js/pages/support.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/support.js)).
  * Побудова відділу продажів під ключ: 250 000 грн ([`js/pages/support.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/support.js)).
* **Юридичні документи та регламенти:**
  * Політика конфіденційності: [`js/pages/privacy.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/privacy.js).
  * Правила повернення коштів: [`js/pages/refund.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/refund.js).
  * Умови надання послуг: [`js/pages/terms.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/terms.js).
  * Ліцензія: [`LICENSE`](file:///d:/AI%20ALL/FIRSTWIN/LICENSE) (MIT).

> [!NOTE]
> Вказані кейси, цифри та відгуки наразі оформлені як демонстраційні матеріали портфоліо. Перед запуском прямої платної реклами користувач повинен підтвердити, чи використовувати їх як реальні або замінити на оновлені комерційні пропозиції.

---

## 9. Ризики та технічні прогалини

1. **Ізоляція від ALSER:** Документ `szs_logic_explained.md` та будь-які референси до пошти `sales2@alser.ua` містять корпоративну логіку іншої компанії. Їх суворо заборонено інтегрувати в базу даних чи рекламні системи Sales System.
2. **Збереження лідів у LocalStorage:** Заявки з сайту не потрапляють на сервер. Якщо користувач очистить кеш або змінить пристрій, заявка буде втрачена. Потрібен прямий webhook або запис у Supabase `contacts`.
3. **Відсутність валідних лічильників GA4 та Meta Pixel:** Рекламні кампанії не можна запускати до налаштування передачі подій (`generate_lead`, `book_call`, `view_offer`).
4. **Плейсхолдери контактів:** На сайті вказані фіктивні контакти (`+38 (099) 000-00-00`, `contact@example.com`, `@sales_expert`).
5. **Непідключений еквайринг:** Клієнти не можуть здійснити реальну оплату карткою онлайн.

---

## 10. Інструкції для передачі в Claude Code

### Точна папка для відкриття
```bash
cd "D:\AI ALL\FIRSTWIN"
```

### Топ-15 файлів, які Claude Code повинен прочитати першими

1. [`docs/technical-specs/antigravity_to_claude_handoff.md`](file:///d:/AI%20ALL/FIRSTWIN/docs/technical-specs/antigravity_to_claude_handoff.md) — Цей handoff-звіт.
2. [`README.md`](file:///d:/AI%20ALL/FIRSTWIN/README.md) — Огляд проєкту, візія та стек.
3. [`ARCHITECTURE.md`](file:///d:/AI%20ALL/FIRSTWIN/ARCHITECTURE.md) — Архітектура білінгу, інвойсингу, аналітики та автоматизацій.
4. [`DATABASE.md`](file:///d:/AI%20ALL/FIRSTWIN/DATABASE.md) — Довідник структури таблиць PostgreSQL та RPC.
5. [`index.html`](file:///d:/AI%20ALL/FIRSTWIN/index.html) — Точка входу, метатеги, CDN скрипти та GA4.
6. [`js/app.js`](file:///d:/AI%20ALL/FIRSTWIN/js/app.js) — Ініціалізація додатку.
7. [`js/router.js`](file:///d:/AI%20ALL/FIRSTWIN/js/router.js) — Маршрутизація SPA (публічна частина, портал, клієнтський кабінет).
8. [`js/state.js`](file:///d:/AI%20ALL/FIRSTWIN/js/state.js) — Стан лідів, UTM-трекінг, кейси та прайси.
9. [`js/pages/home.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/home.js) — Головна сторінка та віджет діагностики.
10. [`js/pages/consultation.js`](file:///d:/AI%20ALL/FIRSTWIN/js/pages/consultation.js) — Форма лідогенерації та запису.
11. [`js/config.js`](file:///d:/AI%20ALL/FIRSTWIN/js/config.js) — Публічна конфігурація Supabase.
12. [`js/portal/api/supabase-client.js`](file:///d:/AI%20ALL/FIRSTWIN/js/portal/api/supabase-client.js) — Клієнт взаємодії з БД.
13. [`js/portal/ui/portal-shell.js`](file:///d:/AI%20ALL/FIRSTWIN/js/portal/ui/portal-shell.js) — Лейаут внутрішнього порталу.
14. [`js/client/ui/client-shell.js`](file:///d:/AI%20ALL/FIRSTWIN/js/client/ui/client-shell.js) — Лейаут клієнтського кабінету.
15. [`.env.example`](file:///d:/AI%20ALL/FIRSTWIN/.env.example) — Перелік необхідних змінних середовища.

### Рекомендована послідовність подальшої роботи Claude Code

1. **Крок 1: Завершення наскрізної лідогенерації**
   * Зв'язати форми сайту (`#/consultation`, `#/contacts`) із таблицею контактів у Supabase або відправкою сповіщень у Telegram-канал власника через Edge Function / Bot API.
2. **Крок 2: Налаштування веб-аналітики**
   * Встановити реальний GA4 Measurement ID (`G-XXXXXXXXXX` → дійсний ID).
   * Додати відстеження подій SPA-переходів у `js/router.js` (`page_view`).
   * Додати трекінг конверсійних подій: `diagnostic_completed`, `form_start`, `generate_lead`, `book_call`.
3. **Крок 3: Підключення контактів та соціальних профілів**
   * Замінити плейсхолдери `@sales_expert`, `contact@example.com`, номери телефонів на реальні реквізити замовника.
4. **Крок 4: Підготовка платіжного шлюзу (за потреби)**
   * Підключити офіційний віджет Monobank або LiqPay API для онлайн-оплати консультацій.
5. **Крок 5: Налаштування рекламних кабінетів**
   * Після верифікації подій аналітики підключити Meta Pixel / Google Ads та налаштувати рекламні аудиторії.

### Категоричні заборони при роботі з проєктом

> [!CAUTION]
> 1. **НЕ використовувати** корпоративні акаунти, пошту `sales2@alser.ua` або логістичні дані ALSER (`szs_logic_explained.md`) для власної платформи Sales System.
> 2. **НЕ компрометувати** секретні ключі (`SUPABASE_SERVICE_ROLE_KEY`, банківські API-токени) у клієнтському коді або репозиторії.
> 3. **НЕ порушувати** цілісність RLS у Supabase (клієнти ніколи не повинні мати доступу до чужих даних або внутрішньої собівартості).

### Список `TO_CONFIRM` (питання для підтвердження користувачем)

- [ ] **Контакти:** Який реальний номер телефону, Telegram-юзернейм та робочий email встановити на сайті?
- [ ] **Telegram Bot:** Чи створено окремого бота для отримання сповіщень про нові заявки?
- [ ] **Аналітика:** Чи створено вже акаунт Google Analytics 4 (потрібен ID виду `G-XXXXXXXXXX`)?
- [ ] **Домен:** Чи планується прив'язка власного домену (наприклад, `sales-system.ua`) до Vercel?
- [ ] **Еквайринг:** Яку платіжну систему обрати основною для прийому оплат (Monobank / LiqPay / інша)?
- [ ] **Кейси та матеріали:** Чи затверджено поточні тексти кейсів та відгуків для публікації в рекламі?
