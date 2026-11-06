# Legacy 1.0.0 → Normalized Project Knowledge: field mapping

**Дата:** 2026-11-06  
**Статус:** архитектурный mapping contract; не реализация адаптера и не изменение production schema.  
**Проверено:** schemas/project-passport.schema.json, examples/kd-905.project-passport.draft.json, scripts/build-landing-runtime.mjs, tests/landing-runtime-adapter.test.mjs.

## 1. Решение: результат адаптера разделён на три слоя

Паспорт 1.0.0 смешивает знания о проекте, конфигурацию лендинга и внутренние операционные сведения. Поэтому Legacy Adapter должен возвращать разделённый bundle:

    LegacyAdapterResult {
      projectKnowledge: ProjectKnowledge,
      landingInputs: {
        landingSpecification?: LegacyLandingSpecification,
        conversionCatalog: ConversionCatalogEntry[],
        selectionFlow?: SelectionFlow,
        faqDrafts: FaqDraft[]
      },
      internal: {
        verificationReport?: VerificationReport,
        marketContext?: InternalMarketContext,
        protectedConfig?: ProtectedConfig
      },
      warnings: MigrationWarning[]
    }

Это внутренний результат миграции, не публичный API. Нельзя помещать contentStrategy, CTA offers и selectionQuiz в ProjectKnowledge только потому, что сейчас они лежат в одном JSON.

## 2. Минимум ProjectKnowledge, который реально нужен runtime

Текущий builder требует:
- schemaVersion = "1.0.0" как version guard;
- project.id;
- project.name;
- project.location.city.

Остальные данные обрабатываются как optional, фильтруются либо имеют fallback. Это фактический минимум builder-а, а не полный продуктовый минимум KEY.

Нормализованное ядро обязано сохранять project identity и возвращать пустые коллекции, когда сведений нет. Отсутствие данных не превращается в ноль, false, отрицательное утверждение или фиктивную сущность.

## 3. Полевая таблица: Project

| Legacy path | Текущий consumer | Normalized destination | Правило |
|---|---|---|---|
| schemaVersion | Жёсткая проверка 1.0.0 | metadata адаптера: sourceSchemaVersion | Не поле ProjectKnowledge; выбор adapter по версии |
| project.id | identity и cross-reference marketing | project.id | Сохранить без преобразования |
| project.name | публичное имя | project.name | Сохранить строку |
| project.developer | Сейчас не используется builder напрямую | Organization + project.organizationRefs + Claim | Роль developer; бренд не приравнивать к юрлицу без evidence |
| project.class | Сейчас не используется builder напрямую | Claim на Project | Не присваивать премиум-класс автоматически |
| project.location.city | Обязательное поле, публикуется | project.location.city | Прямое значение |
| project.location.address | Публикуется только при status=verified | Claim на Project: address | Сохранить status, sources, lastChecked, note |
| project.location.district | Публикуется только при status=verified | Claim на Project: district | То же |
| project.location.coordinates | Builder сейчас не использует | project.location.coordinates | Переносить только валидные координаты |
| project.delivery | Builder не использует | Claim; ConstructionEvent только при датированном evidence | Текст не создаёт историю событий и не доказывает дату ключей |
| project.constructionStatus | Builder не использует | Claim; ConstructionEvent только при датированном событии | Не угадывать статус из свободного текста |
| project.inventory.apartmentCount | Builder не использует | Project-level aggregate Claim | Не создавать PropertyUnits из общего числа |
| project.inventory.layoutsAvailable | Builder не использует | Claim или warning | Boolean не создаёт Plans/Units |
| project.inventory.priceFrom | Builder не использует | CommercialTerm только при валюте, периоде и scope; иначе Claim + warning | Не трактовать произвольную строку как текущую цену |
| project.inventory.areaRange | Builder не использует | Claim о диапазоне площадей | Не создавать конкретные лоты |
| project.inventory.finishing | Builder не использует | Claim с точным scope | Не распространять на все квартиры без evidence |

## 4. Полевая таблица: факты, источники и интерпретации

