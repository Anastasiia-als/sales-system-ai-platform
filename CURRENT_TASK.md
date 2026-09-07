# Поточне завдання: Phase 7 — Зовнішні інтеграції та механізм вихідної доставки (Outbound Delivery Engine)

## Активний етап: Phase 7B — Інтеграція сповіщень Telegram (ШЛЮЗ АРХІТЕКТУРИ ТА ПЛАНУВАННЯ / PLANNING ONLY)

### Архітектурний бейслайн
- **Попередній етап Phase 7A**: ПОВНІСТЮ ЗАКРИТО (PASSED / ACCEPTED / CLOSED після успішного Manual Acceptance користувачем).
- **Поточний стан**: PLANNING ONLY / ZERO IMPLEMENTATION до окремого схвалення архітектурного контракту Phase 7B.
- **Обсяг етапу (Scope)**: Виділений канал Outbox `channel_type='telegram'`, збереження Bot Token у Supabase Vault (`vault.secrets`), модель таблиці `telegram_destinations`, захист від референційного видалення (`23001 RESTRICT_VIOLATION`), парсер та екранування MarkdownV2, обробка HTTP 429 з `parameters.retry_after`, мінімізація корисної інформації, UI керування чатами/топіками.

---

## 1. Затверджена структура Phase 7

| Підетап | Компонент | Пріоритет | Статус | Опис |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 7A** | Integration Core & Outbound Webhooks | **Обов'язковий** | **ЗАКРИТО / PASSED** | Transactional Outbox, Vault-backed URL/secret storage, SSRF protection (без 3xx redirect, DNS rebinding guard), exact-byte HMAC-SHA256, білі списки payload, захищені `SECURITY DEFINER` RPCs, тригери референційної цілісності, автономний воркер диспетчера, UI кінцевих точок та журналу доставок. Повністю прийнято користувачем. |
| **Phase 7B** | Telegram Notifications Integration | **Обов'язковий** | **ПЛАНУВАННЯ / ШЛЮЗ АРХІТЕКТУРИ** | Виділений канал Outbox `channel_type='telegram'`, бот-токен у Vault, парсер MarkdownV2, обробка затримки 429 `retry_after`. |
| **Phase 7C** | Calendar Read-Only Feed (iCalendar) | **Обов'язковий** | **ЗАТВЕРДЖЕНО** | Односторонній потік підписки RFC 5545 `.ics`, архітектура хешованих токенів (`sha256(raw_token)`), заборона зворотного запису. |
| **Phase 7D** | Additional Communication (Slack) | **Опціональний** | **ВІДКЛАДЕНО** | Опціонально / відкладено до підтвердженої бізнес-потреби. |

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

## 3. Результат ручного прийняття Phase 7A (Manual Acceptance PASSED)
- **Статус Phase 7A**: **ПОВНІСТЮ ПРИЙНЯТО ТА ЗАКРИТО (PASSED / ACCEPTED / CLOSED)**.
- **Підтверджені критерії приймання**:
  1. Розділ «Інтеграції та Webhooks» працює коректно для клієнта `Demo Client Corp`.
  2. Тестовий вебхук `Phase 7A Manual Test` успішно створений із показом одноразового Signing Secret.
  3. Зміна статусу задачі `Draft Recommendations` генерує подію `task.completed`.
  4. Запис у журналі Outbox отримує статус `DELIVERED`, HTTP 200, 1/5 спроб.
  5. Зовнішній сервер `webhook.site` підтверджує отримання POST із заголовками `X-Firstwin-Event: task.completed`, `X-Firstwin-Signature-256`, `X-Firstwin-Timestamp`, `X-Firstwin-Delivery`.
  6. Мінімізований payload містить коректні дані події, задачі та проєкту без витоку чутливої інформації.
  7. Hard Delete Protection блокує видалення точки з історією доставок (помилка `23001`).
  8. Soft Deactivation успішно вимикає точку без втрати історії.
  9. Дефект `selectedDepIds is not defined` не відтворюється.
- **Поточний стан**: ПЛАНУВАННЯ ТА ШЛЮЗ АРХІТЕКТУРИ PHASE 7B. Жодної реалізації чи змін у БД до окремого погодження користувачем.
