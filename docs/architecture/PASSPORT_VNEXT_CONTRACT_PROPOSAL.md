# Passport vNext — предложение контракта данных KEY

**Версия предложения:** 0.1  
**Статус:** проектирование; не production schema  
**Основание:** полевой аудит паспорта КД «905» от 2026-11-06 и текущие runtime-зависимости.

## 1. Основные решения

1. Паспорт описывает объект недвижимости и доказательства сведений о нём. Он не выбирает ЦА, не формирует CTA и не управляет композицией страницы.
2. Один объект может использоваться в нескольких кампаниях. Паспорт не переписывается при смене аудитории или рекламного фокуса.
3. Факты, проектные заявления, наблюдения, гипотезы, коммерческие предложения и публикационные разрешения — разные измерения. Их нельзя сводить к одному status.
4. Тип планировки, конкретный лот и коммерческое предложение — разные сущности.
5. POI, расстояние по прямой и маршрут — разные сущности/измерения.
6. Источники и доказательства должны переиспользоваться по ID.
7. Схема должна оставаться типизированной и понятной обычному коду. Не превращать паспорт в неограниченный граф произвольных атрибутов.
8. Неполнота данных допускается. Готовность оценивается для конкретного claim, модуля и режима публикации.

## 2. Предлагаемая верхнеуровневая структура

    {
      "schemaVersion": "2.0.0",
      "project": {},
      "organizations": [],
      "buildings": [],
      "plans": [],
      "lots": [],
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

Это целевой логический контракт, не окончательная JSON Schema. Коллекции необязательны: отсутствие сведений не означает отсутствие сущности в реальности.

## 3. Сущности и поля

### 3.1 Project

- id — стабильный внутренний ID;
- name — официальное/основное название;
- aliases[] — прежние и альтернативные названия;
- propertyType — клубный дом, ЖК, апартаменты, коттеджный посёлок и т. п.;
- location.city, location.address, location.coordinates, location.district;
- organizationIds[] — связи с застройщиком и участниками;
- externalIds[] — ID ЕИСЖС/наш.дом.рф и других официальных реестров.

Не хранить здесь positioning, audiences, contentStrategy, primaryCta, visualDirection, CRM pipeline и webhook.

### 3.2 Organizations

- id, name, legalName, role;
- sourceIds[], evidenceIds[];
- связи проекта с брендом, юридическим лицом, генподрядчиком и управляющей организацией.

Не смешивать бренд застройщика и юридическое лицо без явного основания.

### 3.3 Buildings

Отдельные корпуса/очереди:
- id, projectId, name, buildingNumber, phase;
- floors, sectionsCount, entrancesCount, apartmentCount;
- constructionTechnology, facade, engineeringSystems[], elevators[];
- territoryFeatures[], parkingFeatures[], commonAreas[];
- claimIds[] для доказуемых утверждений.

Числовые и юридически значимые значения должны ссылаться на claims/evidence, а не жить как неподтверждённые голые числа.

### 3.4 Plans — типы планировок

- id, projectId, buildingId, code, name;
- rooms, areaSqm, ceilingHeightM;
- floorPlanAssetId, layoutVersion, geometryStatus;
- features[] (балкон, лоджия, терраса и т. п.);
- claimIds[], evidenceIds[], validity.

Планировка — тип пространственного решения. Она не подтверждает наличие свободной квартиры.

### 3.5 Lots — конкретные квартиры/помещения

- id, projectId, buildingId, sectionId, floor, number (если допустимо);
- planId, rooms, areaSqm;
- availabilityStatus;
- price, currency, priceObservedAt, validUntil;
- commercialTermIds[], sourceIds[], evidenceIds[].

Доступность и цена динамичны. Нельзя считать лот доступным по устаревшему срезу. Публичный runtime получает только актуальную и разрешённую проекцию.

### 3.6 Points of Interest (POI)

- id, name, category, coordinates, address;
- operationalStatus: работает / строится / планируется / закрыто / неизвестно;
- identityEvidenceIds[], lastVerifiedAt.

POI не должен содержать маркетинговую интерпретацию вроде «идеально для семей» или «всё рядом».

### 3.7 Routes

Маршрут — отдельная запись:
- id, originProjectId, destinationPoiId;
- mode: walking / driving / public_transport / cycling;
- distanceMeters, durationSeconds;
- routeProvider, routeObservedAt, validUntil;
- accessibilityNotes, evidenceIds[].

Расстояние по прямой не является маршрутом. Пешее время не выводится из расстояния по прямой. Формулировка «N минут» должна ссылаться на актуальный маршрут и его метод.

### 3.8 Documents и Construction Events

Document:
- id, projectId, buildingId;
- documentType, number, revision, publishedAt, effectiveFrom, effectiveUntil;
- sourceId, assetId, supersedesDocumentId.

Construction event:
- id, projectId, buildingId, eventType;
- plannedAt, observedAt, occurredAt;
- status, sourceIds[], evidenceIds[].

Срок ввода из новой редакции декларации не должен перезаписывать историю. Нужны версии и события, чтобы видеть, когда и кем срок был изменён.

### 3.9 Commercial Terms

Отдельно хранить условия покупки:
- id, projectId, lotIds[] или scope;
- termType: price / discount / installment / mortgage_program / booking / other;
- value, currency, conditions[], restrictions[];
- validFrom, validUntil, observedAt;
- provider, sourceIds[], evidenceIds[];
- publicationPolicy.

Условия девелопера не являются CTA. Сценарии «получить презентацию», «подбор», «консультация» принадлежат KEY Conversion Catalog.

### 3.10 Assets

- id, projectId, assetType, representationType (photo/render/diagram/document/video);
- role (hero/facade/courtyard/lobby/interior/plan/map/construction_progress/brand и т. п.);
- url или storageRef, alt, caption;
- depictedEntityIds[], createdAt, capturedAt, version;
- rightsHolder, rightsStatus, rightsEvidenceIds[];
- allowedChannels[], allowedContexts[], validUntil.

Наличие URL не означает наличие прав. Render и реальная фотография не должны маркироваться одинаково.

### 3.11 Sources и Evidence

Source — описание источника:
- id, url, title, publisher, sourceType, reliabilityClass;
- publishedAt, accessedAt, retrievedAt;
- documentId или assetId, если применимо.

Evidence — конкретное доказательство:
- id, sourceId, locator (страница, раздел, таблица, timestamp, фрагмент);
- quoteOrExtract, extractionMethod, observedAt;
- limitations[].

Source отвечает «где нашли», Evidence — «какое конкретное место подтверждает утверждение». Один Source может иметь много Evidence.

### 3.12 Claims

Claim — проверяемое утверждение:
- id, subjectType, subjectId, predicate;
- value, unit, claimText;
- modality: designed / declared / observed / measured / legally_registered / independently_verified;
- epistemicStatus: verified / provisional / hypothesis / unknown / conflicting / outdated;
- evidenceIds[];
- validFrom, validUntil, lastCheckedAt;
- publicationPolicy: allowed / allowed_with_qualification / internal_only / blocked;
- limitations[], conflictGroupId.

epistemicStatus, modality, freshness и publicationPolicy независимы. Например, подтверждённое заявление застройщика о предусмотренном паркинге не равно независимому подтверждению фактически построенного паркинга.

### 3.13 Market Context

Оставить внутренним доменом:
- snapshotId, snapshotAt, periodStart, periodEnd;
- entityRef, comparisonSet, samplingMethod, sampleSize;
- metrics[] с единицами и методикой;
- sourceIds[], evidenceIds[], limitations[];
- observationType: asking_price / listing_count / transaction / demand_signal / advertising_signal / other.

Число объявлений нельзя называть продажами, спросом или свободным остатком.

## 4. Что остаётся за пределами паспорта

| Сущность | Канонический слой |
|---|---|
| Сегменты, мотивы, JTBD, страхи, барьеры, критерии выбора | Customer Experience |
| Интервью, CRM-исследования, опросы и исследовательские выводы | Customer Experience research/evidence |
| Выбранная ЦА и главная потребность кампании | Landing Brief |
| Positioning, hooks, message angles, CTA, funnels, qualification, experiments | Landing Brief |
| Порядок секций, layout, визуальное направление и module configuration | Landing Specification |
| KEY offers / lead scenarios / consent / processing workflow | KEY Conversion Catalog / Operations |
| CRM endpoint, pipeline, env vars, API credentials | Protected Integration Config |
| Лиды и ответы посетителей | Lead/event storage, отдельно от паспорта |

## 5. Миграция schema 1.0.0 → 2.0.0

| Текущий путь | Целевой путь | Правило |
|---|---|---|
| project.id/name/location | project | Сохранить ID; нормализовать географию и evidence |
| project.developer | organizations[] + связь с project | Сохранить значение и источник |
| project.positioning* | Landing Brief | Перенести только как legacy draft, не автоматически approve |
| project.audiences | Customer Experience | Перенести как неподтверждённые seed hypotheses, если нет evidence |
| project.delivery/constructionStatus | Claims + Documents + Construction Events | Не терять историю и конфликтующие сроки |
| project.inventory | Buildings / Plans / Lots / Commercial Terms | Разделить проектную ёмкость, планировки и наличие |
| facts[] | Claims[] + Evidence[] + Sources[] | Сохранять IDs и publication policy; дедуплицировать источники |
| advantages[] | Customer/Marketing Intelligence | Не мигрировать как факты; преобразовать в кандидаты интерпретаций с provenance |
| infrastructure[] | POI[] + Routes[] + Claims[] | Разделить существование POI и маршрутные показатели |
| offers[] | KEY Conversion Catalog | Не считать коммерческим предложением застройщика |
| assets.* | Assets[] | Сохранить ID/права; добавить роль и связь с сущностью по мере наличия |
| contentStrategy | Landing Brief + Landing Specification | Сохранить как legacy draft; не использовать как источник истины после перехода |
| commercial | Protected Integration Config / private notes | Секреты не переносить в публичный паспорт; проверить доступы |
| verification | Computed Readiness/Audit Report + Conflict records | Генерировать из фактов, источников и конфликтов |
| apartmentPlans[] | Plans[] | Сохранить план как тип продукта, не создавать Lot автоматически |
| selectionQuiz / faq | Landing Specification | Переносить в контекст конкретной кампании |

Миграция должна быть идемпотентной, иметь отчёт о потерях/неоднозначностях и не повышать draft/hypothesis до approved/verified.

## 6. Обратная совместимость

1. Старый schema 1.0.0 остаётся читаемым на время миграции.
2. Adapter преобразует старый паспорт в нормализованную внутреннюю модель vNext.
3. Builder принимает нормализованную модель, а не читает legacy-поля напрямую.
4. Для каждого перенесённого поля есть тест mapping и negative test на утечку private/internal данных.
5. После переноса всех consumers и fixtures можно объявить schema 2.0.0 основной.
6. Старый формат удаляется только отдельным изменением после подтверждения отсутствия потребителей.

## 7. Минимальный набор проверок

- stable IDs и уникальность сущностей;
- все ссылки на source/evidence/entity разрешаются;
- claim с publicUse allowed имеет evidence и допустимую модальность;
- устаревшие claims не проходят public projection;
- проектное заявление не превращается в факт физической реализации;
- маршрутные claims требуют route evidence;
- plan не превращается в lot;
- lot availability/price проверяются по свежести;
- render/photo различаются в подписи;
- asset без подтверждённых прав не попадает в public projection;
- marketContext, private notes и integration secrets не попадают в runtime;
- отсутствующий домен не блокирует независимые модули;
- старый passport fixture даёт предсказуемый migration report.

## 8. Решения для проверки до реализации

1. Нужен ли единый registry организаций уже в первом этапе или достаточно developer entity.
2. Какие типы недвижимости поддерживать в первой версии кроме многоквартирных ЖК.
3. Где хранить документы и медиа: внешние URL, Project storage или оба варианта.
4. Какую систему единиц/валют и локалей поддержать для первого рынка.
5. Какие поля лотов можно получать законно и с какой частотой обновлять.
6. Какие статусы availability и публикации являются каноническими.
7. Какие права и legal review нужны для публичного использования медиа и коммерческих условий.

До закрытия этих вопросов не следует генерировать окончательный JSON Schema 2.0.0. Следующий этап — проверить модель на двух-трёх контрастных типах объектов и пройти полный mapping каждого текущего поля.
