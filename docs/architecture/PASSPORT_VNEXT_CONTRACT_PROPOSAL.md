# Passport vNext — контракт данных KEY (предложение)

**Версия:** 0.2  
**Дата:** 2026-11-06  
**Статус:** архитектурное предложение; не production schema и не команда на миграцию.  
**Scope первой версии KEY:** городские новостройки бизнес- и премиум-сегмента.

## 1. Продуктовая граница

KEY сейчас создаёт систему привлечения качественных обращений по новостройкам бизнес- и премиум-сегмента: клубным домам и городским жилым проектам в дорогих локациях с выразительной архитектурой и особенностями продукта/среды.

Вне scope первой версии: массовая типовая застройка, эконом/стандарт-сегмент, загородная недвижимость, коттеджные посёлки и продажа земельных участков.

Это не вечный запрет на расширение. Новые сегменты добавляются только при реальной бизнес-потребности, наличии ресурсов и отдельном архитектурном решении. Сейчас не проектировать их абстракции и поля.

## 2. Основные принципы

1. Паспорт описывает конкретный проект, его продукт, среду и доказательства сведений. Он не выбирает аудиторию, CTA, рекламную кампанию или композицию лендинга.
2. Один объект может использоваться в нескольких кампаниях без переписывания паспорта.
3. Факты, заявления застройщика, наблюдения, гипотезы, коммерческие условия и права на публикацию — разные измерения.
4. Тип планировки, конкретная единица недвижимости и коммерческое предложение — разные сущности.
5. Внутренняя среда проекта и внешняя городская инфраструктура — разные сущности.
6. Source отвечает «где нашли», Evidence — «какой конкретный фрагмент подтверждает утверждение».
7. Неполнота данных допустима; отсутствие сведений не означает отсутствие характеристики в реальности.
8. Не строить универсальный граф произвольных атрибутов и не создавать абстракции ради гипотетического будущего.

## 3. Предлагаемая верхнеуровневая структура

    {
      "schemaVersion": "2.0.0",
      "project": {},
      "organizations": [],
      "phases": [],
      "buildings": [],
      "sections": [],
      "site": {},
      "siteFeatures": [],
      "propertyUnits": [],
      "plans": [],
      "pointsOfInterest": [],
      "routes": [],
      "documents": [],
      "constructionEvents": [],
      "commercialTerms": [],
      "assets": [],
      "claims": [],
      "sources": [],
      "evidence": [],
      "marketContext": {}
    }

Это логическая модель. Не все коллекции обязательны; некоторые сущности создаются только при наличии в проекте. Точная JSON Schema будет подготовлена после проверки consumers, mapping и fixtures.

## 4. Сущности

### 4.1 Project
- id, name, aliases;
- propertyType — клубный дом / городской жилой проект / иной поддерживаемый городской формат;
- class/segment — только как доказуемые сведения с provenance, не субъективная оценка;
- location: city, address, coordinates, district;
- organizationIds, externalIds;
- claimIds.

Не хранить positioning, audiences, contentStrategy, primaryCta, visualDirection, CRM pipeline и webhook.

### 4.2 Organizations
- id, name, legalName, role;
- sourceIds, evidenceIds.
Роли включают застройщика, юридическое лицо, архитектурное бюро, генподрядчика и управляющую организацию. Бренд и юридическое лицо не смешиваются без основания.

### 4.3 Phases, Buildings, Sections
Phase — необязательная очередь/этап.
Building — корпус/здание: projectId, phaseId, name/number, floors, elevators, engineering systems, construction attributes, claimIds.
Section — необязательная секция/подъезд внутри здания.
Значения о сроках, статусе и характеристиках связываются с точным subject. Уровень проекта не распространяется автоматически на каждый корпус.

### 4.4 Site и Site Features
Site описывает территорию городского проекта и её границы/геометрию, если они известны. Не доказывает право собственности или доступность всей изображённой территории.

Site Features — внутренние пространства и элементы среды:
- lobby, courtyard, private_garden, terrace, playground, sports_area, lounge, coworking, concierge_area, parking, storage, other.

Для каждого feature фиксируются ID, тип, связь с проектом/корпусом, статус (designed / declared / under_construction / realized / unknown), claims и evidence. Не смешивать внутренние пространства с внешними POI.

### 4.5 Property Units
Конкретные единицы недвижимости/продукта:
- apartment;
- apartment_with_terrace (только когда формат выделен в данных проекта);
- serviced_apartment (только при подтверждённом юридическом/продуктовом статусе);
- commercial_unit;
- parking_space;
- storage_unit;
- other.

Пентхаус, двухуровневая, видовая квартира и другие особенности чаще являются типизированными features конкретной квартиры, а не отдельным unitKind.

Поля по применимости: id, projectId, buildingId, sectionId, floor, unitKind, planId, area, rooms, featureIds, availabilityStatus, observedAt, validUntil, commercialTermIds, sourceIds, evidenceIds. Условные ограничения не должны требовать rooms для машиноместа или план квартиры для кладовой.

План и Property Unit не одно и то же. Планировка не подтверждает доступность конкретной квартиры. Цена и наличие динамичны, имеют дату наблюдения и срок актуальности.

### 4.6 Plans
Поддерживаемые виды:
- apartment_floor_plan;
- building_floor_plan;
- section_plan;
- floor_plan;
- site_masterplan;
- parking_plan;
- other.

Поля: id, planKind, version, subject reference, assetId, geometry/scale status, evidenceIds. План должен быть связан с точным объектом/типом; render-план и техническая документация различаются.

### 4.7 POI и Routes
POI — внешняя городская инфраструктура. Route — отдельная запись с origin/destination, mode, distance, duration, provider, observedAt, validUntil, evidenceIds. Расстояние по прямой не равно маршруту; время не вычисляется из прямой дистанции.

