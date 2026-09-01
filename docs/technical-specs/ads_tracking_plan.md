# Tracking Plan — Sales System

Версія: 0.3 · Дата: 2026-09-01 · Статус: **Блок А реалізовано в коді** (локальна гілка `docs/ads-consolidation`); активація вимагає застосування міграції, реального GA4 ID та deploy — усе після окремого погодження власниці.

## 0. Стан реалізації (після Блоку А, 2026-09-01)

| Компонент | Стан | Деталі |
| --- | --- | --- |
| Подієвий шар | **Реалізовано** | `js/marketing/analytics.js`: усі browser-події пишуться в `window.dataLayer` завжди; у GA4 — лише за наявності ID і analytics-згоди |
| GA4 | Підготовлено, вимкнено | Плейсхолдер `G-XXXXXXXXXX` прибрано з `index.html`; gtag.js завантажується динамічно лише коли в `js/marketing/marketing-config.js` заданий реальний `GA4_MEASUREMENT_ID` і є згода |
| Consent banner | **Реалізовано** | `js/marketing/consent.js` + Google Consent Mode v2 (default denied в `index.html`); категорії analytics / marketing |
| UTM-захоплення | **Реалізовано повністю** | `js/marketing/attribution.js`: 5 UTM + 5 click IDs (`gclid`,`gbraid`,`wbraid`,`fbclid`,`ttclid`), first-touch (localStorage) + last-touch (sessionStorage), landing page, referrer. Back-compat у `js/state.js` |
| `page_view` для SPA | **Реалізовано** | Хук у `js/router.js` на кожну зміну hash-маршруту (лише публічні сторінки, портал не трекається) |
| `view_offer` | **Реалізовано** | Мапа маршрутів → offer_id у `js/router.js` |
| `form_start`, `generate_lead`, `contact_click` | **Реалізовано** | Форми `#/consultation` і `#/contacts` (`js/pages/consultation.js`, `contacts.js`) |
| Ліди на сервер | **Реалізовано, чекає міграції** | `js/marketing/leads-api.js` → RPC `submit_marketing_lead` (міграція `20260901000025`, верифікована локально на PGlite, ще не застосована). Успіх показується **лише після підтвердження сервера**; поведінка при збої — §0.1 |
| Telegram-сповіщення | Підготовлено, **вимкнено** | Edge Function `supabase/functions/lead-notify/` — no-op без секретів `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`; прапорець `TELEGRAM_NOTIFY_ENABLED=false` у конфізі |
| `book_call` | Схема готова | Фіксується власницею через RPC `update_marketing_lead_status` після бронювання в календарі (див. `ads_calendar_booking.md`) |
| GTM | Відкладено | На поточному обсязі подій прямий gtag достатній; GTM додається на Етапі 1 за потреби |
| Meta Pixel / CAPI | Не підключено | Кабінету Meta немає (Блок Б); прапорець `META_PIXEL_ID` зарезервовано в конфізі |

## 0.1 Поведінка форм, збереження заявки та захист (рішення власниці 2026-09-01)

**Політика збереження заявки:**

- Заявка вважається збереженою **тільки** після підтвердженого запису в Supabase (RPC повернув `ok:true` з `lead_id`). Тільки тоді відвідувач бачить `#/success`, і тільки тоді надсилається подія `generate_lead` (з тим самим `event_id`, який прийняв сервер).
- Якщо сервер не відповів/відмовив — форма показує **чесне повідомлення про помилку** з кнопкою повторної відправки та контактною поштою. Редіректу на success немає, `generate_lead` не створюється.
- `event_id` генерується один раз на спробу форми і **повторно використовується при retry** — серверна дедуплікація гасить подвійні надсилання.
- Персональні дані **не зберігаються в localStorage**. Єдина клієнтська копія — тимчасовий draft форми у `sessionStorage` (живе максимум 1 годину або до закриття вкладки; видаляється автоматично і одразу після успішного запису). Це компроміс «відновлення після випадкового перезавантаження» без безстрокового зберігання ПД.
- localStorage-ліди залишилися лише в демо-даних `#/admin` (несправжні записи `js/state.js`) і не поповнюються з публічних форм.

