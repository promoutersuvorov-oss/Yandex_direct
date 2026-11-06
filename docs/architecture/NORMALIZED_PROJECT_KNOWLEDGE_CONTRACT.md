# Normalized Project Knowledge — минимальный внутренний контракт

**Версия:** 0.1  
**Дата:** 2026-11-06  
**Статус:** design proposal; не production schema, не публичный API и не изменение runtime.  
**Назначение:** единая внутренняя форма данных между Passport Reader и генератором публичного runtime.

## 1. Зачем нужен отдельный normalized contract

Схема паспорта описывает, как данные хранятся и собираются. Runtime не должен зависеть от того, в какой версии паспорта эти данные пришли.

Normalized Project Knowledge — внутренняя модель, в которую преобразуются:
- текущий Project Passport 1.0.0 через Legacy Adapter;
- будущий Passport vNext через отдельный reader/adapter.

Builder должен читать только normalized model. Это позволяет менять паспорт поэтапно, не ломая генератор и не заставляя каждую версию паспорта знать внутреннее устройство runtime.

Это не означает, что нужно вводить новый сервис, базу данных или API. На первом этапе это обычный типизированный объект в коде и чистые функции преобразования.

## 2. Границы модели

Normalized Project Knowledge включает:
- идентичность проекта;
- структурные сущности проекта и их связи;
- утверждения (claims), источники и доказательства;
- активы и права использования;
- продуктовые единицы и планировки;
- внутренние элементы среды;
- внешние POI и маршруты;
- подтверждённые коммерческие условия.

Не включает:
- аудитории, JTBD, мотивы и барьеры;
- позиционирование конкретной рекламной кампании;
- hooks, CTA, lead magnets, funnel и qualification;
- порядок секций и визуальную композицию лендинга;
- настройки CRM, endpoint, токены и секреты;
- персональные данные посетителей и лиды.

Эти домены принадлежат Customer Experience, Landing Brief, Landing Specification, Conversion Catalog, Integration Config и Lead Storage.

## 3. Общие правила типов и ссылок

### 3.1 Stable ID

Все сущности получают стабильный ID в пределах проекта. ID исходных данных сохраняются, если их семантика однозначна. Если legacy ID отсутствует, адаптер может создать детерминированный внутренний ID из типа сущности и стабильного ключа исходного значения. Нельзя генерировать новый случайный ID при каждом чтении.

### 3.2 EntityRef

Связи на сущности задаются явной парой:
- type: project | phase | building | section | site | site_feature | property_unit | plan | poi;
- id: стабильный ID сущности.

Ссылки не должны быть голыми строками без типа, если в одном поле допустимы разные виды сущностей.

### 3.3 SubjectRef

Claim, Document, Construction Event, Asset и Commercial Term могут относиться к конкретной сущности через SubjectRef. SubjectRef использует ту же пару type + id, но допускает только предметы, для которых соответствующий домен имеет смысл.

Не использовать наследование характеристик «вниз» по дереву автоматически. Утверждение на уровне проекта не доказывает автоматически характеристику корпуса, секции или квартиры.

### 3.4 Null, missing и unknown

Различать:
- поле отсутствует — источник/паспорт не содержит сведений;
- null — значение явно не установлено;
- unknown — значение исследовали, но установить не удалось;
- not_applicable — характеристика не применима к типу сущности.

Не подставлять 0, false, пустую строку или «нет» вместо отсутствующего значения.

## 4. Минимальные интерфейсы данных

Ниже — логические TypeScript-подобные формы для обсуждения. Это не готовый код и не JSON Schema.

### 4.1 ProjectKnowledge

    ProjectKnowledge {
      contractVersion: "0.1",
      project: Project,
      organizations: Organization[],
      phases: Phase[],
      buildings: Building[],
      sections: Section[],
      site?: Site,
      siteFeatures: SiteFeature[],
      propertyUnits: PropertyUnit[],
      plans: Plan[],
      pointsOfInterest: PointOfInterest[],
      routes: Route[],
      documents: ProjectDocument[],
      constructionEvents: ConstructionEvent[],
      commercialTerms: CommercialTerm[],
      assets: Asset[],
      claims: Claim[],
      sources: Source[],
      evidence: Evidence[],
      marketContext?: InternalMarketContext
    }

Коллекции могут быть пустыми. Это означает «сведения не внесены», а не «объектов не существует».

### 4.2 Project

    Project {
      id: string,
      name: string,
      aliases: string[],
      propertyType: "urban_residential_new_build",
      classClaimIds: string[],
      location: {
        city: string,
        address?: Evidenced<string>,
        district?: Evidenced<string>,
        coordinates?: Coordinates
      },
      organizationRefs: EntityRef[],
      externalIds: ExternalId[]
    }

