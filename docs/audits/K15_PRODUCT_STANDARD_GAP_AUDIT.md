# K15 × KEY Landing Product Standard — gap audit

**Date:** 2026-11-05  
**Scope:** static source audit of `landing/reference/K15_landing_edited.html` against `docs/product/KEY_LANDING_PRODUCT_STANDARD.md`.  
**Evidence boundary:** this is a source-code inspection, not a completed visual review of every viewport, a live endpoint/CRM test, or a legal/claims audit. Browser CI results are tracked separately in GitHub Actions.

## Executive conclusion

K15 is a materially stronger reference than a static brochure: its source contains a coherent editorial visual language, a rich section sequence, multiple CTA intents, a multi-step apartment quiz, interactive apartment/plan selection, a reusable modal/form factory, event hooks, responsive breakpoints and explicit failure handling for unavailable lead delivery.

It is **not yet a proven production-ready gold standard**. The largest product gap is architectural: the page is still a K15-specific monolithic HTML/CSS/JS implementation. It demonstrates patterns worth extracting, but does not itself provide a reusable project-neutral renderer or explain how strategy chooses a different composition for another ЖК. The second gap is proof: static code can show that a behavior is implemented, but cannot establish that real media, external links, endpoints, legal consent, mobile keyboard behavior, and every state work in production.

**Recommendation:** preserve K15 as a reference implementation and UX pattern library. Extract its proven patterns into engine components and contracts; do not turn its 17-section order, text, facts, styling, or K15-specific controls into the universal template.

## 1. Source inventory

Static inspection of the current reference file found:

- 17 top-level sections in this order: hero, key facts, gallery, about, security, parking, quiz, location, lifestyle, gift, apartments, price, developer, steps, mortgage, FAQ, final contacts.
- 40 button elements and 40 anchor elements in the source.
- One reusable lead-form factory, three native dialog elements, and seven input elements in the static source. Runtime-generated modal forms are created by JavaScript and are not all visible as literal HTML.
- At least nine responsive/media-query conditions, including breakpoints at 1100, 860, 820, 560, 520 and 480 px, plus hover-capability and reduced-motion rules.
- Inline CSS and two inline script blocks; the page is not yet separated into independently testable reusable components.
- 81 HTML IDs with no duplicate IDs detected by the static scan.
- Named section IDs include hero, key, gallery, about, security, quiz, location, lifestyle, gift, apartments, price, developer, steps, mortgage, faq and contacts. Parking has no section ID.

These counts describe source markup only. They are not a claim that all 40 buttons/links are correct or all routes are valid.

## 2. What K15 already does well

### Product story and visual direction — strong reference

- The opening is editorial and project-specific rather than a generic catalog hero.
- The CSS defines a consistent palette, spacing, content width, typographic roles, dark/light surfaces, border colors and focus-visible treatment.
- Section sequence moves from first impression and project character through security, parking, location, lifestyle, apartments and financial information to FAQ and contact.
- Typography uses a serif display face paired with a sans-serif UI face; the design uses deliberate whitespace and restrained interaction rather than a default card grid everywhere.
- The page has explicit reduced-motion handling, responsive layouts, visible keyboard focus and touch-oriented horizontal carousels.

### Distinct commercial intents — strong reference

The source exposes separate CTA intents such as presentation, viewing, plans (including room-count context), promotions, installment, mortgage approval, questions and chat/callback. A common modal shell is used without forcing every CTA to have the same copy or context. Plan CTA passes the selected room count into the request context.

This is the correct reusable pattern for KEY: shared modal infrastructure, distinct intent-specific offer, fields, copy, context and analytics.

### Apartment selection and quiz — strong reference

- Apartment types are selectable and the plan view has an associated visual area.
- A quiz is presented as a short, multi-step decision flow rather than a generic lead form.
- The source contains stateful question navigation, answer selection and result-oriented next steps.
- The lightbox includes a visualization disclosure for assets marked as visualizations.

These are patterns to generalize, but the exact K15 question wording, apartment data, plan UI and visual assets must not leak into another project's passport.

### Lead delivery honesty — good foundation, needs deployment proof

