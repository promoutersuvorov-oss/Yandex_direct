# K15 runtime contract → KLanding canonical model

**Дата:** 2026-11-05  
**Статус:** migration specification, derived from the imported K15 HTML baseline. K15 source is intentionally unchanged.

## 1. Scope and source of truth

Source: `landing/reference/K15_landing_edited.html` (2,498 lines; SHA `392f27352188edf851f7f436d887bae117d10413`).

This document records the actual legacy runtime contract that must be considered before implementing a K15 adapter. It is not permission to publish K15 data or reuse its endpoint, identifiers, copy, claims, assets, legal URLs or contact details for another project.

The canonical destination remains `schemas/project-passport.schema.json` plus the separately versioned runtime/marketing/lead/analytics contracts to be designed. Do not add duplicate passport fields merely to mirror K15.

## 2. Runtime config mapping

| K15 source | Meaning / observed use | KLanding destination | Migration rule |
|---|---|---|---|
| `CONFIG.phone` | Sales phone; rendered as tel links and used in error fallback | `project.contacts` / lead adapter settings | Normalize E.164; validate ownership and project scope |
| `CONFIG.address` | Display address | `project.location.address` | Keep distinct from coordinates; verify current source |
| `CONFIG.mapLat`, `mapLon` | Project coordinates | `project.location.coordinates` | Validate numeric ranges and source evidence |
| `CONFIG.mapCity2gis` | Provider-specific city slug | runtime map provider config | Provider-specific, not passport fact |
| `CONFIG.legal` | Footer legal line | runtime legal/footer content | Never copy K15 literal into another project |
| `CONFIG.privacyUrl` | Consent link | legal/compliance config | Require legal review for the actual data controller and form |
| `CONFIG.endpoint` | Google Apps Script lead/bot-click receiver | integration secret/reference, server-side only | Never expose production secrets in public passport; browser should call controlled server endpoint |
| `CONFIG.metrikaId`, `vkPixelId` | Analytics provider identifiers | analytics provider adapter | Configure per project/deployment; empty means not configured |
| `CONFIG.bots.telegram/max/vk` | Messenger bot URLs | channel integration config | Validate deep-link syntax and project/offer routing |
| `CONFIG.formats` | Per-room price labels | dated commercial inventory/offer data | Never use as static fact; require source + freshness |
| `CONFIG.presentationUrl/Meta` | Presentation file and label | approved assets / lead magnet offer | Asset rights, availability and actual delivery must pass |
| `CONFIG.checklistUrl/Meta` | Checklist file and label | approved assets / lead magnet offer | Verify file exists; no broken download promise |
| `CONFIG.workSchedule`, `workHours` | Live/opening status and copy | contact operations data | Time zone and days explicit; do not imply SLA |
| `CONFIG.mapTiles`, `mapTileUrl` | External map tile behavior | renderer provider configuration | Provider policy/capacity and attribution check before paid traffic |
| `CONFIG.callbackSla` | Response-time promise | offer/service-level claim with evidence | Publish only when operationally guaranteed |
| `CONFIG.company.*` | Developer legal identity, documents, office, ad mark | verified developer entity + legal links | Every document link and legal ID must be current |
| `CONFIG.showSlotLabels`, `imgPath` | Debug/media rendering controls | renderer/dev config | Never public marketing facts |
| `CONFIG.social.*` | Social links | project contacts/channels | Reject `#` and placeholder URLs |
| `CONFIG.vars.PRICE_FROM`, `PAYMENT_FROM`, `PAYMENT_NOTE` | Price and illustrative payment copy | dated commercial data / mortgage assumptions | Require source, timestamp, assumptions and explicit illustrative disclaimer |
| `CONFIG.vars.DELIVERY_DATE` | Delivery date | dated project fact | Require primary source and current status |
| `CONFIG.vars.INSTALLMENT_PCT` | Installment down-payment figure | dated commercial offer | Verify eligibility, period and conditions |
| `CONFIG.vars.PARKING_TERMS` | Parking terms | verified offer/fact | Do not infer guaranteed space from parking existence |
| `CONFIG.vars.APT_TYPE`, `APT_AREA` | Featured apartment type/area | apartmentPlans / inventory record | Bind to exact plan asset and current inventory |

