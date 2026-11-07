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
  passport.project.positioningStatus = "approved";
  passport.project.positioningFactIds = ["verified-1"];
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
  passport.contentStrategy.heroCopy = {
    headline: "Тестовый ЖК — приватность в центре города",
    lead: passport.project.positioning,
    supportingFactIds: ["verified-1"],
    proofPoints: [{ label: "Подтверждённый факт", factId: "verified-1" }, { label: "Ещё один факт", factId: "verified-1" }]
  };
  passport.contentStrategy.modules = [
    { moduleId: "hero", order: 0, decision: "include", reason: "Главный блок", requiredFactIds: ["verified-1"], assetIds: ["hero"], ctaIds: ["presentation", "selection"] },
    { moduleId: "gallery", order: 20, decision: "include", reason: "Проверка галереи", assetIds: ["hero", "gallery-2"] },
    { moduleId: "floor-plans", order: 10, decision: "include", reason: "Проверка планировок", assetIds: ["plan-asset"], ctaIds: ["selection"] },
    { moduleId: "quiz", order: 30, decision: "include", reason: "Проверка квиза", ctaIds: ["selection"] },
    { moduleId: "mortgage", order: 40, decision: "conditional", reason: "Условия не подтверждены" }
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
  assert.equal(profile.marketing.headline, "Тестовый ЖК — приватность в центре города");
  assert.equal(profile.marketing.proofPoints.length, 2);
  assert.equal(report.rendererAudit.status, "passed");
  const manifest = JSON.parse(readFileSync(join(output, "module-manifest.json"), "utf8"));
  assert.deepEqual(manifest.modules.map(item => item.moduleId), ["hero", "floor-plans", "gallery", "quiz"], "Explicit composition order must be respected, with hero fixed first.");
  assert.equal(report.publicationReadiness.productionReady, false);
  assert.ok(!report.rendererAudit.selectedModules.some(item => item.moduleId === "mortgage"),
    "conditional mortgage without verified terms must stay out of the selected composition");

  // Public media and the evidence trail for usage rights must use HTTPS.
  for (const [label, mutate, expected] of [
    ["http-media-url", candidate => { candidate.assets.images[0].url = "http://example.com/hero.webp"; }, "unsafe public URL scheme"],
    ["http-rights-source", candidate => { candidate.assets.images[0].rightsSource.url = "http://example.com/rights"; }, "traceable HTTPS rightsSource"]
  ]) {
    const insecure = structuredClone(passport);
    mutate(insecure);
    const insecureInput = join(dir, label + ".json");
    const insecureOutput = join(dir, label + "-output");
    writeFileSync(insecureInput, JSON.stringify(insecure));
    const insecureBuild = spawnSync(process.execPath, [resolve("scripts/build-review-bundle.mjs"), "--passport", insecureInput, "--out", insecureOutput], { encoding: "utf8" });
    assert.equal(insecureBuild.status, 1, label + " must block generation.");
    const insecureReport = JSON.parse(readFileSync(join(insecureOutput, "generation-report.json"), "utf8"));
    assert.ok(insecureReport.blockers.some(message => message.includes(expected)), label + " must report the HTTPS policy violation.");
  }

  // Public facts and apartment plans must cite traceable HTTPS evidence, not merely any URL.
  for (const [label, mutate, expected] of [
    ["http-fact-source", candidate => { candidate.facts[0].sources[0].url = "http://example.com/project"; }, "non-HTTPS traceable evidence"],
    ["http-plan-source", candidate => { candidate.apartmentPlans[0].sources[0].url = "http://example.com/plan-data"; }, "non-HTTPS traceable evidence"]
  ]) {
    const untraceable = structuredClone(passport);
    mutate(untraceable);
    const untraceableInput = join(dir, label + ".json");
    const untraceableOutput = join(dir, label + "-output");
    writeFileSync(untraceableInput, JSON.stringify(untraceable));
    const untraceableBuild = spawnSync(process.execPath, [resolve("scripts/build-review-bundle.mjs"), "--passport", untraceableInput, "--out", untraceableOutput], { encoding: "utf8" });
    assert.equal(untraceableBuild.status, 1, label + " must block generation.");
    const untraceableReport = JSON.parse(readFileSync(join(untraceableOutput, "generation-report.json"), "utf8"));
    assert.ok(untraceableReport.blockers.some(message => message.includes(expected)), label + " must report the evidence URL violation.");
  }

  // Invalid compositions must be blocked before any review bundle can be published.
  for (const [label, mutate, expected] of [
    ["duplicate-hero", candidate => candidate.contentStrategy.modules.push({ ...candidate.contentStrategy.modules[0], order: 5 }), "found 2"],
    ["duplicate-order", candidate => { candidate.contentStrategy.modules[1].order = candidate.contentStrategy.modules[2].order; }, "duplicate explicit order"]
  ]) {
    const invalid = structuredClone(passport);
    mutate(invalid);
    const invalidInput = join(dir, label + ".json");
    const invalidOutput = join(dir, label + "-output");
    writeFileSync(invalidInput, JSON.stringify(invalid));
    const invalidBuild = spawnSync(process.execPath, [resolve("scripts/build-review-bundle.mjs"), "--passport", invalidInput, "--out", invalidOutput], { encoding: "utf8" });
    assert.equal(invalidBuild.status, 1, label + " must block generation.");
    const invalidReport = JSON.parse(readFileSync(join(invalidOutput, "generation-report.json"), "utf8"));
    assert.ok(invalidReport.blockers.some(message => message.includes(expected)), label + " blocker must be explicit.");
  }
  assert.equal(profile.facts.length, 1);
  assert.equal(profile.apartmentPlans.length, 1);
  assert.equal(profile.selectionQuiz.questions.length, 1);
  assert.equal(profile.offers[0].successMessage, undefined, "Internal success copy must not leak into the public preview profile.");
  assert.deepEqual(Object.keys(profile.offers[0]).sort(), ["consentRequired", "description", "id", "requiredFields", "scenarioId", "title", "type"].sort());
  assert.equal(profile.offers[0].scenarioId, profile.offers[0].id, "Legacy offers must receive a stable scenarioId fallback.");
  assert.equal(profile.offers[0].consentRequired, true, "Consent must be required by default.");
  const preview = spawnSync(process.execPath, [
    resolve("scripts/render-review-preview.mjs"), "--bundle", output,
    "--out", join(output, "preview.html")
  ], { encoding: "utf8" });
  assert.equal(preview.status, 0, preview.stderr || preview.stdout);
  const html = readFileSync(join(output, "preview.html"), "utf8");
  assert.ok(html.includes("Тестовый ЖК"));
  assert.ok(html.includes('<h1 id="heading-0">Тестовый ЖК — приватность в центре города</h1>'));
  assert.ok(html.includes("Подтверждённый факт"));
  assert.ok(html.includes('data-preview-cta="selection"'), "Every CTA assigned to the hero must be rendered.");
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
  const sectionOrder = ["hero", "floor-plans", "gallery", "quiz"].map(id => html.indexOf('data-module="' + id + '"'));
  assert.ok(sectionOrder.every((position, index) => position >= 0 && (index === 0 || position > sectionOrder[index - 1])), "Rendered HTML must preserve the strategist-defined module order.");
  assert.ok(!html.includes("Главный блок"), "Internal module rationale must never be exposed as visitor-facing hero copy.");
  assert.ok(html.includes('data-variant="plan-selector"') || html.includes('data-variant="default"'), "Module layout variant must reach rendered HTML.");
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
  secondPassport.contentStrategy.heroCopy.headline = "Второй независимый ЖК — новый проект";
  secondPassport.contentStrategy.heroCopy.lead = "Второй независимый объект с отдельной подтверждённой историей.";
  secondPassport.contentStrategy.heroCopy.supportingFactIds = ["verified-1"];
  secondPassport.contentStrategy.heroCopy.proofPoints = [{ label: "Факт второго объекта", factId: "verified-1" }, { label: "Подтверждение", factId: "verified-1" }];
  secondPassport.facts[0].claim = "Уникальный факт второго объекта";
  const secondInput = join(dir, "second-passport.json");
  const secondOutput = join(dir, "second-output");
  writeFileSync(secondInput, JSON.stringify(secondPassport));
  const secondBuild = spawnSync(process.execPath, [resolve("scripts/build-review-bundle.mjs"), "--passport", secondInput, "--out", secondOutput], { encoding: "utf8" });
  assert.equal(secondBuild.status, 0, secondBuild.stderr || secondBuild.stdout);
  const secondProfile = JSON.parse(readFileSync(join(secondOutput, "project-profile.json"), "utf8"));
  const secondText = JSON.stringify(secondProfile);
  const secondPreview = spawnSync(process.execPath, [
    resolve("scripts/render-review-preview.mjs"), "--bundle", secondOutput,
    "--out", join(secondOutput, "preview.html")
  ], { encoding: "utf8" });
  assert.equal(secondPreview.status, 0, secondPreview.stderr || secondPreview.stdout);
  const secondHtml = readFileSync(join(secondOutput, "preview.html"), "utf8");
  assert.ok(secondHtml.includes("Второй независимый ЖК"));
  assert.ok(!secondHtml.includes("Тестовый ЖК"));
  assert.ok(!secondHtml.includes("K15"));
  assert.equal(secondProfile.project.id, "second-test-project");
  assert.equal(secondProfile.project.name, "Второй независимый ЖК");
  assert.ok(secondText.includes("Уникальный факт второго объекта"));
  assert.ok(!secondText.includes("Тестовый ЖК"));
  assert.ok(!secondText.includes("Подтверждённое утверждение"));

  passport.project.positioningFactIds = ["missing-fact-id"];
  writeFileSync(input, JSON.stringify(passport));
  const unsupportedPositioning = spawnSync(process.execPath, [resolve("scripts/build-review-bundle.mjs"), "--passport", input, "--out", output], { encoding: "utf8" });
  assert.equal(unsupportedPositioning.status, 1, "Approved positioning without public evidence must block bundle generation.");
  const positioningReport = JSON.parse(readFileSync(join(output, "generation-report.json"), "utf8"));
  assert.ok(positioningReport.blockers.some(message => message.includes("positioning is marked approved")));

  passport.project.positioningFactIds = ["verified-1"];
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
