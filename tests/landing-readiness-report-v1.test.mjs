import test from "node:test";
import assert from "node:assert/strict";
import { buildLandingReadinessReport } from "../src/landing-readiness-report-v1.mjs";

const baseProfile = {
  mode: "demo",
  project: { id: "kd905", name: "Клубный дом 905", city: "Воронеж" },
  composition: ["advantages", "location"],
  marketing: { headline: "Тихий центр. Свой ритм.", lead: "Клубный дом в центре города." },
  advantages: [{ id: "a" }, { id: "b" }],
  media: [], heroMedia: null, plans: [],
  infrastructure: [{ id: "school", name: "Школа", qualification: "Расстояние и маршрут не подтверждены." }],
  integration: { leadEndpoint: "", privacyPolicyUrl: "", privacyPolicyVersion: "" }
};

test("readiness report exposes commercial gaps without changing builder output", () => {
  const report = buildLandingReadinessReport({ profile: baseProfile, requestedMode: "production" });
  assert.equal(report.status, "blocked");
  assert.equal(report.publicationAllowed, false);
  assert.equal(report.project.id, "kd905");
  assert.ok(report.warnings.some(item => item.code === "HERO_MEDIA_MISSING"));
  assert.ok(report.warnings.some(item => item.code === "ADVANTAGES_LIMITED"));
  assert.ok(report.warnings.some(item => item.code === "FLOOR_PLANS_MISSING"));
  assert.ok(report.warnings.some(item => item.code === "INFRASTRUCTURE_ROUTES_INCOMPLETE"));
  assert.ok(report.blockers.some(item => item.code === "LEAD_INTAKE_NOT_READY"));
  assert.equal(report.manualReview.length, 3);
});

test("production profile with approved assets and lead intake can be ready", () => {
  const profile = {
    ...baseProfile, mode: "production",
    heroMedia: { url: "https://cdn.example.test/hero.webp" },
    advantages: [{}, {}, {}], plans: [{}],
    infrastructure: [{ id: "park", distanceLabel: "5 мин. пешком" }],
    integration: {
      leadEndpoint: "https://crm.example.test/leads",
      privacyPolicyUrl: "https://example.test/privacy",
      privacyPolicyVersion: "2026-01"
    }
  };
  const report = buildLandingReadinessReport({ profile, requestedMode: "production" });
  assert.equal(report.status, "ready");
  assert.equal(report.publicationAllowed, true);
  assert.equal(report.counts.blockers, 0);
  assert.equal(report.counts.warnings, 0);
});

test("builder warnings remain visible and deduplicated by code and message", () => {
  const warning = { code: "POI_METRIC_NOT_PUBLISHED", message: "No verified route." };
  const report = buildLandingReadinessReport({ profile: baseProfile, warnings: [warning, warning] });
  assert.equal(report.warnings.filter(item => item.code === warning.code).length, 1);
});

test("review-bundle profile is reportable and missing CRM is advisory, not a publication failure", () => {
  const profile = {
    project: { id: "sample", name: "Sample House", city: "Voronezh" },
    facts: [], advantages: [{}, {}, {}],
    infrastructure: [{ name: "Park" }],
    apartmentPlans: [],
    assets: [],
    modules: [{ moduleId: "hero", assetIds: [] }, { moduleId: "location" }]
  };
  const report = buildLandingReadinessReport({ profile, requestedMode: "review" });
  assert.equal(report.status, "needs_attention");
  assert.equal(report.publicationAllowed, false);
  assert.ok(report.warnings.some(item => item.code === "LEAD_INTAKE_NOT_READY"));
  assert.equal(report.blockers.length, 0);
  assert.ok(report.ready.some(item => item.code === "PAGE_COMPOSITION_PRESENT"));
  assert.ok(report.warnings.some(item => item.code === "HERO_MEDIA_MISSING"));
});
