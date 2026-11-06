import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizePassportV1 } from "../src/passport-normalizer-v1.mjs";

const source = {
  url: "https://developer.example/project",
  title: "Официальные сведения",
  accessedAt: "2026-11-01T10:00:00Z",
  sourceType: "official_project",
  quoteOrEvidence: "Фрагмент, подтверждающий утверждение."
};

function passport() {
  return {
    schemaVersion: "1.0.0",
    project: {
      id: "sample-residence",
      name: "Sample Residence",
      developer: { value: "Developer", status: "verified", sources: [source] },
      class: { value: null, status: "missing", sources: [] },
      location: {
        city: "Воронеж",
        address: { value: "Улица Примерная, 1", status: "verified", sources: [source], lastChecked: "2026-11-01T10:00:00Z" },
        district: { value: "Центр", status: "verified", sources: [source] }
      },
      delivery: { value: "IV квартал 2026", status: "provisional", sources: [source], note: "Требует повторной проверки." },
      constructionStatus: { value: "Строится", status: "provisional", sources: [source] },
      inventory: {
        apartmentCount: { value: 45, status: "verified", sources: [source] },
        layoutsAvailable: false,
        priceFrom: { value: null, status: "missing", sources: [] },
        areaRange: { value: null, status: "missing", sources: [] }
      }
    },
    facts: [
      { id: "f-1", claim: "В проекте предусмотрен закрытый двор.", status: "verified", publicUse: "allowed_with_qualification", sources: [source] },
      { id: "f-2", claim: "Старая акция.", status: "expired", publicUse: "blocked", sources: [source], expiresAt: "2025-01-01T00:00:00Z" }
    ],
    advantages: [{ id: "a-1", title: "Больше приватности", benefit: "Сценарий жизни", supportingFactIds: ["f-1"] }],
    infrastructure: [
      {
        name: "Городской парк", category: "park", status: "verified", source,
        distanceMeters: 350, walkingMinutes: 5,
        distanceEvidence: {
          method: "walking_route", checkedAt: "2026-11-01T10:00:00Z",
          validUntil: "2027-01-01T00:00:00Z", source
        }
      },
      {
        name: "Сквер", category: "park", status: "verified", source,
        distanceMeters: 250,
        distanceEvidence: {
          method: "straight_line", checkedAt: "2026-11-01T10:00:00Z",
          validUntil: "2027-01-01T00:00:00Z", source
        }
      },
      {
        name: "Школа без маршрута", category: "school", status: "verified", source,
        distanceMeters: 500
      }
    ],
    offers: [{ id: "presentation", title: "Презентация", type: "presentation", status: "active" }],
    assets: {
      images: [{ id: "hero", type: "render", url: "https://cdn.example/hero.webp", status: "approved", projectMatch: "confirmed", rightsStatus: "confirmed", rightsNote: "Использовать только в согласованных рекламных материалах." }],
      plans: [{ id: "plan-asset", type: "plan", url: "https://cdn.example/plan.webp", status: "approved", projectMatch: "confirmed", rightsStatus: "confirmed" }]
    },
    apartmentPlans: [{
      id: "plan-1", title: "Двухкомнатная", rooms: 2, areaSqm: 68.4, floor: 4,
      assetId: "plan-asset", status: "verified", publicUse: "allowed", sources: [source]
    }],
    contentStrategy: { modules: [] },
    selectionQuiz: null,
    faq: [],
    commercial: { brokerNotes: "internal" },
    verification: { checkedAt: "2026-11-01T10:00:00Z" },
    marketContext: { snapshotAt: "2026-11-01T10:00:00Z", observations: [] }
  };
}