| Legacy path | Текущий consumer | Normalized destination | Правило |
|---|---|---|---|
| facts[].id | marketing.claimFactIds, advantages, requiredFactIds | Claim.id | Сохранить, если ID уникален |
| facts[].claim | Фактическое основание копирайта | Claim.claimText; predicate/value — только при безопасном разборе | Исходный текст не перефразировать при миграции |
| facts[].status | Publishable fact filter | Claim.epistemicStatus | verified→verified; provisional→provisional; hypothesis→hypothesis; missing→unknown; conflicting→conflicting; expired→outdated |
| facts[].publicUse | Publication gate | Claim.publicationPolicy | Маппинг значений один к одному |
| facts[].sources[] | Требование источника; source title в карточках evidence | Source[] + Evidence[] + Claim.evidenceIds | Source дедуплицировать осторожно; Evidence сохраняет конкретную связь с claim |
| source.url/title/sourceType/accessedAt | Источник | Source | Сохранить исходные значения |
| source.quoteOrEvidence | Фрагмент подтверждения | Evidence.quoteOrExtract | Не сочинять фрагмент, если поле отсутствует |
| evidencedValue.value/status/sources/note | Address, district и другие значения | Claim + Source + Evidence | missing/null не превращать в позитивный claim; note сохранить как limitation |
| evidencedValue.lastChecked | Сейчас не влияет на builder | Claim.lastCheckedAt | Сохранить |
| advantages[] | Builder строит карточки при publishable supportingFactIds | Landing Brief / marketing interpretation | title, benefit, hook не являются фактами |
| advantages[].supportingFactIds | Runtime gate | References на Claim IDs в landingInputs | Сохранить и валидировать после нормализации |
| advantages[].audienceFit | Runtime metadata | Customer Experience / Landing Brief | Не часть паспорта объекта |
| advantages[].strength | Presentation metadata | Landing Specification | Не мера доказательности |

### Правило Source и Evidence

В legacy Source вложен в поля и факты; в normalized model Source и Evidence разделены. Одинаковые источники можно дедуплицировать, но Evidence нельзя склеивать только по URL: разные claims могут подтверждаться разными фрагментами. При конфликте title/publisher для одинакового URL adapter выдаёт warning. В provenance сохраняются исходные legacy path и IDs.

## 5. Полевая таблица: инфраструктура, активы, планировки

| Legacy path | Текущий consumer | Normalized destination | Правило |
|---|---|---|---|
| infrastructure[].name/category | Имя и категория POI | PointOfInterest + Claim | В legacy нет ID: создать deterministic ID и warning synthetic ID |
| infrastructure[].status | Только verified проходит runtime filter | Claim epistemicStatus | Не маппить напрямую в POI operating status |
| infrastructure[].source | Подтверждение существования места | Source + Evidence | Не доказывает расстояние или время |
| infrastructure[].distanceMeters | Runtime distance label | Route measurement + Evidence | Без distanceEvidence не создавать publishable Route |
| infrastructure[].walkingMinutes | Runtime walking label | Route duration | Только при method=walking_route и отдельном evidence |
| infrastructure[].distanceEvidence.method | Отличает route от straight line | Route measurementMethod | straight_line не даёт walking duration |
| infrastructure[].distanceEvidence.checkedAt/validUntil/source | Freshness gate | Route.observedAt/validUntil + Evidence | Хранить отдельно от POI source |
| infrastructure[].marketingMeaning | Сейчас не используется builder | Landing Brief / derived copy | Интерпретация, не факт |
| infrastructure[].publicLabel | Подпись в runtime | Projection display label | Не смешивать с claim о POI |
| assets.images/videos/plans/documents/maps[] | Builder объединяет категории | Asset[] | Сохранить исходную категорию как type/role |
| assets.*[].id/type/url/status | Media, plans, map | Asset | ID сохранить; render/photo/plan/video/pdf/map/logo/other типизировать |
| assets.*[].projectMatch | Требуется confirmed | Asset subject match + evidence | unconfirmed/conflicting блокирует public projection |
| assets.*[].rightsStatus/rightsSource/rightsNote | Требуется confirmed | Asset rightsStatus/rightsEvidenceIds/limitations | URL не доказывает права |
| assets.*[].validUntil/usage/alt | Freshness и alt | Asset.validUntil/allowedContexts/alt | Неизвестный контекст не считать разрешённым |
| apartmentPlans[].id | Plan ID в runtime | Plan.id | Сохранить |
| apartmentPlans[].rooms/areaSqm/floor/finishing/title | Карточки планировок | Plan attributes/Claims | Сохранить при наличии evidence и точного scope |
| apartmentPlans[].assetId | Требуется approved asset type=plan | Plan.assetId | Неразрешимая ссылка → warning; план не публиковать |
| apartmentPlans[].status/publicUse/sources/expiresAt/updatedAt | Publication gate | Plan freshness + Claim/evidence policy | Не повышать статус |
| apartmentPlans[] целиком | Builder публикует планы | Plans[] | Не создавать PropertyUnit: нет надёжного unit/lot ID и availability |

Важное наблюдение: builder сейчас отбрасывает инфраструктурные POI без distanceLabel. Normalized model должна хранить POI независимо от наличия маршрута, но legacy parity projection временно обязана сохранить текущее поведение, пока не будет отдельного решения об изменении публичного runtime.

## 6. Полевая таблица: маркетинг, конверсия и внутренние сведения

