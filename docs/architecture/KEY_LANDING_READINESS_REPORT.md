# KEY Landing Readiness Report v1

The readiness report is a commercial/operational summary of the canonical runtime builder output. It does not replace or weaken claim, asset, module-registry, Positioning Gate, or production lead-workflow validation.

## Statuses
- `ready`: no blockers or warnings remain.
- `needs_attention`: no blockers, but one or more warnings need review.
- `blocked`: one or more blockers prevent production publication.

## Report groups
- `ready`: evidence-backed capabilities already present in the built profile.
- `warnings`: commercial/content gaps and existing builder diagnostics.
- `blockers`: missing required hero copy or production lead-intake configuration.
- `manualReview`: qualitative checks that are intentionally not guessed by heuristics (positioning strength, visual quality, CTA fit).

## Important limits
The report only summarizes a successfully built profile. If the canonical builder throws (invalid claims, unsupported modules, unapproved Positioning Gate, invalid endpoint/policy, or unready lead workflow), that error remains a hard build failure and must be surfaced by the caller as a blocker. This module does not catch or bypass those errors.

A missing floor plan, image, or route is reported as a warning rather than a fabricated substitute. Route metrics are never inferred from POI names. `publicationAllowed` is true only for an explicitly requested production report with a production-mode profile and zero blockers.

## Automatic generation

Every successful `scripts/build-review-bundle.mjs` run now writes:
- `readiness-report.json` — standalone structured readiness result;
- `generation-report.json` — the same result embedded under `readiness`.

The report is generated from the already-built, evidence-filtered project profile and selected module manifest. Existing builder warnings are carried into the report. The report does not independently approve assets, facts, modules, or production integrations.

Review mode treats missing live CRM intake as a warning because a review bundle is not a production deployment. An explicit production report treats missing intake configuration as a blocker. A review bundle can never set `publicationAllowed` to true.

The source-integrity CI job runs the focused readiness tests before building the canonical and KD 905 review bundles.


## Deterministic composition audit v1

Every successful review-bundle build also writes `layout-audit.json` and embeds the same object as `generation-report.json.layoutAudit`.

The audit checks only deterministic facts available in the built profile and selected module manifest:
- missing hero or a text-only hero that can use approved proof points;
- image-led variants without assigned approved media;
- selected modules with no renderable content;
- text-only sections that need a card/typographic hierarchy;
- conversion-oriented sections without an appropriate CTA;
- repeated fact assignments across sections;
- compositions whose assigned CTAs collapse to a single scenario.

Each finding contains a severity, stable code, explanation, affected module IDs, supporting counts/IDs, and an actionable recommendation. The audit never inserts stock imagery, invents claims, or silently changes the composition.

This is not computer-vision screenshot scoring. The report explicitly sets `visualScreenshotAssessment: not_performed` and keeps `humanReviewRequired: true`. Browser viewport tests and a human visual review remain separate publication gates. A recommendation is not an automatic approval or a blocker unless the underlying builder contract already makes it one.
