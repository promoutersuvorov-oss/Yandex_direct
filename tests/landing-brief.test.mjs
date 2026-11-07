import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateLandingBriefReferences } from "../src/landing-brief.mjs";

const brief = JSON.parse(await readFile(new URL("../examples/landing-brief.example.json", import.meta.url), "utf8"));
const passport = {
  project: { id: "sample-residence" },
  offers: [{ id: "presentation", type: "presentation", status: "active", scenarioId: "presentation_request" }],
  facts: [{
    id: "fact_infrastructure_01",
    status: "verified",
    publicUse: "allowed",
    sources: [{ url: "https://developer.example/project" }]
  }]
};

test("accepts the example brief when all cross-contract references resolve", () => {
  assert.deepEqual(validateLandingBriefReferences(brief, passport), []);
});

test("rejects a brief for a different project", () => {
  const invalid = structuredClone(brief);
  invalid.projectId = "another-project";
  assert.ok(validateLandingBriefReferences(invalid, passport).some(error => error.includes("projectId")));
});

test("rejects broken segment, hook, offer and funnel references", () => {
  const invalid = structuredClone(brief);
  invalid.hooks[0].segmentIds = ["missing_segment"];
  invalid.funnels[0].offerId = "missing_offer";
  invalid.ctas[0].funnelId = "missing_funnel";
  const errors = validateLandingBriefReferences(invalid, passport);
  assert.ok(errors.some(error => error.includes("missing_segment")));
  assert.ok(errors.some(error => error.includes("missing_offer")));
  assert.ok(errors.some(error => error.includes("missing_funnel")));
});

test("rejects public hooks and positioning based on non-publishable facts", () => {
  const invalid = structuredClone(brief);
  invalid.hooks[0].supportingFactIds = ["internal_fact"];
  const errors = validateLandingBriefReferences(invalid, {
    ...passport,
    facts: [...passport.facts, {
      id: "internal_fact", status: "verified", publicUse: "internal_only",
      sources: [{ url: "https://developer.example/internal" }]
    }]
  });
  assert.ok(errors.some(error => error.includes("internal_fact")));
});

test("keeps CTA scenario identity aligned with the selected offer", () => {
  const invalid = structuredClone(brief);
  invalid.ctas[0].scenarioId = "callback_request";
  assert.ok(validateLandingBriefReferences(invalid, passport).some(error => error.includes("scenarioId")));
});


test("rejects CTA intent mismatches and competing primary actions in one module", () => {
  const invalid = structuredClone(brief);
  invalid.ctas[0].intent = "request_callback";
  invalid.ctas.push({
    ...invalid.ctas[0],
    id: "second_hero_action",
    intent: "get_information"
  });
  const errors = validateLandingBriefReferences(invalid, passport);
  assert.ok(errors.some(error => error.includes("does not match offer type")));
  assert.ok(errors.some(error => error.includes("Multiple CTAs target module hero")));
});


import { validatePositioningGate } from "../src/landing-brief.mjs";

function approvedPositioningBrief() {
  const valid = structuredClone(brief);
  valid.strategy.positioning = {
    statement: "A convenient daily routine for young professionals",
    supportingFactIds: ["fact_infrastructure_01"],
    status: "approved",
    audienceSegmentId: "young_professionals",
    primaryNeed: "A more convenient everyday routine",
    productFocus: "Selected apartments in the sample residence",
    primaryTrafficSource: "Yandex Direct search campaign",
    primaryConverter: "Request a project presentation",
    gateStatus: "approved",
    confidence: "medium",
    rationale: "The selected product and campaign intent address the segment's stated need.",
    evidenceBasis: {
      audience: { type: "research_finding", finding: "Interview notes from the target segment", sampleSize: 8 },
      need: { type: "research_finding", finding: "Repeated need observed in the same interviews", sampleSize: 8 },
      product: { type: "fact", finding: "The selected apartment product is documented in the passport" },
      traffic: { type: "research_finding", finding: "Search query analysis for the campaign" },
      converter: { type: "fact", finding: "KEY has an assigned owner and a defined presentation delivery process" }
    },
    approvedBy: "product_owner",
    approvedAt: "2026-11-06"
  };
  return valid;
}

test("blocks production generation when positioning is missing", () => {
  const invalid = structuredClone(brief);
  delete invalid.strategy.positioning;
  assert.ok(validatePositioningGate(invalid).some(error => error.includes("is missing")));
  assert.ok(validateLandingBriefReferences(invalid, passport, { requirePositioningGate: true })
    .some(error => error.includes("Positioning Gate is missing")));
});

test("blocks hypothesis and review statuses from production generation", () => {
  const invalid = approvedPositioningBrief();
  invalid.strategy.positioning.gateStatus = "hypothesis";
  assert.ok(validatePositioningGate(invalid).some(error => error.includes("not approved")));
});

test("approves a complete five-part positioning contract with evidence and sign-off", () => {
  assert.deepEqual(validatePositioningGate(approvedPositioningBrief()), []);
});

test("blocks positioning that references a missing audience segment or unverified product/converter", () => {
  const invalid = approvedPositioningBrief();
  invalid.strategy.positioning.audienceSegmentId = "missing_segment";
  invalid.strategy.positioning.evidenceBasis.product.type = "expert_hypothesis";
  invalid.strategy.positioning.evidenceBasis.converter.type = "unknown";
  const errors = validatePositioningGate(invalid);
  assert.ok(errors.some(error => error.includes("unknown segment")));
  assert.ok(errors.some(error => error.includes("verified operational/product evidence for product")));
  assert.ok(errors.some(error => error.includes("verified operational/product evidence for converter")));
});

test("requires both legacy and gate approval statuses to agree", () => {
  const invalid = approvedPositioningBrief();
  invalid.strategy.positioning.status = "draft";
  assert.ok(validatePositioningGate(invalid).some(error => error.includes("Legacy positioning status")));
});

test("does not approve expert hypotheses as validated campaign evidence", () => {
  const invalid = approvedPositioningBrief();
  invalid.strategy.positioning.evidenceBasis.audience.type = "expert_hypothesis";
  assert.ok(validatePositioningGate(invalid).some(error => error.includes("validated evidence for audience")));
});
