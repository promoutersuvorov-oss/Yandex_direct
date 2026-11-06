# Passport 1.0.0 → Normalized Project Knowledge: field mapping и минимальный контракт

**Дата:** 2026-11-06  
**Версия:** 0.2  
**Статус:** архитектурная спецификация миграционного этапа; не production schema и не изменение runtime.

## 1. Решение

Текущий Passport 1.0.0 остаётся действующим входным контрактом. Новый normalized contract вводится как внутренняя модель данных между reader/adapter и runtime builder.

Важно различать три слоя:

1. **Source Passport** — документ, в котором данные собраны по версии schema 1.0.0 или будущей 2.0.0.
2. **Normalized Project Knowledge (NPK)** — нормализованные знания об объекте, независимые от версии входного паспорта.
3. **Public Runtime Profile** — ограниченная проекция для браузера, собранная из NPK + Landing Brief + Marketing Copy + public Integration Config.

NPK не является публичным API, не содержит стратегию кампании и не должен сериализоваться целиком в браузер.

## 2. Фактический runtime baseline

Проверен `scripts/build-landing-runtime.mjs`, schema 1.0.0, пример паспорта, draft паспорта КД «905» и 16 тестов `tests/landing-runtime-adapter.test.mjs`.

Текущий builder читает напрямую:
- `schemaVersion`, `project.id/name/location.city/location.district/location.address`;
- `facts`, `advantages`;
- `assets.*`;
- `apartmentPlans`;
- `infrastructure`;
- `offers`;
- `contentStrategy.modules`, `contentStrategy.visualDirection`;
- `selectionQuiz`.

Маркетинговый JSON, Landing Brief и public Integration Config являются отдельными входами. Поля `commercial`, `marketContext`, `verification` не должны попадать в public profile.

Builder формирует runtime profile с группами:
- `project`;
- `composition`, `design`;
- `marketing`, `marketingStrategy`, `ctaMap`;
- `advantages`, `media`, `heroMedia`, `locationMap`, `plans`, `infrastructure`;
- `offers`, `selectionQuiz`;
- `integration`, `analytics`, `mode`.

Это текущий baseline, который необходимо сохранить parity tests. Его не следует путать с целевой структурой NPK.

## 3. Минимальный NPK для первой реализации

Не нужно сразу нормализовать каждый домен до максимальной глубины. Первая реализация должна покрыть все текущие runtime consumers и при этом не потерять доказательные связи.

### 3.1 Корневой объект

    NormalizedProjectKnowledge {
      contractVersion: "0.1",
      source: {
        schemaVersion: "1.0.0",
        projectId: string
      },
      project: ProjectIdentity,
      claims: Claim[],
      sources: Source[],
      evidence: Evidence[],
      assets: Asset[],
      plans: Plan[],
      pointsOfInterest: PointOfInterest[],
      routes: Route[],
      structures?: StructureIndex,
      propertyUnits?: PropertyUnit[],
      siteFeatures?: SiteFeature[],
      commercialTerms?: CommercialTerm[],
      internalMarketContext?: InternalMarketContext
    }

Для legacy паспорта коллекции, которые нельзя восстановить однозначно, остаются пустыми, а adapter выдаёт warnings. Пустая коллекция означает отсутствие нормализованных записей, а не доказанное отсутствие соответствующей сущности у объекта.

### 3.2 ProjectIdentity

    ProjectIdentity {
      id: string,
      name: string,
      city: string,
      addressClaimId?: string,
      districtClaimId?: string,
      organizationIds: string[]
    }

Минимально обязательны только id, name, city — именно их требует текущий builder. Адрес и район не дублируются как «доверенные» значения: они публикуются через Claims, если прошли проверку.

### 3.3 Claim

    Claim {
      id: string,
      subject: EntityRef,
      predicate: string,
      value: ClaimValue,
      modality: "declared" | "designed" | "observed" | "measured" | "legally_registered" | "independently_verified",
      epistemicStatus: "verified" | "provisional" | "hypothesis" | "unknown" | "conflicting" | "outdated",
      sourceIds: string[],
      evidenceIds: string[],
      publicUse: "allowed" | "allowed_with_qualification" | "internal_only" | "blocked",
      observedAt?: string,
      validUntil?: string,
      limitations: string[]
    }

    ClaimValue =
      | { kind: "text", value: string }
      | { kind: "number", value: number, unit?: string }
      | { kind: "boolean", value: boolean }
      | { kind: "text_list", value: string[] }
      | { kind: "measurement", value: number, unit: "m" | "m2" | "km" | "minutes" | "floors" | "units" }