### 4.8 Documents и Construction Events
Document имеет тип, номер, редакцию, даты, source, asset и subject scope: project, phase, building, section или property unit. История редакций сохраняется.

Construction Event имеет eventType, plannedAt, observedAt, occurredAt, status и связи с конкретным subject, sources и evidence.

### 4.9 Commercial Terms
Условия приобретения: price, discount, installment, mortgage_program, booking и другие. Хранятся с scope, условиями, ограничениями, периодом действия, датой наблюдения, источниками и evidence.

Сценарии получения лида KEY (презентация, подбор, консультация, просмотр) не относятся к Commercial Terms. Они остаются в Conversion Catalog / Landing Brief.

### 4.10 Assets
- id, assetType, representationType (photo / render / diagram / document / video);
- role, url/storageRef, alt, caption;
- depictedEntityIds, capturedAt, version;
- rightsHolder, rightsStatus, rightsEvidenceIds;
- allowedChannels, allowedContexts, validUntil.

Наличие URL не означает наличие прав. Фото и рендер должны различаться.

### 4.11 Sources, Evidence, Claims
Source: id, url, title, publisher, sourceType, reliabilityClass, publishedAt, accessedAt, retrievedAt.

Evidence: id, sourceId, locator, quoteOrExtract, extractionMethod, observedAt, limitations.

Claim: id, subject reference, predicate, value, unit, claimText, modality, epistemicStatus, evidenceIds, validFrom, validUntil, lastCheckedAt, publicationPolicy, limitations, conflictGroupId.

epistemicStatus, modality, freshness и publicationPolicy независимы. Заявление застройщика о предусмотренном объекте не равно независимому подтверждению его фактической реализации.

### 4.12 Market Context
Внутренние наблюдения: snapshot, period, entity/comparison set, sampling method, sample size, metrics, sourceIds, evidenceIds, limitations. Не попадает в public runtime. Количество объявлений не является числом продаж, спросом или свободным остатком.

## 5. Специфика целевого сегмента

Паспорт должен позволять собирать, если подтверждено:
- архитектурную концепцию, автора/бюро и особенности фасадов;
- этажность, число квартир, плотность, число квартир на этаже;
- лобби, ресепшен, общественные и приватные пространства;
- двор, озеленение, приватные сады и благоустройство;
- террасы, панорамное остекление, высоту потолков и нестандартные планировки;
- инженерные системы, вентиляцию, кондиционирование, лифты;
- паркинг, машиноместа, кладовые и инфраструктуру для автомобилей;
- отделку и комплектацию;
- видовые характеристики с привязкой к конкретному этажу/квартире;
- внешнюю городскую инфраструктуру и проверенные маршруты.

Это возможные домены сбора, а не обязательные преимущества каждого объекта. Нельзя выводить преимущество из пустого поля или из самого позиционирования сегмента.

## 6. Что вынесено за пределы паспорта

| Домен | Канонический слой |
|---|---|
| Сегменты, мотивы, JTBD, страхи, барьеры | Customer Experience |
| Интервью, исследования и выводы | Customer Experience research/evidence |
| Выбранная ЦА, потребность, продуктовый фокус, источник трафика, главный конвертер | Landing Brief / Positioning Gate |
| Hooks, CTA, лид-магниты, воронки, квалификация, эксперименты | Landing Brief |
| Порядок секций, layout, визуальное направление, конфигурация модулей | Landing Specification |
| KEY lead scenarios, consent и обработка обращений | Conversion Catalog / Operations |
| CRM endpoint, pipeline, credentials | Protected Integration Config |
| Лиды и ответы посетителей | Lead/event storage |

## 7. Миграционные принципы 1.0.0 → 2.0.0

- Сохранять legacy schema 1.0.0 до переноса всех consumers.
- facts преобразовывать в Claims + Evidence + Sources без повышения статуса.
- infrastructure разделять на POI, Route и Claim.
- apartmentPlans преобразовывать в Plans; не создавать Property Unit автоматически.
- inventory преобразовывать в Building/Property Unit только при достаточных данных; неоднозначности выводить в migration report.
- advantages не считать фактами и не переносить в паспорт как доказанные преимущества.
- offers переносить в Conversion Catalog, не смешивать с Commercial Terms.
- contentStrategy переносить в Landing Brief / Landing Specification как draft.
- commercial secrets не переносить в публичный паспорт.
- verification формировать как audit/readiness report из первичных данных.
- миграция должна быть идемпотентной и сопровождаться отчётом о потерях/неоднозначностях.

## 8. Минимальные проверки будущей схемы

- уникальность ID и разрешимость ссылок;
- точный subject scope для claims/documents/events/assets;
- claim, разрешённый к публикации, имеет evidence;
- устаревшие claims не проходят public projection;
- проектное заявление не превращается в факт реализации;
- plan не превращается в Property Unit;
- availability и price проходят freshness checks;
- внешние POI не смешиваются с Site Features;
- asset без подтверждённых прав не публикуется;
- marketContext/private data не попадают в runtime;
- отсутствие необязательной сущности не блокирует независимые модули;
- migration report фиксирует потери и неоднозначности.

## 9. Условия перехода к JSON Schema 2.0.0

До реализации требуется:
1. сверить сущности с текущими runtime consumers;
2. определить conditional rules для Property Unit;
3. определить единый формат subject references;
4. определить Site Features и связи с корпусами;
5. завершить field mapping 1.0.0;
6. подготовить positive/negative fixtures и migration tests.

До выполнения этих условий текущая schema 1.0.0 остаётся production contract. Данный документ — proposal, не изменение runtime.
