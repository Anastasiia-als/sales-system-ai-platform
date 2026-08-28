# Client & Project Delivery Platform — Permissions & RBAC Specification

> **Module**: Client & Project Delivery Platform (Client Portal)  
> **Security Model**: Supabase Auth + Membership-Based RBAC + Hardened Database RLS  
> **Status**: Approved, Hardened & Live Verified (Phase 2A)  
> **Last Updated**: 2026-08-22  

---

## 1. Багаторівнева модель безпеки

```mermaid
flowchart TD
    subgraph Layer 1: Authentication
        AUTH["🔐 Supabase Auth\n(Standard Session, Email Invites, Magic Links)"]
    end

    subgraph Layer 2: Primary Security Boundary (Tenant Isolation)
        OWNER_CHECK["👑 is_global_owner()\n(Strictly global_role = 'owner')"]
        ORG_MEMBERSHIP["🏢 Organization & OrganizationMembership\n(RLS: is_org_member, is_org_admin)"]
        PROJ_MEMBERSHIP["📁 Project & ProjectMembership\n(RLS: is_project_member)"]
    end

    subgraph Layer 3: Secondary Visibility Filtering (Client Visibility)
        VISIBILITY["👁️ Client Visibility Filters\n(is_client_visible = true, is_internal = false)"]
    end

    AUTH --> OWNER_CHECK
    OWNER_CHECK -->|Global Access| ALL_TENANTS[("Всі Організації")]
    OWNER_CHECK -->|Standard Scoped Access| ORG_MEMBERSHIP
    ORG_MEMBERSHIP --> PROJ_MEMBERSHIP
    PROJ_MEMBERSHIP --> VISIBILITY
```

---

## 2. Фінальна рольова модель (Owner vs PM vs Specialist vs Client)

| Роль | Скоуп доступу | Авторизація | Зона відповідальності |
|---|---|---|---|
| **Owner** | **Global** (All Tenants) | `global_role = 'owner'` | Єдиний глобальний адміністратор. Повний доступ до всіх клієнтів, проєктів, команд, Roadmap (етапів і Milestones), угод, фінансів. |
| **PM / Admin** | **Scoped** (Призначені Organizations) | `organization_memberships.org_role IN ('admin', 'pm')` | **НЕ є global admin**. Має доступ виключно до організацій та проєктів, де він є активним членом. Керує Roadmap, створює та редагує етапи і Milestones. |
| **IT Specialist** | **Scoped** (Призначені Projects) | `project_memberships` | Доступ до технічних задач, Roadmap, документації та матеріалів **лише конкретного призначеного проєкту**. Не може самовільно додавати нові етапи чи змінювати структуру Roadmap. |
| **Client** | **Tenant & Visibility Scoped** | `org_role = 'client'` + `is_client_visible` | Доступ виключно до своєї `Organization` та своїх `Projects`. Бачить тільки погоджені етапи (`is_client_visible = true`), відкриті таски та зустрічі. |

---

## 3. Захист від підвищення привілеїв (Role Escalation Protection)

1. **Заборона самостійної зміни `global_role`**:
   - Тригер `prevent_role_escalation()` у базі даних блокує будь-яку спробу користувача змінити своє поле `global_role` у таблиці `profiles`.
2. **Заборона самопризначення в Організації (`OrganizationMembership`)**:
   - RLS-політики забороняють користувачу вставляти або оновлювати записи в `organization_memberships`.
3. **Заборона самопризначення в Проєкти (`ProjectMembership`)**:
   - Тільки адміністратор організації або `owner` може додавати користувачів до `project_memberships`.
4. **Захист Roadmap (`project_stages` & `milestones`)**:
   - Доступ на читання (`SELECT`) перевіряється через `public.is_project_member(project_id)`.
   - Створення, редагування та видалення (`INSERT`, `UPDATE`, `DELETE`) дозволено **виключно** для `public.is_org_admin(organization_id)` або `owner`. Спеціалісти заблоковані від несанкціонованої зміни структури делівері.
   - `responsible_user_id` є виключно бізнес-полем відповідального і не відкриває доступ без активного членства.