### Content/config collections

| K15 collection | KLanding mapping | Required treatment |
|---|---|---|
| `HERO` | hero module assets + art direction | Keep image identity, rights, alt/caption, crop metadata separate |
| `GALLERY` | gallery assets | Preserve order, caption and asset provenance |
| `SECURITY` | facts + advantages + composition modules | Atomize each claim; no generic safety guarantees |
| `PLACES` | infrastructure records | Preserve coordinates, travel mode, distance method and source/date |
| `WALK`, `distM`, `fmtDist` | derived distance metadata | Preserve method and assumptions; do not call straight-line estimate a route |
| `LIFE` | lifestyle/experience content + assets | Separate fact from interpretation and imagery |
| `ROOMS` | apartment interior/media collection | Do not confuse interior imagery with a technical floor plan |
| `V` in plan viewer | plan variants | Bind both views to one verified plan record and correct labels |
| `QUIZ` | `selectionQuiz` | Preserve question keys, finite options, answer state and result offer |
| `MODALS` | CTA/offer scenario catalog | Normalize scenario IDs; do not treat every configured key as an active offer |
| `OFFER_CODE` | channel routing / offer mapping | Preserve routing semantics and test each deep link |
| `BOT_CH` | messenger adapter behavior | Keep channel-specific URL builder out of passport |
| `MOODS`, `art()`, `slot()` | visual primitives / media fallback | Reuse only after visual QA; generated placeholders must never masquerade as real project imagery |
| `EMBEDDED`, `EXTERNAL` | asset resolution | Import only real files with provenance/rights; external fallback requires explicit approval |

## 3. Lead form contract observed in K15

The form factory `leadForm(source, btn, extra, opts)` creates:
- `uname` — name;
- `uphone` — phone;
- optional `utime` — callback time preference;
- `ucontact` — call / Telegram / MAX;
- `uweb` — honeypot;
- `uconsent` — consent checkbox;
- `data-source` — CTA scenario;
- optional `data-extra` — contextual data (for example room count or quiz answers).

Observed payload for a lead:
- `type: "lead"`, `cid`, `lead_id`;
- `name`, `phone`, `contact`, optional `call_time`;
- `source`, `page`, `ts`;
- attribution spread from `ATTR`;
- `ym_uid`, `device`, `time_on_page_s`;
- scenario-specific `extra` (e.g. `rooms` or `answers`).

Observed safeguards:
- name and phone validation;
- explicit consent checkbox;
- honeypot;
- submit disabled during request;
- 12-second abort timeout;
- transport failure restores submit and displays an error;
- success UI appears only when `sendLead` returns true;
- missing endpoint in production returns false rather than success.

### Canonical lead contract to implement

Use a versioned payload with explicit fields (no arbitrary spread):
- `schemaVersion`, `eventId`, `leadId`, `projectId`;
- `createdAt`, `pageUrl`, `referrer`, `deviceClass`;
- `contact.name`, `contact.phone`, `contact.preferredChannel`, optional `contact.preferredTime`;
- `consent.policyVersion`, `consent.acceptedAt`, `consent.policyUrl`;
- `conversion.scenarioId`, `conversion.offerId`, `conversion.moduleId`, `conversion.entityContext`;
- `qualification.answers` (validated against the active quiz schema);
- `attribution.firstTouch`, `attribution.lastTouch`, `attribution.clickIds`;
- `analytics.sessionId`, optional provider identifiers only when policy permits.

Never include undefined fields, arbitrary browser storage, or internal commercial data. Validate server-side. Treat honeypot submissions as spam signals; do not render a user-facing success state for a real visitor.

## 4. Attribution and analytics migration

