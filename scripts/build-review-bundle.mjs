import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const passportPath = resolve(arg("--passport", "examples/project-passport.example.json"));
const outDir = resolve(arg("--out", "review-bundle"));
const errors = [];
const warnings = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const warn = (condition, message) => { if (!condition) warnings.push(message); };
const uniqueBy = (items, key) => {
  const values = items.map(item => item?.[key]).filter(Boolean);
  return values.length === new Set(values).size;
};
const asArray = value => Array.isArray(value) ? value : [];
const verified = value => value?.status === "verified" && asArray(value.sources).length > 0;
const publicFact = fact => fact?.status === "verified" &&
  ["allowed", "allowed_with_qualification"].includes(fact.publicUse) &&
  asArray(fact.sources).length > 0;

let passport;
try {
  passport = JSON.parse(readFileSync(passportPath, "utf8"));
} catch (error) {
  console.error(`Cannot read passport ${passportPath}: ${error.message}`);
  process.exit(1);
}

check(passport && typeof passport === "object" && !Array.isArray(passport), "Passport root must be an object.");
check(passport?.schemaVersion === "1.0.0", "Unsupported passport schemaVersion; expected 1.0.0.");
check(typeof passport?.project?.id === "string" && /^[a-z0-9][a-z0-9-]*$/.test(passport.project.id), "project.id must be a lowercase slug.");
check(typeof passport?.project?.name === "string" && passport.project.name.trim().length > 0, "project.name is required.");
check(typeof passport?.project?.location?.city === "string" && passport.project.location.city.trim().length > 0, "project.location.city is required.");

const facts = asArray(passport.facts);
const advantages = asArray(passport.advantages);
const modules = asArray(passport.contentStrategy?.modules);
const offers = asArray(passport.offers);
const assetGroups = passport.assets && typeof passport.assets === "object" ? passport.assets : {};
const assets = Object.entries(assetGroups).flatMap(([group, items]) => asArray(items).map(item => ({ ...item, group })));
const factById = new Map(facts.map(fact => [fact.id, fact]));
const offerById = new Map(offers.map(offer => [offer.id, offer]));
const assetById = new Map(assets.map(asset => [asset.id, asset]));

check(uniqueBy(facts, "id"), "facts[] contains duplicate or empty IDs.");
check(uniqueBy(advantages, "id"), "advantages[] contains duplicate or empty IDs.");
check(uniqueBy(modules, "moduleId"), "contentStrategy.modules[] contains duplicate or empty moduleId values.");
check(uniqueBy(offers, "id"), "offers[] contains duplicate or empty IDs.");
check(uniqueBy(assets, "id"), "assets contains duplicate or empty IDs.");

for (const fact of facts) {
  if (fact.status === "verified" && asArray(fact.sources).length === 0) {
    errors.push(`Verified fact "${fact.id}" has no source.`);
  }
  if (["allowed", "allowed_with_qualification"].includes(fact.publicUse) && fact.status !== "verified") {
    errors.push(`Fact "${fact.id}" is public-eligible but status is ${fact.status}; only verified facts may be published.`);
  }
  if (fact.publicUse === "allowed" && asArray(fact.sources).length === 0) {
    errors.push(`Public fact "${fact.id}" has no evidence source.`);
  }
}
for (const advantage of advantages) {
  const support = asArray(advantage.supportingFactIds);
  if (support.length === 0) errors.push(`Advantage "${advantage.id}" has no supportingFactIds.`);
  for (const id of support) {
    const fact = factById.get(id);
    if (!fact) errors.push(`Advantage "${advantage.id}" references unknown fact "${id}".`);
    else if (!publicFact(fact)) errors.push(`Advantage "${advantage.id}" relies on non-publishable fact "${id}".`);
  }
}
for (const module of modules) {
  for (const id of asArray(module.requiredFactIds)) {
    const fact = factById.get(id);
    if (!fact) errors.push(`Module "${module.moduleId}" requires unknown fact "${id}".`);
    else if (!publicFact(fact)) errors.push(`Module "${module.moduleId}" requires non-publishable fact "${id}".`);
  }
  for (const id of asArray(module.assetIds)) {
    if (!assetById.has(id)) errors.push(`Module "${module.moduleId}" references unknown asset "${id}".`);
    else if (assetById.get(id).status !== "approved") errors.push(`Module "${module.moduleId}" references asset "${id}" that is not approved.`);
  }
  for (const id of asArray(module.ctaIds)) {
    if (!offerById.has(id)) errors.push(`Module "${module.moduleId}" references unknown offer "${id}".`);
    else if (offerById.get(id).status !== "active") errors.push(`Module "${module.moduleId}" references inactive offer "${id}".`);
  }
}
for (const asset of assets) {
  if (asset.status === "approved" && !asset.url) errors.push(`Approved asset "${asset.id}" has no URL.`);
  if (asset.group === "plans" && asset.type !== "plan") errors.push(`Asset "${asset.id}" is in assets.plans but type is not "plan".`);
}
for (const offer of offers) {
  if (offer.status === "active" && !offer.successMessage) warnings.push(`Active offer "${offer.id}" has no successMessage.`);
}
warn(asArray(passport.verification?.conflicts).length === 0, "Passport contains unresolved verification conflicts.");
warn(passport.verification?.manualReviewRequired !== true, "Passport explicitly requires manual review.");
warn(assets.some(asset => asset.status === "approved"), "No approved media assets are available.");
warn(modules.some(module => module.decision === "include"), "No modules are marked include; review bundle will contain no active sections.");

