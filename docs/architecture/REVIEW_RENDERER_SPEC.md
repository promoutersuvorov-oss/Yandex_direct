# Review Renderer — implementation contract

**Status:** internal review preview; not production renderer.  
**Current entry point:** `scripts/render-review-preview.mjs`  
**Input:** output of `scripts/build-review-bundle.mjs`.

## Purpose and boundaries

The review renderer proves that a verified project passport and a selected module manifest can produce a real HTML page that can be opened in a browser and exercised. It is an intermediate product-validation step between structured data and the future production landing engine.

It deliberately:
- emits a `noindex,nofollow` page marked as a preliminary version;
- does not collect contact details or send leads;
- never claims that an application has been received;
- keeps source evidence and internal generation notes out of the public profile;
- requires a separate publication gate, real endpoint verification, privacy configuration and human review.

A successful preview build is not a production-ready landing.

## Build pipeline

1. Validate the project passport against `schemas/project-passport.schema.json`.
2. Build a review bundle containing:
   - `project-profile.json` — allowlisted public presentation data;
   - `module-manifest.json` — selected modules, order, variants, evidence references and CTA IDs;
   - `generation-report.json` — internal evidence ledger, blockers, warnings, renderer compatibility and publication gates.
3. Render `preview.html` from the public profile and manifest.
4. Run Node-level security/data tests and Playwright browser tests.

Example:

```bash
node scripts/build-review-bundle.mjs --passport examples/project-passport.example.json --out artifacts/review-bundle
node scripts/render-review-preview.mjs --bundle artifacts/review-bundle --out artifacts/review-bundle/preview.html
```

## Data and publication gates

- Facts are public only when verified, current, sourced and marked `allowed` or `allowed_with_qualification`.
- Advantages must reference publishable facts.
- Approved media must have a safe HTTP(S) URL, confirmed project match, confirmed usage rights, traceable rights evidence and a current approval.
- Apartment plans require verified status, public-use permission, a source and an approved plan asset.
- A quiz requires explicit approval and an active result offer.
- An active offer is copied through an allowlist; internal success copy and commercial notes are not public profile fields.
- Project positioning is published only when `positioningStatus = approved` and `positioningFactIds` is non-empty and every referenced fact passes the public fact gate. An explicitly approved but unsupported positioning blocks bundle generation. Draft/unapproved positioning is omitted.
- Internal module rationale (`reason`, `whyIncluded`, `positionReason`) remains in the manifest/report and is never rendered as visitor-facing copy.

## Module contract

The manifest order is the rendered section order. The strategy can include, omit or conditionally include modules; the bundle builder checks selected modules against the renderer registry before preview generation.

Current module families include:
- `hero` — project identity and approved positioning;
- `gallery` — responsive multi-image presentation;
- `floor-plans` / `apartments` — evidence-backed plan cards and contextual plan CTA;
- `quiz` — approved finite-choice quiz; answers remain local to the preview;
- `mortgage` — local annuity-payment calculator; the visitor enters price, down payment, annual rate and term. No bank rate, apartment price or loan condition is assumed, and no lead is sent;
- `location` / `places` — verified infrastructure facts;
- additional mapped editorial sections such as `about`, `security`, `lifestyle`, `gift`, `price`, `developer`, `mortgage`, `steps`, `faq` and `contacts`.

The current implementation is intentionally a first renderer slice. Some mapped modules currently receive a shared editorial layout and do not yet have their full domain-specific component behavior. A registry mapping alone is not proof of a complete section renderer.

## Strategy-selected layout variants

The current renderer has an explicit allowlist of visual variants:
- `editorial-split` — asymmetric editorial split;
- `gallery-mosaic` — gallery-led mosaic composition;
- `plan-selector` — wide plan presentation;
- `step-form` — wide quiz/personal-selection presentation;
- `full-bleed` — image-led full-height composition.

Unknown variants fall back to the safe base layout. Variants are responsive and must not create horizontal overflow. This is a small first implementation of strategy-to-art-direction mapping, not a complete design system.

## Security and privacy requirements

- Escape all passport-derived text before HTML insertion.
- Revalidate image URLs at render time; only HTTP(S) is accepted.
- Never render raw source URLs, internal broker notes, evidence ledger, webhook URLs, analytics IDs or internal module rationale in the visitor-facing preview.
- Never generate a lead form or simulate a real lead delivery in preview.
- Quiz answers and mortgage inputs are processed in browser memory only and are not transmitted.
- Mortgage results are indicative annuity estimates from visitor-entered assumptions; they are not a bank offer, approval or confirmation of available terms.
- Do not copy a K15 fact, asset, plan, CTA or commercial setting into another project's profile.

## Automated verification

The CI pipeline currently checks:
- JSON Schema and canonical passport validity;
- evidence and rights gates;
- missing renderer mappings;
- safe escaping and unsafe media URL rejection;
- private/internal data isolation;
- a second project's profile and rendered HTML do not inherit the first project's name or facts;
- gallery, plan card, quiz, visitor-input mortgage calculation and contextual CTA behavior;
- loaded media, no JavaScript page errors and no horizontal overflow at 360, 390, 768 and 1440 px;
- K15 reference page smoke tests, including CTA form validation and failed lead transport;
- Chromium, Firefox and WebKit.

The browser matrix is a useful regression gate, not a substitute for human visual acceptance, real iOS/Android device testing, performance measurement, accessibility review or end-to-end CRM delivery tests.

## Next engineering milestones

1. Replace the shared fallback layout with domain-specific section renderers and a documented component registry.
2. Add more than one clearly synthetic passport with different marketing strategy, module order, variants and content density; assert no project leakage.
3. Expand variant tokens and art-direction constraints without turning variants into one rigid universal composition.
4. Add visual screenshot review and accessibility checks to the Definition of Done.
5. Implement production CTA/form contracts and real delivery only after the landing experience is accepted; test delivery end to end before enabling public success states.