The source checks name, phone and consent, includes a honeypot, records CTA source and contextual data, and has an explicit timeout/failure path. When the endpoint is empty in non-development mode, it logs that the lead was not sent and returns failure rather than showing a success state.

Important caveat: the development branch deliberately logs the lead and returns success to support local development. This must remain clearly isolated from preview and production builds. Production acceptance requires verifying the actual configured endpoint and the complete data path, not just reading the function.

### Analytics — useful initial event vocabulary

A common goal helper routes events to configured Yandex Metrika, VK pixel and dataLayer, and the page captures a range of intent and interaction events. KLanding should preserve this as an adapter pattern while introducing a stable, documented event schema and consent-aware loading.

## 3. Product-standard gaps

| Area | Source evidence | Gap / required action | Priority |
|---|---|---|---|
| Reusable generation engine | Single K15 HTML file with inline CSS/JS and K15-specific CONFIG/data | Extract project-neutral renderer, component contracts, tokens and adapters. Keep content/data separate from presentation. | P0 |
| Dynamic composition | Fixed 17-section order in source | Composition must be chosen from strategy, evidence and segment; support omit/reorder/variant rules and explain decisions internally without exposing rationale to visitors. | P0 |
| Project isolation | K15-specific names, copy, room data, imagery and config references are embedded in source | Add automated leakage tests: a synthetic second ЖК must not render K15 names, facts, IDs, assets, prices, location or CTAs. | P0 |
| Evidence and claims | Some dynamic fields are guarded by `missing(...)`; source also contains direct copy and numeric claims | Every published claim needs passport fact ID, source, checked date, status and expiry rules. Audit all direct copy, counts, distances, dates, prices and financing claims. | P0 |
| Lead delivery | `sendLead` supports endpoint, timeout and failure path; DEV branch returns success for local development | Add environment guard that prevents DEV simulation in any public build. Test success, HTTP failure, timeout, network failure, duplicate submission, retry and payload context against a controlled endpoint. | P0 before production |
| Offer readiness | Multiple CTA labels and modal scenarios exist | Each offer needs a verified deliverable, owner, delivery method, required fields, consent text and next-step SLA. Do not promise a gift/presentation until the asset and delivery path are real. | P0 |
| Marketing strategy | Some hero text changes from UTM/query intent; section composition remains hard-coded | Strategy must be a structured input: segment, motive, objection, hook, proof, offer, funnel and ad-to-landing match. UTM personalization must only select approved variants. | P1 |
| Apartment plans | Interactive apartment selector and plan view exist | Move apartment records and assets into passport with evidence, expiry, rights, public-use status and inventory freshness. Distinguish illustrative plan from available inventory. | P1 |
| Mortgage/finance | Mortgage and installment sections and modal intents exist | Rebuild as transparent calculator module only when verified rates, assumptions and update dates exist. Show estimates and disclaimers; no unsupported “best terms” claims. | P1 |
| Media and rights | Source uses slot/image helpers, image names, generated/visualization markers and a lightbox | Create an asset manifest with project match, rights, source, role, alt text, type and visualization disclosure. Verify every referenced file and fallback. | P1 |
| Responsive QA | Multiple breakpoints and reduced-motion rule in source | Browser matrix must test actual K15 and generated preview at phone/tablet/desktop widths, modal, menu, carousel, quiz, plan selector, keyboard and safe areas. Width-only checks are insufficient. | P1 |
| Accessibility | Focus-visible, labels/ARIA and native dialogs are present in parts | Audit keyboard focus order, dialog focus trap/return, labels, error announcements, contrast, touch target size and screen-reader naming. | P1 |
| Performance | Hero image preload, lazy/media hydration helpers and CSS transitions exist | Measure real image payloads, LCP/CLS/INP on mobile throttling; confirm deferred media and no layout shifts. | P1 |
| Navigation and links | 40 anchors found | Crawl every anchor and CTA, validate destinations and in-page targets; check telephone/chat links, privacy link and map attribution. | P1 |
| Privacy and consent | Consent checkbox and configurable privacy URL exist | Verify final privacy document, consent wording/version, storage/transport of consent, retention and third-party analytics behavior with legal review. | P0 before real traffic |
| Analytics and learning | Goal helper and UTM-derived hero variant exist | Formalize event names, deduplication, campaign/creative/segment/offer/page version IDs, test-vs-real flag and downstream qualification/sale feedback. | P1 |
| Visual acceptance | CSS source suggests deliberate design | Human visual review is still needed for real assets, image crops, typography, blank spaces, overlap and all key viewport screenshots. | P0 for gold-standard approval |

