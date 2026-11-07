# KEY Closed-Loop Growth & Conversion Intelligence Architecture

**Status:** target architecture; prepare contracts now, implement after the landing generator reaches a stable production baseline.  
**Purpose:** make campaigns improve from observed visitor behaviour and downstream CRM outcomes, not merely generate pages and buy traffic.

## 1. Product outcome

KEY optimizes for **qualified demand and completed business outcomes**, not raw form volume.

`Yandex Direct → KEY landing → consent-aware analytics → lead intake → KEY CRM outcomes → conversion feedback → controlled landing/ad experiments → next traffic cohort`

The loop is closed only when a landing session can be linked, where lawful and technically supported, to a lead and later to a verified CRM outcome. A click, scroll, calculator use or submitted form is not proof of purchase intent or a deal.

## 2. Architecture layers

| Layer | Responsibility | Authority |
|---|---|---|
| Acquisition | Campaign, ad, keyword, click IDs, spend | Yandex Direct |
| Landing runtime | Event capture, CTA/form context, page version | KEY landing |
| Web analytics | Sessions, behaviour, Webvisor/heatmaps where supported | Yandex Metrica |
| Lead intake | Validation, consent, idempotency, attribution snapshot | KEY intake service |
| CRM | Contact history, qualification, viewing, reservation, deal | KEY CRM |
| Conversion feedback | Approved offline/CRM outcome delivery | KEY server-side adapter/outbox |
| Intelligence | Funnel/cohort analysis and hypotheses | KEY analytics/AI workspace |
| Experiment control | Assignment, exposure, guardrails and decisions | KEY experiment registry |

Yandex products remain external. KEY's canonical event and lead contracts are the integration boundary. A landing must never contain private CRM or advertising credentials.

## 3. Identity and attribution

Keep identifiers distinct:
- `projectId`, `landingId`, `landingVersion`;
- `sessionId` and optional pseudonymous `visitorId`, only where justified and permitted;
- immutable `eventId` (also idempotency key) and stable `leadId`;
- `experimentId` and `variantId`;
- Yandex ClientID/click IDs only when available, permitted and documented by the destination contract.

Preserve first-touch and last-touch separately. Capture only allow-listed UTM/click identifiers and timestamps. Never overwrite first-touch, infer missing values or treat client-supplied attribution as trusted proof. Existing lead payload already has first/last-touch attribution and optional `analytics.sessionId`; extend additively and version it. See [CRM handoff contract](KEY_CRM_API_HANDOFF_CONTRACT.md).

## 4. Shared event contract

All modules emit through one versioned, vendor-neutral event adapter. No ad hoc vendor calls inside individual modules.

Minimum events:
- `landing_view`;
- `content_view` with module ID and visibility rule;
- `cta_view` / `cta_click` with CTA, module, intent and offer IDs;
- `interactive_start` / `interactive_complete`;
- `form_start` / `form_submit`;
- `lead_accepted` only after durable intake acknowledgement;
- `lead_delivery_failed` with safe error category;
- `crm_status_changed` from trusted CRM workflow;
- `experiment_exposure`;
- `consent_updated`.

Each event has schema version, event ID, timestamp, project/landing version, source and controlled IDs. Distinguish visibility, click, start, completion, submit attempt and durable acceptance. Deduplicate by event ID. Server-side acceptance is authoritative for lead events; browser events are not.

Do not send names, phone numbers, email, raw form answers, CRM notes or sensitive data to web analytics. Do not collect keystrokes, clipboard content, arbitrary DOM text or detailed cursor trails in KEY's own event stream. Vendor mappings live in adapters.

## 5. Behavioural analysis: evidence, not mind-reading

Metrica, Webvisor and heatmaps can help locate drop-off, confusing controls, scroll/return patterns, device friction and differences between traffic cohorts. They cannot establish why a person acted, financial qualification, purchase intent or causality.

Use session replay only after verifying vendor capability, account permissions, lawful basis/consent, masking and retention. Mask contact fields and sensitive controls; prefer aggregate reporting for routine analysis and targeted replay for diagnosis. Never make raw recordings a required input to every AI request.

AI findings must label **observed**, **hypothesis**, or **unknown**, identify the sample and date range, and state limitations. Correlation is not causation. A UX recommendation becomes a testable hypothesis, not an automatic production change.

## 6. CRM quality model

CRM is authoritative for lead quality. Map the real CRM enum/status model before implementation. A possible conceptual ladder is:

`new → attempted_contact → contacted → qualified / disqualified → consultation → viewing → reservation → deal / lost`

These are target concepts, not a claim that those exact statuses currently exist.

Every trusted transition should carry lead ID, timestamp, previous/new status, reason code where applicable and audit/source metadata. AI may summarize and recommend; it must not silently set qualification or deal outcomes. Human sales actions or approved CRM business rules establish those outcomes.

Use a quality ladder, not one opaque score: valid/reachable lead → contacted → qualified → viewing scheduled/completed → reservation → deal. Optimize first for a frequent, reliably recorded qualified-lead event; add deeper outcomes when volume, latency and match coverage are usable. Report event volume and match coverage alongside cost. A click on a calculator or download is not a qualified lead.

## 7. Conversion feedback to Yandex

A server-side outbox/adapter maps approved CRM outcomes to the currently supported Yandex Metrica/Direct conversion-feedback mechanism.

Before coding, verify current official API requirements, account access, upload windows, identifiers, attribution, consent basis, deduplication and diagnostics. ClientID and YCLID are candidate identifiers, not guaranteed available or valid for every destination. Do not assume a general-purpose API exports every Metrica session or that raw Webvisor sessions can be ingested as training data.

