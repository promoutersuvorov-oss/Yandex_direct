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
