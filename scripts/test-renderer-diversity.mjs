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
  const firstOut = join(work, "first-bundle");
  build(firstPassport, firstOut);
  const firstHtml = readFileSync(join(firstOut, "preview.html"), "utf8");

  const alternate = JSON.parse(readFileSync(firstPassport, "utf8"));
  alternate.project.id = "synthetic-riverside-residence";
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

  const first = signature(firstHtml);
  const second = signature(secondHtml);
  assert.equal(first[0]?.module, "hero", "Each composition must begin with its hero.");
  assert.equal(second[0]?.module, "hero", "Alternate composition must begin with its hero.");
  assert.notDeepEqual(first, second, "Different project strategies must produce different module/variant compositions.");
  assert.ok(first.some(item => item.module === "gallery") && first.some(item => item.module === "quiz"), "First strategy fixture must exercise gallery and quiz modules.");
  assert.ok(second.some(item => item.module === "location") && second.some(item => item.module === "price") && second.some(item => item.module === "faq"), "Alternate strategy must exercise its own editorial modules.");
  assert.ok(secondHtml.includes("Синтетическая резиденция у воды"), "Alternate project identity must reach the rendered page.");
  assert.ok(secondHtml.includes('data-variant="full-bleed"') && secondHtml.includes('data-variant="location-led"') && secondHtml.includes('data-variant="conversion-led"'), "Alternate strategy variants must reach the actual HTML renderer.");
  assert.ok(!secondHtml.includes('data-module="gallery"') && !secondHtml.includes('data-module="quiz"'), "Modules excluded by the alternate passport must not leak into its page.");

  console.log("Renderer diversity passed.");
  console.log("Composition A: " + first.map(item => item.module + ":" + item.variant).join(" → "));
  console.log("Composition B: " + second.map(item => item.module + ":" + item.variant).join(" → "));
} finally {
  rmSync(work, { recursive: true, force: true });
}