test("normalizes project identity, organizations, claims, sources and evidence", () => {
  const result = normalizePassportV1(passport());
  assert.deepEqual(result.errors, []);
  assert.equal(result.knowledge.project.id, "sample-residence");
  assert.equal(result.knowledge.project.city, "Воронеж");
  assert.equal(result.knowledge.organizations[0].name, "Developer");
  assert.ok(result.knowledge.project.addressClaimId);
  assert.ok(result.knowledge.project.districtClaimId);
  const fact = result.knowledge.claims.find(item => item.id.includes("f-1"));
  assert.ok(fact);
  assert.equal(fact.value.value, "В проекте предусмотрен закрытый двор.");
  assert.equal(fact.epistemicStatus, "verified");
  assert.equal(fact.publicUse, "allowed_with_qualification");
  assert.equal(result.knowledge.sources.length, 1, "identical source records should be deduplicated");
  assert.equal(result.knowledge.evidence.length, 1, "identical evidence extracts should be deduplicated");
  assert.equal(fact.sourceIds.length, 1);
  assert.equal(fact.evidenceIds.length, 1);
});

test("keeps distinct evidence extracts linked to the correct claims under one source", () => {
  const input = passport();
  input.facts[1].sources = [{ ...source, quoteOrEvidence: "Другой фрагмент источника." }];
  const result = normalizePassportV1(input);
  const first = result.knowledge.claims.find(item => item.id.includes("f-1"));
  const second = result.knowledge.claims.find(item => item.id.includes("f-2"));
  assert.equal(result.knowledge.sources.length, 1);
  assert.equal(result.knowledge.evidence.length, 2);
  const firstEvidence = result.knowledge.evidence.find(item => item.id === first.evidenceIds[0]);
  const secondEvidence = result.knowledge.evidence.find(item => item.id === second.evidenceIds[0]);
  assert.equal(firstEvidence.extract, "Фрагмент, подтверждающий утверждение.");
  assert.equal(secondEvidence.extract, "Другой фрагмент источника.");
});

test("does not mark a claim publishable when source evidence is missing", () => {
  const input = passport();
  input.facts[0].sources = [{ url: source.url, title: source.title, accessedAt: source.accessedAt }];
  const result = normalizePassportV1(input);
  const claim = result.knowledge.claims.find(item => item.id.includes("f-1"));
  assert.equal(claim.sourceIds.length, 1);
  assert.equal(claim.evidenceIds.length, 0);
  assert.equal(claim.publicUse, "internal_only");
});

test("uses deterministic IDs and does not mutate the source passport", () => {
  const input = passport();
  const before = structuredClone(input);
  const first = normalizePassportV1(input);
  const second = normalizePassportV1(input);
  assert.deepEqual(input, before);
  assert.deepEqual(first, second);
});

test("does not turn aggregate apartment count into individual property units", () => {
  const result = normalizePassportV1(passport());
  assert.deepEqual(result.knowledge.propertyUnits, []);
  assert.ok(result.knowledge.claims.some(item => item.predicate === "project.inventory.apartment_count"));
  assert.ok(result.warnings.some(item => item.code === "AGGREGATE_INVENTORY_NOT_EXPANDED"));
});

test("distinguishes walking routes from straight-line distance and unsupported metrics", () => {
  const result = normalizePassportV1(passport());
  assert.equal(result.knowledge.routes.length, 1);
  assert.equal(result.knowledge.routes[0].mode, "walking");
  assert.equal(result.knowledge.routes[0].durationSeconds, 300);
  assert.equal(result.knowledge.pointsOfInterest[0].status, "unknown",
    "verified means the listing is evidenced, not that the POI operational status is known");
  const poiListed = result.knowledge.claims.find(item => item.predicate === "poi.listed_by_source");
  assert.equal(poiListed.value.kind, "boolean");
  assert.equal(poiListed.value.value, true);
  const straightLine = result.knowledge.claims.find(item => item.predicate === "poi.straight_line_distance");
  assert.equal(straightLine.value.unit, "m");
  assert.equal(straightLine.modality, "measured");
  assert.ok(result.warnings.some(item => item.code === "ROUTE_EVIDENCE_MISSING"));
});

test("normalizes assets and plans without inventing unit records", () => {
  const result = normalizePassportV1(passport());
  assert.equal(result.knowledge.assets.length, 2);
  assert.equal(result.knowledge.assets.find(item => item.id === "hero").assetKind, "render");
  assert.equal(result.knowledge.assets.find(item => item.id === "hero").publicationStatus, "approved");
  assert.equal(result.knowledge.assets.find(item => item.id === "hero").rightsLimitations[0], "Использовать только в согласованных рекламных материалах.");
  assert.equal(result.knowledge.plans.length, 1);
  assert.equal(result.knowledge.plans[0].assetId, "plan-asset");
  assert.equal(result.knowledge.plans[0].area.unit, "m2");
  assert.equal(result.knowledge.plans[0].publicUse, "internal_only",
    "a legacy rightsStatus assertion without rights evidence must not authorize publication");
  assert.deepEqual(result.knowledge.propertyUnits, []);
});

