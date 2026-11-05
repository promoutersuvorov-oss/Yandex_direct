# KEY CTA context and delivery contract

This document defines the versioned conversion context shared by rendered CTA entry points. The current review renderer implements only a local preview envelope; it does not collect contact details, consent or send network requests.

## Preview envelope — `key-cta-context/2.0`

- `schemaVersion`: immutable contract version.
- `state`: `preview_only` for the current renderer.
- `projectId`: canonical project identity.
- `conversion.scenarioId`: stable marketing/conversion scenario key, distinct from storage `offerId`.
- `conversion.offerId`: active public offer identifier, nullable only for a non-offer generic action.
- `conversion.moduleId`: actual module containing the CTA (`hero`, `floor-plans`, `quiz`, etc.).
- `conversion.entityContext`: typed context, currently `plan` or `quizAnswers`; never arbitrary browser state.
- `requirements.requiredFields`: fields a future form must request.
- `requirements.consentRequired`: legal-consent requirement declaration; defaults to true.
- `delivery.status`: `disabled_in_preview`; `delivery.accepted` is always false.

## Invariants

1. CTA `offerId` must resolve to an active offer referenced by the included module.
2. Each semantic module may expose at most one primary conversion CTA. Do not render competing conversion buttons side by side; a different user intent belongs to its own relevant module and CTA.
3. Active scenario IDs must be unique. Legacy offers without `scenarioId` use `offer.id` as a compatibility fallback.
4. A plan CTA carries the exact verified plan ID, room count, area, optional floor/finishing and approved asset ID.
5. A quiz CTA carries validated question/option IDs under `entityContext.quizAnswers` and the quiz's result offer.
6. UI completion is not delivery success. No success state may claim a lead was received until a trusted server response confirms it.
7. The preview does not collect names, phones, consent, attribution, or other personal data and does not issue network requests.
8. Production delivery requires a server-side adapter, endpoint ownership, schema validation, anti-spam controls, consent policy/version/timestamp, retention rules, retry semantics and CRM acceptance evidence.

## Future production lead envelope

The eventual server payload should add server-issued `eventId`/`leadId`, `createdAt`, validated contact fields, consent evidence, first/last-touch attribution and analytics metadata. These are deliberately absent from the preview payload. See `K15_RUNTIME_MIGRATION_CONTRACT.md` for the observed legacy K15 field mapping and migration constraints.
