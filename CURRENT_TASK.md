# Поточне завдання: Phase 8 — AI Delivery Layer

## Активний етап: Phase 8B — Meeting Intelligence & Action Item Extraction (Manual Acceptance Gate)

### Архітектурний бейслайн
- **Статус Phase 8A (Core AI Gateway, Quotas & Schemas)**: **ПРИЙНЯТО ТА ЗАКРИТО (CLOSED / APPROVED)**. Успішно підтверджено у Manual Acceptance: авторизація порталу, регресія Core Gateway 22/22, Unauthorized 401, авторизована структурована генерація 200, Provider allowlist 400.
- **Статус Gemini Production Provider Activation**: `PENDING_LIVE_ACTIVATION` (Окремий неблокуючий статус, очікує передачі `GEMINI_API_KEY` у середовищі).
- **Поточний статус Phase 8B (Meeting Intelligence & Action Item Extraction)**: **ІМПЛЕМЕНТОВАНО — ОЧІКУЄ РУЧНОГО ПРИЙМАННЯ (IMPLEMENTED — PENDING ACCEPTANCE)**. Усунуто блокуючий дефект ручного тестування: впроваджено семантичний екстрактор нотаток у `AIGateway`, інвалідовано старий чернетковий артефакт (міграція `20260910000035_phase8b_grounded_notes_extraction.sql`), оновлено шаблон `meeting_intelligence_v1` із правилами Zero-Hallucination, реалізовано автоприв'язку дедлайнів та виконавців у UI `portal-meeting-detail-view.js`. 7/7 виділених сьютів (131 твердження) 100% PASS, канонічна регресія платформи 97/97 сьютів (1906 тверджень) 100% PASS.

---

## 1. Затверджена структура Phase 8

| Підетап | Компонент | Пріоритет | Статус | Опис |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 8A** | Core AI Gateway, Quotas & Schemas | **Обов'язковий** | **ПРИЙНЯТО ТА ЗАКРИТО (CLOSED)** | Провайдер-агностичний шлюз `AIGateway`, підтримка Gemini 2.5, детермінований mock transport, операційні квоти токенів з UTC-скиданням, валідація JSON Schema, append-only аудит, DLP-санітизація, детерміністична деідентифікація учасників, авторитетна авторизація сесії та захист від prompt-ін'єкцій. 93/93 сьютів (1771 твердження) 100% PASS. Gemini Live Activation: PENDING_LIVE_ACTIVATION. |
| **Phase 8B** | Meeting Intelligence & Action Item Extraction | **Обов'язковий** | **ІМПЛЕМЕНТОВАНО — ОЧІКУЄ ПРИЙМАННЯ (PENDING ACCEPTANCE)** | Автоматична генерація протоколу зустрічі з сирих нотаток/транскриптів (Рішення, Резюме), двоетапний інтерактивний інтерфейс Human-in-the-Loop перевірки, курації та створення завдань у `tasks` в 1 клік через атомарну RPC-функцію з контролем ідемпотентності. |
| **Phase 8C** | Delivery Risk & Predictive Health Advisor | **Обов'язковий** | **ЗАПЛАНОВАНО** | Аналіз ланцюжків блокуючих залежностей, прострочених дій клієнта, генерація щотижневого дайджесту ризиків для Власника та PM. |
| **Phase 8D** | Client Action & Brief Assistant | **Опціональний** | **ЗАПЛАНОВАНО** | Поліпшення клієнтських брифів, авто-валідація повноти відповідей перед відправленням. |

---

## 2. Заморожені архітектурні інваріанти

1. **Ідентичність доставки Transactional Outbox**:
   - Складений унікальний ключ: `(event_id, channel_type, destination_id)`.
   - Окремий рядок для кожного одержувача доставки, що унеможливлює конфлікти та забезпечує детерміновані повторні спроби.
