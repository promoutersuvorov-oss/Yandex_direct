# Runtime Builder V1 — implementation status

Функция `buildLandingProfileFromKnowledge(knowledge, landingInputs, legacyReferences, marketing, integration, options)` реализована как отдельный pure builder. Она не читает raw passport и не меняет legacy builder или browser runtime.

## Implemented gates

- Module Registry V1 resolves passport module IDs and exact variants to existing runtime sections or fixed slots. Required includes fail closed when capabilities are missing; conditional modules are skipped with a diagnostic from the registry. Unknown modules, unsupported variants and section collisions are errors.
- FAQ is a dedicated accessible accordion section. Passport entries contain questions and required fact IDs only; answers are assembled from publishable Claims and named sources. No free-form or inferred answers are generated. The `approved-faq-answers` capability gates inclusion.
- Lifestyle is a dedicated runtime section. It renders only authored `lifestyleStories` with approved publication status, publishable supporting claims and an approved project asset whose rights explicitly allow the `lifestyle` usage context. It does not synthesize stories from raw project facts.

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
- Production: отдельная approvedMarketingStrategy (включая Positioning Gate), HTTPS endpoint, HTTPS privacy URL, policy version, consent text version, API contract version, подтверждённая delivery verification и явный активный presentation offer. Demo defaults не публикуются в production; CTA map должен ссылаться на реальные offers.

## Known intentional differences / constraints

- Module resolution is implemented in `src/landing-module-registry-v1.mjs`. The builder uses its section composition. `buildLandingProfileFromKnowledgeWithDiagnostics()` returns `{ profile, warnings }` for QA orchestration; `buildLandingProfileFromKnowledge()` remains a compatibility wrapper returning only the runtime profile. Diagnostics are not serialized into the public runtime profile.

- Builder не принимает Landing Brief и не валидирует его against raw Passport. Для production orchestration обязан передать отдельный `approvedMarketingStrategy`, предварительно проверенный соответствующим валидатором и Claim bridge. До этого production generation закрыт.
- Address/district читаются только из publishable project claims `project.address` и `project.district`; неподтверждённые значения остаются пустыми. Normalized identity пока не содержит прямых `addressClaimId/districtClaimId` ссылок.
- POI без walking route не показывается в legacy `infrastructure`, потому что текущий runtime UI ожидает `distanceLabel`. Для показа самого POI без выдуманного расстояния нужен отдельный UI contract.
- Offer defaults существуют только в demo mode. В production каждый используемый offer должен быть явно задан и пройти consent/status checks. Собственная CRM KEY пока без API, поэтому production lead workflow намеренно остаётся закрытым.
- Analytics остаётся выключенной.
- Семантический parity с legacy builder ещё не доказан. Реальный draft 905 проходит явный mapping для hero/key/about/security/location; conditional gallery и floor-plans пропускаются без assets/inventory; обязательный lifestyle image-led блокирует сборку, пока нет approved media. Это ожидаемый fail-closed результат, а не готовый production landing.

## Tests

`tests/landing-runtime-builder-v1.test.mjs` покрывает claim/source/evidence gate, marketing reference bridge, assets, production fail-closed, module resolution и отсутствие internal leakage.


## Primary browser runtime handoff — CI verified

The canonical CLI now supports an explicit `--target-runtime` mode. It writes the generated profile directly to `landing/runtime/project.config.js`, the exact file loaded by `landing/runtime/index.html`; this avoids a manual copy step. The flag is mutually exclusive with `--out`. The existing arbitrary `--out` path remains available for isolated builds and CI artifacts.

A focused fixture for ЖК «Галилей» and a Node CLI contract test verify the generated profile identity, visitor-facing copy, demo mode, disabled analytics and empty lead endpoint. The browser integration spec injects the actual generated profile into the primary runtime and checks rendered project data, selected section composition and the fail-closed demo lead path.

**Evidence status (2026-11-07):** GitHub Actions run [#692](https://github.com/promoutersuvorov-oss/Yandex_direct/actions/runs/42357341810) passed: source-integrity success; Chromium 36/36, Firefox 36/36 and WebKit 36/36. The canonical CLI contract test passed (1/1), including writing to the exact runtime config path and restoring the original demo config after the test. The browser integration test passed in all three engines. This proves builder-to-primary-runtime consumption and selected DOM composition with a controlled, evidence-safe fixture. It does not prove production CRM delivery, legal approval, live analytics, commercial performance or visual acceptance on physical devices. PR #24 remains Draft and stacked on PR #20; the handoff is not considered merged into the product baseline until the dependency chain is reviewed and merged.


## Two-project primary runtime diversity — CI verified

A second stacked change set adds a KD 905 profile beside the Galiley profile. Both are built through the same canonical CLI and consumed by the primary browser runtime.

[GitHub Actions run #694](https://github.com/promoutersuvorov-oss/Yandex_direct/actions/runs/42357689874) passed source-integrity and all browser jobs: Chromium 37/37, Firefox 37/37, WebKit 37/37. Tests cover two distinct compositions (`concept → location` vs `advantages → location`), two hero layouts (`fullscreen` vs `split`), two design palette tokens, desktop/mobile widths, no horizontal overflow, visible CTA and demo fail-closed behavior.

KD 905's source statuses were not relaxed. Its qualification-required facts are not promoted; without approved media, the gallery stays hidden; the advantages module shows an explicit evidence-required empty state. This demonstrates structural composition diversity, not visual premium quality, full product catalog coverage or production readiness. PR #26 remains Draft and stacked on PR #24.
