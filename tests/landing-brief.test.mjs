import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateLandingBriefReferences } from "../src/landing-brief.mjs";

const brief = JSON.parse(await readFile(new URL("../examples/landing-brief.example.json", import.meta.url), "utf8"));
const passport = {
  project: { id: "sample-residence" },
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
