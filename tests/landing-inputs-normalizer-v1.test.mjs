import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLandingInputsV1 } from "../src/landing-inputs-normalizer-v1.mjs";

const basePassport = () => ({
  schemaVersion: "1.0.0",
  project: {
    id: "kd-905-voronezh", name: "Клубный дом 905",
    positioning: "Камерный дом в центре", positioningStatus: "draft",
    positioningFactIds: ["central-district"], audiences: ["Для собственного проживания"],
    inventory: { layoutsAvailable: false }
  },
  contentStrategy: {
    coreIdea: "Дом для своего ритма", primaryCta: "presentation",
    secondaryCtas: ["viewing"], audiencePriority: ["owner_occupier"],
    informationGaps: ["Актуальная доступность планировок"],
    modules: [{ moduleId: "hero", decision: "include", reason: "Первый контакт", order: 0,
      requiredFactIds: ["central-district"], ctaIds: ["presentation"] }],
    visualDirection: { theme: "urban-noir", heroLayout: "split", palette: ["графит", "молочный"],
      signatureInteraction: "Плавное раскрытие архитектуры", customCss: "body{display:none}" }
  },
  advantages: [{ id: "a1", title: "Закрытая территория", benefit: "Больше приватности",
    supportingFactIds: ["f1"], strength: "strong", hook: "Своя территория" }],
  offers: [{ id: "presentation", title: "Получить презентацию", type: "presentation",
    status: "active", requiredFields: ["phone"] }],
  selectionQuiz: { status: "approved", title: "Подбор квартиры", questions: [
    { id: "rooms", label: "Сколько комнат?", options: [{ id: "one", label: "Одна" }, { id: "two", label: "Две" }] }
  ], resultOfferId: "presentation" },
  faq: [{ id: "faq1", question: "Где находится дом?", requiredFactIds: ["central-district"] }],
  commercial: { leadWebhookEnvKey: "KEY_SECRET", brokerNotes: "Внутреннее" },
  marketContext: { snapshotAt: "2026-11-01T00:00:00Z", observations: [] },
  verification: { checkedAt: "2026-11-01T00:00:00Z", factsWithoutSources: [] }
});

test("keeps marketing strategy separate from verified project knowledge", () => {
  const result = normalizeLandingInputsV1(basePassport());
  assert.deepEqual(result.errors, []);
  assert.equal(result.landingInputs.strategy.coreIdea, "Дом для своего ритма");
  assert.equal(result.landingInputs.positioning.status, "draft");
  assert.equal(result.landingInputs.marketingCandidates[0].classification, "marketing_candidate");
  assert.equal(result.landingInputs.marketingCandidates[0].verificationRequired, true);
  assert.equal("claims" in result.landingInputs, false);
});

test("preserves module decisions and safe visual direction without executing arbitrary tokens", () => {
  const result = normalizeLandingInputsV1(basePassport());
  assert.equal(result.landingInputs.strategy.modules[0].moduleId, "hero");
  assert.equal(result.landingInputs.design.theme, "urban-noir");
  assert.equal(result.landingInputs.design.heroLayout, "split");
  assert.equal("customCss" in result.landingInputs.design, false);
  assert.deepEqual(result.landingInputs.design.paletteBrief, ["графит", "молочный"]);
  assert.ok(result.warnings.some(item => item.code === "PALETTE_REQUIRES_TOKENIZATION"));
});

test("keeps offers, quiz and FAQ as distinct conversion entities with explicit gates", () => {
  const result = normalizeLandingInputsV1(basePassport());
  assert.equal(result.landingInputs.conversionCatalog[0].publicEligible, true);
  assert.equal(result.landingInputs.selectionFlow.publicEligible, true);
  assert.equal(result.landingInputs.selectionFlow.resultOfferExists, true);
  assert.equal(result.landingInputs.faqDrafts[0].answerStatus, "not_generated");
  const invalid = basePassport();
  invalid.selectionQuiz.resultOfferId = "missing-offer";
  const blocked = normalizeLandingInputsV1(invalid);
  assert.equal(blocked.landingInputs.selectionFlow.publicEligible, false);
  assert.ok(blocked.warnings.some(item => item.code === "QUIZ_RESULT_OFFER_MISSING"));
});

test("does not promote hypotheses or positioning into facts and keeps layout readiness explicit", () => {
  const p = basePassport();
  p.project.positioningStatus = "draft";
  p.project.inventory.layoutsAvailable = false;
  const result = normalizeLandingInputsV1(p);
  assert.equal(result.landingInputs.positioning.status, "draft");
  assert.deepEqual(result.landingInputs.positioning.supportingFactIds, ["central-district"]);
  assert.equal(result.landingInputs.readiness.layoutsAvailableStatus, "not_confirmed");
  assert.equal(result.landingInputs.marketingCandidates[0].classification, "marketing_candidate");
});

test("keeps protected commercial, market context and verification data internal", () => {
  const result = normalizeLandingInputsV1(basePassport());
  assert.equal(result.internal.commercial.leadWebhookEnvKey, "KEY_SECRET");
  assert.equal(result.internal.marketContext.observations.length, 0);
  assert.ok(!JSON.stringify(result.landingInputs).includes("KEY_SECRET"));
  assert.ok(!JSON.stringify(result.landingInputs).includes("Внутреннее"));
});

test("is deterministic and does not mutate the source passport", () => {
  const p = basePassport();
  const before = JSON.stringify(p);
  const first = normalizeLandingInputsV1(p);
  const second = normalizeLandingInputsV1(p);
  assert.equal(JSON.stringify(p), before);
  assert.deepEqual(first, second);
});

test("rejects unsupported passport versions and incomplete identity", () => {
  assert.equal(normalizeLandingInputsV1({ schemaVersion: "2.0.0" }).landingInputs, null);
  const p = basePassport(); delete p.project.id;
  assert.equal(normalizeLandingInputsV1(p).landingInputs, null);
});

test("normalizes lifestyle story drafts without promoting them to approved content",()=>{
  const source=basePassport();
  source.contentStrategy.lifestyleStories=[{id:"courtyard-morning",title:"Утро во дворе",description:"Черновой текст сценария",
    sceneLabel:"ДВОР",assetId:"courtyard-render",supportingFactIds:["courtyard"],publicationStatus:"draft"}];
  const result=normalizeLandingInputsV1(source);
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.landingInputs.lifestyleStories,[{id:"courtyard-morning",title:"Утро во дворе",
    description:"Черновой текст сценария",sceneLabel:"ДВОР",assetId:"courtyard-render",
    supportingFactIds:["courtyard"],publicationStatus:"draft"}]);
});