const allowedFacts = facts.filter(publicFact);
const allowedAdvantages = advantages.filter(item =>
  asArray(item.supportingFactIds).length > 0 &&
  asArray(item.supportingFactIds).every(id => publicFact(factById.get(id)))
);
const approvedAssets = assets.filter(asset => asset.status === "approved" && asset.url);
const activeOffers = offers.filter(offer => offer.status === "active");
const publicValue = value => verified(value) ? value.value : null;
const profile = {
  project: {
    id: passport.project?.id ?? null,
    name: passport.project?.name ?? null,
    city: passport.project?.location?.city ?? null,
    address: publicValue(passport.project?.location?.address),
    district: publicValue(passport.project?.location?.district),
    developer: publicValue(passport.project?.developer),
    class: publicValue(passport.project?.class),
    positioning: passport.project?.positioning ?? null,
    delivery: publicValue(passport.project?.delivery),
    constructionStatus: publicValue(passport.project?.constructionStatus)
  },
  facts: allowedFacts.map(({ id, claim, publicUse, sources }) => ({ id, claim, publicUse, sourceIds: sources.map((_, index) => `${id}:source:${index + 1}`) })),
  advantages: allowedAdvantages,
  infrastructure: asArray(passport.infrastructure).filter(item => item.status === "verified" && item.source),
  offers: activeOffers,
  assets: approvedAssets
};
const manifest = {
  projectId: passport.project?.id ?? null,
  modules: modules.filter(item => ["include", "conditional"].includes(item.decision)).map(item => ({
    moduleId: item.moduleId,
    decision: item.decision,
    reason: item.reason,
    variant: item.variant ?? null,
    requiredFactIds: asArray(item.requiredFactIds),
    assetIds: asArray(item.assetIds),
    ctaIds: asArray(item.ctaIds),
    dependencies: asArray(item.dependencies),
    qaCriteria: asArray(item.qaCriteria)
  }))
};
const report = {
  reportVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  passportPath,
  projectId: passport.project?.id ?? null,
  status: errors.length ? "blocked" : warnings.length ? "review_required" : "ready_for_renderer_mapping",
  summary: {
    factsTotal: facts.length,
    factsPublishable: allowedFacts.length,
    advantagesTotal: advantages.length,
    advantagesPublishable: allowedAdvantages.length,
    modulesTotal: modules.length,
    modulesSelected: manifest.modules.length,
    offersActive: activeOffers.length,
    assetsTotal: assets.length,
    assetsApproved: approvedAssets.length
  },
  blockers: errors,
  warnings,
  boundaries: [
    "This is a review-only intermediate bundle, not a publishable landing page.",
    "No K15 HTML, prices, contacts, coordinates, endpoints, analytics IDs or commercial secrets are copied.",
    "Renderer compatibility, asset rights, live integrations and visual QA require separate gates."
  ]
};

mkdirSync(outDir, { recursive: true });
for (const [name, value] of Object.entries({
  "project-profile.json": profile,
  "module-manifest.json": manifest,
  "generation-report.json": report
})) {
  const target = resolve(outDir, name);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(value, null, 2) + "\n", "utf8");
}
console.log(`Review bundle written to ${outDir}`);
console.log(`Status: ${report.status}; publishable facts: ${allowedFacts.length}/${facts.length}; selected modules: ${manifest.modules.length}`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
for (const error of errors) console.error(`BLOCK: ${error}`);
if (errors.length) process.exit(1);