Не использовать `unknown` / произвольный JSON как тип значения в production contract. Новые типы ClaimValue добавляются осознанно. Состояние отсутствия данных не является Claim со значением «нет».

### 3.4 Source и Evidence

    Source {
      id: string,
      url?: string,
      title: string,
      publisher?: string,
      sourceType: string,
      publishedAt?: string,
      accessedAt: string
    }

    Evidence {
      id: string,
      sourceId: string,
      locator?: string,
      extract?: string,
      extractionMethod?: string,
      observedAt: string,
      limitations: string[]
    }

Source описывает публикацию/документ. Evidence указывает на конкретный фрагмент или место в Source. Один Source может иметь несколько Evidence. Legacy `quoteOrEvidence` не всегда позволяет определить locator и extract раздельно; adapter сохраняет исходную строку как extract и отмечает низкую структурированность.

### 3.5 Asset

    Asset {
      id: string,
      assetKind: "photo" | "render" | "video" | "plan" | "document" | "map" | "logo" | "other",
      url?: string,
      alt?: string,
      subjectRefs: EntityRef[],
      projectMatch: "confirmed" | "unconfirmed",
      publicationStatus: "approved" | "pending" | "blocked" | "missing",
      rightsStatus: "confirmed" | "pending" | "blocked" | "unknown",
      rightsEvidenceIds: string[],
      rightsLimitations: string[],
      validUntil?: string,
      allowedContexts: string[]
    }

Сохранить legacy asset ID, URL, type, alt, projectMatch, rightsStatus и validUntil. `status=approved` не означает, что правообладатель известен: status публикации и rightsStatus остаются разными измерениями. Если legacy `rightsSource` или `rightsNote` есть, перенести их как source/evidence или limitation, не повышая статус автоматически.

### 3.6 Plan

    Plan {
      id: string,
      planKind: "apartment_floor_plan" | "building_floor_plan" | "section_plan" | "floor_plan" | "site_masterplan" | "parking_plan" | "other",
      subjectRef?: EntityRef,
      assetId: string,
      title?: string,
      rooms?: number,
      area?: Measurement,
      floor?: number,
      finishingClaimId?: string,
      sourceIds: string[],
      epistemicStatus: string,
      publicUse: string,
      validUntil?: string
    }

Legacy `apartmentPlans` становятся Plan только при наличии assetId, который разрешается в актив типа plan. Публичное использование Plan требует также approved asset, confirmed project match, confirmed rights с отдельным rights evidence и publishable plan evidence. Не создавать Property Unit на основании plan. В будущем связь с конкретной квартирой задаётся только при наличии отдельного подтверждённого unit ID.

### 3.7 POI и Route

    PointOfInterest {
      id: string,
      name: string,
      category: string,
      status: string,
      sourceIds: string[],
      claimIds: string[]
    }

    Route {
      id: string,
      originRef: EntityRef,
      destinationPoiId: string,
      mode: "walking" | "driving" | "public_transport" | "cycling",
      distance?: Measurement,
      durationSeconds?: number,
      method: "route" | "straight_line",
      sourceIds: string[],
      observedAt: string,
      validUntil?: string
    }

Legacy `infrastructure` содержит имя, категорию, статус доказанности, один источник и опциональные distance/time values с отдельным distanceEvidence. Adapter создаёт POI со status=unknown, если отдельный operating status не задан: legacy status=verified подтверждает запись/существование по источнику, но не доказывает текущее операционное состояние. Отдельный Claim фиксирует факт перечисления POI источником и его epistemicStatus. Route создаётся только если distanceEvidence.method = walking_route или другой реальный маршрутный метод. Для straight_line создаётся только Claim измерения прямой дистанции; нельзя создавать пеший Route или duration. Если отсутствует стабильный POI ID, adapter генерирует детерминированный ID из projectId + normalized name + category и сохраняет исходное имя.

### 3.8 Структуры проекта, Property Units, Site Features