## 4. Critical checks before calling K15 an approved gold standard

1. **Resolve every factual claim.** Build a claim inventory from visible copy and runtime-generated text, then match each item to the current passport and primary evidence. Pay special attention to apartment count, prices, delivery dates, installment/mortgage terms, distances and availability.
2. **Verify all media.** Build a manifest from every `data-img`, `data-kind`, CSS background and runtime asset reference. Check that each file loads, belongs to K15, has usage rights and has the correct visualization label.
3. **Run the complete CTA matrix.** For every CTA intent, verify the modal copy, context, required fields, consent, payload, analytics event, endpoint result and error/retry behavior.
4. **Test real viewport behavior.** Include iPhone/Android-sized widths, tablet and desktop; open menu, modal, quiz, plan selector, carousel and keyboard. Verify the keyboard does not hide the submit control.
5. **Test deployment configuration.** Confirm endpoint, privacy URL, callback SLA, phone/chat details, analytics IDs, CSP and production/dev mode separation.
6. **Perform visual review.** Inspect screenshots rather than inferring visual quality from CSS. Include loading, missing-media and reduced-motion states.

## 5. What should be extracted into KLanding

### Universal engine

- Design tokens and responsive layout primitives.
- Section registry with schema, readiness requirements, supported variants and renderer mapping.
- Shared modal/dialog shell with intent-specific content.
- CTA contract: intent, offer, source section, page version, context, required fields, expected analytics event and delivery state.
- Lead form component with validation, consent, honeypot/rate-limit integration, pending/success/error/retry states and no false success.
- Gallery/carousel/lightbox, plan selector, quiz stepper, FAQ and calculator primitives.
- Analytics adapter and campaign attribution contract.
- Asset registry and evidence/expiry/rights gate.
- Browser and accessibility QA suite.

### K15-specific data and art direction

- Project name, positioning, claims, local context, imagery, visualizations, apartment inventory and plan assets.
- Its own section order and inclusion rationale.
- Its own segment-specific quiz, offers and CTA labels.
- Its palette, typography, image treatment and component variants where these are genuinely tied to K15's identity.

### Must not be copied to another ЖК by default

- K15 claims, apartment count, price, delivery date, installment conditions, distances and infrastructure.
- K15 images, plans, renders, names, copy and CTA context.
- K15's exact 17-section sequence or its quiz questions.
- K15-specific assumptions hidden in scripts or configuration.

## 6. Proposed acceptance gates

- **Gate A — source integrity:** schema, claim IDs, asset IDs, project isolation, renderer contract and no unsupported module.
- **Gate B — generated page:** every selected module renders; every CTA has a valid scenario; no internal research rationale or private source notes are visitor-facing.
- **Gate C — interaction:** quiz, plan selector, gallery, modal, form validation and error/retry behavior pass browser tests.
- **Gate D — responsive/accessibility:** viewport matrix, keyboard, touch, reduced motion, focus, dialog and screen-reader checks pass.
- **Gate E — production delivery:** real controlled endpoint, consent, CRM mapping, analytics and downstream lead status are verified end to end.
- **Gate F — visual/product approval:** human review confirms the page is individually art-directed, factually grounded, coherent and commercially useful.

Passing CI is not equivalent to passing Gates E or F.

## Final assessment

K15 is a useful **reference implementation and pattern source**, not yet the universal KEY product itself and not yet an independently verified production gold standard. The next work should focus on extracting and testing the universal engine, not adding more decorative sections. The first transfer test should be a second, clearly synthetic ЖК passport with a materially different strategy and section composition; it must render without K15 leakage.