Сегмент KEY не означает, что каждому проекту автоматически присваивается класс premium. Класс и особенности сегмента должны иметь основание в claims/evidence.

### 4.3 Building и Section

    Building {
      id: string,
      projectId: string,
      phaseId?: string,
      name?: string,
      number?: string,
      sectionIds: string[],
      claimIds: string[]
    }

    Section {
      id: string,
      buildingId: string,
      name?: string,
      number?: string,
      claimIds: string[]
    }

Физические характеристики здания (этажность, лифты, инженерия, число квартир, паркинг) хранятся как типизированные значения/claims с точной привязкой subject. Не создавать универсальное поле arbitraryAttributes.

### 4.4 PropertyUnit

    PropertyUnit {
      id: string,
      projectId: string,
      unitKind: "apartment" | "serviced_apartment" | "commercial_unit" | "parking_space" | "storage_unit" | "other",
      buildingId?: string,
      sectionId?: string,
      floor?: number,
      planId?: string,
      area?: Measurement,
      rooms?: number,
      featureIds: string[],
      availability?: FreshValue<AvailabilityStatus>,
      commercialTermIds: string[],
      claimIds: string[]
    }

Допустимые unitKind ограничены текущим городским сегментом. Террасы, пентхаусы, двухуровневые решения и видовые характеристики чаще являются features, а не отдельными видами единиц.

### 4.5 Plan

    Plan {
      id: string,
      planKind: "apartment_floor_plan" | "building_floor_plan" | "section_plan" | "floor_plan" | "site_masterplan" | "parking_plan" | "other",
      subject: EntityRef,
      assetId?: string,
      version?: string,
      area?: Measurement,
      rooms?: number,
      claimIds: string[]
    }

Plan — тип/схема пространственного решения. PropertyUnit — конкретная единица. Их нельзя создавать друг из друга автоматически.

### 4.6 Site и SiteFeature

    Site {
      id: string,
      projectId: string,
      boundaryAssetId?: string,
      area?: Measurement,
      featureIds: string[],
      claimIds: string[]
    }

    SiteFeature {
      id: string,
      projectId: string,
      buildingId?: string,
      featureKind: "lobby" | "courtyard" | "private_garden" | "terrace" | "playground" | "sports_area" | "lounge" | "coworking" | "concierge_area" | "parking" | "storage" | "other",
      status: "designed" | "declared" | "under_construction" | "realized" | "unknown",
      claimIds: string[],
      assetIds: string[]
    }

SiteFeature описывает внутреннюю среду проекта. Внешние школы, парки, магазины, транспорт и медицина — POI.

### 4.7 POI и Route

    PointOfInterest {
      id: string,
      name: string,
      category: string,
      coordinates?: Coordinates,
      address?: string,
      status: "operating" | "under_construction" | "planned" | "closed" | "unknown",
      claimIds: string[]
    }

    Route {
      id: string,
      origin: EntityRef,
      destination: EntityRef,
      mode: "walking" | "driving" | "public_transport" | "cycling",
      distance?: Measurement,
      durationSeconds?: number,
      provider?: string,
      observedAt: string,
      validUntil?: string,
      evidenceIds: string[]
    }

Наличие POI не доказывает маршрут, а расстояние по прямой не является длительностью пути.

### 4.8 Claim

    Claim {
      id: string,
      subject: EntityRef,
      predicate: string,
      value: string | number | boolean | string[] | Measurement,
      unit?: string,
      modality: "designed" | "declared" | "observed" | "measured" | "legally_registered" | "independently_verified",
      epistemicStatus: "verified" | "provisional" | "hypothesis" | "unknown" | "conflicting" | "outdated",
      evidenceIds: string[],
      validFrom?: string,
      validUntil?: string,
      lastCheckedAt?: string,
      publicationPolicy: "allowed" | "allowed_with_qualification" | "internal_only" | "blocked",
      limitations: string[],
      conflictGroupId?: string
    }

Для публикации claim должен пройти отдельную проверку актуальности, evidence, modality и publicationPolicy. Сам по себе статус verified недостаточен, если claim устарел или относится не к тому subject.

### 4.9 Source и Evidence

    Source {
      id: string,
      url?: string,
      title: string,
      publisher?: string,
      sourceType: string,
      publishedAt?: string,
      accessedAt: string,
      retrievedAt?: string
    }

    Evidence {
      id: string,
      sourceId: string,
      locator?: string,
      quoteOrExtract?: string,
      extractionMethod?: string,
      observedAt: string,
      limitations: string[]
    }

Один источник может иметь много фрагментов доказательств. Нельзя считать наличие URL достаточным evidence для любого claim.

