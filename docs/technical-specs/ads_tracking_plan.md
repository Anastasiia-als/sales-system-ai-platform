# Tracking Plan — Sales System

Версія: 0.2 · Дата: 2026-09-01 · Статус: специфікація до реалізації.
Актуалізовано 2026-09-01 після звірки з реальним проєктом FIRSTWIN: сайт і платформа підтверджені (`https://firstwin-livid.vercel.app/`, Vanilla JS SPA + Supabase + Vercel), тому колишнє блокування `TO_CONFIRM: URL/платформа` знято.

## 0. Фактичний стан трекінгу на сайті (аудит 2026-09-01)

| Компонент | Стан | Деталі |
| --- | --- | --- |
| GA4 | Плейсхолдер | `index.html:40-45` — gtag підключено з ID `G-XXXXXXXXXX`; реальний лічильник не створено |
| GTM | Відсутній | Контейнера немає; `dataLayer` ініціалізовано лише для gtag |
| UTM-захоплення | Часткове | `js/state.js` зчитує тільки `utm_source`, `utm_medium`, `utm_campaign` (sessionStorage). **Не зчитуються:** `utm_content`, `utm_term`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid` — треба розширити |
| `page_view` для SPA | Відсутній | Сайт на hash-роутингу (`#/route`); переходи між маршрутами не надсилаються в GA4 — потрібен хук у `js/router.js` |
| Кастомні події | Відсутні | `view_offer`, `cta_click`, `form_start`, `generate_lead`, `book_call`, `contact_click` не реалізовані |
| Ліди на сервер | Відсутні | Форми пишуть у `localStorage` (`sales_app_leads`), POST у Supabase/webhook немає |
| Consent banner | Відсутній | Обов'язковий до ввімкнення ad_storage / CAPI / enhanced conversions |
| Meta Pixel / CAPI | Відсутні | Кабінету Meta немає |

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

**Рішення щодо системи (актуалізація 2026-09-01):** CRM Sales System — це власний FIRSTWIN Delivery Portal на Supabase (project `aayqydcdfxhlwizhfjun`), який уже працює (30+ таблиць, RLS, RPC). Але його схема покриває delivery/білінг, а не маркетингові ліди. Handoff-звіт рекомендує додати окрему таблицю маркетингових лідів (`click_id`, `campaign_id`, `lead_cost`, `qualification_status` + поля вище) окремою міграцією — це і є цільова реалізація §4. HubSpot-портал власниці залишається порожнім резервом і зараз не використовується. `TO_CONFIRM: погодження, що атрибуція лідів живе в Supabase (рекомендовано), а не в HubSpot`

## 5. Контроль якості трекінгу

- Перевірка всіх подій у GA4 DebugView / Meta Test Events до запуску реклами.
- Автоматичний тест (щогодини): доступність лендінгу + наявність ключової події `generate_lead` після синтетичного сабміту; алерт у Telegram/email при збої.
- Enhanced conversions (Google) і CAPI (Meta) вмикаються лише після перевірки consent banner, хешування і дедуплікації.

## 6. Порядок реалізації на сайті (пропозиція)

1. Міграція Supabase: таблиця маркетингових лідів + RLS (анонімна вставка через Edge Function або захищений RPC, читання лише для staff).
2. Перевести форми `#/consultation` і `#/contacts` з `localStorage` на запис у Supabase + Telegram-сповіщення власниці.
3. Розширити `js/state.js`: захоплення `utm_content`, `utm_term`, click IDs, first/last-touch, landing page, referrer.
4. Реальний GA4 ID + `page_view` через хук роутера + кастомні події §2.
5. Consent banner → лише після нього Meta Pixel/CAPI та enhanced conversions.
6. Кожен крок — E2E-тест тестовим лідом до запуску реклами.
