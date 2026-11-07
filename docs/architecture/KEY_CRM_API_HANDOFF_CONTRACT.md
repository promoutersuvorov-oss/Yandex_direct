# KEY ↔ CRM lead intake contract

**Status:** proposed integration contract; CRM backend exists, but its API is not available yet. This document does not claim that a CRM endpoint exists or that production delivery is active.

**Scope:** stable boundary between KEY landing runtime and the future KEY CRM intake API. The current payload implementation is the source of truth for fields already emitted by the landing runtime: `src/lead-payload.mjs`.

## 1. Integration boundary

Recommended flow:

`KEY landing (browser) → trusted KEY intake endpoint → private CRM backend / lead service`

The browser must never contain a private CRM credential, database credential, or internal service token. If the CRM backend later exposes only a private API, KEY must add/use a server-side relay rather than calling that API directly from a static landing.

The public intake endpoint is responsible for request validation, abuse protection, consent evidence handling, idempotency, and forwarding to the CRM. The CRM remains the system of record.

## 2. Proposed HTTP interface

The following is a proposal, not an existing route:

- Method: `POST`
- Proposed path: `/api/v1/leads`
- Content type: `application/json`
- Idempotency header: `Idempotency-Key: <eventId>`
- Payload version: `schemaVersion: "1.0.0"`

The final host, route, authentication model, and deployment location must be agreed with the CRM backend owner before configuration. Do not put secrets into `project.config.js`, generated landing files, or browser JavaScript.

## 3. Request body

The canonical request is produced by `createLeadPayload()` in `src/lead-payload.mjs`. Current top-level fields:

| Field | Meaning |
|---|---|
| `schemaVersion` | Version of the payload contract (`1.0.0`) |
| `eventId` | Stable identifier for this delivery event; idempotency key |
| `leadId` | Stable identifier for the lead across retries |
| `projectId` | Canonical ЖК/project identifier |
| `createdAt` | Client event creation time in ISO 8601 |
| `pageUrl`, `referrer` | Landing page and referrer URLs |
| `deviceClass` | `mobile`, `tablet`, `desktop`, or `unknown` |
| `contact` | Name, phone, preferred channel and optional preferred time |
| `consent` | Policy URL, policy version and acceptance timestamp; acceptance is required before payload creation |
| `conversion` | Scenario, offer, module, CTA, hook, funnel, segment and typed entity context |
| `qualification` | Validated quiz answers, when present |
| `attribution` | First-touch and last-touch attribution, when present |
| `analytics` | Session identifier, when present |

### Field-level details verified against the current payload builder

**`contact`**
- Required: `name` (string, max 100), `phone` (string, 7–15 digits after removing formatting).
- Optional: `preferredChannel` (`phone`, `telegram`, `max`, `whatsapp`, `email`; defaults to `phone`), `preferredTime` (string, max 80).
- The landing renders the channel and preferred-time controls only when the active offer explicitly lists `preferredChannel` or `preferredTime` in `requiredFields`. Name and phone remain required for every current lead scenario; the builder always carries those baseline requirements into the public offer profile.

**`consent`**
- Required input acceptance is `accepted: true`; the serialized payload carries `policyVersion`, `acceptedAt` (ISO 8601) and `policyUrl` (HTTP/HTTPS URL). The boolean is validated but is not repeated in the serialized object.

**`conversion`**
- Required: `scenarioId`.
- Optional stable IDs: `offerId`, `moduleId`, `ctaId`, `hookId`, `funnelId`, `segmentId`.
- Optional `entityContext` accepts only these keys: `rooms` (integer 0–10), `planId` (string), `plan` (id, rooms, areaSqm, assetId; optional floor and finishing), `mortgage` (price, downPayment, ratePercent, termYears, estimatedMonthlyPayment), `quizAnswers`, `requestedInfo`, `preferredViewing`. Unknown keys are rejected. Mortgage values are validated as finite numbers and basic ranges, not independently verified against lender offers.

**`qualification.answers`**
- Optional object with at most 20 answer keys. Keys must match the answer-ID pattern. Values are short strings (max 160) or arrays of up to 10 strings (each max 80).