### 4.10 Asset

    Asset {
      id: string,
      assetType: "photo" | "render" | "video" | "plan" | "document" | "map" | "logo" | "other",
      role?: string,
      url?: string,
      storageRef?: string,
      depictedSubjects: EntityRef[],
      capturedAt?: string,
      version?: string,
      rightsHolder?: string,
      rightsStatus: "confirmed" | "pending" | "blocked" | "unknown",
      rightsEvidenceIds: string[],
      allowedContexts: string[],
      validUntil?: string
    }

Активы требуют отдельной проверки проекта, прав, срока и контекста использования. Рендер не подписывается как фотография.

### 4.11 CommercialTerm

    CommercialTerm {
      id: string,
      termKind: "price" | "discount" | "installment" | "mortgage_program" | "booking" | "other",
      subjectRefs: EntityRef[],
      value?: Measurement,
      conditions: string[],
      restrictions: string[],
      validFrom?: string,
      validUntil?: string,
      observedAt: string,
      sourceIds: string[],
      evidenceIds: string[],
      publicationPolicy: "allowed" | "allowed_with_qualification" | "internal_only" | "blocked"
    }

KEY lead scenarios и CTA не входят сюда. Это условия покупки от продавца/застройщика, а не сценарии конверсии KEY.

## 5. Publication projection

Normalized model не отправляется в браузер целиком. Публичный runtime строится из ограниченной проекции:
- project identity;
- publishable claims, преобразованные в безопасные текстовые/структурированные значения;
- assets с подтверждёнными правами и разрешённым контекстом;
- планы с проверенной связью с активом;
- POI и маршруты с актуальным evidence;
- только те коммерческие условия, которые разрешены к публикации.

В проекцию не входят:
- сырые источники и внутренние заметки;
- неподтверждённые/конфликтующие/устаревшие claims;
- внутренний market context;
- закрытые коммерческие сведения;
- секреты интеграций;
- данные CRM и персональные данные лидов.

Landing Brief и Landing Specification остаются отдельными входами Builder-а.

## 6. Mapping legacy 1.0.0 → normalized model

| Legacy поле | Нормализованное представление | Ограничение |
|---|---|---|
| project.id/name/location | Project | Сохранять identity |
| project.developer | Organization + связь с Project | Не смешивать бренд и юрлицо |
| project.class | Claim о классе/сегменте | Сохранить evidence/status; не считать автоматически подтверждённым |
| project.delivery / constructionStatus | Claim + Document / Construction Event при наличии данных | Не восстанавливать историю из одного текущего значения |
| project.inventory | Частично Property Unit / Project claims | Не создавать единицы из общих счётчиков |
| facts[] | Claims + Sources + Evidence | Сохранять publicUse и исходный ID |
| advantages[] | Не переносить в Project Knowledge как факты | Это интерпретации/marketing candidates |
| infrastructure[] | POI + Route + Claims | Разделять существование места и маршрут |
| offers[] | Не переносить в Project Knowledge | В Conversion Catalog |
| assets.* | Assets[] | Проверить rights, depicted subject, role |
| apartmentPlans[] | Plans[] | Не создавать Property Unit |
| contentStrategy | Не переносить в Project Knowledge | Landing Brief / Specification |
| selectionQuiz / faq | Не переносить в Project Knowledge | Landing Specification / Conversion Flow |
| commercial | Только подтверждённые условия → Commercial Terms; секреты исключить | Не переносить CRM secrets и broker notes |
| marketContext | InternalMarketContext | Только internal-only |
| verification | Вычисляемый audit report | Не дублировать как первичный источник истины |

Legacy adapter должен возвращать warnings для значений, которые нельзя безопасно нормализовать. Он не должен додумывать связи, геометрию, subject или доказательства.

## 7. Вопросы, которые должны быть закрыты перед реализацией

1. Какие поля Project Unit действительно нужны для первых сценариев: каталог типов или только квартира/паркинг/кладовая/коммерческое помещение?
2. Нужен ли отдельный Phase entity в первой итерации или достаточно optional phaseId на Building?
3. Какие конкретные данные о Site Features требуются runtime уже сейчас, а какие могут оставаться только в паспорте?
4. Как представлять типизированные value/unit для Claims без arbitrary JSON?
5. Какой минимальный формат геометрии и координат нужен, учитывая, что сейчас builder использует только текстовые POI и маршрутные подписи?

Решения должны исходить из реальных источников данных и потребностей ближайшего генератора, а не из абстрактной универсальности.


## 12. Уточнение минимального контракта и legacy mapping

Более точный минимальный NPK и полное сопоставление полей паспорта 1.0.0 с целевыми доменами зафиксированы в [PASSPORT_V1_TO_NORMALIZED_MAPPING.md](PASSPORT_V1_TO_NORMALIZED_MAPPING.md). При расхождениях использовать этот mapping как более позднюю спецификацию: `Claim.value` должен быть типизированным, `apartment_with_terrace` не является отдельным `unitKind`, а текущие runtime consumers определяют минимальный обязательный набор первой реализации.