5. **Захист Tasks & Dependencies (`tasks` & `task_dependencies`) (Phase 2B.1 Hardening)**:
   - Доступ на читання (`SELECT`) регламентується членством у проєкті `public.is_project_member(project_id)` або роллю `owner`.
   - Створення та видалення задач (`INSERT`, `DELETE`) дозволено **виключно** адмінам організації `public.is_org_admin(organization_id)` або `owner`.
   - Оновлення задач (`UPDATE`):
     - **PM / Org Admin / Owner**: повне право управління всіма задачами (призначення, пріоритети, етапи, дедлайни, статус).
     - **Specialist / IT Specialist**: має право оновлювати **виключно власні призначені задачі** (`assignee_user_id = auth.uid()`).
     - **Обмеження полів для Specialist**: тригер `prevent_task_unauthorized_modifications` та RLS блокують будь-яку спробу спеціаліста змінити `organization_id`, `project_id`, `stage_id`, `milestone_id`, `assignee_user_id` (перепризначення), `priority` (контролюється PM/Admin), `responsibility_type`, `client_contact_id`, `is_client_visible` або `created_by`. Спеціаліст може змінювати виключно операційні поля: `status` та `description`.
   - Клієнтська роль має строгий `default deny` на таблицю `tasks` до активації клієнтського кабінету в Phase 4.
   - `assignee_user_id` та `client_contact_id` є виключно бізнес-полями і не відкривають прямий доступ до бази даних в обхід RLS.

---

## 4. Безпека профілів (Profiles Security)

- Звичайний користувач не може отримати список усіх користувачів платформи.
- Політика вибірки з `profiles` дозволяє бачити:
  1. Власний профіль (`id = auth.uid()`);
  2. Користувачів зі спільних організацій (перетин за активними `organization_memberships`);
  3. Глобальний Owner бачить усі профілі.

---

## 5. `SECURITY DEFINER` Hardening

Усі службові SQL-функції створено з явною директивою:
```sql
SECURITY DEFINER SET search_path = public, pg_temp;
```
Це усуває ризик підміни шляху пошуку схем (Search Path Hijacking) та забезпечує виконання функцій у безпечному пісочнику.

---

## 6. Безпека документів та сховища файлів (Documents & Storage Security) (Phase 3A)

1. **Ізоляція внутрішніх документів (`internal_access_scope`)**:
   - `management`: доступ мають виключно `owner` та `pm`/`admin` відповідної організації. Спеціалісти та клієнти заблоковані від читання та завантаження. Прапорець `is_client_visible` автоматично примусово виставляється у `false`.
   - `project_team`: доступ на читання мають `owner`, `pm`/`admin` організації та призначені учасники проєкту (`is_project_member(project_id)`).
2. **Права на створення, редагування та завантаження нових версій**:
   - Створення документів (`INSERT`), редагування метаданих (`UPDATE`), архівація та завантаження нових версій (`document_versions` / Storage upload) дозволено **виключно** для `public.is_org_admin(organization_id)` або глобального `owner`.
   - Спеціалісти у Phase 3A мають консервативні права **Read-Only** для призначених `project_team` документів.
3. **Захист сховища Supabase Storage (`project-documents`)**:
   - Бакет є строго приватним (`public = false`).
   - Доступ до бінарних файлів контролюється RLS-політиками на таблиці `storage.objects` за структурою шляху `{org_id}/{project_id}/{document_id}/...`.
   - Скачування файлів клієнтом відбувається через короткоживучі Signed URLs.
4. **Строгий Default Deny для ролі Client**:
   - Клієнтська роль у Phase 3A заблокована на рівні RLS для таблиць `documents`, `document_versions` та бакета `project-documents`, навіть якщо прапорець `is_client_visible = true`. Реальний клієнтський доступ активується у Phase 4 після окремого тестування.

---

## 7. Безпека зустрічей, протоколів та Action Items (Meetings Security) (Phase 3B)

1. **Глобальний доступ Owner**:
   - `global_role = 'owner'` має повний доступ на читання, створення, редагування, завершення та видалення зустрічей, серій, протоколів та рішень у всіх організаціях.
2. **Скоупований доступ PM / Admin**:
   - Адміністратори та PM організації мають повний доступ до управління зустрічами (`meeting_series`, `meetings`, `meeting_participants`, `meeting_notes`, `meeting_decisions`, `meeting_documents`) виключно в межах своїх організацій.
3. **Обмежений доступ Specialist**:
   - Спеціалісти мають доступ на читання (`SELECT`) зустрічей та рішень лише в тих проєктах, до яких вони явно призначені через `project_memberships`.
   - **Захист внутрішніх нотаток**: нотатки з типом `note_type = 'internal'` доступні виключно для PM / Admin та Owner. Спеціалісти заблоковані від читання внутрішніх нотаток на рівні RLS.
   - Спеціалісти не можуть самовільно створювати, змінювати або видаляти зустрічі.
4. **Захист Action Items та таскової системи**:
   - Action Items зустрічей матеріалізуються як сутності `tasks` з обов'язковим зовнішнім ключем `source_meeting_id`.
   - На створені задачі поширюються всі перевірки цілісності та обмеження безпеки Phase 2B/2B.1.
