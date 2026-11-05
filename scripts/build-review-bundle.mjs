import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}
const passportPath = resolve(arg("--passport", "examples/project-passport.example.json"));
const outDir = resolve(arg("--out", "review-bundle"));
const templatePath = resolve(arg("--template", "landing/reference/K15_landing_edited.html"));
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
const isCurrent = record => {
  const expiration = record?.expiresAt ?? record?.validUntil;
  if (!expiration) return true;
  const expiry = Date.parse(expiration);
  return Number.isFinite(expiry) && expiry >= Date.now();
};
const isSafePublicUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const isTraceableSource = source => Boolean(
  source && isSafePublicUrl(source.url) &&
  typeof source.title === "string" && source.title.trim() &&
  typeof source.accessedAt === "string" && Number.isFinite(Date.parse(source.accessedAt))
);
const publicFact = fact => fact?.status === "verified" && isCurrent(fact) &&
  ["allowed", "allowed_with_qualification"].includes(fact.publicUse) &&
  asArray(fact.sources).length > 0 && asArray(fact.sources).every(isTraceableSource);
const safeIdentity = value => typeof value === "string" && value.trim() &&
  !/(заполнить|уточнить|placeholder|todo)/i.test(value) ? value : null;

let template;
try {
  template = readFileSync(templatePath, "utf8");
} catch (error) {
  console.error(`Cannot read renderer template ${templatePath}: ${error.message}`);
  process.exit(1);
}
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
  if (["allowed", "allowed_with_qualification"].includes(fact.publicUse) && !isCurrent(fact)) {
    errors.push(`Fact "${fact.id}" is expired or has an invalid expiresAt date.`);
  }
  if (["allowed", "allowed_with_qualification"].includes(fact.publicUse) &&
      (asArray(fact.sources).length === 0 || !asArray(fact.sources).every(isTraceableSource))) {
    errors.push(`Public fact "${fact.id}" has missing or non-HTTPS traceable evidence sources.`);
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
  if (asset.status === "approved" && !isSafePublicUrl(asset.url)) errors.push(`Approved asset "${asset.id}" has an unsafe public URL scheme.`);
  if (asset.status === "approved" && !(typeof asset.rightsNote === "string" && asset.rightsNote.trim())) {
    errors.push(`Approved asset "${asset.id}" has no rightsNote for the review trail.`);
  }
  if (asset.status === "approved" && asset.projectMatch !== "confirmed") {
    errors.push(`Approved asset "${asset.id}" is not confirmed as belonging to this project.`);
  }
  if (asset.status === "approved" && asset.rightsStatus !== "confirmed") {
    errors.push(`Approved asset "${asset.id}" does not have confirmed usage rights.`);
  }
  if (asset.status === "approved" && (!asset.rightsSource?.url || !isSafePublicUrl(asset.rightsSource.url) || !asset.rightsSource?.title || !asset.rightsSource?.accessedAt)) {
    errors.push(`Approved asset "${asset.id}" has no traceable HTTPS rightsSource.`);
  }
  if (asset.status === "approved" && !isCurrent(asset)) {
    errors.push(`Approved asset "${asset.id}" has expired approval or an invalid validUntil date.`);
  }
  if (asset.group === "plans" && asset.type !== "plan") errors.push(`Asset "${asset.id}" is in assets.plans but type is not "plan".`);
}
for (const offer of offers) {
  if (offer.status === "active" && !offer.successMessage) warnings.push(`Active offer "${offer.id}" has no successMessage.`);
}
warn(asArray(passport.verification?.conflicts).length === 0, "Passport contains unresolved verification conflicts.");
warn(passport.verification?.manualReviewRequired !== true, "Passport explicitly requires manual review.");
warn(safeIdentity(passport.project?.name) !== null, "Project name is missing or remains a template placeholder.");
warn(safeIdentity(passport.project?.location?.city) !== null, "Project city is missing or remains a template placeholder.");
warn(assets.some(asset => asset.status === "approved"), "No approved media assets are available.");
warn(modules.some(module => module.decision === "include"), "No modules are marked include; review bundle will contain no active sections.");