Это optional-домены для целевых городских бизнес-/премиум-проектов. Они не нужны для воспроизведения legacy runtime profile и не должны выдумываться из общих счётчиков.

    StructureIndex {
      phases: Phase[],
      buildings: Building[],
      sections: Section[]
    }

    PropertyUnit {
      id: string,
      unitKind: "apartment" | "serviced_apartment" | "commercial_unit" | "parking_space" | "storage_unit" | "other",
      buildingId?: string,
      sectionId?: string,
      floor?: number,
      planId?: string,
      area?: Measurement,
      rooms?: number,
      featureClaimIds: string[],
      availabilityClaimId?: string
    }

    SiteFeature {
      id: string,
      featureKind: "lobby" | "courtyard" | "private_garden" | "terrace" | "playground" | "sports_area" | "lounge" | "coworking" | "concierge_area" | "parking" | "storage" | "other",
      subjectRef: EntityRef,
      status: "designed" | "declared" | "under_construction" | "realized" | "unknown",
      claimIds: string[],
      assetIds: string[]
    }

Для первой schema 2.0.0 достаточно Phase (optional), Building, Section (optional), PropertyUnit, Plan и SiteFeature. Не вводить Land Parcel и загородные сущности. `apartment_with_terrace` не должен быть unitKind: терраса — характеристика/claim квартиры, если нет отдельного каталожного типа.

## 4. Field mapping: Passport 1.0.0 → NPK / другой канонический слой

| Legacy путь | Текущий runtime consumer | Целевое место | Правило миграции |
|---|---|---|---|
| `schemaVersion` | Version guard | `source.schemaVersion` + `contractVersion` | Сохранять исходную версию; не подменять версию source |
| `project.id` | project.id, brief.projectId | `project.id` | Сохранять без изменений |
| `project.name` | project.name, media fallback alt | `project.name` | Сохранять |
| `project.location.city` | project.city | `project.city` | Обязательное поле NPK |
| `project.location.address` | project.address при status verified | Claim + `addressClaimId` | Значение и status/source сохранять; публиковать только по policy |
| `project.location.district` | project.district при status verified | Claim + `districtClaimId` | Аналогично адресу |
| `project.developer` | Не используется builder напрямую | Organization + связь с Project; Claim при спорном бренде/юрлице | Не смешивать бренд и юрлицо |
| `project.class` | Не используется builder напрямую | Claim о классе/сегменте | Не присваивать класс без основания |
| `project.delivery` | Не используется builder напрямую | Claim + Document / Construction Event при наличии | Не создавать историю события из одного значения |
| `project.constructionStatus` | Не используется builder напрямую | Claim + Construction Event | Сохранить modality и дату |
| `project.inventory.apartmentCount` | Не используется builder напрямую | Aggregate Claim на уровне Project | Не создавать N квартир/Property Units |
| `project.inventory.layoutsAvailable` | Не используется builder напрямую | Derived/readiness flag только в Landing Inputs/QA | Не переносить в Project Knowledge и не считать фактом наличия конкретных планов |
| `project.inventory.priceFrom` | Не используется builder напрямую | CommercialTerm | Без валюты, scope, observedAt и validUntil не переносить как Claim/CommercialTerm; вернуть warning |
| `project.inventory.areaRange` | Не используется builder напрямую | Internal migration warning до расширения ClaimValue | Не создавать неподдерживаемый measurement_range и не создавать квартиры из диапазона |
| `project.positioning`, `project.audiences` | Не используется builder напрямую | Landing Brief / Customer Experience | Не переносить в Project Knowledge; сохранить только в кампанийном/покупательском контексте |
| `project.inventory.finishing` | Не используется builder напрямую | Claim на уровне проекта/корпуса/единицы | Subject scope не расширять автоматически |
| `facts[]` | publishableFactIds; marketing claim validation; advantages/modules/brief refs | Claims + Sources + Evidence | Сохранить ID, status, publicUse, expiresAt, claim; источник нормализовать отдельно |
| `advantages[]` | Runtime advantages | Не Project Knowledge; Marketing Candidate в Landing Brief/Marketing Layer | Это интерпретация «факт → польза», не факт паспорта. Сохранить supportingFactIds как claim refs |
| `infrastructure[]` | Runtime infrastructure labels | POI + Claims + Routes | Не путать наличие места, прямую дистанцию и маршрут; marketingMeaning — Marketing Layer |
| `offers[]` | Runtime offers / CTA validation | Conversion Catalog | Не характеристика объекта. Сохранить offer/scenario IDs и consent semantics |
| `assets.images/videos/plans/documents/maps` | media, map, plan asset validation | Assets[] | Сохранить ID/URL/type/rights/projectMatch/expiry; назначить assetKind и subjectRefs только при наличии оснований |
| `contentStrategy.modules[]` | Runtime composition | Landing Specification | Перенести moduleId/decision/order/variant/dependencies; requiredFactIds → claimIds |
| `contentStrategy.visualDirection` | Runtime design palette/layout | Landing Specification | Перенести только allowlisted design tokens; не исполнять произвольный CSS |
| `contentStrategy.coreIdea` | Не используется builder при наличии brief; стратегический контекст | Landing Brief | Не хранить в паспорте объекта |
| `contentStrategy.primaryCta` / secondaryCtas | Не используется напрямую в builder | Landing Brief / Conversion Catalog | CTA — стратегия конверсии, не свойство ЖК |
| `contentStrategy.audiencePriority` | Не используется напрямую в builder | Landing Brief | Не хранить в паспорте |
| `contentStrategy.informationGaps` | Не используется напрямую в builder | Passport QA / Landing Brief research backlog | Сохранять как gaps, не превращать в факты |
| `commercial.leadWebhookEnvKey` | Не копируется в runtime | Protected Integration Config | Никогда не переносить в публичный паспорт |
| `commercial.crmPipeline` | Не копируется в runtime | Protected Integration Config / Operations | Не привязывать к паспорту |
| `commercial.brokerNotes`, `restrictedData` | Не копируются в runtime | Internal Operations / access-controlled notes | Не переносить в публичный NPK |
| `verification` | Не копируется в runtime | Вычисляемый Passport QA / Verification Report | Сохранять как audit history при необходимости, не делать первичным источником истины |
| `apartmentPlans[]` | Runtime plans | Plans[] | Сохранять ID/assetId/rooms/area/floor/finishing/status/publicUse/source/expiry; без auto-unit |
| `selectionQuiz` | Runtime selectionQuiz | Conversion Flow / Landing Specification | Вынести из паспорта; вопросы и результат — сценарий KEY, не характеристика ЖК |
| `faq[]` | Не используется builder напрямую | Landing Specification FAQ entries с claim refs | Ответ не должен существовать без подтверждающих claims |
| `marketContext` | Не копируется в runtime | InternalMarketContext | Внутренний слой, срезы и ограничения сохранить; не публиковать |