**Server-side захист публічних RPC (реалізовано в міграції, перевірено локально):**

- Rate limiting за псевдонімізованим IP (md5-хеш заголовка, сирий IP не зберігається): максимум 5 створених лідів/годину і 20/добу з одного IP; глобальний запобіжник 100/годину.
- Журнал `marketing_submission_log` **без персональних даних** (тільки ip-хеш, форма, результат, код помилки); автоочищення рядків старших за 7 днів.
- Нормалізація вводу: trim, email → lowercase + формат-перевірка, телефон → лише цифри та `+`; жорсткі ліміти довжини кожного поля.
- Дедуплікація рівня 1 (`event_id`) і рівня 2 (той самий email/телефон у тій самій формі протягом 10 хв → повертається наявний лід).
- Honeypot-поле: боти отримують фейковий успіх без створення рядка.
- Читання лідів/подій/журналу — тільки owner (RLS); anon не має INSERT-політик на жодну таблицю і не має EXECUTE на статусний RPC; зміна статусів — тільки owner, дискваліфікація без причини з довідника неможлива.
- Turnstile/CAPTCHA: **не підключено** (сторонній сервіс — лише за окремим погодженням власниці); зафіксовано як опцію на випадок, якщо реальний спам перевищить пороги rate limiting.

**Локальна верифікація міграції:** `node test_migration_local.js` — вбудований PostgreSQL (PGlite), 61 перевірка: DDL, RLS, ролі anon/authenticated/owner, дедуплікація, rate limiting, воронка статусів, rollback і повторне застосування. Production не задіюється.

> Важливо для UTM при hash-роутингу: query-параметри мають стояти **до** хеша (`https://site/?utm_source=...#/audit`), інакше рекламні системи та `state.js` їх не побачать. Фінальні URL в оголошеннях будувати саме так.

## 1. Принципи

- Єдині назви подій у сайті, GTM, GA4, рекламних системах і CRM.
- Кожна browser/server подія несе `event_id` для дедуплікації (GA4 ↔ Meta CAPI ↔ CRM).
- Thank-you page (`#/success`) не рахується повторно лідом без унікального ID заявки.
- Жодних персональних чи чутливих даних у назвах подій, URL, UTM, параметрах, логах.
- Події з ПД (email/телефон) надсилаються платформам лише за наявності згоди (consent banner) і хешування за правилами платформи.
- У CRM зберігаються first-touch і last-touch атрибуція, UTM, landing page, referrer, click IDs (`gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid`).

## 2. Схема подій

| Подія | Trigger | Ключові параметри | Джерело | Destinations | Consent | Дедуплікація | Тест |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `page_view` | Зміна hash-маршруту SPA (`js/router.js`) | `page_location`, `page_referrer` | dataLayer | GA4 | analytics | стандартна GA4 | GA4 DebugView |
| `view_offer` | Перегляд сторінки/секції конкретної послуги | `offer_id` (aiauto/audit/salesdept) | dataLayer | GA4 | analytics | — | DebugView |
| `cta_click` | Клік по основному CTA | `offer_id`, `cta_id` | dataLayer | GA4 | analytics | — | DebugView + Tag Assistant |
| `form_start` | Фокус/перше поле форми | `form_id`, `offer_id` | dataLayer | GA4 | analytics | 1 раз на сесію | DebugView |
| `generate_lead` | Валідне надсилання форми (server-side підтвердження — запис у Supabase) | `event_id`, `form_id`, `offer_id` | dataLayer + сервер | GA4, Google Ads, Meta (Pixel+CAPI), CRM | analytics + ad_storage | `event_id` browser↔server | тестовий лід end-to-end |
| `book_call` | Успішне бронювання в календарі | `event_id`, `offer_id` | webhook календаря | GA4, Google Ads, Meta CAPI, CRM | ad_storage | `event_id` | тестове бронювання |
| `contact_click` | Клік на месенджер/телефон | `channel` (telegram/phone/email) | dataLayer | GA4 | analytics | — | DebugView |
| `qualified_lead` | Лід кваліфіковано в CRM | `event_id` ліда, `disqual_reason` (якщо ні) | CRM | GA4 (import), Google Ads offline conv., дашборд | згода з ПД | ID ліда CRM | ручний прогін статусу |
| `proposal_sent` | Надіслано КП | `deal_id` | CRM | дашборд | — | `deal_id` | ручний прогін |
| `closed_won` | Угоду оплачено/виграно | `deal_id`, `revenue`, `currency` | CRM | GA4 import, Google Ads offline conv., дашборд | згода з ПД | `deal_id` | ручний прогін |

