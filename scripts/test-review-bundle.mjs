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
  passport.project.positioning = '<img src=x onerror="alert(1)">';
  passport.verification.manualReviewRequired = false;
  passport.facts = [{
    id: "verified-1", claim: "Подтверждённое утверждение", status: "verified",
    publicUse: "allowed",
    sources: [{ url: "https://example.com/project", title: "Источник", accessedAt: "2026-11-05T10:00:00Z", sourceType: "developer" }]
  }];
  passport.advantages = [{
    id: "adv-1", title: "Преимущество", benefit: "Польза", supportingFactIds: ["verified-1"], strength: "core"
  }];
  passport.offers = [
    { id: "presentation", title: "Презентация", type: "presentation", status: "active", successMessage: "Принято" },
    { id: "selection", title: "Подбор", type: "apartment_selection", status: "active", successMessage: "Запрос принят" }
  ];
  passport.assets.images = [{
    id: "hero", url: "https://example.com/hero.webp", type: "render", status: "approved", alt: "Фасад", rightsNote: "Письменное разрешение застройщика", projectMatch: "confirmed", rightsStatus: "confirmed", rightsSource: { url: "https://example.com/rights", title: "Разрешение на использование", accessedAt: "2026-11-05T10:00:00Z", sourceType: "document" }
  }, {
    id: "gallery-2", url: "https://example.com/courtyard.webp", type: "photo", status: "approved", alt: "Двор", rightsNote: "Письменное разрешение застройщика", projectMatch: "confirmed", rightsStatus: "confirmed", rightsSource: { url: "https://example.com/rights", title: "Разрешение на использование", accessedAt: "2026-11-05T10:00:00Z", sourceType: "document" }
  }];
  passport.assets.plans = [{
    id: "plan-asset", url: "https://example.com/plan.webp", type: "plan", status: "approved", alt: "Тестовый план", rightsNote: "Синтетический тестовый материал", projectMatch: "confirmed", rightsStatus: "confirmed", rightsSource: { url: "https://example.com/rights", title: "Разрешение на использование", accessedAt: "2026-11-05T10:00:00Z", sourceType: "document" }
  }];
  passport.apartmentPlans = [{
    id: "plan-45", title: "Тестовая планировка", rooms: 2, areaSqm: 54.2, assetId: "plan-asset",
    status: "verified", publicUse: "allowed",
    sources: [{ url: "https://example.com/plan-data", title: "Тестовые данные планировки", accessedAt: "2026-11-05T10:00:00Z", sourceType: "document" }]
  }];
  passport.selectionQuiz = {
    status: "approved", title: "Подбор тестового варианта", description: "Синтетический сценарий для проверки.",
    resultOfferId: "selection",
    questions: [{ id: "purpose", label: "Для чего выбираете квартиру?", options: [
      { id: "living", label: "Для жизни" }, { id: "investment", label: "Для инвестиций" }
    ] }]
  };
  passport.contentStrategy.modules = [
    { moduleId: "hero", decision: "include", reason: "Главный блок", requiredFactIds: ["verified-1"], assetIds: ["hero"], ctaIds: ["presentation"] },
    { moduleId: "gallery", decision: "include", reason: "Проверка галереи", assetIds: ["hero", "gallery-2"] },
    { moduleId: "floor-plans", decision: "include", reason: "Проверка планировок", assetIds: ["plan-asset"], ctaIds: ["selection"] },
    { moduleId: "quiz", decision: "include", reason: "Проверка квиза", ctaIds: ["selection"] }
  ];
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
  assert.equal(profile.apartmentPlans.length, 1);
  assert.equal(profile.selectionQuiz.questions.length, 1);
  assert.equal(profile.offers[0].successMessage, undefined, "Internal success copy must not leak into the public preview profile.");
  assert.deepEqual(Object.keys(profile.offers[0]).sort(), ["description", "id", "requiredFields", "title", "type"].sort());
  const preview = spawnSync(process.execPath, [
    resolve("scripts/render-review-preview.mjs"), "--bundle", output,
    "--out", join(output, "preview.html")
  ], { encoding: "utf8" });
  assert.equal(preview.status, 0, preview.stderr || preview.stdout);
  const html = readFileSync(join(output, "preview.html"), "utf8");
  assert.ok(html.includes("Тестовый ЖК"));
  assert.ok(html.includes('<h1 id="heading-0">Тестовый ЖК</h1>'));
  assert.equal((html.match(/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/g) || []).length, 1, "Hero positioning should appear once, not duplicate as the title.");
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(!html.includes('<img src=x onerror="alert(1)">'));
  assert.ok(html.includes("Подтверждённое утверждение"));
  assert.ok(!html.includes("Главный блок"), "Internal module rationale must not be shown as visitor-facing copy.");
  assert.ok(html.includes("data-preview-cta=\"presentation\""));
  assert.ok(html.includes("отправка заявок отключена"));
  assert.ok(html.includes("media-grid"), "Gallery module must render a multi-image layout.");
  assert.ok(html.includes("plan-45"), "Apartment plan identity must be present in its contextual CTA.");
  assert.ok(html.includes("data-preview-quiz"), "Approved quiz must render as an interactive form.");
  assert.ok(!html.includes("data-lead-form"), "Preview must not create a lead submission form.");
  assert.ok(!html.includes("INTERNAL_NOTE"));
  assert.ok(!html.includes("script.google.com"));
  assert.ok(!text.includes("INTERNAL_NOTE"));
  assert.ok(!text.includes("brokerNotes"));

  // A second project must produce an isolated profile and must not inherit the first project's copy.
  const secondPassport = structuredClone(passport);
  secondPassport.project.id = "second-test-project";
  secondPassport.project.name = "Второй независимый ЖК";
  secondPassport.project.location.city = "Другой город";
  secondPassport.facts[0].claim = "Уникальный факт второго объекта";
  const secondInput = join(dir, "second-passport.json");
  const secondOutput = join(dir, "second-output");
  writeFileSync(secondInput, JSON.stringify(secondPassport));
  const secondBuild = spawnSync(process.execPath, [resolve("scripts/build-review-bundle.mjs"), "--passport", secondInput, "--out", secondOutput], { encoding: "utf8" });
  assert.equal(secondBuild.status, 0, secondBuild.stderr || secondBuild.stdout);
  const secondProfile = JSON.parse(readFileSync(join(secondOutput, "project-profile.json"), "utf8"));
  const secondText = JSON.stringify(secondProfile);
  assert.equal(secondProfile.project.id, "second-test-project");
  assert.equal(secondProfile.project.name, "Второй независимый ЖК");
  assert.ok(secondText.includes("Уникальный факт второго объекта"));
  assert.ok(!secondText.includes("Тестовый ЖК"));
  assert.ok(!secondText.includes("Подтверждённое утверждение"));

  passport.facts[0].status = "provisional";
  passport.facts.push({
    id: "expired-public", claim: "Просроченное утверждение", status: "verified",
    publicUse: "allowed", expiresAt: "2020-01-01T00:00:00Z", sources: [{
      url: "https://example.com/old", title: "Старый источник", accessedAt: "2020-01-01T00:00:00Z", sourceType: "developer"
    }]
  });
  passport.contentStrategy.modules.push({
    moduleId: "parking", decision: "include", reason: "Проверка отсутствующего renderer"
  });
  passport.assets.images[0].url = "javascript:alert(1)";
  passport.assets.images[0].rightsStatus = "pending";
  passport.assets.images[0].projectMatch = "unconfirmed";
  passport.assets.images[0].validUntil = "2020-01-01T00:00:00Z";
  writeFileSync(input, JSON.stringify(passport));
  const blocked = spawnSync(process.execPath, [resolve("scripts/build-review-bundle.mjs"), "--passport", input, "--out", output], { encoding: "utf8" });
  assert.equal(blocked.status, 1, "Unverified public facts must block bundle generation.");
  const blockedReport = JSON.parse(readFileSync(join(output, "generation-report.json"), "utf8"));
  assert.equal(blockedReport.status, "blocked");
  assert.ok(blockedReport.blockers.some(message => message.includes("unsafe public URL scheme")));
  console.log("PASS: public fact gating, module references and commercial-data isolation.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