| Legacy path | Текущий consumer | Куда переносится | Правило |
|---|---|---|---|
| offers[] | Runtime offers и CTA mapping | Conversion Catalog | Сценарии обращения KEY, не условия продажи недвижимости |
| offers[].id/type/title/status/scenarioId/description | mapOffer | Conversion Catalog entry | Сохранить scenarioId; provisional/inactive не активировать |
| offers[].requiredFields/consentRequired/consentExceptionReason/successMessage | Consent и форма | Conversion Catalog / Consent Policy | Юридическое исключение не публиковать |
| contentStrategy.coreIdea/primaryCta/secondaryCtas/audiencePriority | Landing composition context | Landing Brief / Landing Specification | Не хранить в ProjectKnowledge |
| contentStrategy.modules[] | Builder строит composition/order по requiredFactIds | Landing Specification | Сохранить decision/order/reason/dependencies и ссылки на claims |
| contentStrategy.visualDirection | Palette/layout selection | Design Specification | Не хранить в ProjectKnowledge; enum сохранить |
| selectionQuiz | Builder публикует approved quiz | Conversion Flow / Landing Specification | Не часть объекта |
| faq[] | FAQ content downstream | Landing Content / FAQ projection | requiredFactIds сохраняются; вопрос не становится фактом |
| commercial.leadWebhookEnvKey/crmPipeline/brokerNotes/restrictedData | Внутренние сведения KEY | Protected Operations/Integration Config | Не переносить в ProjectKnowledge и public runtime |
| verification | Builder не использует как источник истины | Verification Report | Производный audit report |
| marketContext | Builder не публикует | InternalMarketContext | Internal-only; наблюдения не являются фактами о самом ЖК |
| Marketing JSON | Отдельный обязательный input builder | Marketing Copy input | Не сливать с паспортом; claimFactIds должны ссылаться на normalized Claim IDs |
| Landing Brief | Production gate и positioning | Landing Brief | Остаётся отдельным входом |
| Integration JSON | HTTPS/privacy production gate | Protected/public integration config | Не часть паспорта; API собственной CRM пока нет |

## 7. Runtime parity obligations

| Runtime output | Legacy source | Требование к нормализованной проекции |
|---|---|---|
| project.id/name/city | project identity | Полное совпадение |
| project.district/address | verified evidencedValue | Публиковать только эквивалентно разрешённые claims |
| advantages[] | advantages + publishable facts | Сохранить карточки как marketing interpretation, не как факты |
| media/heroMedia/locationMap | assets | Совпадение порядка и approved asset filtering |
| plans[] | apartmentPlans + assets.plans | Совпадение при valid plan + linked asset |
| infrastructure[] | infrastructure | POI отдельно от маршрута; legacy projection пока сохраняет старый distanceLabel filter |
| offers | offers + defaults | Сохранить offer IDs и scenario IDs |
| composition/design | contentStrategy | Отдельный Landing Specification input |
| selectionQuiz | selectionQuiz + offers | Отдельный Conversion Flow input |
| marketingStrategy/ctaMap | Landing Brief + offers + facts | Не входит в ProjectKnowledge |
| integration | отдельный integration JSON | Сохранить отдельную границу |

Parity test сравнивает полный публичный профиль builder-а для одной legacy fixture до и после refactor. Недостаточно сравнить количество модулей или полей.

## 8. Обязательные migration warnings

1. Legacy facts не имеют явного subject: default project-level claim допустим только при отсутствии признаков более узкого scope.
2. Infrastructure item не имеет стабильного ID: deterministic synthetic ID с provenance.
3. Source вложен в claim: deduplication может обнаружить конфликт metadata.
4. project.inventory — агрегаты, не список лотов.
5. apartmentPlans — планировочные записи, не реальные лоты.
6. project.class может быть missing; сегмент KEY не даёт права назначать класс автоматически.
7. delivery/constructionStatus — snapshots, не история Construction Events.
8. commercial — операционная конфигурация KEY, не Commercial Terms застройщика.
9. Assets без подтверждённых прав/принадлежности сохраняются внутренне, но блокируются для публикации.
10. Legacy verified не задаёт modality: проектное заявление, наблюдение и независимая проверка различаются только при наличии оснований.

## 9. Scope первой реализации adapter

Первый adapter должен:
- читать schema 1.0.0;
- построить Project, Claims, Sources, Evidence и Assets;
- преобразовать Infrastructure в POI, а Route — только при отдельном route evidence;
- преобразовать apartmentPlans в Plans без PropertyUnits;
- вернуть отдельные landingInputs и internal metadata;
- выдавать warnings для неразрешимых связей;
- сохранять deterministic IDs и provenance;
- не менять public runtime profile до отдельного переключения builder-а.

Если legacy не содержит Buildings, Sections, Site, PropertyUnits, ConstructionEvents или CommercialTerms, адаптер возвращает пустые коллекции. Не нужно придумывать их из агрегатов.

## 10. Условие перехода к коду

Перед реализацией:
1. зафиксировать mapping;
2. добавить golden fixture нормализации для 905 и synthetic fixture минимального городского проекта;
3. определить warning codes и adapter interfaces;
4. зафиксировать текущий public profile snapshot;
5. реализовать pure adapter и unit tests;
6. только затем переключать builder на normalized model.

Schema 1.0.0 и текущий builder остаются production baseline.
