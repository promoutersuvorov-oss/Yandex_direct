# Generator → Closed-Loop Growth Integration Readiness

**Snapshot date:** 2026-11-07  
**Scope:** static code review of the generator/runtime on the architecture branch. This is a readiness audit, not a claim that external analytics or CRM services are connected.

## Executive decision

The generator already has useful foundations: allow-listed first/last-touch attribution, typed lead payload construction, consent evidence in the lead request, stable lead/event IDs for retries, contextual CTA metadata, and a PII-free `key:conversion-intent` browser event.

It is **not yet measurement-ready** for the proposed closed loop. The most important missing seams are a shared versioned event envelope/adapter, explicit landing identity/version, a session ID attached to the lead payload, consent-aware analytics activation, and a trusted CRM outcome callback/outbox. Do not integrate Webvisor/heatmaps or Yandex conversion uploads into the browser runtime as a shortcut.

## Existing capabilities verified in source

| Capability | Current source | Finding |
|---|---|---|
| First/last-touch attribution | `src/attribution.mjs` | Captures an allow-list of UTM/click IDs; preserves first touch and updates last touch. |
| Lead payload validation | `src/lead-payload.mjs` | Versioned `1.0.0` payload; allow-lists fields; validates consent, contact, conversion context and URLs. |
| Lead/event identifiers | `landing/runtime/app.js` | Generates stable event/lead IDs for one pending submission and reuses them on retry. |
| Lead context | `landing/runtime/app.js` | Includes project, conversion scenario, offer, module, CTA, hook, funnel, segment, qualification and attribution context. |
| Consent evidence | `landing/runtime/app.js`, `src/lead-payload.mjs` | Explicit acceptance and policy version/URL/time are required for lead payload creation. This is not yet a general consent manager for analytics tags. |
| CTA intent event | `landing/runtime/app.js` | Emits PII-free `key:conversion-intent` CustomEvent for clicks on `[data-open-offer]`. |
| CRM intake boundary | `docs/architecture/KEY_CRM_API_HANDOFF_CONTRACT.md` | Proposed server-side intake contract; the document explicitly says the actual CRM API is not available and production delivery is not connected. |

## Missing or incomplete seams

| Gap | Why it matters | Minimal Phase 0 requirement |
|---|---|---|
| No shared event schema/envelope | Different modules could create incompatible events; no safe vendor adapter boundary. | Define versioned event types and required context; use one internal adapter interface. |
| No stable `landingId` / `landingVersion` in runtime/lead context | Cannot reliably compare page versions or connect outcomes to a published artifact. | Add stable IDs to generated manifest/config and include them in event/lead context additively. |
| Session attribution is stored, but no session ID is passed into the lead payload | Campaign touch can be preserved, but the lead cannot yet be reliably joined to a browser session. | Generate a pseudonymous session ID only under approved consent/config; pass it through the existing optional `analytics.sessionId` field. |
| No general consent-aware analytics gate | Lead-form consent does not automatically authorize analytics/replay tags. | Separate consent purposes and ensure vendor adapters stay disabled until policy/config allows them. |
| CTA intent is an isolated browser event, not a complete event pipeline | No durable event IDs, schema version, event delivery state or deduplication for behavioural events. | Route the existing intent event through the shared event adapter; keep lead acceptance server-authoritative. |
| No trusted CRM lifecycle callback/outbox | A submitted form is not a qualified lead, viewing or deal. | Keep CRM status mapping and authenticated server-side callbacks as post-generator work. |
| No conversion feedback adapter | No verified path from CRM outcomes to Yandex accepted/matched conversions. | Implement only after actual CRM statuses, identifiers, API requirements and test-account access are confirmed. |
| No experiment registry/exposure logging | Cannot attribute outcomes to controlled variants. | Preserve experiment/variant IDs in the event envelope; implement assignment only when experiments are scheduled. |

## Phase 0 work to do while finishing the generator

Do only the following, and only where it does not destabilize the production landing path:

1. Keep `projectId` canonical and add explicit `landingId` and immutable published `landingVersion` to the generated manifest/config.
2. Define a small, versioned, vendor-neutral event envelope with `eventId`, `eventType`, `occurredAt`, `projectId`, `landingId`, `landingVersion`, optional `sessionId`, module/CTA/offer IDs and consent-purpose context.
3. Introduce one no-op-by-default event adapter interface. Existing `key:conversion-intent` becomes an input to it; no direct Yandex SDK/API call is added to page modules.
4. Extend the lead payload additively with `landingId` and `landingVersion`; populate the existing optional `analytics.sessionId` only when a consent-approved session context exists.
5. Keep analytics/replay tags off by default. A lead-consent checkbox must not be reused as analytics consent.
6. Add contract tests for stable identity, event schema validation, no PII in behavioural events, consent-off behaviour and backward compatibility of the existing lead payload.

Do **not** build a queue, analytics dashboard, AI analyst, Yandex uploader, Webvisor scraper or experiment platform during Phase 0. Those require real endpoints, operational ownership and baseline data.

## Acceptance criteria before calling the generator measurement-ready

- A published landing has stable `projectId`, `landingId` and `landingVersion`.
- A CTA click produces a schema-valid, PII-free event through the shared adapter.
- No vendor analytics request occurs when the relevant consent purpose is absent/denied.
- A lead payload retains current fields and includes landing identity; optional session identity is present only when valid and permitted.
- A retry reuses the same lead/event IDs; behavioural event deduplication uses its own stable event ID.
- A browser analytics failure cannot block a lead submission or break page usability.
- Existing CRM API remains explicitly marked unconnected until a real intake endpoint and staging test exist.

## Recommended implementation order

1. Stabilize generator output and landing identity/version.
2. Add event envelope + no-op adapter + focused tests.
3. Add consent-purpose configuration and session identity behind a disabled-by-default gate.
4. Extend lead payload compatibly.
5. Only after generator completion, connect Metrica, CRM outcome callbacks and Yandex conversion feedback in separate integration changes.

## Business measurement

This readiness work is not itself a competitive advantage. It is justified only if it avoids a future generator rewrite and makes each published landing comparable. After the first live cohort, measure implementation time, event coverage, session-to-lead match rate, CRM outcome match rate, qualified-lead cost and experiment cycle time. If these metrics cannot be collected reliably, do not add more automation.