2. **Захищені функції `SECURITY DEFINER`**:
   - Виконання `public._emit_integration_event` суворо відкликано у `PUBLIC`, `anon` та `authenticated`.
   - Доступ мають лише `service_role` та внутрішні тригери.
   - Суворе використання `SET search_path = public, pg_temp` та повністю кваліфікованих імен об'єктів.
   - Контекст (`organization_id`, `project_id`) обчислюється на сервері з перевірених рядків БД.
   - Прямий виклик клієнтом повертає помилку `42501 permission denied`.
3. **Референційна цілісність та семантика видалення**:
   - `destination_id UUID NOT NULL` в `integration_outbox`.
   - Фізичне видалення (`DELETE`) кінцевих точок або Telegram-дестинацій суворо **заборонено**, якщо в Outbox є хоч один історичний запис (в усіх статусах).
   - Керування життєвим циклом через `is_active = false`.
   - Тригери `BEFORE DELETE` на `public.integration_endpoints` та `public.telegram_destinations` повертають помилку `23001 RESTRICT_VIOLATION`.
   - Фізичне видалення дозволено виключно за умови, що кількість записів в Outbox дорівнює точно 0.
4. **Серверна маршрутизація та валідація**:
   - `_enqueue_integration_outbox_deliveries(p_event_id UUID)` не приймає аргументів маршрутизації від клієнта.
   - Перевіряє існування дестинації, збіг `channel_type`, належність тенанту (`organization_id`) та активний стан (`is_active = true`).
   - 0 рядків створюється для неіснуючих, чужих, деактивованих чи невідповідних каналів.
5. **Збереження секретів у Supabase Vault**:
   - Повні URL вебхуків (разом із секретними шляхами/токенами) та секрети підпису зберігаються у `vault.secrets`.
   - UI отримує лише масковані метадані та UUID-посилання на Vault. Жодних відкритих секретів у звичайних таблицях.
6. **SSRF та мережева безпека**:
   - Диспетчер перевіряє цільові IP-адреси на належність до приватних/loopback/link-local діапазонів IANA перед відкриттям сокету.
   - HTTP 3xx перенаправлення категорично відхиляються як невдала доставка зі статусом `rejected_ssrf`.
   - DNS-резолвінг виконується безпосередньо перед запитом для унеможливлення атак DNS rebinding.
7. **Підпис точно за байтами HMAC-SHA256**:
   - Підпис обчислюється над точною послідовністю байтів серіалізованого JSON-тіла HTTP-запиту.
   - Заголовок: `X-Firstwin-Signature-256: sha256=<hex>`.
8. **Мінімізація корисного навантаження (Payload Minimization)**:
   - Суворі білі списки полів для кожної події у `payload_json`.
   - Персональні дані (PII) та внутрішні токени доступу категорично виключені.
9. **Контекст організації в UI**:
   - Використовується авторитетний механізм через `DataClient.getOrganizations()` та `PortalState.currentOrganization` / `PortalAuth.getMemberships()`.
10. **Автономний воркер диспетчера Outbox**:
    - Інтегрований у `server.js` фоновий диспетчер (`js/portal/api/dispatcher-worker.js`), що використовує `FOR UPDATE SKIP LOCKED`, підтримує автоматичну доставку кожні 2.5 секунди та наскрізні повторні спроби (exponential backoff).
11. **Production Event Allowlist для Telegram (Phase 7B)**:
    - Суворий список подій: `task.completed`, `stage.completed`, `document.approved`, `client_action.completed`.
    - Будь-який вибір `*` у UI розгортається на сервері виключно у цей allowlist. Заборона підписки на майбутні/сторонні події.
12. **Канонічна ідентичність Telegram дестинації та дедуплікація (Phase 7B)**:
    - Ідентичність: `(organization_id, bot_id, chat_id, COALESCE(thread_id, 0))`.
    - Частковий унікальний індекс забороняє створення дублюючих активних дестинацій (`WHERE is_active = true`).
13. **Посилена перевірка підключення Telegram (Phase 7B)**:
    - Двоетапний серверний валідаційний ланцюжок: `getMe` (токен) + `getChat` (доступність чату) + валідація сумісності `thread_id` з `is_forum`.
    - Жоден Bot Token не повертається у клієнтський UI, DOM чи прикладні таблиці. Збереження виключно у `vault.secrets`.
