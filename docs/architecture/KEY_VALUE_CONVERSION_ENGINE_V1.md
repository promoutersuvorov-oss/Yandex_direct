# KEY Value Conversion Engine — contract v1

## Product principle

KLanding does not route every CTA to one generic contact form. Each CTA is a contextual value exchange: the visitor is offered a concrete, truthful benefit, performs a relevant interaction, and is asked for contact details only when they are needed to deliver the next promised outcome.

## Conversion chain

1. **Value proposition** — what useful thing the visitor gets, stated concretely.
2. **Interaction** — calculator, plan selector, presentation preview, video, quiz, question, or another relevant action.
3. **Contextual conversion** — a specific next step tied to the interaction (for example, an individual credit calculation based on the entered budget).
4. **Fulfillment** — the actual way the value is delivered: immediately on page, a verified asset, or a configured KEY service.
5. **Measurement** — record the scenario and funnel events without placing personal data in analytics.

## Contract: `key-value-conversion/1.0`

The pure builder in `src/value-conversion-contract-v1.mjs` validates:

- stable scenario, offer and module identifiers;
- concrete value proposition and action label;
- fulfillment mode: `on_page`, `asset_delivery`, `credit_calculation`, `expert_followup`, `callback`;
- real asset/service identifiers for promises that require them;
- explicit contact requirement, specific contact purpose and minimum allowlisted fields;
- typed, allowlisted entity context such as selected plan, budget, down payment and loan term.

The contract does not render a form, collect personal data, transmit a lead, or assert that a service has fulfilled the promise.

## Non-negotiable behavior

- No universal form for unrelated CTA actions.
- Do not request contact details when the visitor can receive the value immediately on the page.
- If contact is required, explain exactly what the visitor will receive and why the details are needed.
- Preserve interaction context; never ask the visitor to re-enter information already provided.
- Do not promise an asset or service without a verified asset ID or configured service ID.
- A click, modal opening, local calculation or preview is not a delivered lead.
- A completion/success state is allowed only after the promised asset is actually available or the responsible service confirms receipt.
- Analytics should measure CTA view/click, interaction completion, contact intent, consent, accepted delivery, qualification and downstream outcomes. Keep contact data out of analytics payloads.

## Experimentation

Test complete value propositions and paths, not just button colors. Compare click-through, interaction completion, contact conversion, accepted delivery, qualified-lead rate, cost per qualified lead and eventual sales. Do not select a winner on CTR alone. Keep experiments bounded and avoid changing several major variables at once.

## First implementation boundary

The v1 contract and synthetic tests are local-only. Production still requires KEY-approved services, real asset catalog, CRM/server-side receiver, privacy policy and consent text approved for the applicable jurisdiction, operational owners and response-time commitments.
