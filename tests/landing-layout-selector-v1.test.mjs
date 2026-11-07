import test from "node:test";
import assert from "node:assert/strict";
import { selectLandingLayoutVariants } from "../src/landing-layout-selector-v1.mjs";

const profile = {
  marketing: { proofPoints: [{ label: "Закрытая территория" }, { label: "Ресепшен 24/7" }] },
  facts: [{ id: "security" }, { id: "lobby" }],
  advantages: [{ id: "privacy", supportingFactIds: ["security"] }],
  assets: [],
  offers: [{ id: "viewing" }]
};

test("selects editorial hero and proof-led layout when approved media is absent", () => {
  const result = selectLandingLayoutVariants({ profile, manifest: { modules: [
    { moduleId: "hero", decision: "include", variant: "default", requiredFactIds: [], assetIds: [], ctaIds: [] },
    { moduleId: "security", decision: "include", variant: "image-led", requiredFactIds: ["security"], assetIds: [], ctaIds: [] }
  ] } });
  assert.deepEqual(result.manifest.modules.map(item => item.variant), ["editorial-split", "proof-led"]);
  assert.equal(result.report.automaticChanges, 2);
  assert.equal(result.report.decisions[1].requestedVariant, "image-led");
});

test("preserves explicit valid editorial choices and CTA/fact/asset assignments", () => {
  const manifest = { modules: [
    { moduleId: "hero", decision: "include", variant: "editorial-split", requiredFactIds: ["security"], assetIds: [], ctaIds: ["viewing"] },
    { moduleId: "security", decision: "include", variant: "proof-led", requiredFactIds: ["security"], assetIds: [], ctaIds: ["viewing"] }
  ] };
  const result = selectLandingLayoutVariants({ profile, manifest });
  assert.deepEqual(result.manifest.modules.map(item => item.variant), ["editorial-split", "proof-led"]);
  assert.deepEqual(result.manifest.modules.map(item => item.requiredFactIds), [["security"], ["security"]]);
  assert.deepEqual(result.manifest.modules.map(item => item.ctaIds), [["viewing"], ["viewing"]]);
  assert.equal(result.report.automaticChanges, 0);
});

test("uses approved media as a prerequisite for keeping image-led and never invents assets", () => {
  const withMedia = { ...profile, assets: [{ id: "render-1", type: "render", url: "https://example.test/render.jpg" }] };
  const manifest = { modules: [
    { moduleId: "security", decision: "include", variant: "image-led", requiredFactIds: ["security"], assetIds: ["render-1"], ctaIds: [] }
  ] };
  const result = selectLandingLayoutVariants({ profile: withMedia, manifest });
  assert.equal(result.manifest.modules[0].variant, "image-led");
  assert.deepEqual(result.manifest.modules[0].assetIds, ["render-1"]);
});

test("does not rewrite excluded modules or create facts, media, and CTAs", () => {
  const manifest = { modules: [
    { moduleId: "gallery", decision: "exclude", variant: "image-led", requiredFactIds: [], assetIds: [], ctaIds: [] }
  ] };
  const result = selectLandingLayoutVariants({ profile, manifest });
  assert.equal(result.manifest.modules[0].variant, "image-led");
  assert.equal(result.manifest.modules[0].layoutSelection, undefined);
  assert.equal(result.report.automaticChanges, 0);
});

test("preserves an explicitly curated feature-led layout without approved media", () => {
  const result = selectLandingLayoutVariants({ profile, manifest: { modules: [
    { moduleId: "lifestyle", decision: "include", variant: "feature-led",
      requiredFactIds: ["security"], assetIds: [], ctaIds: [] }
  ] } });
  assert.equal(result.manifest.modules[0].variant, "feature-led");
  assert.equal(result.report.decisions[0].automatic, false);
});
