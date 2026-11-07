# KEY behavioral feedback and advertising optimization architecture

**Status:** architecture contract / staged future integration. No production Yandex OAuth connection, Webvisor export, CRM event stream, or Direct optimization job is enabled by this document.

**Business outcome:** optimize for cost per qualified lead and downstream deal outcomes, not merely form submissions. The system must show which landing promise, audience segment, CTA, and traffic source produce qualified opportunities.

## 1. Product loop

`Yandex Direct → landing → consent-aware behavior measurement → lead intake → KEY CRM → qualification / viewing / deal outcome → analytics → campaign decisions`

The loop has two separate evidence streams:

1. **Behavioral evidence:** page and section engagement, scroll depth, CTA visibility/clicks, offer opens, calculator/quiz use, form starts, validation errors and delivery outcomes.
2. **Commercial evidence:** lead accepted, qualified/not qualified, viewing booked/completed, deal won/lost and (when available) value/revenue.

The first explains what people do on the landing. The second tells KEY whether those actions create business value. Do not optimize campaigns on raw form count when CRM outcomes are available.

## 2. Architecture boundaries

- **Landing runtime:** emits a small, versioned, PII-minimized event envelope. It does not call Yandex APIs and contains no OAuth tokens or CRM secrets.
- **Consent gate:** analytics collection and non-essential identifiers are disabled until the applicable consent state is granted. Demo/review mode emits only local test events and never sends personal data.
- **KEY intake API:** validates and durably accepts lead payloads, preserves idempotency, stores attribution linkage separately from contact data, and emits server-side lead lifecycle events.
- **CRM:** system of record for qualification, contact attempts, appointments, outcomes and deal value. CRM status changes are authoritative; browser events cannot claim a lead is qualified or a deal is won.
- **Event store / warehouse:** joins allowed event data to CRM outcomes using internal opaque references. Access to the mapping from opaque reference to ClientID/yclid is restricted and separately retained.
- **Analytics adapters:** one adapter reads Yandex Metrika data; another exports approved offline conversions to Metrika / Direct. Adapters are server-side and independently retryable.
- **Optimization service:** produces recommendations and experiment reports first. Campaign changes remain human-approved until attribution quality, sample size and guardrails are demonstrated.

## 3. Yandex Metrika: what is and is not automated

The Metrika API supports management, reports, Logs API and data import. The Reports API provides aggregated visit/hit statistics; Logs API provides non-aggregated collected data for custom analysis. These are appropriate programmatic inputs for cohorts, funnels and segment comparisons.

**Do not design around an assumed API export of raw Webvisor session recordings.** Webvisor recordings are reviewed in the Metrika interface. KEY can use API reports/logs to identify cohorts and suspicious drop-off patterns, then prepare a filtered review queue for a human to inspect relevant Webvisor sessions in the authorized Metrika account. The recordings themselves are not copied into KEY or sent to an LLM by default.

Click maps, scroll maps and form analytics are enabled/configured in the Metrika counter and reviewed as behavioral evidence. They are not a substitute for event instrumentation with stable KEY CTA and scenario IDs. Use Metrika reports for aggregated patterns; use KEY events to identify which product component or message was interacted with.

**Practical workflow:**
1. Query Metrika by counter, project landing, date range, device, source/campaign and relevant goals.
2. Compare landing and cohort performance; identify unusual abandonment or high-intent sessions that did not convert.
3. Generate a review queue with visit date, permitted Metrika visit reference/link where available, cohort reason and question to investigate. No raw contact data.
4. An authorized analyst reviews selected Webvisor recordings and records structured observations (e.g. CTA overlooked, pricing confusion, form friction) with evidence strength and limitations.
5. Convert validated observations into a proposed landing/offer experiment. Do not let an AI infer a person's psychological state as fact from cursor movement or a single recording.

## 4. Canonical event model

The machine-readable contract is `schemas/behavioral-event.schema.json`. The event envelope is intentionally narrow:

- `eventId`, `eventName`, `occurredAt`, `projectId`, `landingVersion`, `source`;
- pseudonymous `sessionId`, `pagePath`, `deviceClass`, analytics consent state;
- allow-listed UTM attribution fields;
- stable context IDs: `scenarioId`, `offerId`, `moduleId`, `ctaId`, `hookId`, `funnelId`, `segmentId`, `intent`;
- a small set of typed behavioral or CRM outcome fields.

Supported event names cover landing view, section view, CTA impression/click, offer open, form start/validation/delivery, plan/calculator/quiz actions, and server-originated CRM qualification, viewing and deal outcomes.

**Never put** name, phone, email, message text, raw form values, full URL/query string, raw Webvisor recording, or unrestricted DOM text into behavioral events. Do not send raw ClientID or yclid into general-purpose analytics events. Where lawful and approved, store click/client identifiers in a restricted attribution-link table and refer to it using `attributionRef`.

## 5. Identity, attribution and consent

- First-touch and last-touch UTM data are useful attribution context but do not prove that a campaign caused a sale.
- Preserve yclid and Metrika ClientID only where the relevant consent, privacy notice, retention and access policy permit. Keep them in a restricted server-side linkage store, not in general event logs.
- The browser may obtain a Metrika ClientID only after the counter is available and applicable consent is granted; pass it to KEY intake only through an approved, documented field. Never invent an identifier when unavailable.
- Keep click/client identifiers linked to the lead with a stable internal attribution reference. CRM receives the reference and only the minimum approved identifiers needed for offline conversion matching.
- Enforce retention, deletion, access logging, role-based access and data-subject request handling across event store, CRM and export queues.
- Do not send PII to LLMs or use recordings for model training. AI summaries should use minimized observations and aggregate data.