### Отдельные правила migration warnings

Adapter обязан возвращать предупреждения для:
- источника без URL или title, если поле требуется для публикации;
- source.quoteOrEvidence без возможности локализовать конкретный фрагмент;
- инфраструктуры с distanceMeters без distanceEvidence;
- walkingMinutes при method=straight_line;
- плана с отсутствующим или неподходящим assetId;
- property count / area range без отдельных units;
- priceFrom без валюты, scope и срока действия;
- project positioning/audiences, которые относятся к кампании и Customer Experience;
- неоднозначного developer brand vs legal entity;
- отсутствующей даты актуальности для динамических данных;
- asset с rightsStatus неизвестным или без evidence;
- offer, который нельзя однозначно сопоставить Conversion Catalog scenario.

Warnings не должны «исправляться» догадками и не всегда должны блокировать чтение всего паспорта. Public projection блокируется для конкретного неподтверждённого элемента.

## 5. Минимальные правила нормализации и публикации

1. Stable ID сохраняется, если он уже есть и не конфликтует с ID другого домена.
2. Если ID отсутствует, допускается детерминированный ID из source projectId + entity type + стабильного ключа. Не использовать random ID.
3. Все ссылки разрешаются и проверяются по типу и ID.
4. Claim без evidence может оставаться internal/provisional, но не публикуется как verified.
5. Publication policy, epistemic status, modality и freshness независимы.
6. Проектное заявление не равно реализации.
7. Значение уровня Project не наследуется Building/Unit автоматически.
8. Asset без confirmed rights не публикуется.
9. Plan без валидного plan asset не публикуется.
10. POI без подтверждения существования не публикуется.
11. Route/distance/time без отдельного route evidence не публикуется.
12. CommercialTerm публикуется только при действующем сроке и точном scope.
13. InternalMarketContext, Operations и integration secrets никогда не попадают в Public Runtime Profile.
14. Отсутствие данных не преобразуется в ноль, false или «отсутствует».
15. Ошибки одной optional сущности не должны терять все независимые подтверждённые данные проекта.