K15 captures query keys:
`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `yclid`, `ysclid`, `gclid`, `erid`, `rb_clickid`; it also records referrer, `_ym_uid`, page URL, timestamp, device class and time on page.

Observed analytics events include:
- `modal_open`, `form_start`, `lead_error`, `lead`, `lead_<group>`;
- `quiz_step_<n>`, `quiz_done`;
- `bot_click`, `bot_<channel>`, `chat_open`;
- `click_phone`, `click_route`, `click_2gis`, `click_gmaps`, `open_about`;
- `view_<sectionId>`, `scroll_25/50/75/100`, `stay_30s`;
- `download_presentation`, `download_checklist` via data-goal hooks.

**Detected legacy attribution defect:** the comment says first-touch, but `const a = Object.keys(o).length ? o : prev` replaces stored attribution whenever a later page view contains new campaign parameters. This is not stable first-touch attribution. The new adapter must retain first-touch and last-touch separately and test a two-campaign multi-page journey.

Analytics must use a canonical event dictionary with stable IDs and parameters. Provider adapters (Yandex Metrika, VK, dataLayer) are optional sinks, not the source of truth. A click event is not a delivered lead; a client-side fetch attempt is not proof that a bot click was accepted.

## 5. CTA scenario migration

K15 contains a `MODALS` catalog and `OFFER_CODE` mapping. The observed routing includes:
`presentation`, `plans`, `prices`, `promotions`, `mortgageApproval`, `installment`, `terms`, `viewing`, `ask`, `request`, `newbuildings`, `parking`, `quiz`, `final`.

Special behavior:
- `plans` can specialize by `data-rooms` and append `rooms` to the lead context;
- quiz completion opens a lead form with serialized answers;
- presentation success can expose actual presentation/checklist downloads;
- bot deep links encode offer + session/client token;
- CTA scenario is also used for analytics grouping and follow-up copy.

Migration rules:
1. Normalize IDs and store them in one offer/scenario registry.
2. Each CTA must declare required fields, allowed context keys, destination, consent and delivery behavior.
3. Keep module CTA links valid after composition; no CTA may point to a removed module.
4. Do not expose K15-specific room availability or promises on another ЖК.
5. Bot delivery must be tested as a separate integration, not inferred from link generation.

## 6. High-risk legacy issues to resolve before reuse

| Issue | Evidence in source/audits | Action |
|---|---|---|
| First-touch attribution overwritten by later UTM | `ATTR` assignment described above | Implement first + last touch; add journey test |
| Public Apps Script endpoint embedded in client code | `CONFIG.endpoint` | Move behind controlled server/proxy; rotate if exposed beyond intended use |
| Consent policy points to developer privacy page | `CONFIG.privacyUrl` comment requests legal validation | Confirm data controller, purposes, retention and consent text |
| Callback SLA "5 минут" | `CONFIG.callbackSla` | Do not publish until operationally proven |
| K15 commercial facts/placeholders | `PRICE_FROM`, `PAYMENT_FROM`, `DELIVERY_DATE`, `PARKING_TERMS` | Block public use until verified and current |
| Media bundle unavailable in current repository | import inventory | Restore exact archive/assets; do not substitute generated stand-ins |
| OSM public tile endpoint | `CONFIG.mapTileUrl` | Use approved provider or static fallback and verify policy/capacity |
| Social links contain `#` placeholders | `CONFIG.social` | Hide until real links supplied |
| Bot links empty | `CONFIG.bots` | Do not display non-functional messenger CTAs |
| Presentation URL empty; checklist path may not exist | config + static audit warning | Check files and delivery path before promise |
| Legacy map uses hand-authored distances and fallback formula | `PLACES`, `WALK` | Keep method, source, mode and date per place; re-verify all distances |
| Claims conflict across K15 archive/checklist versions | K15 product audit | Evidence-led conflict resolution; never choose convenient number |

## 7. Regression scenarios required before replacing K15 runtime