5. **Default Deny для Client (Phase 3B)**:
   - Для ролі Client у Phase 3B було накладено тимчасовий `default deny`. Повний продуктовий доступ клієнтів активовано у Phase 4A.

---

## 8. Модель безпеки та ізоляції Client Portal (Phase 4A)

1. **Межа автентифікації та активного доступу (Active Access Boundary)**:
   - Клієнтська контактна особа (`contacts`) пов'язується з користувачем (`auth.users`) через таблицю `client_portal_access`.
   - Наявність активної сесії Supabase Auth **не гарантує** доступу до бізнес-даних: RLS-політики перевіряють `is_active_client_user(organization_id)` (`status = 'active'`).
   - Якщо статус доступу `revoked`, клієнт миттєво втрачає доступ до читання та дій в усіх проєктах організації.

2. **Ізоляція проєктів клієнта (Project Scoping)**:
   - Клієнт бачить виключно ті проєкти своєї організації, до яких йому явно надано доступ через `project_memberships` (`can_client_access_project(project_id)`).
   - Інші проєкти тієї ж організації залишаються повністю невидимими для клієнта.

3. **Захист внутрішніх артефактів (Roadmap, Docs, Meetings, Tasks)**:
   - **Roadmap Stages & Milestones**: клієнт бачить виключно записи з `is_client_visible = TRUE`. Внутрішні етапи та технічні майлстоуни команди повертають 0 рядків.
   - **Документи**: клієнт бачить виключно `is_client_visible = TRUE` та `internal_access_scope = 'project_team'`. Фінансові, внутрішні та `management` документи надійно приховані в RLS та Storage.
   - **Зустрічі та нотатки**: клієнт бачить лише `is_client_visible = TRUE` зустрічі. Внутрішні нотатки (`note_type = 'internal'`) заблоковані.
   - **Задачі команди**: клієнт бачить виключно свої задачі (`responsibility_type = 'client'`, `is_client_visible = TRUE`). Задачі розробників/спеціалістів приховані.

4. **Контрольоване виконання дій через SQL RPC**:
   - Прямий `UPDATE` на таблицю `tasks` для ролі Client заблоковано.
   - Зміна статусу задачі дозволена виключно через `complete_client_action(p_task_id)` та `reopen_client_action(p_task_id)`.
   - Тригер `prevent_task_unauthorized_modifications()` блокує будь-які спроби зміни метаданих, пріоритетів, термінів або чужих дій.

---

## 9. Модель безпеки публікації версій, погоджень та робочого простору клієнта (Phase 4B)

1. **Модель публікації на рівні версій (Version-Level Publication Model)**:
   - Документ може мати прапорець `is_client_visible = TRUE`, але клієнт має доступ виключно до тих версій (`document_versions`), де `is_client_visible = TRUE`.
   - Нові версії за замовчуванням створюються внутрішніми (`is_client_visible = FALSE`), що запобігає випадковому витоку чернеток до фінальної перевірки PM.
   - Публікація окремих версій дозволена виключно через RPC `public.publish_document_version(p_version_id, p_publish)`, доступну тільки PM/Org Admin/Owner.

2. **Захист від застарілих погоджень (Stale Approval Protection)**:
   - Клієнт може погодити або надіслати запит на правки **виключно для найновішої опублікованої версії** документа.
   - Якщо між переглядом і погодженням була опублікована новіша версія, функції `approve_document_version` та `request_document_changes` викидають виключення (`Stale version approval is not allowed`).

3. **Незмінність аудиту погоджень (`document_review_events`)**:
   - Будь-яка дія клієнта (`approved`, `changes_requested`) створює незмінний аудит-запис у таблиці `document_review_events`.
   - Прямі операції `UPDATE` та `DELETE` на таблиці заборонені RLS.
   - Для запиту змін (`changes_requested`) поле `comment` є обов'язковим і валідується на рівні SQL-функції (перевірка на порожні пробіли).

4. **Безпека робочого простору зустрічей (Meetings & Materials)**:
   - Внутрішні нотатки (`note_type = 'internal'` або `is_client_visible = FALSE`) та внутрішні рішення суворо фільтруються на рівні бази даних.
   - Список учасників на стороні клієнта транслюється через безпечну проєкцію (тільки `display_name`, `participant_type`, `role_tag`, без внутрішніх метаданих).
   - Прикріплені до зустрічі матеріали відображають тільки опубліковані версії файлів.

---

## 10. Модель безпеки сповіщень та персонального інбоксу (Notifications & Personal Inbox Security) (Phase 5B)