14. **RBAC / RLS / SECURITY DEFINER Hardening для Telegram (Phase 7B)**:
    - Керування дестинаціями дозволено виключно Owner / Org Admin (`profiles.global_role = 'owner'` або `org_role IN ('admin', 'owner')`).
    - Клієнти мають суворий Default Deny. `organization_id` валідується сервером.
15. **Контракт Chat ID / Topic ID та MarkdownV2 Escaping (Phase 7B)**:
    - `chat_id` зберігається як `TEXT NOT NULL` без втрати точності для від'ємних 64-бітних ID (`-100...`).
    - `thread_id` зберігається як `BIGINT` (nullable).
    - Обов'язкове екранування 18 спецсимволів Telegram MarkdownV2 усуває помилки 400 Bad Request.

---

## 3. Результати ручного приймання Phase 7 (Manual Acceptance PASSED)
- **Статус Phase 7A**: **ПОВНІСТЮ ПРИЙНЯТО ТА ЗАКРИТО (PASSED / ACCEPTED / CLOSED)**.
- **Статус Phase 7B**: **ПОВНІСТЮ ПРИЙНЯТО ТА ЗАКРИТО (PASSED / ACCEPTED / CLOSED)**.
- **Статус Phase 7C**: **ПОВНІСТЮ ПРИЙНЯТО ТА ЗАКРИТО (PASSED / ACCEPTED / CLOSED)**.
  - Підтверджено користувачем у реальному Chrome та Google Calendar:
    1. Календарна підписка успішно створюється в UI.
    2. `.ics` фід завантажується та імпортується коректно у Google Calendar.
    3. Етапи та завдання проєктів коректно відображаються у Google Calendar.
    4. Ротація/перегенерація токена працює без збоїв.
    5. Відкликаний токен негайно втрачає доступ і повертає `not_found_or_expired` (404).

---

## 4. Результати верифікації Phase 8A
- **Спеціалізовані тести Phase 8A**: **3 набори, 100% PASS** (44 перевірки).
  1. `test_phase8a_gateway_and_schemas.js`: 22/22 PASS (схеми JSON, валідація, генерація, логування, HTTP 200).
  2. `test_phase8a_quotas_and_security.js`: 14/14 PASS (ізоляція тенантів, вичерпання ліміту 429, захист від мутацій логів 23514).
  3. `test_phase8a_vault_and_keys.js`: 8/8 PASS (нуль відкритих ключів у таблицях, нуль витоків у логах/відповідях, CORS 204).
- **Повна канонічна регресія платформи (`scratch/run_canonical_regression.js`)**: **91 набір тестів, 1717 тверджень, 0 помилок (EXIT 0, 100% PASS)**.
- **Data Preservation Guard**: **100% PASS** (0 зниклих правил, 0 витоків фікстур).
- **Підтверджені архітектурні інваріанти Phase 8A**:
  1. **Provider Abstraction**: єдиний шлюз `AIGateway` з підтримкою Google Gemini 2.5 та mock transport.
  2. **Structured Outputs**: сувора валідація JSON Schema з відхиленням невалідних структур (422).
  3. **Multi-Tenant Cost Guard**: щоденні квоти токенів з атомарним декрементом та HTTP 429 при переліміті.
  4. **Append-Only Immutability**: тригер `prevent_ai_logs_mutation()` блокує будь-яке видалення/редагування логів (23514).
  5. **Zero-Training & Zero-Leakage**: відсутність відкритих ключів у БД, маскування чутливих даних.

---

## 5. Наступний етап дорожньої карти: Phase 8B — Meeting Intelligence & Action Item Extraction
- **Поточна дія**: Реалізація сервісу екстракції протоколу зустрічі та UI затвердження завдань в один клік (`#/portal/meetings/:id`).
- **Human-in-the-Loop**: ШІ генерує виключно чернетки рішень та кандидатні завдання. Фізичне створення задач у `tasks` вимагає явної дії PM.

