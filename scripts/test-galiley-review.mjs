import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const dir = resolve(process.argv[2] || "artifacts/galiley-review");
const profile = JSON.parse(readFileSync(join(dir, "project-profile.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(dir, "module-manifest.json"), "utf8"));
const report = JSON.parse(readFileSync(join(dir, "generation-report.json"), "utf8"));
const html = readFileSync(join(dir, "preview.html"), "utf8");

assert.equal(profile.project?.id, "galiley-voronezh");
assert.equal(profile.project?.name, "ЖК «Галилей»");
assert.equal(profile.design?.theme, "garden-modern");
assert.ok(Array.isArray(profile.facts) && profile.facts.length >= 10, "Expected sourced project facts.");
assert.equal((profile.assets || []).length, 0, "No media without confirmed rights may enter the preview.");
assert.ok(manifest.modules.some(item => item.moduleId === "hero"));
assert.ok(manifest.modules.some(item => item.moduleId === "lifestyle"));
assert.ok(manifest.modules.some(item => item.moduleId === "location"));
assert.ok(html.includes('data-theme="garden-modern"'), "Project-specific theme must reach rendered HTML.");
assert.ok(html.includes("ЖК «Галилей»"), "Project identity must reach rendered HTML.");
assert.ok(!html.includes("Клубный дом «905»"), "No KD905 identity may leak into the Galiley preview.");
assert.equal(report.publicationReadiness?.productionReady, false, "Research preview must remain non-production.");
console.log("Galiley review preview passed identity, theme, source-data and publication-safety checks.");
