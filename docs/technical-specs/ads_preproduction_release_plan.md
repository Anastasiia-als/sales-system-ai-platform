# Pre-production Release Plan — маркетингова лідогенерація (Блок А → production)

Версія: 1.0 · Дата: 2026-09-01 · Статус: підготовлено; **виконання лише після окремого «Погоджую» власниці на кожен незворотний крок**.

## 1. Обсяг релізу

| Складова | Що саме |
| --- | --- |
| Supabase-міграція | `supabase/migrations/20260901000025_marketing_leads_attribution.sql` (таблиці `marketing_leads`, `marketing_lead_events`, `marketing_submission_log`; RPC `submit_marketing_lead`, `update_marketing_lead_status`, helper `marketing_client_ip_hash`; RLS owner-only) |
| Rollback-скрипт | `supabase/rollbacks/20260901000025_down.sql` |
| Frontend | `index.html`, `js/app.js`, `js/router.js`, `js/state.js`, `js/pages/consultation.js`, `js/pages/contacts.js`, `js/marketing/*`, `css/components.css` |
| Edge Function | `supabase/functions/lead-notify/` — **не деплоїться в цьому релізі** (Telegram вимкнено рішенням власниці) |
| Гілка | `docs/ads-consolidation` → merge у `main` |

## 2. Передумови (підтверджує власниця perед стартом)

- [ ] «Погоджую push + merge у main»
- [ ] «Погоджую застосування міграції 20260901000025 до production Supabase»
- [ ] «Погоджую Vercel deploy»
- [ ] Створено pre-deploy backup (крок 4.1 нижче) і посилання/файл збережено

## 3. Environment variables

Для цього релізу **нові змінні не потрібні** — фронтенд використовує лише публічні `SUPABASE_URL` і `SUPABASE_PUBLISHABLE_KEY` з `js/config.js` (уже в коді, публічні за призначенням).

Довідково, на майбутні кроки (НЕ цей реліз):

| Змінна | Де живе | Секретна? |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Supabase Edge Function secrets | **ТАК — ніколи не в репозиторій/чат** |
| `TELEGRAM_CHAT_ID` | Supabase Edge Function secrets | так (квазі-секрет) |
| `GA4_MEASUREMENT_ID` | `js/marketing/marketing-config.js` (публічний код) | ні |
| `META_PIXEL_ID` | `js/marketing/marketing-config.js` | ні |
| `SUPABASE_SERVICE_ROLE_KEY` | тільки серверні середовища | **ТАК** |

## 4. Порядок виконання

### 4.1 Pre-deploy backup (обов'язково, до будь-яких змін)

Ручна дія власниці або за її погодженням:
1. Supabase Dashboard → проєкт `firstwin-platform` → Database → Backups → переконатися, що є свіжий автоматичний бекап **сьогоднішньої дати**; за відсутності — створити ручний.
2. Додатково (рекомендовано): локальний дамп схеми+даних:

```bash
pg_dump "$DATABASE_URL" --no-owner --format=custom --file=backup_pre_ads_$(date +%Y%m%d).dump
```

3. Зафіксувати у чаті: дата/час бекапу. **Без підтвердженого бекапу далі не йти.**

### 4.2 Локальна фінальна верифікація (без production)

```bash
node test_migration_local.js
```

```bash
node test_block_a_marketing.js
```

```bash
node test_smoke_routes.js
```

Критерій: 61 + 32 + 20 перевірок зелені. (Стан на 2026-09-01: пройдено.)

### 4.3 Git: push і merge

```bash
git push -u origin docs/ads-consolidation
```

Потім merge у `main` (fast-forward або PR — на вибір власниці). **Увага:** якщо Vercel налаштований на auto-deploy з `main`, merge запустить deploy — тому міграцію (4.4) треба застосувати ДО merge, інакше форми на новому сайті отримуватимуть 404 від RPC і показуватимуть відвідувачам помилку.

### 4.4 Застосування міграції до production Supabase