**`attribution`**
- Serialized as `first_touch` and `last_touch` objects. Each may contain only captured attribution parameters: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `yclid`, `ysclid`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `vk_click_id`, `rb_clickid`, `erid`. Values are strings capped at 256 characters.

**`analytics`**
- Optional `sessionId` only. This is payload context, not proof that an external analytics receiver is configured or enabled.

The payload builder deliberately drops arbitrary browser fields and validates typed apartment-plan, mortgage and quiz context. Do not silently rename fields or reinterpret identifiers when implementing the CRM adapter. Contract changes require a schema version decision and tests.

## 4. Successful acknowledgement

The endpoint must return a 2xx response with JSON confirming durable acceptance, for example:

```json
{
  "accepted": true,
  "leadId": "lead_example",
  "eventId": "evt_example",
  "receivedAt": "2026-11-06T15:00:00.000Z"
}
```

The example identifiers and timestamp are illustrative only. `accepted: true` means the intake service has durably recorded the request or durably queued it for CRM processing; it must not mean merely that the HTTP handler started.

The current landing runtime accepts `accepted: true`, `success: true`, or `status: "accepted"` for backward compatibility. For the new CRM API, standardize on `accepted: true`.

A 2xx response without a recognized JSON acknowledgement is not success. The landing must not show a success message in that case.

## 5. Idempotency and retries

1. The same `eventId` is sent in both the `Idempotency-Key` header and request body.
2. A retry after timeout or network failure must reuse the same `eventId` and `leadId`; it must not create a new lead identity.
3. The intake service must persist the idempotency result and prevent duplicate lead creation.
4. Replaying the same key with the same logical request returns the original accepted result (2xx + `accepted: true`).
5. Reusing a key with a materially different request must be rejected as an idempotency conflict and logged for investigation.
6. Client-side stable IDs alone do not prevent duplicates. Deduplication must be enforced server-side.

## 6. Error behaviour

Use non-2xx responses for rejected requests and return a machine-readable error body without exposing internal stack traces or secrets. Suggested categories:

- `400` / `422`: invalid payload, unsupported schema version, or missing required data;
- `401` / `403`: rejected authentication or authorization, if applicable to the chosen public-intake design;
- `409`: idempotency key reused with a different request;
- `429`: rate limit / abuse protection;
- `5xx`: temporary intake or downstream failure.

A duplicate replay of an already accepted request is not a new rejection: return the original accepted acknowledgement. The landing retains the form data after a failed delivery and allows retry.

## 7. Security and privacy requirements

- HTTPS only.
- No private CRM credentials in browser code or public configuration.
- Server-side schema validation; do not trust client-side validation.
- Rate limiting and anti-spam controls at the public intake boundary.
- Verify consent evidence against the configured policy version and URL; retain only what the approved privacy policy permits.
- Define retention, access control, audit logging, and deletion handling before production.
- Avoid logging raw phone numbers, names, consent payloads, or full request bodies in routine application logs.
- Restrict CORS to intended landing origins where applicable; CORS is not authentication.
- Do not treat client timestamps, attribution, or qualification answers as trusted authorization data.

## 8. Acceptance checklist before enabling production

- [ ] CRM/API owner confirms route, host, auth boundary, and supported schema version.
- [ ] OpenAPI document or equivalent request/response examples are available.
- [ ] API validates all required fields server-side.
- [ ] Durable acceptance semantics are documented.
- [ ] Server-side idempotency is tested for first delivery, same-key replay, and conflicting replay.
- [ ] Rate limiting and abuse protection are enabled.
- [ ] Consent, retention, access, and deletion requirements are approved.
- [ ] Staging end-to-end test proves the lead appears in the CRM with project, CTA, attribution, and qualification context.
- [ ] Failure, timeout, retry, and duplicate scenarios are tested.
- [ ] Production endpoint is configured only after the above checks pass.

## 9. Current implementation status

- The landing runtime has a versioned payload builder and client-side validation.
- The runtime sends to a configured HTTPS endpoint and requires an explicit JSON acknowledgement.
- Retry preserves the pending `eventId` and `leadId`.
- Browser tests use a mocked/intercepted webhook; they do not prove delivery to the real CRM.
- CRM backend exists, but its API is not available yet.
- Production CRM integration is therefore **not connected**. Keep production delivery disabled until the real intake API is agreed and verified.
