# Runtime capability matrix — 2026-11-07

**Scope:** primary browser runtime and its selectable product modules. This is a source-backed implementation inventory, not a visual approval or production-readiness declaration.

## Status meanings

- **implemented** — a distinct runtime component/section exists, the registry maps an explicit supported variant, and automated coverage exercises its core behavior.
- **partial** — a related UI path exists, but it is shared, narrower than the catalog promise, or lacks an operational dependency. Do not describe it as a complete standalone feature.
- **placeholder** — a visible placeholder exists but is not a working feature. No current catalog entry is classified this way.
- **unsupported** — no selectable standalone implementation exists. The registry rejects the module with `MODULE_UNSUPPORTED`; it must not silently disappear or be presented as implemented.

## Catalog coverage

| Catalog module | Registry status | Current runtime mapping | Important limitation |
|---|---|---|---|
| `hero` | implemented | `HeroSection` / hero slot | Approved media or typographic fallback; only declared layouts are accepted |
| `key` | partial | `HeroSection` / hero slot | Key facts are not a separate facts module yet |
| `gallery` | implemented | `GallerySection` / visual-story | Requires approved project media; not a full asset-management UI |
| `about` | implemented | `ConceptSection` | Explicit feature-led/architectural variants map to the same current component treatment |
| `territory` | unsupported | — | No standalone territory renderer |
| `security` | partial | `AdvantagesSection` | Proof-led advantage cards, not a dedicated security-system component |
| `location` | implemented | `LocationSection` | Evidence-gated nearby places; this is not an interactive map |
| `lifestyle` | partial | `LifestyleSection` | Approved story cards exist; broader lifestyle storytelling/art direction is incomplete |
| `quiz` | implemented | `SelectionQuiz` | Requires an approved finite-choice selection flow |
| `gift` | unsupported | — | Presentation can be an offer/CTA only when the real asset and delivery path exist; no generic gift module |
| `apartments` | implemented | `ApartmentsSection` | Requires current inventory and rights-cleared plan assets |
| `price` | unsupported | — | No standalone current-price/inventory component |
| `mortgage` | partial | `PaymentCalculator` | User-input estimate exists; verified bank programs/rates are not integrated |
| `developer` | unsupported | — | No standalone developer/document component |
| `progress` | unsupported | — | No dated construction-progress timeline |
| `steps` | unsupported | — | No standalone, KEY-approved purchase-process timeline |
| `faq` | implemented | `FaqAccordion` | Requires approved answers and supporting facts |
| `contacts` | partial | `LeadDialogAndClosing` | Client handoff exists; production CRM delivery and legal approval remain unverified |
| `faq-legal` | unsupported | — | No dedicated legal-content module or approved legal copy |
| `footer-nav` | unsupported | shared page shell only | Footer shell is not independently composable |
| `modal` | unsupported | shared dialog primitive | Dialog is a shared interaction primitive, not a standalone content module |
| `lightbox` | unsupported | shared media-viewer primitive | Viewer is a shared interaction primitive, not a standalone content module |
| `promo` | unsupported | — | No standalone promotion renderer with expiry/terms validation |
| `map` | unsupported | — | Nearby-place list does not constitute an interactive map |

The legacy `floor-plans` ID remains as a **partial alias** to canonical `apartments`; new strategies should use `apartments`.

## Enforcement

The registry is the executable source for the status and runtime mapping. Its resolver:

1. Rejects unknown IDs with `MODULE_UNKNOWN`.
2. Rejects catalog modules marked unsupported with `MODULE_UNSUPPORTED` and a reason.
3. Rejects undeclared variants with `MODULE_VARIANT_UNSUPPORTED`.
4. Enforces required publishable facts and runtime capabilities.
5. Returns `status` and `runtimeComponent` on each accepted placement so diagnostics can distinguish a complete component from a partial mapping.

The automated registry test checks that every module in the product catalog has an explicit status, that implemented/partial modules identify a real component and supported variant, and that unsupported modules fail closed.

## What this does not prove

- A module status does not prove that a specific project's passport has enough evidence/assets to use it.
- A passed browser test does not prove visual quality or commercial performance.
- `implemented` does not mean the feature is production-integrated; for example, contacts remains partial until a real, approved lead workflow is connected.
- Shared primitives (`modal`, `lightbox`) may be used by implemented modules without becoming selectable content modules.

## Next product work

Prioritize the next complete, high-value vertical slice in the primary runtime. Do not implement all unsupported catalog modules merely to increase coverage. Choose only modules justified by a real project's verified data and a measurable user action; likely next candidates are a dedicated territory/story composition or a genuinely useful price/inventory enquiry path once its data source is available.
