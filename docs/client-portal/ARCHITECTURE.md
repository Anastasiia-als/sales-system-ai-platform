# FIRSTWIN Architecture & Client Portal Placement

> **Module**: Client & Project Delivery Platform (Client Portal)  
> **Phase**: Phase 3A — Documents, File Storage & Versioning Completed  
> **Status**: Live Supabase Project Active (`firstwin-platform` in `eu-central-1`) with Private Storage (`project-documents`)  
> **Last Updated**: 2026-08-22  

---

## 1. Загальний огляд архітектури FIRSTWIN

### 1.1 Frontend Stack
- **Мова та стандарти**: Сучасний Vanilla JavaScript (ES6 Modules).
- **Архітектурний патерн**: Single Page Application (SPA) з клієнтським Hash-роутером (`window.location.hash`).
- **Стилізація**: Vanilla CSS3 з власною дизайн-системою (Dark SaaS Palette, CSS Custom Properties, Glassmorphism).
- **Іконки**: Lucide Icons.
- **Шрифти**: Google Fonts — `Plus Jakarta Sans`.
- **Публічна конфігурація**: `js/config.js` експортує браузерно-безпечні змінні `window.FIRSTWIN_ENV` (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`).

### 1.2 Підключений Data & Auth Layer (Live Supabase)
- **Живий проєкт Supabase**: `firstwin-platform` (ID/Ref: `aayqydcdfxhlwizhfjun`).
- **Регіон**: `eu-central-1` (Frankfurt, Germany).
- **Тарифний план**: Free Plan.
- **Аутентифікація**: Supabase Auth (Session-based, Email Invites, Magic Links).
- **Ключі доступу у браузері**: Використовується **виключно** `Publishable Key` (`sb_publishable_...`). Жодних секретних ключів або `service_role` у клієнтському коді.
- **Модульна структура Client Portal (`js/portal/`)**:
  - `config/supabase-config.js` — постачальник конфігурації з `window.FIRSTWIN_ENV`;
  - `api/supabase-client.js` — синглтон Supabase-клієнта з динамічним ESM SDK;
  - `api/data-client.js` — єдиний інтерфейс `DataClient` доступу до персистентного шару (організації, контакти, проєкти, членство команди, Roadmap, етапи, Milestones, Tasks, Task Dependencies, Documents, Document Versions та Storage);
  - `auth/auth-service.js` — сервіс `PortalAuth` (стандартні сесії Supabase, слухач `onAuthStateChange`);
  - `state/portal-state.js` — реактивний стан `PortalState`;
  - `ui/portal-shell.js` — десктопний лейаут робочого простору з активним розділом Документи;
  - `ui/portal-clients-view.js` — таблиця організацій та створення клієнтів;
  - `ui/portal-client-detail-view.js` — картка клієнта з табами Огляд, Контакти та Проєкти;
  - `ui/portal-projects-view.js` — реєстр проєктів делівері з пошуком, фільтрами та створенням проєкту;
  - `ui/portal-project-detail-view.js` — паспорт проєкту, Roadmap, Team, Tasks та Documents tab;
  - `ui/portal-roadmap-view.js` — інтерактивний Stage View делівері, Milestones, детермінований прогрес та дедлайни;
  - `ui/portal-project-tasks-view.js` — модуль управління задачами проєкту (List View & Kanban Board, пріоритети, залежності, Client Actions);
  - `ui/portal-tasks-view.js` — робочий простір "Мої задачі" (`#/portal/tasks`);
  - `ui/portal-documents-view.js` — робочий простір "Документи" (`#/portal/documents`);
  - `ui/portal-document-detail-view.js` — паспорт документа, картка поточної версії та історія версій (`#/portal/documents/:id`);
  - `ui/portal-meetings-view.js` — робочий простір "Зустрічі" (`#/portal/meetings`) з фільтрами та плануванням зустрічей/серій;
  - `ui/portal-meeting-detail-view.js` — паспорт зустрічі, адженда, протоколи, рішення, Action Items/Tasks та прикріплені матеріали (`#/portal/meetings/:id`).

---

## 2. Архітектурна діаграма екосистеми

```mermaid
flowchart TD
    subgraph FIRSTWIN Frontend
        direction TB
        PUB["🌐 Публічний сайт\n(#/, #/services, #/cases)"]
        CRM["📊 FIRSTWIN CRM\n(#/admin - Leads, Sales Funnel)"]
        CP_CLIENTS["🏢 Clients & Contacts\n(#/portal/clients, #/portal/clients/:id)"]
        CP_PROJECTS["📁 Projects, Roadmap & Team\n(#/portal/projects, #/portal/projects/:id)"]
    end
    
    subgraph Data & Auth Layer (js/portal/)
        DATA_CLIENT["⚡ DataClient (Unified Access API)\n(js/portal/api/data-client.js)"]
        AUTH_LAYER["🔐 PortalAuth (Supabase Auth)\n(js/portal/auth/auth-service.js)"]
        STATE_LAYER["📊 PortalState (Reactive Store)\n(js/portal/state/portal-state.js)"]
    end

    subgraph Live Supabase Backend (eu-central-1)
        DB[("🐘 PostgreSQL DB (firstwin-platform)\n(Hardened RLS / Tenant Boundary)")]
        AUTH_SRV["🛡️ Supabase Auth Service\n(Email Invites / Magic Links / JWT)"]
    end
    
    PUB -.->|Створення ліда| CRM
    CRM -->|Конвертація ліда в Проєкт| DATA_CLIENT
    CP_CLIENTS --> STATE_LAYER
    CP_PROJECTS --> STATE_LAYER
    
    STATE_LAYER --> DATA_CLIENT
    STATE_LAYER --> AUTH_LAYER
    
    DATA_CLIENT --> DB
    AUTH_LAYER --> AUTH_SRV
```

---

## 3. Багаторівнева модель ізоляції та безпеки

1. **Рівень 1: Tenant Boundary (Організація та Членство)**
   - `Organization` + `OrganizationMembership` — первинна межа ізоляції.
   - Користувач Організації А на рівні RLS бази даних не має технічної можливості отримати або змінити записи Організації Б.
2. **Рівень 2: Project Membership**
   - Доступ спеціалістів до конкретних проєктів, їх етапів (`project_stages`) та контрольних точок (`milestones`) регламентується виключно явною таблицею `project_memberships`.
   - `responsible_pm_id` та `responsible_user_id` є бізнес-полями відповідальних і не обходять RLS; PM отримує права через роль адміна організації або прямий `project_memberships`.
3. **Рівень 3: Client Visibility (`is_client_visible`)**
   - Використовується як вторинний фільтр всередині дозволеного проєкту для приховування внутрішніх етапів чи контрольних пунктів від клієнтського представника.

---

## 4. Ізоляція Portal Layout (Phase 2C)

Portal UI повністю ізольований від публічного сайту через CSS-механізм `body.portal-active`.

### 4.1 Механізм ізоляції

Роутер (`js/router.js`) визначає чи поточний маршрут є Portal-маршрутом (`/portal*`) та додає/знімає клас `portal-active` на `<body>`.

Коли `body.portal-active` активний, CSS приховує:
- `.top-notice-bar` — маркетинговий promo-банер
- `.main-header` — публічна SalesSystem навігація та CTA
- `.main-footer` — публічний підвал сайту
- `.mobile-sticky-bar` — мобільна CTA-панель
- `#chat-widget-container` — чат-віджет підтримки

### 4.2 Portal Shell

Authenticated Portal рендерить власний desktop-first Shell:
- **Sidebar** — навігація, бренд, посилання до CRM
- **Portal Header** — хлібні крихти, інформація про користувача, logout
- **Workspace** — контентна зона (#portal-main-container)

### 4.3 Публічний сайт

Публічні маршрути (`#/`, `#/services`, `#/audit` тощо) продовжують відображати повний public layout без змін.

---

## 5. Стратегія локалізації UI (Phase 2C)

### 5.1 Принцип
- **Database enum values** залишаються англійськими (`backlog`, `todo`, `on_track` тощо)
- **UI display labels** локалізовані українською через display-map функції в кожному view-компоненті
- **Brand names** залишаються англійськими (FIRSTWIN, Delivery Platform)

### 5.2 Канонічна термінологія

| Контекст | Українська | DB/Code Value |
|---|---|---|
| Milestone | Контрольна точка | milestone |
| Roadmap | Дорожня карта | roadmap |
| Health: On Track | В нормі | on_track |
| Health: At Risk | Є ризик | at_risk |
| Health: Delayed | Із затримкою | delayed |
| Task: Backlog | Беклог | backlog |
| Task: To Do | До виконання | todo |
| Task: In Progress | В роботі | in_progress |
| Task: Review | На перевірці | review |
| Task: Waiting Client | Очікуємо клієнта | waiting_client |
| Task: Blocked | Заблоковано | blocked |
| Task: Done | Виконано | done |
| Priority: Low | Низький | low |
| Priority: Medium | Середній | medium |
| Priority: High | Високий | high |
| Priority: Critical | Критичний | critical |
| Client Visible | Видно клієнту | is_client_visible |
| Client Actions | Очікуємо від клієнта | responsibility_type: client |
| Role: Owner | Власник | owner |
| Role: PM | Менеджер проєкту | pm |
| Role: Specialist | Спеціаліст | specialist |
| Role: Client | Клієнт | client |

---

## 6. Архітектура зустрічей, протоколів та Action Items (Phase 3B)

### 6.1 Життєвий цикл зустрічі
Повний робочий цикл зустрічі проєкту реалізовано за формулою:
$$\text{Meeting} \longrightarrow \text{Agenda} \longrightarrow \text{Participants} \longrightarrow \text{Notes} \longrightarrow \text{Decisions} \longrightarrow \text{Action Items (Tasks)} \longrightarrow \text{Next Meeting}$$

### 6.2 Заборона дублювання таскового рушія
Meeting Action Items не створюють окремої паралельної таблиці задач. Натомість Action Item матеріалізується як стандартний запис `tasks` з обов'язковим зовнішнім ключем `source_meeting_id`.
- **Внутрішня дія команди**: `responsibility_type = 'internal'`, `assignee_user_id` призначає виконавця команди.
- **Дія клієнта (Client Action)**: `responsibility_type = 'client'`, `client_contact_id` призначає відповідальну особу клієнта, `is_client_visible = true`.

### 6.3 Bounded Recurrence Generation
Періодичні зустрічі конфігуруються через `meeting_series` та генерують фіксовану кількість майбутніх зустрічей (від 4 до 12 екземплярів) без ризику неконтрольованого зростання бази даних чи залежності від фонових cron-воркерів.

---

## 7. Архітектура Client Portal Workspace (Phase 4A)

### 7.1 Розподіл маршрутів та просторів
- `#/portal/*`: Internal Portal (Owner, PM, Specialist, IT Specialist) — робочий простір внутрішньої команди.
- `#/client/*`: Client Portal — окремий клієнтський інтерфейс:
  - `#/client/login`: авторизація за email/паролем або Magic Link.
  - `#/client/activate`: початкова активація та встановлення пароля.
  - `#/client/dashboard`: головний дашборд клієнта (KPI, дозволені проєкти, Client Actions, зустрічі, документи).

### 7.2 Zero-Flash Layout Isolation Guard
Для усунення будь-якого миготіння внутрішнього сайдбару або публічного сайту при перезавантаженні сторінки (`F5`):
1. **Інлайн-скрипт у `<head>`**: миттєво додає класи `portal-active` та `client-active` до `document.documentElement` до парсингу `<body>`.
2. **CSS Isolation**: правила в `css/portal.css` приховують публічний навігаційний хедер і футер та налаштовують нативний скрол для `html.client-active`.
3. **Router Synchronizer**: `js/router.js` при навігації підтримує актуальний стан класів та викликає відповідний контролер сторінки.

### 7.3 Клієнтська компонентна архітектура
```
js/
├── client/
│   └── ui/
│       ├── client-shell.js                 # Клієнтський шелл (шапка, навігація Головна/Проєкти/Дії/Документи/Зустрічі, селектор організацій, аватар)
│       ├── client-dashboard-view.js        # Вітальний банер, KPI картки, картки проєктів, Client Actions, зустрічі, документи
│       ├── client-projects-view.js         # Робочий простір проєктів клієнта (#/client/projects)
│       ├── client-project-detail-view.js   # Паспорт проєкту з 5 вкладками: Огляд, Дорожня карта, Дії, Документи, Зустрічі (#/client/projects/:id)
│       ├── client-actions-view.js          # Action Center клієнта з фільтрами та виконанням (#/client/actions)
│       ├── client-documents-view.js        # Каталог документів клієнта з версіями (#/client/documents)
│       ├── client-document-detail-view.js  # Перегляд, завантаження та погодження версій документа (#/client/documents/:id)
│       ├── client-meetings-view.js         # Робочий простір зустрічей клієнта (#/client/meetings)
│       ├── client-meeting-detail-view.js   # Сторінка зустрічі: адженда, учасники, нотатки, рішення, матеріали (#/client/meetings/:id)
│       └── client-auth-view.js             # Екрани входу та активації клієнта
├── pages/
│   └── client-page.js                      # Головний контролер клієнтських маршрутів (#/client/*)
└── portal/
    ├── api/
    │   └── data-client.js                  # DataClient методи з Phase 4B RPC (approve_document_version, request_document_changes, publish_document_version)
    └── auth/
        └── auth-service.js                 # Сесії, перевірка ролей та завантаження активного доступу
```

---

## 8. Архітектура публікації версій та погодження документів (Phase 4B)

### 8.1 Життєвий цикл публікації та погодження документа
$$\text{Upload new version (Internal draft, } v_n \text{)} \longrightarrow \text{PM Publishes } v_n \longrightarrow \text{Client Reviews } v_n \longrightarrow \begin{cases} \text{Approve } \longrightarrow \text{Status: Approved} \\ \text{Request Changes (Mandatory Comment) } \longrightarrow \text{Status: Changes Requested} \end{cases}$$

### 8.2 Stale Approval Protection Guard
Для усунення race conditions (коли клієнт погоджує версію $v_{n-1}$, в той час як команда вже підготувала та опублікувала $v_n$):
- SQL-функції `approve_document_version` та `request_document_changes` виконують детерміновану перевірку:
  $$p\_version\_id \equiv \max_{\text{published}} (document\_versions.id)$$
- При спробі викликати дію для застарілої версії операція відхиляється на рівні бази даних з повідомленням про наявність новішої опублікованої версії.

### 8.3 Незмінний журнал рішень (`document_review_events`)
Кожне погодження або запит правок фіксується як незмінний аудит-запис із точним часом, версією, ідентифікатором контакту та обов'язковим коментарем у разі повернення на доопрацювання.

---

## 9. Архітектура Командного Центру Власника (Phase 5A)

- **Портфельний зріз (`#/portal/dashboard`)**:
  - Центральний контролер `js/portal/ui/portal-dashboard-view.js`.
  - Ефективний паралельний запит `DataClient.getOwnerDashboardData()` для одночасної вибірки клієнтів, проєктів, етапів, задач, документів, зустрічей та команди в межах дозволеного RLS-скоупу.
  - Деривативний `Attention Center` для виявлення операційних проблем у реальному часі без надлишкових таблиць.
  - Таблиця здоров'я портфеля з швидкою клієнтською фільтрацією, пошуком та сортуванням.

---

## 10. Архітектура Сповіщень та Персонального Інбоксу (Phase 5B)

### 10.1 Схема взаємодії компонентів сповіщень
```
[Database Mutations]   ──> [PostgreSQL Triggers] ──┐
[Scheduled / Time]     ──> [evaluate_notifications]├──> [public.notifications]
[Business RPCs]        ──> [create_internal_notif]─┘          │ (Strict Personal RLS)
                                                              ▼
┌─────────────────────────────────────────────────────────────┴────────────────────────────────┐
│ Frontend UI Components:                                                                      │
│ 1. Portal Shell Header Bell (#btn-portal-shell-bell, Unread Badge, Flyout Dropdown)          │
│ 2. Notifications Center View (#/portal/notifications, Metrics, 8 Filter Tabs, Search)        │
│ 3. Dashboard Widget (#/portal/dashboard, Recent Unread/Critical, Direct Deep Links)          │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Детермінована дедуплікація (`dedupe_key`)
- Усі автоматичні сповіщення формуються з унікальним ключем дедуплікації:
  $$\text{dedupe\_key} = \text{event\_type} : \text{entity\_id} : \text{recipient\_user\_id} : \text{date\_bucket}$$
- Запобігає спаму та багаторазовим записам при багаторазовому виклику `evaluate_notifications()` або перезавантаженні сторінок.

### 10.3 Персональна безпека
- Читання та зміна статусу прочитання регулюються виключно через `recipient_user_id = auth.uid()`.
- Клієнтська роль ізольована за принципом `default deny`.




