# Runtime Builder V1 — implementation status

Функция `buildLandingProfileFromKnowledge(knowledge, landingInputs, legacyReferences, marketing, integration, options)` реализована как отдельный pure builder. Она не читает raw passport и не меняет legacy builder или browser runtime.

## Implemented gates

- Module Registry V1 resolves passport module IDs and exact variants to existing runtime sections or fixed slots. Required includes fail closed when capabilities are missing; conditional modules are skipped with a diagnostic from the registry. Unknown modules, unsupported variants and section collisions are errors.

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

- Module resolution is implemented in `src/landing-module-registry-v1.mjs`. The builder uses its section composition; generation orchestration should also retain `resolveRuntimeModulesV1(...).warnings` for QA reporting. The runtime profile itself does not expose internal diagnostics.

- Builder не принимает Landing Brief и не валидирует его against raw Passport. Для production orchestration обязан передать отдельный `approvedMarketingStrategy`, предварительно проверенный соответствующим валидатором и Claim bridge. До этого production generation закрыт.
- Address/district читаются только из publishable project claims `project.address` и `project.district`; неподтверждённые значения остаются пустыми. Normalized identity пока не содержит прямых `addressClaimId/districtClaimId` ссылок.
- POI без walking route не показывается в legacy `infrastructure`, потому что текущий runtime UI ожидает `distanceLabel`. Для показа самого POI без выдуманного расстояния нужен отдельный UI contract.
- Offer defaults пока сохранены для совместимости runtime, но они не означают готовность CRM/API.
- Analytics остаётся выключенной.
- Семантический parity с legacy builder ещё не доказан. Реальный draft 905 проходит явный mapping для hero/key/about/security/location; conditional gallery и floor-plans пропускаются без assets/inventory; обязательный lifestyle image-led блокирует сборку, пока нет approved media. Это ожидаемый fail-closed результат, а не готовый production landing.

## Tests

`tests/landing-runtime-builder-v1.test.mjs` покрывает claim/source/evidence gate, marketing reference bridge, assets, production fail-closed, module resolution и отсутствие internal leakage.
