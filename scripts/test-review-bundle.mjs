import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const dir = mkdtempSync(join(tmpdir(), "klanding-bundle-test-"));
try {
  const passport = JSON.parse(readFileSync("examples/project-passport.example.json", "utf8"));
  passport.project.name = "Тестовый ЖК";
  passport.project.location.city = "Тестовый город";
  passport.verification.manualReviewRequired = false;
  passport.facts = [{
    id: "verified-1", claim: "Подтверждённое утверждение", status: "verified",
    publicUse: "allowed",
    sources: [{ url: "https://example.com/project", title: "Источник", accessedAt: "2026-11-05T10:00:00Z", sourceType: "developer" }]
  }];
  passport.advantages = [{
    id: "adv-1", title: "Преимущество", benefit: "Польза", supportingFactIds: ["verified-1"], strength: "core"
  }];
  passport.offers = [{
    id: "presentation", title: "Презентация", type: "presentation", status: "active", successMessage: "Принято"
  }];
  passport.assets.images = [{
    id: "hero", url: "https://example.com/hero.webp", type: "render", status: "approved", alt: "Фасад", rightsNote: "Письменное разрешение застройщика"
  }];
  passport.contentStrategy.modules = [{
    moduleId: "hero", decision: "include", reason: "Главный блок",
    requiredFactIds: ["verified-1"], assetIds: ["hero"], ctaIds: ["presentation"]
  }];
  passport.commercial.brokerNotes = "INTERNAL_NOTE";
  const input = join(dir, "passport.json");
  const output = join(dir, "output");
  writeFileSync(input, JSON.stringify(passport));
  const result = spawnSync(process.execPath, [resolve("scripts/build-review-bundle.mjs"), "--passport", input, "--out", output], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const profile = JSON.parse(readFileSync(join(output, "project-profile.json"), "utf8"));
  const report = JSON.parse(readFileSync(join(output, "generation-report.json"), "utf8"));
  const text = JSON.stringify(profile);
  assert.equal(report.status, "review_required");
  assert.equal(report.rendererAudit.status, "passed");
  assert.equal(report.publicationReadiness.productionReady, false);
  assert.equal(profile.facts.length, 1);
  assert.ok(!text.includes("INTERNAL_NOTE"));
  assert.ok(!text.includes("brokerNotes"));

  passport.facts[0].status = "provisional";
  writeFileSync(input, JSON.stringify(passport));
  const blocked = spawnSync(process.execPath, [resolve("scripts/build-review-bundle.mjs"), "--passport", input, "--out", output], { encoding: "utf8" });
  assert.equal(blocked.status, 1, "Unverified public facts must block bundle generation.");
  const blockedReport = JSON.parse(readFileSync(join(output, "generation-report.json"), "utf8"));
  assert.equal(blockedReport.status, "blocked");
  console.log("PASS: public fact gating, module references and commercial-data isolation.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
