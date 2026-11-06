# Runtime Builder V1 — implementation status

Функция `buildLandingProfileFromKnowledge(knowledge, landingInputs, legacyReferences, marketing, integration, options)` реализована как отдельный pure builder. Она не читает raw passport и не меняет legacy builder или browser runtime.

## Implemented gates

- Project identity и projectId consistency.
- Approved marketing copy и обязательные COPY_KEYS.
- Claim publication: verified, разрешённая publicUse, source/evidence references существуют и связаны, validUntil актуален.
- Marketing copy claimFactIds и candidate supportingFactIds разрешаются только через explicit legacyReferences bridge.
- Assets: approved, confirmed project match, confirmed rights, rights evidence, HTTPS URL, validUntil.
- Plans: verified, allowed, source/evidence, связь с прошедшим asset gate.
- POI: не публикуется только из-за существования POI; требуется publishable existence claim и подтверждённый актуальный walking route. Straight-line distance не превращается в walking time.
- Offers: active, consent, supported offer type.
- Quiz: только approved flow с существующим offer, отфильтрованным как quiz.
- Composition: requiredFactIds проверяются через bridge; неизвестный выбранный module вызывает ошибку.
- Production: отдельная approvedMarketingStrategy (включая Positioning Gate), HTTPS endpoint, HTTPS privacy URL и policy version.

## Known intentional differences / constraints

- Builder не принимает Landing Brief и не валидирует его against raw Passport. Для production orchestration обязан передать отдельный `approvedMarketingStrategy`, предварительно проверенный соответствующим валидатором и Claim bridge. До этого production generation закрыт.
- Address/district читаются только из publishable project claims `project.address` и `project.district`; неподтверждённые значения остаются пустыми. Normalized identity пока не содержит прямых `addressClaimId/districtClaimId` ссылок.
- POI без walking route не показывается в legacy `infrastructure`, потому что текущий runtime UI ожидает `distanceLabel`. Для показа самого POI без выдуманного расстояния нужен отдельный UI contract.
- Offer defaults пока сохранены для совместимости runtime, но они не означают готовность CRM/API.
- Analytics остаётся выключенной.
- Семантический parity с legacy builder ещё не доказан. Реальный draft 905 сейчас блокируется неизвестными runtime module IDs (например, `hero`/`about`/`gallery`): builder намеренно не угадывает их отображение на UI-секции. Нужна отдельная согласованная Module Registry/adapter mapping. Тесты проверяют, что этот конфликт не скрывается.

## Tests

`tests/landing-runtime-builder-v1.test.mjs` покрывает claim/source/evidence gate, marketing reference bridge, assets, production fail-closed, module resolution и отсутствие internal leakage.