Варіант А (рекомендований, без CLI): Supabase Dashboard → SQL Editor → вставити повний вміст `20260901000025_marketing_leads_attribution.sql` → Run.
Варіант Б (за наявності Supabase CLI і зв'язаного проєкту): `supabase db push`.

Перевірка одразу після:

```sql
SELECT to_regclass('public.marketing_leads') IS NOT NULL AS leads,
       to_regclass('public.marketing_lead_events') IS NOT NULL AS events,
       to_regclass('public.marketing_submission_log') IS NOT NULL AS log;
```

```sql
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('marketing_leads','marketing_lead_events','marketing_submission_log');
```

Критерій: три таблиці існують, `relrowsecurity = true` для всіх трьох.

### 4.5 Production smoke-тест RPC (до deploy сайту)

У SQL Editor (виконується як службовий тест, потім прибирається):

```sql
SELECT public.submit_marketing_lead(jsonb_build_object(
  'name', 'RELEASE SMOKE TEST', 'email', 'smoke@test.internal',
  'form_id', 'other', 'event_id', gen_random_uuid()::text
));
```

Очікування: `{"ok": true, "lead_id": "...", "duplicate": false}`.
Прибирання тестового рядка:

```sql
DELETE FROM public.marketing_leads WHERE name = 'RELEASE SMOKE TEST';
```

### 4.6 Vercel deploy

Merge у `main` (крок 4.3) запускає auto-deploy, або вручну: Vercel Dashboard → проєкт `firstwin` → Deployments → Redeploy. Дочекатися статусу **Ready**.

### 4.7 Post-deploy smoke-тести (production сайт)

1. Відкрити `https://firstwin-livid.vercel.app/?utm_source=test&utm_medium=test&utm_campaign=RELEASE_SMOKE#/consultation`.
2. Переконатися: з'явився cookie-банер; обрати «Прийняти всі».
3. Надіслати тестову заявку (ім'я `RELEASE SMOKE TEST`, ваш email).
4. Очікування: редірект на `#/success` (якщо помилка — форма покаже чесне повідомлення, це FAIL релізу).
5. У Supabase перевірити рядок і атрибуцію:

```sql
SELECT name, email, utm_source, utm_campaign, first_touch IS NOT NULL AS ft, event_id
FROM public.marketing_leads ORDER BY created_at DESC LIMIT 3;
```

6. Перевірити журнал: `SELECT outcome, COUNT(*) FROM public.marketing_submission_log GROUP BY 1;`
7. Видалити тестовий лід (SQL з 4.5).
8. Пройти `#/contacts` аналогічно.
9. Перевірити консоль браузера: немає запитів до googletagmanager/facebook (ID ще не задані).

### 4.8 Критерії успіху релізу

- Обидві форми записують ліди в `marketing_leads` з повною атрибуцією.
- При вимкненому інтернеті/збої форма показує помилку і кнопку повтору (перевірити DevTools → Offline).
- RLS: анонімний запит `GET /rest/v1/marketing_leads` з anon-ключем повертає порожньо/помилку.
- Жодних JS-помилок на 21 маршруті; портал/клієнтський кабінет працюють як раніше.
- Canonical master regression (218 тестів) — без нових падінь.

## 5. Rollback

### 5.1 Supabase

1. Якщо в `marketing_leads` уже є реальні ліди — спершу експорт:

```sql
COPY (SELECT * FROM public.marketing_leads) TO STDOUT WITH CSV HEADER;
```

   (через Dashboard → SQL Editor → Download CSV.)
2. Виконати `supabase/rollbacks/20260901000025_down.sql` у SQL Editor.
3. Перевірити: `SELECT to_regclass('public.marketing_leads');` → NULL.
4. Решта БД не зачіпається (rollback перевірений локально: сторонні таблиці неушкоджені).
5. Катастрофічний сценарій: відновлення з бекапу 4.1 (Dashboard → Backups → Restore) — **лише за окремим погодженням, це відкочує ВСЮ базу**.

### 5.2 Vercel

Варіант А (миттєвий, без git): Vercel Dashboard → Deployments → попередній робочий deployment → ⋯ → **Promote to Production**.
Варіант Б (через git): `git revert <merge-commit>` у `main` → push → auto-deploy.

Сайт після відкату Vercel працює незалежно від того, застосована міграція чи ні (старий код не звертається до нових таблиць).

## 6. Точки обов'язкового підтвердження власниці

| Крок | Що підтверджує |
| --- | --- |
| 4.1 | Бекап створено (дата/час) |
| 4.3 | «Погоджую push/merge» |
| 4.4 | «Погоджую міграцію на production» |
| 4.6 | «Погоджую deploy» |
| 5.1 п.5 | «Погоджую повне відновлення БД з бекапу» (тільки в катастрофічному сценарії) |
| будь-яке видалення даних | окреме «Погоджую видалення …» |

## 7. Що свідомо НЕ входить у цей реліз

- Deploy `lead-notify` / Telegram-сповіщення (вимкнено до надання токена).
- GA4/GTM/Meta Pixel (Блок Б, після створення кабінетів).
- Зміна цін/контактів/кейсів на сайті (TO_CONFIRM у власниці).
- Custom domain, платіжні рішення, будь-які рекламні кампанії.