Requirements:
- only approved conversion events and allow-listed fields leave KEY;
- no raw contact data or CRM notes in uploads;
- persist immutable outbox record before delivery;
- idempotent retries and explicit states;
- record destination, payload version, attempt, response category and external receipt where available;
- reconcile sent, accepted, rejected and unmatched events;
- sending an HTTP request is not proof that Yandex accepted or matched it;
- secrets remain server-side.

## 8. AI intelligence and experiments

AI consumes minimized aggregates and approved CRM outcome summaries, not unrestricted personal data.

Each recommendation includes:
1. business question and metric;
2. evidence, cohort and date range;
3. sample size, data quality and match limitations;
4. explicitly labelled hypothesis;
5. intervention and target segment;
6. primary metric and guardrails;
7. experiment design, sample/duration rationale and stop rule;
8. outcome, including inconclusive results.

Useful analyses include campaign → qualified lead/viewing/deal cost; device → form failure; CTA/module → downstream quality; offer/scenario → contactability and fulfilment; landing version → qualified lead and viewing outcomes.

Do not optimize only CTR, scroll depth, raw leads or cheap conversions when downstream quality worsens. Use stable assignment and exposure logging, avoid overlapping experiments, keep a control where feasible, and do not declare winners from tiny samples or one lucky deal. Human approval is required before live budget, targeting, price, claim, offer or landing changes. Autonomous rollout is out of scope for the first release.

## 9. Privacy and governance

Before collection/replay, document controller/processor roles, purposes, lawful basis and consent requirements, vendor terms, masking, retention, access, deletion, audit and incident handling. Review cross-border processing/data residency where applicable. Respect consent withdrawal and minimize identifiers. Pseudonymous IDs remain personal data when linkable; hashing does not automatically anonymize. Privacy review is a release gate, not later cleanup.

Prevent personal data entering prompts, routine logs, screenshots or model datasets without a separately approved basis.

## 10. Integration seams to preserve in the generator now

The generator should expose stable, versioned interfaces without implementing the full stack yet:
- landing manifest: project/landing/version and stable module, CTA, form IDs;
- shared event adapter and vendor-neutral event schema;
- lead payload with landing/session/experiment context;
- consent configuration: policy version, purposes and vendor enablement;
- allow-listed first/last-touch attribution capture;
- server-side CRM intake/outbox boundary with idempotency and status callbacks;
- server-side conversion adapter for approved CRM outcomes;
- experiment registry, variant definitions, assignment and exposure records;
- minimized aggregate export for AI analysis.

Missing analytics must not break the landing. Lead delivery remains explicit. Do not inject vendor scripts into every page until consent and runtime configuration are ready.

## 11. Delivery phases and gates

### Phase 0 — generator foundation (current priority)
Finish and stabilize the generator. Preserve stable project, landing, module, CTA, form and lead IDs. Keep event, attribution and consent seams versioned/vendor-neutral. Forms and lead delivery must work without analytics. Do not build speculative optimization services.

**Exit:** production-quality landing can be generated, validated, published and submit a lead through the agreed intake boundary with traceable project/CTA/attribution context.

### Phase 1 — measurement-ready landings
Implement shared event adapter, event schema, consent-aware Metrica mapping and basic funnel events. Reconcile test sessions and establish baselines.

**Exit:** event delivery/deduplication reconcile; no contact data leaks into analytics.

### Phase 2 — CRM outcomes
Connect real CRM API under existing handoff contract; map actual statuses; preserve lead/session/attribution linkage; add conversion outbox.

**Exit:** test lead traced from landing to CRM outcome and approved conversion delivered/reconciled in destination test environment.

### Phase 3 — behavioural intelligence
Use aggregate funnel, heatmap and approved replay diagnostics. Generate evidence-linked UX hypotheses and compare cohorts against downstream quality. AI remains advisory.

**Exit:** findings reproducible from evidence and respect privacy/sample limits.

### Phase 4 — controlled optimization
Run pre-registered landing/campaign experiments. Evaluate qualified lead, viewing and deal costs with volume and match coverage. Adopt only commercially justified improvements.

**Exit:** repeated experiments show improvement against baseline without degrading lead quality, UX or compliance.

## 12. Competitive advantage and KPIs

This architecture is justified only by measurable operating advantage. Track:
- time and human hours from source pack to published landing;
- cost per landing and correction rate;
- event coverage and attribution match rate;
- visitor → lead → qualified → viewing → deal rates;
- cost per qualified lead, viewing and deal;
- contactability, fulfilment and disqualification reasons;
- experiment cycle time and share of recommendations validated;
- lift versus documented baseline, sample size and uncertainty.

Primary objective: **more qualified viewings and deals per unit of marketing spend and KEY operating time** — not more events, dashboards, tokens or architecture.

## 13. Related contracts

- [Customer Experience Architecture](CUSTOMER_EXPERIENCE_ARCHITECTURE.md) — journey, value exchange and funnel metrics.
- [KEY CRM API handoff contract](KEY_CRM_API_HANDOFF_CONTRACT.md) — lead payload, consent and idempotency.
- [Data Model Specification](DATA_MODEL_SPEC.md) — canonical project facts.
- [Commercial Snapshot Contract](COMMERCIAL_SNAPSHOT_CONTRACT.md) — freshness and publication gates.
- [Positioning Gate](POSITIONING_GATE.md) — evidence before positioning.
- [Landing Module Registry](KEY_LANDING_MODULE_REGISTRY_V1.md) — stable module identity.
