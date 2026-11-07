import test from "node:test";
import assert from "node:assert/strict";
import { buildLandingLayoutAudit } from "../src/landing-layout-audit-v1.mjs";

const profile = {
  marketing: { proofPoints: [{ label: "Закрытая территория" }, { label: "Ресепшен 24/7" }] },
  facts: [{ id: "security" }, { id: "lobby" }],
  advantages: [{ id: "privacy", supportingFactIds: ["security"] }],
  assets: [],
  offers: [{ id: "layouts" }, { id: "viewing" }]
};
const manifest = { modules: [
  { moduleId: "hero", decision: "include", variant: "editorial-split", requiredFactIds: [], assetIds: [], ctaIds: ["layouts"] },
  { moduleId: "security", decision: "include", variant: "image-led", requiredFactIds: ["security"], assetIds: [], ctaIds: ["layouts"] },
  { moduleId: "lifestyle", decision: "include", variant: "editorial", requiredFactIds: ["lobby"], assetIds: [], ctaIds: [] },
  { moduleId: "contacts", decision: "include", variant: "conversion-led", requiredFactIds: [], assetIds: [], ctaIds: ["layouts"] }
] };

test("audit recommends evidence panel when hero has proof points but no approved media", () => {
  const audit = buildLandingLayoutAudit({ profile, manifest });
  assert.equal(audit.status, "needs_attention");
  assert.ok(audit.findings.some(item => item.code === "HERO_PROOF_PANEL_RECOMMENDED"));
  assert.equal(audit.visualScreenshotAssessment, "not_performed");
  assert.equal(audit.humanReviewRequired, true);
});

test("audit catches image-led modules without media and proposes non-fabricated fallback", () => {
  const audit = buildLandingLayoutAudit({ profile, manifest });
  const finding = audit.findings.find(item => item.code === "IMAGE_LAYOUT_WITHOUT_MEDIA");
  assert.deepEqual(finding.moduleIds, ["security"]);
  assert.match(finding.recommendation, /редакционный\/карточный/);
});

test("audit reports duplicated facts and conversion gaps without inventing blockers", () => {
  const repeated = {
    ...manifest,
    modules: [...manifest.modules, {
      moduleId: "about", decision: "include", variant: "proof-led",
      requiredFactIds: ["security"], assetIds: [], ctaIds: []
    }]
  };
  const audit = buildLandingLayoutAudit({ profile, manifest: repeated });
  assert.ok(audit.findings.some(item => item.code === "FACTS_REPEATED_ACROSS_SECTIONS"));
  assert.ok(audit.findings.some(item => item.code === "CONVERSION_SECTIONS_WITHOUT_CTA"));
  assert.equal(audit.findings.filter(item => item.severity === "blocker").length, 0);
});

test("audit rejects a composition without a hero", () => {
  const audit = buildLandingLayoutAudit({
    profile,
    manifest: { modules: [{ moduleId: "about", decision: "include", requiredFactIds: [], assetIds: [], ctaIds: [] }] }
  });
  assert.equal(audit.status, "blocked");
  assert.ok(audit.findings.some(item => item.code === "LAYOUT_HERO_MISSING"));
});