## 6. Offline conversion feedback

The CRM lifecycle should map to a small set of stable conversion milestones, for example:

| CRM milestone | Analytics meaning | Optimization use |
|---|---|---|
| Lead accepted | Delivery succeeded | Operational monitoring, not final quality |
| Lead qualified | Meets agreed criteria | Primary quality signal |
| Viewing booked | Strong intent | Mid-funnel quality |
| Viewing completed | Sales engagement confirmed | Stronger quality signal |
| Deal won | Revenue outcome | Highest-value optimization |
| Lead disqualified / deal lost | Negative outcome with controlled reason code | Exclusion and quality analysis |

Export only approved milestones, with stable event/conversion IDs, event timestamps and permitted matching identifiers. Prefer Metrika ClientID where configured; yclid is useful for Direct-specific matching. Validate the current platform matching window and import format before enabling production. The Yandex documentation currently describes a 21-day matching window for yclid-based offline conversion uploads; treat this as a platform constraint to re-check during implementation.

Do not upload every raw CRM stage as an advertising goal. Start with one quality milestone (qualified lead) and one revenue milestone (deal won) after CRM data quality and sufficient event volume are established. Avoid double counting repeated status changes.

## 7. Metrics and decision rules

Primary business metric:

`Cost per qualified lead = advertising spend / unique qualified leads attributed to the campaign`

Secondary metrics:
- landing conversion rate: accepted unique leads / eligible landing sessions;
- qualification rate: qualified unique leads / accepted unique leads;
- cost per viewing booked and completed;
- cost per won deal and revenue/ROAS when reliable value data exists;
- CTA-level progression: impression → click → offer open → form start → accepted lead → qualified lead;
- segment/device/source breakdowns with minimum sample-size thresholds.

Every report must include date range, attribution model, denominator, deduplication rule, consent coverage, missing-ID rate and sample size. Mark results inconclusive when sample sizes are small or identifiers are missing. Compare cohorts rather than declaring causal lift from raw before/after changes.

## 8. AI responsibilities and human gates

AI may:
- summarize aggregate Metrika reports and structured Webvisor observations;
- cluster friction patterns and propose hypotheses;
- identify broken funnel steps and tracking gaps;
- suggest A/B tests for headline, proof, CTA, offer and form friction;
- rank experiments by expected impact, confidence, effort and risk;
- draft campaign adjustments and explain the supporting evidence.

AI must not:
- claim to read Webvisor recordings through an API unless a supported authorized interface is verified;
- infer sensitive traits or psychological states about named visitors;
- expose contact details in prompts, analytics or reports;
- automatically publish landing changes, change bids/budgets, or reconfigure campaigns without explicit human approval;
- optimize to unqualified form submissions when CRM quality outcomes are available.

## 9. Rollout in value order

1. **Instrument and verify:** stable event IDs and PII-free event contract; consent gate; QA dashboard for event loss and duplicates.
2. **Connect CRM outcomes:** server-side lifecycle events and deterministic deduplication; prove lead-to-CRM linkage.
3. **Read Metrika:** OAuth connection with least privilege; reports and Logs API; compare with KEY event counts and expose gaps.
4. **Human Webvisor review queue:** select cohorts from aggregated evidence; authorized analyst records structured observations.
5. **Offline conversions:** export qualified lead first, then deal outcomes; test matching, deduplication, attribution windows and reconciliation.
6. **Experiment loop:** run controlled landing/offer experiments and measure qualified-lead cost.
7. **Assisted optimization:** AI proposes changes with evidence; human approves and publishes.

Do not build a bespoke data warehouse or autonomous bidding agent before the first project proves that CRM outcomes can be matched to traffic reliably.

## 10. Definition of done for the first useful version

- Event schema is validated in CI and rejects contact fields, raw click IDs and query-string URLs.
- Demo mode emits no network events and no personal data.
- Production browser events are consent-gated and have stable CTA/scenario identifiers.
- CRM records accepted lead and lifecycle milestones with an opaque attribution reference.
- A reconciliation report shows counts and missing joins from landing session to accepted lead to qualified lead.
- Metrika API report import is read-only and reproducible for a fixed date range.
- Human Webvisor observations are linked to cohorts and experiments, not copied as raw recordings.
- Qualified-lead cost can be calculated by campaign and landing variant with explicit attribution and sample-size caveats.
- Offline conversion export is tested in a sandbox before production activation.

## 11. Verified platform references

- [Yandex Metrika API overview](https://yandex.ru/dev/metrika/ru/): API types include management, data import, reports and Logs API.
- [Metrika Reports API](https://www.yandex.ru/support/metrica/ru/uploading-data/api-reports): aggregated visit/hit reports.
- [Webvisor recordings](https://www.yandex.ru/support/metrica/ru/webvisor/view-record): recording review and segmentation in the Metrika interface.
- [Click map](https://www.yandex.com/support/metrica/ru/behavior/click-map): aggregated click behavior and counter requirements.
- [Offline conversions in Direct](https://yandex.ru/support/direct/ru/strategies/offline-conversions?lang=ru): CRM conversion import and supported identifiers.
- [Offline data in Metrika](https://yandex.ru/support/metrica/ru/data/offline-params): ClientID, UserID and yclid matching.
- [Yclid matching](https://www.yandex.ru/support/metrica/ru/data/yclid): matching conditions and 21-day window described in the current help.

This architecture is a target design, not evidence that the integrations are connected or that the resulting optimization has already improved campaign performance.