1. Every active CTA opens the correct scenario and has correct title, copy and required fields.
2. Room-specific plans CTA transmits exact `rooms` context.
3. Quiz restores valid progress, validates all answers and transmits complete answer map.
4. Consent is mandatory; policy URL and version are present.
5. Honeypot does not create a real lead.
6. Network error, HTTP error and timeout never show success; retry is possible.
7. Server-confirmed success shows correct next step and only links to available files.
8. First-touch attribution survives later campaign visits; last-touch updates independently.
9. UTM/click IDs, referrer, device, session/client ID and CTA scenario are correctly associated.
10. Analytics distinguishes CTA open, form start, validation failure, transport failure, confirmed delivery and messenger handoff.
11. Modal close/Escape/backdrop/focus restoration work on keyboard and touch.
12. Gallery, carousel, plan viewer and lightbox work on narrow viewport and touch.
13. All map links and external providers are valid and compliant.
14. No K15 name, facts, image, price, offer, legal link, endpoint or contact leaks into a second project's output.

## 8. Exit criteria for adapter work

- A field-by-field migration map is implemented as a tested adapter, not a hand-maintained copy.
- Adapter output validates against the canonical schema.
- Unsupported/ambiguous legacy fields are reported, never silently coerced.
- No secret or K15-specific value is copied into another project.
- The above regression scenarios pass on Chromium, Firefox and WebKit.
- Production readiness remains false until actual CRM delivery, legal consent, analytics and device QA are verified.


### Implemented canonical attribution utility

The first implementation lives in `src/attribution.mjs` and is intentionally provider-neutral:
- `readAttribution(search)` accepts only an explicit allowlist of UTM and click-ID keys, trims values, rejects control characters, and caps each value at 256 characters.
- `mergeAttribution(previous, current)` preserves the original first touch while updating last touch only when a new campaign/click identifier is present.
- `createAttributionState(search, previous)` is the entry point for a page-view journey.
- `attributionToPayload(state)` maps the state to separate `first_touch` and `last_touch` payload fields.

The module currently covers K15's known UTM/click identifiers plus common Yandex, Google, VK and Meta click IDs. It does not read contact fields, infer identity, or itself persist data to browser storage. Persistence policy and consent remain the responsibility of the eventual runtime adapter. The unit suite is `tests/attribution.test.mjs`, run by the source-integrity workflow.

**Integration status:** utility and tests are in the repository; the preview renderer and K15 baseline do not yet submit this state to a live CRM endpoint. Production wiring must happen in the canonical lead runtime, with server-side validation and consent-aware persistence.


## 7. Versioned CTA context contract (review-preview milestone)

The shared browser-side context envelope is `key-cta-context/2.0`. It is a local review representation, not a production lead payload and not permission to transmit personal data.

```json
{
  "schemaVersion": "key-cta-context/2.0",
  "state": "preview_only",
  "projectId": "project-id",
  "conversion": {
    "scenarioId": "stable-scenario-id",
    "offerId": "offer-id",
    "moduleId": "floor-plans",
    "entityContext": {
      "plan": { "id": "plan-id", "rooms": 2, "areaSqm": 54.2, "assetId": "plan-asset-id" },
      "quizAnswers": [{ "questionId": "rooms", "optionId": "two" }]
    }
  },
  "requirements": {
    "requiredFields": ["name", "phone"],
    "consentRequired": true
  },
  "delivery": { "status": "disabled_in_preview", "accepted": false }
}
```

Rules:
- `scenarioId` is stable and distinct from the offer's storage ID; for legacy offers without it, the builder uses `offer.id` as a compatibility fallback.
- `moduleId` identifies the actual rendered module; plan and quiz context is nested under `entityContext`, never spread into arbitrary top-level fields.
- The public offer allowlist includes only `scenarioId`, `id`, `title`, `type`, `description`, `requiredFields`, and `consentRequired`.
- Consent is required by default. This preview only declares the requirement; it does not collect consent or contact data and cannot be used as a production form.
- `delivery.status=disabled_in_preview` and `accepted=false` are mandatory. A UI completion or local payload preview must never be presented as lead delivery success.
- A future server adapter must validate the same contract, enforce the active scenario/offer registry, validate entity context against current passport/inventory, apply consent policy version and timestamp, and only then return an authoritative delivery result.
- Production transport, retries, server validation, PII collection, consent policy and CRM/webhook remain out of scope until endpoint ownership and legal requirements are approved.