1. **Персональна ізоляція інбоксу (Strict Personal Isolation)**:
   - Сповіщення в таблиці `notifications` є суворо персональними: доступ на читання (`SELECT`) та оновлення статусу прочитання (`UPDATE is_read`) мають лише записи, де `recipient_user_id = auth.uid()`.
   - Глобальний Owner має доступ до портфеля проєктів, але його `notifications` інбокс залишається строго персональним (Owner не отримує і не читає приватні сповіщення PM чи спеціалістів).
   - PM бачить сповіщення лише по своїх закріплених проєктах та клієнтах.
   - Specialist отримує сповіщення виключно щодо своїх задач, призначень та подій у призначених проєктах.

2. **Захист від несанкціонованого створення сповіщень (Write Protection)**:
   - Прямий `INSERT` або `DELETE` у таблицю `notifications` з боку браузерних клієнтів повністю заблокований RLS-політиками.
   - Створення сповіщень здійснюється виключно через безпечні системні тригери (`trigger_task_mutation_notifications`, `trigger_project_mutation_notifications`), `SECURITY DEFINER` RPC (`create_internal_notification`, `approve_document_version`, `request_document_changes`) або серверний евалюатор (`evaluate_notifications`).

3. **Строгий Default Deny для ролі Client**:
   - Клієнтські користувачі не мають доступу до внутрішніх сповіщень (`SELECT` повертає 0 рядків).
   - Будь-які внутрішні оперативні нагадування залишаються суворо конфіденційними всередині команди FIRSTWIN.

4. **Детермінована дедуплікація (Dedupe Protection)**:
   - Усі алерти та нагадування формуються з унікальним детермінованим `dedupe_key` (наприклад, `task_overdue:{task_id}:{recipient_user_id}:{date}`).
   - Це унеможливлює спам або дублювання сповіщень при багаторазовому виклику евалюатора чи оновленні сторінок.

5. **Суворий захист від зміни payload сповіщень (Notification Mutation Hardening) (Phase 5B.1)**:
   - Захисний тригер `prevent_notification_unauthorized_modifications()` гарантує, що жоден користувач (включаючи PM та спеціалістів) не може модифікувати поля: `id`, `recipient_user_id`, `actor_user_id`, `organization_id`, `project_id`, `event_type`, `severity`, `title`, `message`, `entity_type`, `entity_id`, `deep_link`, `dedupe_key`, `metadata`, `created_at`, `expires_at`.
   - Дозволено оновлювати **виключно** операційні поля стану прочитання: `is_read` та `read_at`.
   - Спроба підмінити будь-яке інше поле або перепризначити сповіщення іншому користувачу викликає миттєвий SQL-виняток (`ERRCODE = 42501`).

---

## 11. Модель фінансового доступу та економіки проєктів (Financial Security & Access Model) (Phase 5C.1)

1. **Owner (Повний глобальний доступ)**:
   - Має повний доступ (SELECT, INSERT, UPDATE, DELETE) до комерційних умов (`project_commercial_terms`), графіків оплат (`project_payment_schedule`), отриманих платежів (`project_payments`), внутрішніх витрат (`project_costs`) та журналу аудиту (`finance_audit_events`).
   - Бачить повну економіку: контрактну вартість, маржинальність, планові та фактичні витрати, cash-based результат.

2. **PM / Org Admin (Операційний фінансовий контроль організації)**:
   - Має доступ до комерційних умов, графіків оплат, отриманих оплат та залишків **виключно для закріплених організацій** (`is_org_admin(organization_id)`).
   - **Суворо заблоковано доступ до внутрішніх витрат** (`project_costs` повертає 0 рядків на рівні RLS).
   - Не бачить маржинальності та собівартості команди.
   - Має право фіксувати отримані оплати та створювати транші для своїх проєктів.

3. **Specialist / IT Specialist (Повний Default Deny)**:
   - Повністю заблокований доступ до всіх фінансових таблиць (`project_commercial_terms`, `project_payment_schedule`, `project_payments`, `project_costs`, `finance_audit_events`).
   - Вкладка «Фінанси» у паспорті проєкту та розділ «Фінанси» у меню навігації приховані.
   - Прямий REST/API запит повертає 0 рядків.

4. **Client Role (Default Deny у Phase 5C.1)**:
   - Клієнтські користувачі не мають доступу до фінансових таблиць на рівні RLS.

5. **Цілісність даних та фінансовий аудит (Integrity & Audit Trail)**:
   - Заборонено від'ємні та нульові платежі (`amount_minor > 0`).
   - Заборонено overpayment по траншу без розлінкування.
   - Тригери валідують міжпроєктну та валютну відповідність платежів до траншів.
   - Таблиця `finance_audit_events` є строго append-only; будь-які спроби `UPDATE` або `DELETE` блокуються тригером `prevent_finance_audit_tampering()`.