test("does not create plans from assets of another type or publish plans without asset rights", () => {
  const input = passport();
  input.assets.plans[0].type = "render";
  const unresolved = normalizePassportV1(input);
  assert.equal(unresolved.knowledge.plans.length, 0);
  assert.ok(unresolved.warnings.some(item => item.code === "PLAN_ASSET_UNRESOLVED"));

  const restricted = passport();
  restricted.assets.plans[0].rightsStatus = "pending";
  const result = normalizePassportV1(restricted);
  assert.equal(result.knowledge.plans.length, 1);
  assert.equal(result.knowledge.plans[0].publicUse, "internal_only");
});

test("does not turn layout readiness or unsupported area ranges into project claims", () => {
  const input = passport();
  input.project.inventory.areaRange = {
    value: { min: 40, max: 90, unit: "m2" }, status: "verified", sources: [source]
  };
  const result = normalizePassportV1(input);
  assert.equal(result.knowledge.claims.some(item => item.predicate === "project.inventory.layouts_available"), false);
  assert.equal(result.knowledge.claims.some(item => item.predicate === "project.inventory.area_range"), false);
  assert.ok(result.warnings.some(item => item.code === "LAYOUT_READINESS_NOT_MIGRATED"));
  assert.ok(result.warnings.some(item => item.code === "AREA_RANGE_NOT_MAPPED"));
});

test("does not migrate marketing strategy, offers, private commercial notes or verification as project facts", () => {
  const result = normalizePassportV1(passport());
  assert.equal("offers" in result.knowledge, false);
  assert.equal("advantages" in result.knowledge, false);
  assert.equal("contentStrategy" in result.knowledge, false);
  assert.equal("commercial" in result.knowledge, false);
  assert.equal("verification" in result.knowledge, false);
  assert.ok(result.knowledge.internalMarketContext);
  for (const code of [
    "MARKETING_ADVANTAGES_NOT_MIGRATED", "OFFERS_NOT_MIGRATED",
    "LANDING_STRATEGY_NOT_MIGRATED", "PROTECTED_COMMERCIAL_NOT_MIGRATED",
    "VERIFICATION_IS_DERIVED"
  ]) assert.ok(result.warnings.some(item => item.code === code), code);
});

test("fails closed for unsupported versions and incomplete project identity", () => {
  assert.equal(normalizePassportV1(null).knowledge, null);
  assert.equal(normalizePassportV1({ schemaVersion: "2.0.0" }).errors[0].code, "UNSUPPORTED_SCHEMA_VERSION");
  const incomplete = passport();
  delete incomplete.project.location.city;
  assert.equal(normalizePassportV1(incomplete).errors[0].code, "PROJECT_IDENTITY_INCOMPLETE");
});

test("normalizes the real 905 draft without fabricating units, offers or plans", () => {
  const fixture = JSON.parse(readFileSync(new URL("../examples/kd-905.project-passport.draft.json", import.meta.url), "utf8"));
  const result = normalizePassportV1(fixture);
  assert.deepEqual(result.errors, []);
  assert.equal(result.knowledge.project.id, "kd-905-voronezh");
  assert.equal(result.knowledge.propertyUnits.length, 0);
  assert.equal(result.knowledge.plans.length, 0);
  assert.equal(result.knowledge.pointsOfInterest.length, 18);
  assert.equal(result.knowledge.claims.filter(item => item.predicate === "project.fact").length, fixture.facts.length);
  assert.ok(result.warnings.some(item => item.code === "AGGREGATE_INVENTORY_NOT_EXPANDED"));
  assert.ok(result.warnings.some(item => item.code === "OFFERS_NOT_MIGRATED") === false);
  assert.equal("internalMarketContext" in result.knowledge, true);
});