## 6. Parity tests: обязательный baseline

До изменения builder зафиксировать golden outputs для legacy fixtures. После перехода builder должен выдавать эквивалентный runtime profile на тех же входах (допускаются только заранее описанные и проверенные исправления ошибок).

Минимальные проверки:
1. Legacy 1.0.0 adapter сохраняет project identity.
2. District/address публикуются только при verified.
3. Publishable claims сохраняют правила verified + publicUse + source + freshness.
4. Advantages не публикуются без publishable supporting claims и evidence.
5. Asset не публикуется без approved + projectMatch confirmed + rights confirmed + HTTPS + freshness.
6. Plans не публикуются без валидного plan asset.
7. POI не публикуется без verified + source.
8. Route labels не появляются без route evidence и актуальности.
9. Offers сохраняют distinct intent/scenario IDs и consent rules.
10. Composition и design сохраняют allowlist, порядок и fallback.
11. Quiz публикуется только approved и при доступном offer.
12. Marketing Copy/Brief остаются отдельными входами и валидируются по projectId.
13. Positioning Gate остаётся обязательным в production mode.
14. Private commercial, marketContext, verification notes, CRM secrets и internal notes не попадают в runtime.
15. Интеграционные настройки не генерируются и не угадываются.
16. Для КД «905» текущие 21 facts, 13 advantages, 18 infrastructure items и пустые assets/offers/plans не превращаются в придуманные units или коммерческие предложения.

## 7. Этапы реализации

### Step 1 — characterization tests
Зафиксировать snapshot/golden runtime profile для текущих fixtures и все существующие 16 тестов как baseline. Изменения в тестовых данных документировать.

### Step 2 — pure legacy adapter
Создать `src/passport-normalizer-v1.mjs` с чистой функцией `normalizePassportV1(passport)`, которая:
- проверяет входную версию и минимальную структуру;
- возвращает `{ knowledge, warnings, errors }`;
- не изменяет исходный паспорт;
- создаёт стабильные IDs;
- сохраняет source/evidence/provenance;
- не выбрасывает неподдерживаемые поля молча.

### Step 3 — normalized runtime projection
Перевести builder на `knowledge` по одному домену за раз, сохраняя public profile contract. Для каждого домена — parity tests. Не менять HTML, дизайн и CRM интеграцию в этой работе.

### Step 4 — future vNext adapter
После стабилизации NPK создать отдельный `normalizePassportV2`. Оба адаптера должны выдавать один и тот же NPK contract.

### Step 5 — schema 2.0.0
Только после реальных fixtures, positive/negative validation, mapping tests и parity — утверждать JSON Schema 2.0.0 и план deprecation 1.0.0.

## 8. Не входит в эту итерацию

- изменение production schema 1.0.0;
- переписывание builder;
- массовая миграция паспорта 905;
- изменение public runtime profile;
- создание CRM API или интеграция с несуществующим endpoint;
- создание отдельного сервиса/базы данных для NPK;
- поддержка массовой застройки или загородной недвижимости;
- произвольные plugin/extension registries.

## 9. Открытые вопросы, требующие решения по фактическим данным

1. Какие типы коммерческих единиц действительно встречаются в текущих проектах KEY и требуют отдельного каталога PropertyUnit?
2. Для каких проектов реально нужны Phase и Section, а где достаточно Building?
3. Нужна ли геометрия Site в ближайшем runtime или пока достаточно claims + карты/asset?
4. Какой формат маршрутов поддерживается используемыми источниками и какой период актуальности задаётся по типу маршрута?
5. Где хранить версии планировок и связь «тип планировки ↔ доступные конкретные квартиры», когда источник это предоставляет?

Эти вопросы не блокируют нормализацию уже используемых runtime данных. Они блокируют только конкретные optional поля и функции, если для них пока нет подтверждённого сценария.