const allowedFacts = facts.filter(publicFact);
const allowedAdvantages = advantages.filter(item =>
  asArray(item.supportingFactIds).length > 0 &&
  asArray(item.supportingFactIds).every(id => publicFact(factById.get(id)))
);
const approvedAssets = assets.filter(asset => asset.status === "approved" && isSafePublicUrl(asset.url) && asset.projectMatch === "confirmed" && asset.rightsStatus === "confirmed" && asset.rightsNote?.trim() && isSafePublicUrl(asset.rightsSource?.url) && asset.rightsSource?.title && asset.rightsSource?.accessedAt && isCurrent(asset));
const approvedAssetIds = new Set(approvedAssets.map(asset => asset.id));
for (const plan of asArray(passport.apartmentPlans)) {
  if (plan.status === "verified" && plan.publicUse === "allowed") {
    if (!asArray(plan.sources).length || !asArray(plan.sources).every(isTraceableSource)) errors.push(`Public apartment plan "${plan.id}" has missing or non-HTTPS traceable evidence sources.`);
    if (!isCurrent(plan)) errors.push(`Public apartment plan "${plan.id}" is expired or has an invalid expiry date.`);
    const asset = assetById.get(plan.assetId);
    if (!asset || asset.type !== "plan" || !approvedAssetIds.has(plan.assetId)) {
      errors.push(`Public apartment plan "${plan.id}" does not reference an approved, rights-cleared plan asset.`);
    }
  }
}
const publicApartmentPlans = asArray(passport.apartmentPlans)
  .filter(plan => plan.status === "verified" && plan.publicUse === "allowed" && asArray(plan.sources).length > 0 && asArray(plan.sources).every(isTraceableSource) && isCurrent(plan) && approvedAssetIds.has(plan.assetId))
  .map(({ id, title, rooms, areaSqm, floor, assetId, finishing }) => ({ id, title: title ?? null, rooms, areaSqm, floor: floor ?? null, assetId, finishing: finishing ?? null }));
const rawQuiz = passport.selectionQuiz;
const quizOffer = rawQuiz ? offerById.get(rawQuiz.resultOfferId) : null;
if (rawQuiz?.status === "approved" && (!quizOffer || quizOffer.status !== "active")) {
  errors.push(`Approved selection quiz references missing or inactive result offer "${rawQuiz.resultOfferId}".`);
}
const publicSelectionQuiz = rawQuiz?.status === "approved" && quizOffer?.status === "active"
  ? { title: rawQuiz.title, description: rawQuiz.description ?? null, resultOfferId: rawQuiz.resultOfferId,
      questions: asArray(rawQuiz.questions).map(question => ({ id: question.id, label: question.label,
        options: asArray(question.options).map(option => ({ id: option.id, label: option.label })) })) }
  : null;
for (const module of modules) {
  if (module.moduleId === "floor-plans" && module.decision === "include" && publicApartmentPlans.length === 0) {
    errors.push('The "floor-plans" module is included but has no verified, rights-cleared apartment plans.');
  }
  if (module.moduleId === "quiz" && module.decision === "include" && !publicSelectionQuiz) {
    errors.push('The "quiz" module is included but no approved selectionQuiz with an active result offer is available.');
  }
}
const activeOffers = offers.filter(offer => offer.status === "active").map(offer => ({
  id: offer.id,
  title: offer.title,
  type: offer.type,
  description: offer.description ?? null,
  requiredFields: asArray(offer.requiredFields)
}));
const publishableFactIds = new Set(allowedFacts.map(fact => fact.id));
const conditionalReady = item => {
  const requiredFactsReady = asArray(item.requiredFactIds).every(id => publishableFactIds.has(id));
  if (!requiredFactsReady) return false;
  switch (item.moduleId) {
    case "floor-plans":
    case "apartments":
      return publicApartmentPlans.length > 0;
    case "quiz":
      return Boolean(publicSelectionQuiz);
    case "gallery":
      return approvedAssets.some(asset => ["photo", "render", "video"].includes(asset.type));
    case "gift":
    case "presentation":
      return activeOffers.some(offer => offer.type === "presentation");
    case "mortgage":
      return activeOffers.some(offer => offer.type === "mortgage_estimate") &&
        publishableFactIds.has("mortgage-terms");
    case "contacts":
      return activeOffers.some(offer => ["consultation", "callback", "apartment_selection", "viewing"].includes(offer.type));
    default:
      // Unknown conditional modules stay out until an explicit renderer/contract exists.
      return false;
  }
};
const selectedModules = modules.filter(item => item.decision === "include" ||
  (item.decision === "conditional" && conditionalReady(item)));
