import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const work = mkdtempSync(join(tmpdir(), "klanding-diversity-"));
const run = (script, args) => execFileSync(process.execPath, [resolve(root, script), ...args], {
  cwd: root, stdio: "pipe", encoding: "utf8"
});
const build = (passport, out) => {
  run("scripts/build-review-bundle.mjs", ["--passport", passport, "--out", out]);
  run("scripts/render-review-preview.mjs", ["--bundle", out, "--out", join(out, "preview.html")]);
};
const signature = html => [...html.matchAll(/<section class="module[^"]*" data-module="([^"]+)" data-variant="([^"]+)"/g)]
  .map(match => ({ module: match[1], variant: match[2] }));

try {
  const firstPassport = join(work, "first.json");
  run("scripts/create-browser-preview-fixture.mjs", ["--out", firstPassport]);
  const firstData = JSON.parse(readFileSync(firstPassport, "utf8"));
  firstData.contentStrategy.visualDirection.theme = "warm-editorial";
  firstData.contentStrategy.visualDirection.composition = "editorial";
  writeFileSync(firstPassport, JSON.stringify(firstData, null, 2) + "\n");
  const firstOut = join(work, "first-bundle");
  build(firstPassport, firstOut);
  const firstHtml = readFileSync(join(firstOut, "preview.html"), "utf8");
  const firstManifest = JSON.parse(readFileSync(join(firstOut, "module-manifest.json"), "utf8"));
  const firstReport = JSON.parse(readFileSync(join(firstOut, "generation-report.json"), "utf8"));

  const alternate = JSON.parse(readFileSync(firstPassport, "utf8"));
  alternate.project.id = "synthetic-riverside-residence";
  alternate.contentStrategy.visualDirection.theme = "garden-modern";
  alternate.contentStrategy.visualDirection.composition = "architectural";
  alternate.project.name = "Синтетическая резиденция у воды";
  alternate.project.positioning = "Другой сценарий композиции: выразительная архитектура и городской маршрут.";
  alternate.contentStrategy.modules = [
    { moduleId: "hero", decision: "include", reason: "Alternate hero", variant: "full-bleed", assetIds: ["fixture-hero"], ctaIds: ["presentation"] },
    { moduleId: "location", decision: "include", reason: "Location narrative", variant: "location-led", userQuestion: "Как устроен городской маршрут?", requiredFactIds: ["fixture-positioning-proof"] },
    { moduleId: "about", decision: "include", reason: "Feature-led story", variant: "feature-led", userQuestion: "Что формирует характер проекта?", requiredFactIds: ["fixture-positioning-proof"], assetIds: ["fixture-gallery"] },
    { moduleId: "price", decision: "include", reason: "Conversion section", variant: "conversion-led", ctaIds: ["selection"] },
    { moduleId: "faq", decision: "include", reason: "Closing questions", variant: "proof-led", requiredFactIds: ["fixture-positioning-proof"] }
  ];
  const secondPassport = join(work, "second.json");
  writeFileSync(secondPassport, JSON.stringify(alternate, null, 2) + "\n");
  const secondOut = join(work, "second-bundle");
  build(secondPassport, secondOut);
  const secondHtml = readFileSync(join(secondOut, "preview.html"), "utf8");
  const secondManifest = JSON.parse(readFileSync(join(secondOut, "module-manifest.json"), "utf8"));
  const secondReport = JSON.parse(readFileSync(join(secondOut, "generation-report.json"), "utf8"));

  const first = signature(firstHtml);
  const second = signature(secondHtml);
  assert.equal(first[0]?.module, "hero", "Each composition must begin with its hero.");
  assert.equal(second[0]?.module, "hero", "Alternate composition must begin with its hero.");
  assert.notDeepEqual(first, second, "Different project strategies must produce different module/variant compositions.");
  assert.ok(firstHtml.includes('data-theme="warm-editorial" data-composition="editorial"'), "First strategy must select its palette and editorial composition independently.");
  assert.ok(firstHtml.includes("--bg:#f3eee5") && firstHtml.includes('font-family:Georgia,"Times New Roman",serif'), "Warm editorial must change actual surface, palette and typography tokens.");
  assert.ok(first.some(item => item.module === "gallery") && first.some(item => item.module === "quiz"), "First strategy fixture must exercise gallery and quiz modules.");
  assert.ok(second.some(item => item.module === "location") && second.some(item => item.module === "price") && second.some(item => item.module === "faq"), "Alternate strategy must exercise its own editorial modules.");
  assert.ok(secondHtml.includes('data-theme="garden-modern" data-composition="architectural"'), "Alternate strategy must select its palette and architectural composition independently.");
  assert.ok(secondHtml.includes("--bg:#101b18") && secondHtml.includes("font-family:Inter,Arial,sans-serif"), "Garden modern must change actual surface, palette and typography tokens.");
  assert.ok(secondHtml.includes('body[data-composition="architectural"] .module') && secondHtml.includes('body[data-composition="architectural"] figure'), "Architectural composition must change grid geometry and image framing, not only metadata.");
  assert.ok(firstHtml.includes('body[data-composition="editorial"] .module') && firstHtml.includes('body[data-composition="editorial"] h1'), "Editorial composition must define its own page rhythm and typography.");
  assert.ok(secondHtml.includes("Синтетическая резиденция у воды"), "Alternate project identity must reach the rendered page.");
  assert.ok(secondHtml.includes('data-variant="full-bleed"') && secondHtml.includes('data-variant="location-led"') && secondHtml.includes('data-variant="conversion-led"'), "Alternate strategy variants must reach the actual HTML renderer.");
  assert.ok(!secondHtml.includes('data-module="gallery"') && !secondHtml.includes('data-module="quiz"'), "Modules excluded by the alternate passport must not leak into its page.");

  const firstCapabilities = new Map(firstManifest.modules.map(item => [item.moduleId, item.capability]));
  const secondCapabilities = new Map(secondManifest.modules.map(item => [item.moduleId, item.capability]));
  assert.equal(firstCapabilities.get("hero")?.status, "implemented", "Hero must declare its actual specialized capability.");
  assert.equal(firstCapabilities.get("gallery")?.status, "implemented", "Gallery must declare its actual specialized capability.");
  assert.equal(firstCapabilities.get("quiz")?.status, "implemented", "Quiz must declare its actual specialized capability.");
  assert.equal(firstCapabilities.get("lifestyle")?.status, "partial", "Generic editorial sections must not be mislabeled as fully implemented.");
  assert.equal(secondCapabilities.get("location")?.status, "implemented", "Verified nearby-place cards are a specialized renderer capability without implying map or route behavior.");
  assert.deepEqual(firstReport.rendererAudit.capabilitySummary, { implemented: 7, partial: first.length - 7, unsupported: 0 });
  assert.deepEqual(secondReport.rendererAudit.capabilitySummary, { implemented: 3, partial: second.length - 3, unsupported: 0 });
  assert.equal(firstReport.rendererAudit.status, "passed");
  assert.equal(secondReport.rendererAudit.status, "passed");
  assert.ok(firstManifest.modules.every(item => ["implemented", "partial", "unsupported"].includes(item.capability?.status)), "Every selected module must declare a capability state.");

  console.log("Renderer diversity and capability contract passed.");
  console.log("Composition A: " + first.map(item => item.module + ":" + item.variant).join(" → "));
  console.log("Composition B: " + second.map(item => item.module + ":" + item.variant).join(" → "));
} finally {
  rmSync(work, { recursive: true, force: true });
}
