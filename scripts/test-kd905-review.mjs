import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const bundle = resolve(process.argv[2] || "artifacts/kd905-review");
const read = name => JSON.parse(readFileSync(join(bundle, name), "utf8"));
const profile = read("project-profile.json");
const manifest = read("module-manifest.json");
const report = read("generation-report.json");
const html = readFileSync(join(bundle, "preview.html"), "utf8");
const lowerHtml = html.toLocaleLowerCase("ru-RU");

assert.equal(profile.project.id, "kd-905-voronezh");
assert.equal(profile.project.name, "Клубный дом «905»");
assert.equal(profile.project.city, "Воронеж");
assert.equal(profile.design.theme, "warm-editorial");
assert.equal(report.status, "review_required");
assert.equal(report.publicationReadiness.productionReady, false);
assert.equal(report.publicationReadiness.status, "review_required");
assert.equal(report.rendererAudit.status, "passed");
assert.deepEqual(report.rendererAudit.capabilitySummary, { implemented: 2, partial: 4, unsupported: 0 });
assert.ok(report.warnings.includes("Passport contains unresolved verification conflicts."));
assert.ok(report.warnings.includes("Passport explicitly requires manual review."));
assert.ok(report.warnings.includes("No approved media assets are available."));
const gates = Object.fromEntries(report.publicationReadiness.gates.map(gate => [gate.id, gate.status]));
assert.deepEqual(gates, {
  passport_evidence: "passed",
  section_renderer_contract: "passed",
  privacy_notice: "pending_manual_configuration",
  lead_delivery: "pending_integration_test",
  claims_and_project_copy: "pending_manual_review",
  responsive_visual_qa: "pending_browser_review"
});

assert.ok(profile.facts.length >= 5, "The real-project preview should contain verified facts from its own passport.");
assert.ok(profile.facts.some(fact => fact.id === "total-apartments" && fact.claim.includes("45 квартир")));
assert.ok(profile.facts.some(fact => fact.id === "quiet-street"));
assert.ok(!profile.facts.some(fact => fact.id === "delivery-date"), "Unverified delivery claims must not be emitted.");

const selected = manifest.modules.map(module => module.moduleId);
assert.deepEqual(selected, ["hero", "key", "about", "lifestyle", "security", "location"]);
assert.ok(html.includes("Клубный дом «905»"));
assert.ok(html.includes('data-theme="warm-editorial"') && html.includes('data-composition="editorial"'));
assert.ok(html.includes("В доме заявлено 45 квартир всего."));
assert.equal((html.match(/45 квартир/g) || []).length, 1, "The same apartment-count claim must not repeat across sections.");
assert.ok(html.includes("ул. Революции 1905 года, 14"));
assert.ok(!html.includes("Вопросы и ответы"), "A generic fact list must not masquerade as a functional FAQ.");
assert.ok(html.includes("text-only"), "Sections without approved media must use a full-width text layout.");
assert.ok(lowerHtml.includes("подземный паркинг"));
assert.ok(lowerHtml.includes("движения автомобилей"));
assert.ok(!html.includes("K15"));
assert.ok(!html.includes("Синтетическая резиденция"));

assert.equal(profile.assets.length, 0, "Rights-restricted developer media must not leak into the preview.");
assert.equal(profile.offers.length, 0, "No unapproved lead offers may be invented.");
assert.equal(report.summary.assetsApproved, 0);
assert.equal(report.summary.offersActive, 0);
assert.equal(profile.project.delivery, null, "Unverified delivery information must stay out of the public profile.");
assert.equal(profile.project.constructionStatus, null, "Unknown construction status must stay unpublished.");
assert.equal(profile.project.positioning, null, "Draft positioning must not be presented as approved copy.");
assert.ok(!/<form\b/i.test(html), "No fake lead form or nonfunctional quiz may appear.");
assert.ok(!/<button\b[^>]*data-preview-cta=/i.test(html), "No CTA may imply a working KEY lead route.");
assert.ok(html.includes("Не является опубликованной страницей и не принимает заявки."));
assert.ok(html.includes('name="robots" content="noindex,nofollow"'));

console.log("KD 905 review preview passed project-isolation, evidence, rights, inventory and no-false-lead checks.");