const heroDecisions = selectedModules.filter(item => item.moduleId === "hero");
if (heroDecisions.length !== 1) errors.push(`A publishable composition must contain exactly one included "hero" module; found ${heroDecisions.length}.`);
const orderedModules = selectedModules
  .map((item, index) => ({ ...item, __sourceIndex: index }))
  .sort((a, b) => {
    if (a.moduleId === "hero") return b.moduleId === "hero" ? a.__sourceIndex - b.__sourceIndex : -1;
    if (b.moduleId === "hero") return 1;
    const ao = Number.isInteger(a.order) ? a.order : a.__sourceIndex + 1000;
    const bo = Number.isInteger(b.order) ? b.order : b.__sourceIndex + 1000;
    return ao - bo || a.__sourceIndex - b.__sourceIndex;
  })
  .map(({ __sourceIndex, ...item }) => item);
const orderedPositions = orderedModules.map(item => item.order).filter(Number.isInteger);
if (new Set(orderedPositions).size !== orderedPositions.length) errors.push("Included modules contain duplicate explicit order values.");
const publicValue = value => verified(value) ? value.value : null;
const positioningFactIds = asArray(passport.project?.positioningFactIds);
const positioningApproved = passport.project?.positioningStatus === "approved" &&
  positioningFactIds.length > 0 &&
  positioningFactIds.every(id => publicFact(factById.get(id)));
if (passport.project?.positioningStatus === "approved" && !positioningApproved) {
  errors.push("Project positioning is marked approved but lacks publishable supporting fact IDs.");
}
const designTheme = ["urban-noir", "warm-editorial", "garden-modern"].includes(passport.contentStrategy?.visualDirection?.theme)
  ? passport.contentStrategy.visualDirection.theme : "urban-noir";
const profile = {
  design: { theme: designTheme },
  project: {
    id: passport.project?.id ?? null,
    name: safeIdentity(passport.project?.name),
    city: safeIdentity(passport.project?.location?.city),
    address: publicValue(passport.project?.location?.address),
    district: publicValue(passport.project?.location?.district),
    developer: publicValue(passport.project?.developer),
    class: publicValue(passport.project?.class),
    positioning: positioningApproved ? passport.project.positioning : null,
    delivery: publicValue(passport.project?.delivery),
    constructionStatus: publicValue(passport.project?.constructionStatus)
  },
  facts: allowedFacts.map(({ id, claim, publicUse }) => ({ id, claim, publicUse })),
  advantages: allowedAdvantages,
  infrastructure: asArray(passport.infrastructure)
    .filter(item => item.status === "verified" && isTraceableSource(item.source))
    .map(({ name, category, distanceMeters, walkingMinutes, marketingMeaning, publicLabel }) =>
      ({ name, category, distanceMeters, walkingMinutes, marketingMeaning, publicLabel })),
  offers: activeOffers,
  apartmentPlans: publicApartmentPlans,
  selectionQuiz: publicSelectionQuiz,
  assets: approvedAssets.map(({ id, url, type, alt, usage }) => ({ id, url, type, alt, usage }))
};
const rendererAliases = {
  hero: "hero", key: "key", gallery: "gallery", about: "about", security: "security",
  quiz: "quiz", location: "location", places: "location", lifestyle: "lifestyle", life: "lifestyle",
  gift: "gift", presentation: "gift", apartments: "apartments", "floor-plans": "apartments",
  price: "price", developer: "developer", mortgage: "mortgage", steps: "steps", faq: "faq", contacts: "contacts"
};
const renderedSections = new Set(
  [...template.matchAll(/<section\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi)].map(match => match[1])
);
const specializedCapabilities = {
  hero: { status: "implemented", behavior: "Project identity, approved positioning, assigned media and contextual preview CTA." },
  gallery: { status: "implemented", behavior: "Responsive gallery of approved, rights-cleared media with alt text and media-type labels." },
  apartments: { status: "implemented", behavior: "Verified apartment-plan cards with plan-specific preview CTA context." },
  "floor-plans": { status: "implemented", behavior: "Verified apartment-plan cards with plan-specific preview CTA context." },
  quiz: { status: "implemented", behavior: "Required finite-choice answers are validated and kept local in review preview." }
};
const partialCapability = {
  status: "partial",
  behavior: "Generic editorial section: heading, approved facts, supported advantages, at most one assigned image and a preview CTA.",
  limitations: "No dedicated interaction, layout, navigation, calculation, map, FAQ accordion or production lead delivery is implied by this status."
};
const manifest = {
  projectId: passport.project?.id ?? null,
  modules: orderedModules.map((item, index) => {
    const capability = specializedCapabilities[item.moduleId] ?? (rendererAliases[item.moduleId] ? partialCapability : {
      status: "unsupported",
      behavior: "No explicit renderer implementation is registered."
    });
    return {
      order: Number.isInteger(item.order) ? item.order : index,
      moduleId: item.moduleId,
      rendererSectionId: rendererAliases[item.moduleId] ?? null,
      capability: { ...capability },
      decision: item.decision,
      reason: item.reason,
      variant: item.variant ?? null,
      requiredFactIds: asArray(item.requiredFactIds),
      assetIds: asArray(item.assetIds),
      ctaIds: asArray(item.ctaIds),
      dependencies: asArray(item.dependencies),
      qaCriteria: asArray(item.qaCriteria)
    };
  })
};
const missingRendererSections = manifest.modules
  .filter(item => !item.rendererSectionId || !renderedSections.has(item.rendererSectionId))
  .map(item => ({ moduleId: item.moduleId, rendererSectionId: item.rendererSectionId }));
