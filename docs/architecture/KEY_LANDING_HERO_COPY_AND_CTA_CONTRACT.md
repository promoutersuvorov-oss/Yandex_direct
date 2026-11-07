# KEY Hero Copy and Contextual CTA Contract

## Purpose

The hero needs visitor-facing marketing copy without forcing an unreviewed differentiation claim into `project.positioning`. A passport may therefore define `contentStrategy.heroCopy` as a separate, evidence-bound copy block.

## Hero copy schema

- `headline`: short visitor-facing headline.
- `lead`: supporting introduction.
- `supportingFactIds`: non-empty IDs of facts that substantiate the headline and lead.
- `proofPoints`: 2–4 short labels; every item references a fact ID from `supportingFactIds`.

The schema validates shape and length. The canonical builder separately verifies that every referenced fact is current, verified, publicly allowed, and backed by traceable HTTPS evidence. A proof point that references an unsupported fact blocks bundle generation. The renderer never displays strategist rationale as visitor-facing copy.

If no valid `heroCopy` is supplied, the preview keeps its safe project-name / approved-positioning fallback. This preserves compatibility with older passports.

## Contextual CTAs

A module may reference multiple active offers through `ctaIds`. The review renderer displays every assigned offer as a separate button, retaining its own:

- offer and scenario identifiers;
- title and description context;
- required fields;
- consent requirement;
- module context, and plan context when applicable.

The review preview is deliberately non-submitting: clicking a CTA opens a local context preview and marks delivery as disabled. It does not send personal data or imply a working CRM integration. Production readiness still requires a configured HTTPS intake endpoint, a published privacy-policy version, and an integration delivery test.

## K-15 example

The K-15 hero copy is supported by the verified address, closed territory, 24/7 lobby/reception, and 74-apartment facts. Its proof points are short factual labels. The page uses distinct next steps across the composition: check layouts/availability, request the KEY presentation, and arrange a viewing. These are separate conversion scenarios, not three labels pointing to one generic form.

## QA expectations

- Unsupported or expired hero evidence blocks generation.
- Every proof point maps to a publishable fact.
- Every active CTA assigned to a module is rendered separately.
- Preview CTA payloads preserve the correct scenario and module context.
- No preview action is reported as a delivered lead.
- Human review remains required for message quality, design hierarchy, and CTA fit.
