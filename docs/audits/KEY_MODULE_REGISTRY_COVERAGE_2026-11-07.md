# KEY Module Registry — coverage gap audit

**Дата:** 2026-11-07  
**Base HEAD:** `628460518f7f3e1c198e332d1d3184d88dd24688`  
**Источники:** `docs/architecture/MODULE_CATALOG_AND_COMPOSITION_RULES.md`, `src/landing-module-registry-v1.mjs`, `scripts/build-landing-runtime.mjs`, `landing/runtime/app.js`, `tests/production-landing.spec.cjs`.

## Вывод

Каталог описывает широкий продуктовый набор модулей, но Registry V1 содержит только 11 ID. Это не обязательно означает, что вся остальная функциональность отсутствует в UI: часть интерактивов существует как встроенное поведение runtime, а часть секций попадает в legacy builder через alias map. Однако **они не имеют единого формального module contract** на уровне Registry V1. Это реальный архитектурный разрыв: каталог, module manifest, runtime builder и DOM описывают разные уровни абстракции.

Не следует расширять Registry простым добавлением ID. Сначала каждому модулю нужно определить: самостоятельная секция это, слот, поведение внутри секции или CTA/modal interaction.

## 1. Точное покрытие Registry V1

Текущий Registry содержит:

| ID | Runtime target | Variant | Dependencies | Статус по контракту |
|---|---|---|---|---|
| hero | slot: hero | editorial-split | нет | mapped slot |
| key | slot: hero | feature-led | нет | mapped slot |
| about | concept | feature-led | нет | mapped section |
| gallery | visual-story | immersive | approved-project-media | mapped section |
| lifestyle | lifestyle | image-led | approved-lifestyle-stories | mapped section |
| security | advantages | proof-led | нет | append to shared section |
| location | location | location-led | нет | mapped section |
| floor-plans | apartments | plan-selector | current-inventory, rights-cleared-plan-assets | mapped section |
| mortgage | calculator | conversion-led | verified-mortgage-terms | mapped section |
| faq | faq | faq-accordion | approved-faq-answers | mapped section |
| contacts | slot: closing | conversion-led | approved-key-lead-workflow | mapped slot |

Registry умеет отклонять неизвестные ID, неизвестные variants, неподтверждённые required facts, отсутствующие capabilities и конфликтующие section placements. Это правильная fail-closed основа.

## 2. Расхождения каталога и Registry

В каталоге дополнительно перечислены следующие элементы, которые не представлены отдельными ID в Registry V1:

| Каталог | Почему нельзя просто добавить ID | Рекомендуемая классификация |
|---|---|---|
| territory | может быть отдельной секцией или частью lifestyle/security | section module после определения самостоятельного контракта |
| quiz | runtime CTA/selection flow; в builder есть alias selection/quiz, но Registry ID отсутствует | conversion flow / module с отдельным контрактом |
| gift | презентация/материалы зависят от реального deliverable и offer | offer-backed section или CTA offer, не декоративная секция |
| apartments | alias builder существует; Registry использует floor-plans | унифицировать canonical ID и миграцию alias |
| price | dynamic claim и дата актуальности обязательны | section module с price evidence gate |
| developer | карточка/документы; сейчас отдельный Registry contract не показан | section module с legal/source validation |
| progress | только датированные официальные обновления | timeline module с freshness gate |
| steps | процесс KEY должен быть подтверждён операционным владельцем | editorial section с approved process data |
| faq-legal | legal copy нельзя собирать как обычный FAQ | legal disclosure component / section |
| footer-nav | навигация — системный shell, а не маркетинговый модуль | global layout capability |
| modal | модалка — способ представления сценария, не контентный модуль | interaction primitive |
| lightbox | просмотр медиа — поведение gallery/plans | interaction primitive |
| promo | промо требует действующих условий и срока | offer-backed section with expiry gate |
| map | карта — способ представления проверенных POI/маршрутов | location presentation variant, не самостоятельный источник фактов |

## 3. Функциональность runtime, которая не должна ошибочно считаться module coverage

В основном runtime уже есть или тестируется поведение:
- selection quiz и сохранение ответов в CTA context;
- mortgage estimate на параметрах, введённых посетителем;
- plan preview и сохранение выбранного плана;
- lead dialog, consent, attribution, retry/idempotency;
- FAQ accordion;
- навигационное меню;
- галерея/просмотр медиа.

Наличие такого поведения не означает, что каждый пункт уже управляется единым Module Registry, имеет самостоятельный дизайн-вариант или может безопасно включаться/выключаться генератором. И наоборот, Registry mapping не доказывает наличие полноценного уникального renderer.

## 4. Важные технические несовпадения

1. Legacy builder содержит `MODULE_MAP` с alias `floor-plans → apartments`, `mortgage → calculator`, `quiz → selection`. Registry V1 использует другой canonical ID set.
2. Registry placements описывают section/slot и runtimeVariant, но сам по себе registry не рендерит UI и не доказывает, что runtimeVariant полностью реализован.
3. `resolveRuntimeModulesV1` формирует composition из section placements; slot placements добавляются отдельно. Нужно явно документировать, как slots и section order объединяются в итоговую композицию.
4. Каталог содержит presentation forms и interaction primitives рядом с content sections. Эти сущности нужно разделить на разные типы контрактов, а не помещать всё в один плоский список.
5. `territory` и `security` имеют пересечение по фактам благоустройства/приватности; правила merge и доказательства должны быть предметными, не только техническими.

## 5. Рекомендуемая модель

Разделить каталог на четыре уровня:

- **Content sections:** hero, key facts, about, territory, security, gallery, lifestyle, location, floor plans, price, mortgage, developer, progress, steps, FAQ, legal disclosures.
- **Conversion flows:** presentation, apartment selection, callback, viewing, consultation, mortgage estimate.
- **Interaction primitives:** modal/drawer, gallery lightbox, accordion, tabs, carousel, calculator controls, form states.
- **Global shell:** header/navigation, footer, responsive grid, typography, design tokens, consent UI.

Для каждого content section в едином contract задать:
`moduleId`, schema/version, purpose, data requirements, fact/evidence gates, media requirements, supported variants, composition constraints, CTA anchors, responsive behavior, accessibility behavior, analytics events, empty/error state, browser tests, maturity status.

Для conversion flow отдельно задать:
`offerId`, consent, required fields, qualification questions, payload mapping, endpoint capability, success acknowledgement, retry/idempotency and failure UX.

## 6. Следующая инженерная задача

Не расширять Registry наугад. Сначала:
1. утвердить canonical ID и alias migration map;
2. отделить content sections от flows/primitives/shell;
3. сопоставить каждый каталоговый пункт с фактическим runtime component и тестом;
4. обозначить `implemented / partial / placeholder / not implemented / not applicable`;
5. только после этого расширить Registry и добавить контрактные тесты.

**Acceptance:** ни один каталоговый модуль не объявлен реализованным только из-за наличия названия или alias; каждый включаемый модуль имеет проверяемые data gates, реальный renderer, responsive behavior и browser acceptance test.
