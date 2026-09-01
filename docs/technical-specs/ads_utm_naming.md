# Словник назв кампаній та UTM — Sales System

Версія: 0.2 · Дата: 2026-09-01
Актуалізовано 2026-09-01: сайт підтверджено (`https://firstwin-livid.vercel.app/`, hash-роутинг SPA).

## Формат назви кампанії

`PLATFORM_COUNTRY_LANGUAGE_OFFER_FUNNEL_AUDIENCE_YYYYMM`

Приклад: `GADS_UA_UK_AIAUTO_COLD_SMBOWNER_202610`

## Словники кодів

| Поле | Коди |
| --- | --- |
| PLATFORM | `GADS` (Google Ads), `META` (Facebook/Instagram), `LI` (LinkedIn), `TT` (TikTok) |
| COUNTRY | `UA`, `CZ`, `PL` |
| LANGUAGE | `UK` (українська), `RU` (російська, лише за погодженням), `EN` |
| OFFER | `AIAUTO` (автоматизація та AI), `AUDIT` (аудит відділу продажів), `SALESDEPT` (побудова відділу), `CONSULT` (консультація) |
| FUNNEL | `COLD` (холодний трафік), `RETARG` (ретаргетинг), `BRAND` (брендовий попит) |
| AUDIENCE | `SMBOWNER` (власники малого бізнесу), `CLEVEL` (CEO/COO/викон. директор), `SALESHEAD` (КВП), `BROAD` (широка) |

Нові коди додаються лише в цей словник, не «на льоту» в кабінеті.

## Коди креативів (utm_content)

`{OFFER}-{TYPE}-{NN}`, де TYPE: `PAIN` (біль клієнта), `CASE` (кейс/доказ), `PROC` (процес/експертність), `OFR` (конкретний офер). Приклад: `AIAUTO-PAIN-01`.

## UTM-шаблон

`utm_source={gads|meta|li|tt}&utm_medium={cpc|paid_social}&utm_campaign={повний код кампанії}&utm_content={код креативу}&utm_term={keyword_or_audience}`

Правила: тільки латиниця і коди зі словників; без персональних даних; utm_campaign завжди дорівнює назві кампанії в кабінеті — це дозволяє автоматично зводити звіти.

## Специфіка сайту FIRSTWIN (актуалізація 2026-09-01)

- Сайт використовує hash-роутинг (`#/audit`, `#/consultation` тощо), тому UTM-параметри у фінальних URL оголошень ставляться **до** хеша: `https://firstwin-livid.vercel.app/?utm_source=gads&utm_medium=cpc&utm_campaign=GADS_UA_UK_AIAUTO_COLD_SMBOWNER_202610&utm_content=AIAUTO-PAIN-01#/ai-solutions`.
- Поточний код сайту (`js/state.js`) зчитує лише `utm_source`, `utm_medium`, `utm_campaign`; захоплення `utm_content`, `utm_term` і click IDs додається за планом у [ads_tracking_plan.md](ads_tracking_plan.md) §6.
- Приклади відповідності OFFER → цільова сторінка: `AIAUTO` → `#/ai-solutions` або `#/automation`; `AUDIT` → `#/audit`; `SALESDEPT` → `#/support`; `CONSULT` → `#/consultation`.
