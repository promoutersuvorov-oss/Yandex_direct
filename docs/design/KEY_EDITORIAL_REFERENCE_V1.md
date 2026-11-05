# KEY Editorial Reference — first implementation

**Status:** internal concept renderer; not approved as production design or conversion benchmark.  
**Entry point:** `scripts/render-reference-landing.mjs`  
**Output:** `artifacts/review-bundle/reference.html`

## Decision

The legacy K15 page remains an immutable functional reference. It is not the design template for future projects. The new editorial reference is a separate composition layer built from the canonical project profile and selected module manifest.

## What is deliberately retained from K15

- Contextual CTA actions and preservation of apartment/quiz context.
- Dialog-based short conversion steps.
- Gallery and plan presentation as distinct interactions.
- Quiz answers attached to the next action.
- Reduced-motion support and responsive layout principles.
- Clear validation boundary: a preview must never pretend that a lead was delivered.

## What is deliberately not copied

- The old fixed 17-section sequence.
- Its specific hook, copy, claims, price or project details.
- The same CTA repeated in every section.
- The old visual system and section styling.
- The legacy endpoint, analytics IDs, bot links or unverified assets.
- Any assumption that the presence of a section means it belongs on every ЖК page.

## First editorial direction

The first concept uses a restrained editorial visual language: warm mineral background, dark graphite typography, high-contrast serif headlines, asymmetrical hero, large architectural media, generous whitespace, responsive gallery mosaic, clear apartment cards and contextual action dialog. The visual direction is intentionally neutral enough to test information hierarchy; project-specific art direction must later be derived from each passport and marketing brief rather than hardcoded.

## Interaction contract

- CTA opens an honest preview dialog; no personal data is collected.
- Plan CTA retains the selected plan ID and available parameters.
- Approved quiz answers remain local and are shown as context in the preview dialog.
- No CRM, webhook, analytics or real success state is enabled.
- Unsupported or absent data is omitted; the renderer must not invent content.

## CI checks

The pipeline builds both the existing review preview and this independent concept. It checks preview safety and runs browser smoke tests for:
- responsive widths 360, 390, 768 and 1440;
- no JavaScript page errors;
- CTA dialog open/close and honest disabled-delivery state;
- local quiz interaction and context preservation.

These checks do not certify visual quality, real lead delivery, accessibility conformance, performance or production readiness.

## Acceptance gates before calling it an actual benchmark

1. Replace synthetic media with licensed, verified K15 assets and complete a human visual review.
2. Define K15-specific segment, hook, offer and proof chain from current primary sources.
3. Review desktop, Android and iOS layouts on real devices.
4. Test keyboard/focus behavior, screen-reader semantics, contrast and motion.
5. Complete every CTA route and verify real lead delivery in a controlled environment.
6. Connect analytics and attribution without exposing secrets in browser code.
7. Compare at least one materially different ЖК and prove that content strategy and composition change meaningfully.
8. Run a real traffic experiment before making conversion claims.

The new concept is a direction and implementation slice, not a claim that these gates are already passed.