const unsupportedCapabilities = manifest.modules
  .filter(item => item.capability.status === "unsupported")
  .map(item => item.moduleId);
for (const item of missingRendererSections) {
  errors.push(`Selected module "${item.moduleId}" has no matching section in the current renderer.`);
}
for (const moduleId of unsupportedCapabilities) {
  errors.push(`Selected module "${moduleId}" has no implemented renderer capability.`);
}
const rendererAudit = {
  status: missingRendererSections.length || unsupportedCapabilities.length ? "blocked" : "passed",
  renderedSections: [...renderedSections].sort(),
  selectedModules: manifest.modules.map(item => ({
    moduleId: item.moduleId,
    rendererSectionId: item.rendererSectionId,
    capability: item.capability
  })),
  capabilitySummary: {
    implemented: manifest.modules.filter(item => item.capability.status === "implemented").length,
    partial: manifest.modules.filter(item => item.capability.status === "partial").length,
    unsupported: unsupportedCapabilities.length
  },
  missingRendererSections,
  unsupportedCapabilities
};
const report = {
  reportVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  passportPath,
  projectId: passport.project?.id ?? null,
  status: errors.length ? "blocked" : "review_required",
  evidenceLedger: {
    facts: facts.map(({ id, claim, status, publicUse, expiresAt, sources }) => ({
      id, claim, status, publicUse, expiresAt: expiresAt ?? null, sources: asArray(sources)
    })),
    assets: assets.map(({ id, status, projectMatch, rightsStatus, rightsNote, rightsSource, validUntil }) => ({
      id, status, projectMatch: projectMatch ?? null, rightsStatus: rightsStatus ?? null,
      rightsNote: rightsNote ?? null, rightsSource: rightsSource ?? null, validUntil: validUntil ?? null
    })),
    infrastructure: asArray(passport.infrastructure).map(({ name, status, source }) => ({
      name, status, source: source ?? null
    }))
  },
  summary: {
    factsTotal: facts.length,
    factsPublishable: allowedFacts.length,
    advantagesTotal: advantages.length,
    advantagesPublishable: allowedAdvantages.length,
    modulesTotal: modules.length,
    modulesSelected: manifest.modules.length,
    compositionOrder: manifest.modules.map(item => item.moduleId),
    apartmentPlansPublishable: publicApartmentPlans.length,
    selectionQuizAvailable: Boolean(publicSelectionQuiz),
    offersActive: activeOffers.length,
    assetsTotal: assets.length,
    assetsApproved: approvedAssets.length
  },
  blockers: errors,
  warnings,
  rendererAudit,
  publicationReadiness: {
    status: errors.length ? "blocked" : "review_required",
    productionReady: false,
    gates: [
      { id: "passport_evidence", status: errors.length ? "blocked" : "passed" },
      { id: "section_renderer_contract", status: missingRendererSections.length ? "blocked" : "passed" },
      { id: "privacy_notice", status: "pending_manual_configuration" },
      { id: "lead_delivery", status: "pending_integration_test" },
      { id: "claims_and_project_copy", status: "pending_manual_review" },
      { id: "responsive_visual_qa", status: "pending_browser_review" }
    ],
    note: "A review bundle is never production-ready by itself; legal, integration and human review gates remain separate."
  },
  boundaries: [
    "This is a review-only intermediate bundle, not a publishable landing page.",
    "No K15 HTML, prices, contacts, coordinates, endpoints, analytics IDs or commercial secrets are copied.",
    "Evidence URLs and media-rights metadata stay in the internal generation report, not the public project profile.",
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
