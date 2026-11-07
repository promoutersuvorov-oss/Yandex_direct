# KEY Lead Intake Contract v1

## Purpose

Define the minimum boundary between a landing-page interaction and a real KEY lead. This contract does not select a CRM, create a public endpoint, or transmit personal data. It is a pure validation/acknowledgement layer that can be tested with synthetic fixtures.

## Required path

1. A visitor selects a specific conversion scenario (for example, request project details, ask about a plan, arrange a viewing).
2. The UI explains the purpose and shows the applicable consent text.
3. The visitor supplies only the contact fields required for that scenario and explicitly grants consent.
4. The client creates a `key-lead/1.0` envelope with project, landing version, scenario, entity context, consent version/time and available UTM/Yandex click attribution.
5. A server-side adapter validates the envelope and forwards it to the KEY-approved destination. Secrets and endpoint credentials stay server-side.
6. The receiver must return HTTP 2xx plus `accepted: true` and a stable `receiptId`. Otherwise delivery remains unconfirmed; never show a success state.
7. Delivery retries must use the same lead ID/idempotency key to avoid duplicate leads. Do not log raw contact data or consent payloads.

## Delivery states

- `not_sent`: visitor has not submitted.
- `validation_error`: local or server validation failed.
- `sending`: request is in progress.
- `accepted`: explicit receiver acknowledgement and receipt ID received.
- `not_confirmed`: timeout, network error, non-2xx, malformed response or missing receipt ID.
- `retryable_failure`: server has classified the failure as transient; retry with the same idempotency key.

A browser-side HTTP response alone is not proof that a CRM record was created. The receiving integration owns the acknowledgement contract.

## Privacy and security

- No personal data in URLs, analytics events, browser storage, source control, fixtures or routine logs.
- Never embed CRM/API credentials in browser code.
- Require an approved privacy-policy URL/version and consent-text version before production.
- Collect only fields required for the selected scenario.
- Use HTTPS end-to-end, server-side rate limiting, abuse protection and restricted access to lead records.
- Do not send a lead before explicit consent.
- Keep synthetic test fixtures obviously synthetic and isolated from production destinations.

## Current implementation

`src/lead-intake-contract-v1.mjs` implements pure envelope construction/validation and strict delivery acknowledgement classification. Its tests use synthetic values only. It does not perform network requests and is not a production integration.

## Decisions still required from KEY

- CRM / destination and authorized server-side credentials.
- Approved privacy-policy URL and version; approved consent text/version.
- Which real services KEY offers (project details, apartment selection, viewing, consultation) and who owns each queue.
- Required contact fields and response-time SLA per scenario.
- Retention/access rules and operational owner for failed deliveries.
