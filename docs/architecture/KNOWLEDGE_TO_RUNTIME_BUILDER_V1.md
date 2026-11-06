# Knowledge + Landing Inputs → Runtime Builder v1

Статус: implementation contract / pre-builder design. Runtime consumer не переключён.

## 1. Цель

Новый builder принимает только нормализованные доменные входы:
- `NormalizedProjectKnowledge` — факты, evidence, assets, plans, POI, routes;
- `LandingInputs` — стратегия, дизайн, marketing candidates, conversion catalog, selection flow, FAQ;
- `ApprovedMarketingCopy` — готовые тексты с явными ссылками на подтверждающие claims;
- `IntegrationConfig` — отдельный защищённый конфиг, не часть passport/knowledge.

Builder не принимает raw Project Passport. Это принципиальная граница, иначе новая модель останется декоративным промежуточным слоем.

## 2. Функциональный контракт

Предлагаемая функция:

```js
buildLandingProfileFromKnowledge(knowledge, landingInputs, marketing, integration = {}, options = {})
```

Возвращает тот же публичный runtime profile, который сейчас ожидает `landing/runtime/app.js`:
`mode, project, composition, design, marketing, advantages, media, heroMedia, locationMap, plans, infrastructure, offers, integration, analytics, selectionQuiz`.

Это позволяет сравнить builders без одновременной переписки браузерного runtime.

## 3. Обязательные проверки

### Project identity
- `knowledge.contractVersion` поддерживается.
- `knowledge.project.id/name/city` заполнены.
- `landingInputs.projectId === knowledge.project.id`.
- `marketing.projectId === knowledge.project.id`.
- `marketing.approvalStatus === approved`.
- Все обязательные COPY_KEYS заполнены.

### Claim publication gate
Claim допускается в public projection, только если:
- `epistemicStatus === verified`;
- `publicUse` — `allowed` или `allowed_with_qualification`;
- есть sourceIds и evidenceIds;
- ссылки на существующие Source/Evidence валидны;
- срок validUntil не истёк относительно переданного `options.now`.

Builder не должен принимать claims по одному только статусу verified. Claim value остаётся типизированным до формирования публичной проекции.

### Asset gate
Asset допускается, только если:
- `publicationStatus === approved`;
- `projectMatch === confirmed`;
- `rightsStatus === confirmed`;
- `rightsEvidenceIds` не пуст;
- URL — HTTPS;
- `validUntil` не истёк;
- контекст использования соответствует роли asset.

Для plan asset обязательна связь с конкретным Plan и подтверждённые права. Не подменять планировку рендером или наоборот.

### Plan gate
Plan публикуется, только если:
- `epistemicStatus === verified`;
- `publicUse === allowed` (или отдельная явно реализованная политика квалифицированной публикации);
- есть sourceIds/evidenceIds;
- существует связанный asset, прошедший Asset gate;
- Plan и Asset относятся к тому же проекту.

### POI и Route
- Сам POI не получает статус verified из наличия источника: проверяется связанный existence Claim.
- Нельзя выводить расстояние/время из одного факта существования POI.
- Route допускается только с валидными source/evidence, сроком актуальности и корректной методикой.
- straight_line публикуется только как расстояние по прямой; не превращается в «минут пешком».

### Marketing candidates
- Candidate не становится фактом.
- Для публикации каждый candidate должен ссылаться на разрешённые к публикации Claims.
- Связь должна быть явной и однозначной. Нельзя сопоставлять legacy fact и normalized claim по похожему тексту.
- Если связи нет, candidate остаётся внутренним кандидатом и не попадает в публичные advantages.

### Conversion
- Offers допускаются только после проверки статуса, consent, поддерживаемого типа и сценария.
- Наличие offer не доказывает, что backend/CRM endpoint подключён.
- Quiz допускается только при approved status, корректной структуре вопросов и существующем result offer.
- FAQ-вопросы не публикуются с автоматически сочинёнными ответами; answer content должен быть отдельным approved artifact с claim references.

### Composition / design
- Модули берутся из Landing Inputs, а не из knowledge.
- requiredFactIds должны быть разрешены через явную таблицу legacy-ID → normalized-claim-ID.
- неизвестный module ID нельзя молча игнорировать: fail-fast или диагностическая блокировка публикации.
- дизайн-токены — только allowlist; описательные поля не исполняются как CSS/JS.

### Production
- HTTPS lead endpoint, HTTPS privacy URL и версия политики обязательны.
- Internal output и secrets не включаются в public profile.
- При отсутствии API CRM integration остаётся отключённой; не создавать фиктивный endpoint.
- Production mode требует всех утверждений и readiness gates, не только валидной формы.

## 4. Критическая миграционная зависимость: ID bridge

Сейчас Landing Inputs сохраняет legacy `supportingFactIds` и `requiredFactIds`, а Normalized Project Knowledge содержит собственные deterministic claim IDs. Builder не имеет права угадывать соответствие по тексту.

До реализации production builder нормализатор должен возвращать явный индекс соответствий, например:

```js
{
  knowledge,
  legacyReferences: {
    factIdToClaimId: {
      "legacy-fact-id": "normalized-claim-id"
    }
  },
  warnings,
  errors
}
```

Этот индекс — migration metadata, не публичная часть Project Knowledge. Аналогичные bridge maps потребуются для assets и plans только если исходные IDs не сохраняются напрямую.

## 5. Parity test protocol

Один и тот же набор входных данных передаётся:
- legacy `buildLandingProfile(passport, marketing, integration, options)`;
- new `buildLandingProfileFromKnowledge(knowledge, landingInputs, marketing, integration, options)`.

Сравнение не должно требовать байт-в-байт идентичности. Оно проверяет семантическую эквивалентность публичного поведения.

| Domain | Required parity |
|---|---|
| Project identity | id, name, city, district, address |
| Marketing copy | все COPY_KEYS и claim references |
| Advantages | только кандидаты с полным доказательным основанием |
| Media | тот же набор одобренных активов и права |
| Hero / map | тот же выбранный актив и fallback |
| Plans | те же plans, asset links, метаданные |
| POI / routes | одинаковые места и корректная семантика дистанции |
| Offers | тип, CTA key, scenarioId, consent gate |
| Quiz | вопросы, варианты, result offer, approval |
| Composition | порядок, зависимости, отсутствие неизвестных модулей |
| Design | theme → palette, heroLayout, galleryLayout |
| Integration | demo/production gate, без утечки секретов |
| Analytics | не включать незапрошенные или неподключённые интеграции |

Fixtures:
1. synthetic passport с полным набором publishable claims/assets/plans/POI/offers;
2. реальный draft 905, который должен корректно отразить gaps и не выдумывать отсутствующие assets, plans, prices, routes или active offers.

## 6. Порядок реализации

1. Добавить `factIdToClaimId` в результат Passport normalizer и тесты стабильности.
2. Проверить и дополнить Landing Inputs mapping так, чтобы он хранил только IDs, которые можно разрешить через bridge.
3. Реализовать pure builder с fail-closed publication gates.
4. Добавить synthetic fixtures и semantic parity tests.
5. Прогнать 905 и зафиксировать ожидаемые отличия: непроверенные расстояния, отсутствие подтверждённых прав на визуалы, неполная готовность коммерческих сценариев.
6. Только после parity — рассматривать переключение build script/runtime consumer.

## 7. Что не делаем сейчас

- Не меняем `landing/runtime/app.js`.
- Не меняем legacy `buildLandingProfile`.
- Не включаем production CRM/API.
- Не объявляем 905 production-ready.
- Не объединяем PR.
- Не создаём Passport 2.0 ради удобства нового builder.