## 3. UTM-шаблон

`utm_source={platform}&utm_medium=paid_social|cpc&utm_campaign={campaign_code}&utm_content={creative_code}&utm_term={keyword_or_audience}`

Коди — за словником у [ads_utm_naming.md](ads_utm_naming.md). Значення стабільні, без ПД і ручних довільних назв. Параметри — до хеша (див. §0).

## 4. Обов'язкові поля ліда в CRM

Дата/час; source/medium/campaign/content/term; first-touch і last-touch; платформа + campaign/ad IDs; послуга/офер; країна й мова; статус ліда; причина дискваліфікації (обов'язкова, з довідника: нецільова країна / не той тип бізнесу / немає бюджету / не та послуга / спам-дубль / не відповідає / інше); дата першого контакту і швидкість відповіді; booked/showed/no-show; proposal sent; won/lost + причина; дохід і валовий прибуток.

**Рішення підтверджено власницею (2026-09-01):** атрибуція лідів живе у власній CRM на Supabase, не в HubSpot. Реалізація — міграція `supabase/migrations/20260901000025_marketing_leads_attribution.sql`: таблиці `marketing_leads` (усі поля цього розділу: UTM, click IDs, first/last-touch, landing page, платформа, campaign/ad/creative IDs, статуси кваліфікації з довідником причин дискваліфікації, booked/showed/no-show, consultation_paid, proposal_sent, won/lost, дохід/валюта) та `marketing_lead_events` (журнал воронки). Публічний запис — лише через SECURITY DEFINER RPC `submit_marketing_lead` (валідація, honeypot, дедуплікація за `event_id`); читання/оновлення — тільки owner через RLS. Зміни статусів — RPC `update_marketing_lead_status` (вимагає причину при дискваліфікації). Міграція **не застосована** до production — чекає погодження.

## 5. Контроль якості трекінгу

- Перевірка всіх подій у GA4 DebugView / Meta Test Events до запуску реклами.
- Автоматичний тест (щогодини): доступність лендінгу + наявність ключової події `generate_lead` після синтетичного сабміту; алерт у Telegram/email при збої.
- Enhanced conversions (Google) і CAPI (Meta) вмикаються лише після перевірки consent banner, хешування і дедуплікації.

## 6. Порядок реалізації на сайті (статус)

1. ✅ Міграція Supabase підготовлена (`20260901000025`): `marketing_leads` + `marketing_lead_events` + RLS + RPC. **Не застосована** — чекає погодження.
2. ✅ Форми `#/consultation` і `#/contacts` пишуть у Supabase через RPC; success і `generate_lead` — лише після підтвердження сервера, при збої — чесна помилка з retry (§0.1); Telegram-сповіщення підготовлені у вимкненому стані (`lead-notify`).
3. ✅ Повне захоплення атрибуції (`js/marketing/attribution.js` + back-compat у `js/state.js`).
4. ⏳ `page_view`/події реалізовані; реальний GA4 Measurement ID створюється на Етапі 1 (Блок Б) і вставляється в `marketing-config.js`.
5. ✅ Consent banner реалізовано; Meta Pixel/CAPI та enhanced conversions — лише після Блоку Б і перевірки згоди/дедуплікації.
6. ⏳ Локальні E2E-тести Блоку А виконані; повний E2E з реальним GA4/БД — після застосування міграції та створення кабінетів.
