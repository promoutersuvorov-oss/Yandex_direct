# Runtime consumer audit для Passport vNext

**Дата:** 2026-11-06  
**Статус:** read-only аудит текущего кода; без изменения runtime и production schema.

## 1. Главный вывод

Текущий runtime adapter не является нейтральным потребителем абстрактного паспорта. Он напрямую читает конкретные поля schema 1.0.0 и жёстко проверяет версию 1.0.0. Поэтому механическая замена паспорта на vNext сейчас сломает сборку.

До создания production schema 2.0.0 необходимо ввести нормализованный внутренний контракт и отдельный адаптер legacy 1.0.0 → normalized model. Затем runtime builder должен потреблять нормализованную модель, а не смешивать чтение legacy-структуры и бизнес-логику.

## 2. Фактические зависимости build-landing-runtime.mjs

Проверен файл scripts/build-landing-runtime.mjs и тесты tests/landing-runtime-adapter.test.mjs.

| Текущий путь / поле | Как используется | Что важно при миграции |
|---|---|---|
| schemaVersion = 1.0.0 | Жёсткий guard в buildLandingProfile | Временно оставить legacy вход; vNext не подменяет его |
| project.id/name/location.city | Проверка идентичности и публичный project profile | Стабильные поля нормализованного Project |
| project.location.district/address | Публикуются только при status=verified | Сохранить evidence/status semantics |
| facts[] | Фильтр publishableFactIds по verified, publicUse, sources, expiresAt | Нужна проекция Claims → publishable fact IDs |
| advantages[] | Выводятся при валидных supportingFactIds и доказательствах | Не переносить advantages в паспорт vNext как первичные факты |
| assets.* | Сборка media/map/plans и проверка прав | Нормализовать Assets, сохранить type/rights/project match/expiry |
| apartmentPlans[] | Выводит проверенные планировки при наличии plan asset | Mapping в Plans; не создавать Property Unit автоматически |
| infrastructure[] | Выводит POI и distance label, проверяет route evidence | Разделить POI и Routes, затем собрать совместимую runtime projection |
| offers[] | Маппинг offer type → runtime offer key | В vNext это не характеристика недвижимости; нужен отдельный Conversion Catalog mapping |
| contentStrategy.modules | Выбор runtime composition по module ID, decision, requiredFactIds и order | Перенести в Landing Specification; не оставлять в Project Passport |
| contentStrategy.visualDirection | Выбор palette, heroLayout, galleryLayout | Перенести в Landing Specification |
| selectionQuiz | Runtime quiz при approved status | Перенести в Landing Specification / Conversion Flow |
| commercial | Не копируется в public profile | Секреты и закрытые поля должны остаться за пределами public model |
| marketContext | Не копируется в public profile | Оставить internal-only |
| integration argument | Отдельная конфигурация, не паспорт | Сохранить отдельный protected/public integration boundary |

## 3. Текущая граница ответственности runtime

Сейчас builder объединяет несколько обязанностей:
1. читает Project Passport 1.0.0;
2. проверяет publishable facts;
3. фильтрует assets и права;
4. формирует публичную проекцию проекта;
5. читает marketing copy;
6. в production дополнительно валидирует Landing Brief / Positioning Gate;
7. формирует runtime offers, modules, quiz и integration profile.

Для целевой архитектуры эти обязанности нужно разделить на этапы:
- Passport Reader / Legacy Adapter;
- normalized Project Knowledge;
- Claim & Asset Publication Validator;
- Landing Brief / Landing Specification validator;
- Public Runtime Projection;
- Runtime Builder.

Не обязательно создавать отдельный сервис или пакет для каждого этапа. Это логические границы, которые можно реализовать компактными чистыми модулями.

## 4. Безопасная последовательность миграции

### Stage 0 — зафиксировать baseline
- оставить schema 1.0.0 неизменной;
- сохранить текущие fixtures и runtime tests;
- считать текущий builder эталонным поведением, пока не покрыты parity tests.

### Stage 1 — normalized model без изменения поведения
- определить минимальную внутреннюю модель Project Knowledge;
- написать adapter из schema 1.0.0;
- сделать snapshot/parity tests: одинаковый паспорт 1.0.0 должен давать тот же public runtime profile;
- проверить, что private/internal поля не утекли.

### Stage 2 — vNext mapping
- описать mapping Project, Organizations, Phase, Building, Section, Site, Site Features, Property Units, Plans, POI, Routes, Documents, Construction Events, Commercial Terms, Assets, Claims, Sources, Evidence;
- для неоднозначных legacy полей возвращать migration warnings, не угадывать;
- сохранить исходные IDs там, где они имеют стабильную семантику.

### Stage 3 — новый input adapter
- принимать Passport vNext proposal через отдельный reader;
- преобразовывать его в normalized model;
- не менять публичный runtime contract без отдельной причины;
- добавить positive/negative fixtures для каждого домена.

### Stage 4 — переключение builder
- перевести builder на normalized model;
- сохранить parity tests;
- только после этого рассматривать production schema 2.0.0 и deprecation legacy 1.0.0.

## 5. Обязательные parity и regression tests

1. Для legacy fixture 1.0.0 публичный runtime profile не меняется.
2. Факты без источников, просроченные и internal-only не публикуются.
3. Assets без подтверждённых прав/принадлежности не публикуются.
4. Plans без действующего plan asset не публикуются.
5. POI без подтверждённого источника не публикуется.
6. Маршрутные значения без route evidence не публикуются.
7. Offers и CTA сохраняют distinct intent/scenario IDs.
8. Positioning Gate остаётся обязательным для production mode.
9. commercial, marketContext, private notes и integration secrets не попадают в runtime.
10. Site Features не смешиваются с внешними POI.
11. Claims привязываются к точному subject; данные корпуса не наследуются квартирой без явного правила.
12. Missing/unknown/conflicting values не превращаются в нули, пустые факты или позитивные утверждения.

## 6. Что не делаем сейчас

- не меняем schema 1.0.0;
- не переименовываем поля runtime напрямую;
- не пишем массовую миграцию fixture 905;
- не подключаем CRM API (его пока нет);
- не меняем public runtime payload;
- не создаём новые сервисы ради формального разделения слоёв.

## 7. Следующее техническое решение

Следующий артефакт перед JSON Schema 2.0.0 — минимальный normalized Project Knowledge contract и таблица source-to-normalized mapping для каждого реально используемого legacy поля. После этого можно сделать adapter и parity tests, не ломая текущий runtime.
