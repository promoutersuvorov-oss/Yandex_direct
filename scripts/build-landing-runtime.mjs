import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateLandingBriefReferences } from "../src/landing-brief.mjs";
import { normalizePassportV1 } from "../src/passport-normalizer-v1.mjs";
import { normalizeLandingInputsV1 } from "../src/landing-inputs-normalizer-v1.mjs";
import { buildLandingProfileFromKnowledgeWithDiagnostics } from "../src/landing-runtime-builder-v1.mjs";

const COPY_KEYS = [
  "heroKicker", "headline", "lead", "conceptTitle", "conceptCopy",
  "advantagesTitle", "advantagesIntro", "visualTitle", "visualCopy",
  "apartmentsTitle", "apartmentsIntro", "locationTitle", "locationCopy",
  "closingTitle", "closingCopy"
];
const MODULE_MAP = Object.freeze({
  concept: "concept", advantages: "advantages", "visual-story": "visual-story",
  "floor-plans": "apartments", apartments: "apartments", location: "location",
  calculator: "calculator", mortgage: "calculator", selection: "selection",
  quiz: "selection"
});
const PALETTES = Object.freeze({
  "urban-noir": { paper: "#f0efec", paperDeep: "#e2e0db", ink: "#202326", forest: "#252d33", sage: "#a9afb0", accent: "#b7a58e" },
  "warm-editorial": { paper: "#f4f2ed", paperDeep: "#e9e6de", ink: "#252823", forest: "#28362f", sage: "#aeb8a7", accent: "#b7a98f" },
  "garden-modern": { paper: "#f1f3ed", paperDeep: "#e3e9df", ink: "#263029", forest: "#30483a", sage: "#a9bca8", accent: "#c2b58f" }
});
const OFFER_MAP = Object.freeze({
  presentation: "presentation",
  apartment_selection: "quiz",
  mortgage_estimate: "calculator",
  viewing: "viewing",
  consultation: "consultation",
  callback: "callback",
  other: "other"
});
const isObject = value => value && typeof value === "object" && !Array.isArray(value);
const nonEmpty = value => typeof value === "string" && value.trim().length > 0;
const future = (value, now) => !value || (Number.isFinite(Date.parse(value)) && Date.parse(value) > now);
const clone = value => JSON.parse(JSON.stringify(value));

function publishableFactIds(passport, now) {
  const ids = new Set();
  for (const fact of passport.facts || []) {
    if (fact.status === "verified" && ["allowed", "allowed_with_qualification"].includes(fact.publicUse) &&
        fact.sources?.length && future(fact.expiresAt, now)) ids.add(fact.id);
  }
  return ids;
}
function assertClaims(copy, factIds) {
  const claims = copy.claimFactIds || {};
  for (const [key, ids] of Object.entries(claims)) {
    if (!COPY_KEYS.includes(key)) throw new Error(`Unknown marketing copy key in claimFactIds: ${key}`);
    if (!Array.isArray(ids) || ids.length === 0) throw new Error(`Claim mapping for ${key} must contain fact IDs`);
    for (const id of ids) if (!factIds.has(id)) throw new Error(`Marketing claim ${key} references non-publishable fact: ${id}`);
  }
}
function approvedAsset(asset, now) {
  return asset && asset.status === "approved" && asset.projectMatch === "confirmed" &&
    asset.rightsStatus === "confirmed" && nonEmpty(asset.url) && future(asset.validUntil, now) &&
    /^https:\/\//i.test(asset.url);
}
function mapOffer(offer) {
  if (!offer || offer.status !== "active" || offer.consentRequired === false) return null;
  const id = OFFER_MAP[offer.type];
  if (!id) return null;
  return { id, offerId: offer.id, type: offer.type, title: offer.title, scenarioId: offer.scenarioId || offer.id,
    description: offer.description || "Специалист KEY поможет разобраться в проекте и ответит на ваши вопросы." };
}

function buildMarketingStrategy(brief, passport, facts, now) {
  if (brief == null) return null;
  if (!isObject(brief) || brief.approvalStatus !== "approved") {
    throw new Error("LANDING BRIEF must be approved before it can control the public runtime");
  }
  const errors = validateLandingBriefReferences(brief, passport, { now, requirePositioningGate: true });
  if (errors.length) throw new Error("LANDING BRIEF is invalid: " + errors.join("; "));

  const primaryHook = (brief.hooks || []).find(item => item.id === brief.strategy.primaryHookId);
  if (!primaryHook || !["approved", "tested"].includes(primaryHook.status)) {
    throw new Error("LANDING BRIEF primary hook must be approved or tested");
  }
  const offersById = new Map((brief.offers || []).map(offer => [offer.id, offer]));
  const passportOffersById = new Map((passport.offers || []).map(offer => [offer.id, offer]));
  const ctaMap = {};
  for (const cta of brief.ctas || []) {
    const strategyOffer = offersById.get(cta.offerId);
    const passportOffer = strategyOffer && passportOffersById.get(strategyOffer.passportOfferId);
    if (!strategyOffer || strategyOffer.readiness !== "ready") {
      throw new Error(`LANDING BRIEF CTA ${cta.id} uses an offer that is not operationally ready`);
    }
    const mappedOffer = mapOffer(passportOffer);
    if (!mappedOffer) throw new Error(`LANDING BRIEF CTA ${cta.id} maps to an inactive or unsupported passport offer`);
    if (mappedOffer.scenarioId !== strategyOffer.scenarioId) {
      throw new Error(`LANDING BRIEF CTA ${cta.id} scenario does not match the operational offer`);
    }
    const moduleOfferTypes = {
      hero: "presentation",
      closing: "presentation",
      apartments: "consultation",
      calculator: "mortgage_estimate",
      selection: "apartment_selection"
    };
    if (!moduleOfferTypes[cta.moduleId]) {
      throw new Error(`LANDING BRIEF CTA ${cta.id} targets a module without a supported runtime CTA anchor: ${cta.moduleId}`);
    }
    if (moduleOfferTypes[cta.moduleId] !== strategyOffer.type) {
      throw new Error(`LANDING BRIEF CTA ${cta.id} offer type is incompatible with runtime module ${cta.moduleId}`);
    }
    if (cta.moduleId === "selection" && passport.selectionQuiz?.status !== "approved") {
      throw new Error(`LANDING BRIEF CTA ${cta.id} requires an approved passport selectionQuiz`);
    }
    const effectiveHookId = cta.hookId || brief.strategy.primaryHookId;
    const effectiveHook = (brief.hooks || []).find(item => item.id === effectiveHookId);
    if (!effectiveHook || !["approved", "tested"].includes(effectiveHook.status)) {
      throw new Error(`LANDING BRIEF CTA ${cta.id} uses a hook that is not approved or tested`);
    }
    const segmentId = cta.segmentIds?.[0] || brief.strategy.primarySegmentId;
    ctaMap[cta.moduleId] = {
      moduleId: cta.moduleId,
      ctaId: cta.id,
      label: cta.label,
      intent: cta.intent,
      offerKey: mappedOffer.id,
      offerId: mappedOffer.offerId,
      scenarioId: mappedOffer.scenarioId,
      funnelId: cta.funnelId,
      hookId: effectiveHookId,
      segmentId,
      qualificationQuestionIds: Array.isArray(cta.qualificationQuestionIds) ? cta.qualificationQuestionIds : []
    };
  }

  const approvedHooks = (brief.hooks || []).filter(item =>
    ["approved", "tested"].includes(item.status) &&
    (item.supportingFactIds || []).every(id => facts.has(id))
  ).map(item => ({
    id: item.id, category: item.category, message: item.message,
    segmentIds: item.segmentIds, supportingFactIds: item.supportingFactIds,
    hypothesis: item.hypothesis
  }));
  const positioning = brief.strategy.positioning?.status === "approved" &&
    brief.strategy.positioning.supportingFactIds.every(id => facts.has(id))
    ? brief.strategy.positioning.statement : "";
  const primarySegment = (brief.segments || []).find(item => item.id === brief.strategy.primarySegmentId);
  return {
    coreIdea: brief.strategy.coreIdea,
    primarySegmentId: brief.strategy.primarySegmentId,
    primarySegment: primarySegment ? { id: primarySegment.id, name: primarySegment.name, need: primarySegment.need, jtbd: primarySegment.jtbd } : null,
    positioning,
    primaryHook: approvedHooks.find(item => item.id === primaryHook.id) || null,
    hooks: approvedHooks,
    ctaMap
  };
}

export function buildLandingProfile(passport, marketing, integration = {}, options = {}) {
  const now = options.now ? Date.parse(options.now) : Date.now();
  if (!isObject(passport) || passport.schemaVersion !== "1.0.0") throw new Error("Unsupported or missing passport schemaVersion");
  if (!nonEmpty(passport.project?.id) || !nonEmpty(passport.project?.name) || !nonEmpty(passport.project?.location?.city)) {
    throw new Error("Passport project identity is incomplete");
  }
  if (!isObject(marketing) || marketing.approvalStatus !== "approved" || marketing.projectId !== passport.project.id) {
    throw new Error("Marketing copy must be approved for the same projectId");
  }
  if (!isObject(marketing.copy)) throw new Error("Marketing copy.copy is required");
  for (const key of COPY_KEYS) if (!nonEmpty(marketing.copy[key])) throw new Error(`Approved marketing copy is missing: ${key}`);

  const facts = publishableFactIds(passport, now);
  assertClaims(marketing, facts);
  if (options.mode === "production" && !options.brief) {
    throw new Error("Production mode requires an approved LANDING BRIEF with an approved Positioning Gate");
  }
  const marketingStrategy = buildMarketingStrategy(options.brief, passport, facts, now);
  const project = {
    id: passport.project.id,
    name: passport.project.name,
    city: passport.project.location.city,
    district: passport.project.location.district?.status === "verified" ? passport.project.location.district.value : "",
    address: passport.project.location.address?.status === "verified" ? String(passport.project.location.address.value) : ""
  };
  const factsById = new Map((passport.facts || []).map(fact => [fact.id, fact]));
  const advantages = (passport.advantages || []).filter(item =>
    item.title && item.benefit && item.supportingFactIds?.length &&
    item.supportingFactIds.every(id => facts.has(id))
  ).map(item => {
    const supportingFacts = item.supportingFactIds.map(id => factsById.get(id));
    const evidence = supportingFacts.map(fact => {
      const source = (fact.sources || []).find(item => nonEmpty(item.title));
      return source && nonEmpty(fact.claim) ? { claim: fact.claim, sourceTitle: source.title } : null;
    }).filter(Boolean).slice(0, 3);
    return {
      id: item.id,
      title: item.title,
      benefit: item.benefit,
      strength: item.strength,
      audienceFit: item.audienceFit || [],
      hook: item.hook || "",
      evidence,
      status: "verified"
    };
  }).filter(item => item.evidence.length > 0);

  const assets = Object.values(passport.assets || {}).flat().filter(Boolean);
  const usableAssets = assets.filter(asset => approvedAsset(asset, now));
  const media = usableAssets.filter(asset => ["render", "photo"].includes(asset.type)).map(asset => ({
    url: asset.url, alt: asset.alt || passport.project.name, caption: asset.type === "render" ? "Визуализация" : "Фотография",
    type: asset.type, status: "approved", rightsStatus: "approved"
  }));
  const heroMedia = media[0] || null;
  const mapAsset = usableAssets.find(asset => asset.type === "map");
  const locationMap = mapAsset ? { url: mapAsset.url, alt: mapAsset.alt || (passport.project.name + " — карта расположения"), status: "approved", rightsStatus: "approved" } : null;
  const plansByAsset = new Map(usableAssets.filter(a => a.type === "plan").map(a => [a.id, a]));
  const plans = (passport.apartmentPlans || []).filter(plan =>
    plan.status === "verified" && plan.publicUse === "allowed" && plan.sources?.length &&
    future(plan.expiresAt, now) && plansByAsset.has(plan.assetId)
  ).map(plan => {
    const asset = plansByAsset.get(plan.assetId);
    return { id: plan.id, assetId: plan.assetId, title: plan.title || (plan.rooms === 0 ? "Студия" : `${plan.rooms}-комнатная квартира`),
      rooms: plan.rooms, areaSqm: plan.areaSqm, floor: plan.floor, finishing: plan.finishing,
      assetUrl: asset.url, sources: plan.sources, status: "verified", publicUse: "allowed", rightsStatus: "approved" };
  });
  const infrastructure = (passport.infrastructure || []).filter(item => {
    if (item.status !== "verified" || !item.name || !item.source?.url) return false;
    const hasDistance = Number.isFinite(item.distanceMeters) && item.distanceMeters >= 0;
    const hasWalkingTime = Number.isInteger(item.walkingMinutes) && item.walkingMinutes >= 0;
    const evidence = item.distanceEvidence;
    if (!hasDistance || !evidence?.source?.url ||
        !Number.isFinite(Date.parse(evidence.checkedAt)) ||
        !nonEmpty(evidence.validUntil) || !future(evidence.validUntil, now)) return false;
    if (!["walking_route", "straight_line"].includes(evidence.method)) return false;
    if (hasWalkingTime && evidence.method !== "walking_route") return false;
    return true;
  }).sort((a, b) => a.distanceMeters - b.distanceMeters).map(item => {
    const evidence = item.distanceEvidence;
    const distance = item.distanceMeters >= 1000
      ? `${(item.distanceMeters / 1000).toLocaleString("ru-RU")} км`
      : `${Math.round(item.distanceMeters)} м`;
    const distanceLabel = item.walkingMinutes !== undefined && evidence.method === "walking_route"
      ? `${item.walkingMinutes} мин. пешком`
      : evidence.method === "straight_line"
        ? `${distance} по прямой`
        : `${distance} по маршруту`;
    return { name: item.name, category: item.category, distanceMeters: item.distanceMeters, distanceLabel, status: "verified" };
  });

  const offers = {};
  for (const offer of passport.offers || []) {
    const mapped = mapOffer(offer);
    if (mapped && !offers[mapped.id]) offers[mapped.id] = mapped;
  }
  const defaults = {
    presentation: { title: "Получить презентацию", scenarioId: "presentation_request", description: "Специалист KEY поможет разобраться в проекте и ответит на ваши вопросы." },
    plan: { title: "Обсудить планировку", scenarioId: "plan_consultation", description: "Передадим специалисту выбранную планировку и ваши вопросы." },
    quiz: { title: "Получить персональную подборку", scenarioId: "personal_selection", description: "Передадим ваши ответы специалисту KEY." },
    calculator: { title: "Обсудить расчёт", scenarioId: "payment_consultation", description: "Поможем проверить исходные параметры расчёта." }
  };
  Object.assign(offers, Object.fromEntries(Object.entries(defaults).filter(([key]) => !offers[key])));
  const decisions = (passport.contentStrategy.modules || []).filter(m => ["include", "conditional"].includes(m.decision));
  const eligibleDecisions = decisions.filter(m => (m.requiredFactIds || []).every(id => facts.has(id)));
  for (const module of eligibleDecisions) {
    if (!MODULE_MAP[module.moduleId]) {
      throw new Error(`Selected module "${module.moduleId}" has no runtime implementation; refusing to omit it silently`);
    }
  }
  const composition = eligibleDecisions
    .map(m => ({ id: MODULE_MAP[m.moduleId], order: m.order ?? 999 }))
    .sort((a,b) => a.order - b.order)
    .map(m => m.id)
    .filter((id,index,all) => all.indexOf(id) === index);
  const strategy = passport.contentStrategy.visualDirection || {};
  const palette = PALETTES[strategy.theme] || PALETTES["warm-editorial"];
  const allowedHeroLayouts = new Set(["split", "fullscreen", "editorial"]);
  const requestedHeroLayout = strategy.heroLayout || "split";
  const heroLayout = allowedHeroLayouts.has(requestedHeroLayout) ? requestedHeroLayout : "split";
  const allowedGalleryLayouts = new Set(["mosaic", "editorial", "strip"]);
  const requestedGalleryLayout = strategy.galleryLayout || "mosaic";
  const galleryLayout = allowedGalleryLayouts.has(requestedGalleryLayout) ? requestedGalleryLayout : "mosaic";
  const quiz = passport.selectionQuiz?.status === "approved" && offers.quiz ? {
    title: passport.selectionQuiz.title,
    description: passport.selectionQuiz.description || "",
    resultOfferId: passport.selectionQuiz.resultOfferId,
    questions: passport.selectionQuiz.questions.map(q => ({ id:q.id, label:q.label, options:q.options.map(o=>({id:o.id,label:o.label})) }))
  } : null;

  const endpoint = integration.leadEndpoint || "";
  const privacyPolicyUrl = integration.privacyPolicyUrl || "";
  const privacyPolicyVersion = integration.privacyPolicyVersion || "";
  if (endpoint && !/^https:\/\//i.test(endpoint)) throw new Error("Production leadEndpoint must use HTTPS");
  if (privacyPolicyUrl && !/^https:\/\//i.test(privacyPolicyUrl)) throw new Error("privacyPolicyUrl must use HTTPS");
  const productionReady = Boolean(endpoint && privacyPolicyUrl && nonEmpty(privacyPolicyVersion));
  if (options.mode === "production" && !productionReady) throw new Error("Production mode requires HTTPS webhook, HTTPS privacy URL and policy version");

  return {
    mode: productionReady && options.mode === "production" ? "production" : "demo",
    project, composition: ["concept", ...composition.filter(id => id !== "concept")],
    design: { palette, heroLayout, galleryLayout }, marketing: clone(marketing.copy), advantages, media, heroMedia, locationMap, plans, infrastructure,
    offers, integration: productionReady && options.mode === "production" ? { leadEndpoint:endpoint, privacyPolicyUrl, privacyPolicyVersion } : { leadEndpoint:"", privacyPolicyUrl:"", privacyPolicyVersion:"" },
    analytics: { enabled:false }, selectionQuiz: quiz,
    ...(marketingStrategy ? { marketingStrategy, ctaMap: marketingStrategy.ctaMap } : {})
  };
}

/**
 * Canonical CLI path: normalize the passport into independent knowledge and landing inputs,
 * then build through the evidence-gated runtime builder and shared Module Registry.
 * The legacy buildLandingProfile export remains temporarily for downstream compatibility only.
 */
export function buildCanonicalLandingProfile(passport, marketing, integration = {}, options = {}) {
  const now = options.now ? Date.parse(options.now) : Date.now();
  const normalized = normalizePassportV1(passport);
  const inputs = normalizeLandingInputsV1(passport);
  const errors = [...normalized.errors, ...inputs.errors];
  if (errors.length) {
    throw new Error("Passport normalization failed: " + errors.map(item => item.message).join(" | "));
  }
  const facts = publishableFactIds(passport, now);
  const strategy = buildMarketingStrategy(options.brief, passport, facts, now);
  const approvedMarketingStrategy = strategy ? { approvalStatus: "approved", ...strategy } : undefined;
  const result = buildLandingProfileFromKnowledgeWithDiagnostics(
    normalized.knowledge, inputs.landingInputs, normalized.legacyReferences,
    marketing, integration,
    { now: options.now, mode: options.mode, ...(approvedMarketingStrategy ? { approvedMarketingStrategy } : {}) }
  );
  return { ...result, warnings: [...normalized.warnings, ...inputs.warnings, ...result.warnings] };
}

async function main() {
  const args = process.argv.slice(2);
  const get = key => { const i=args.indexOf(key); return i >= 0 ? args[i+1] : null; };
  const passportPath=get("--passport"), marketingPath=get("--marketing"), integrationPath=get("--integration"), briefPath=get("--brief");
  const targetRuntime=args.includes("--target-runtime");
  const explicitOut=get("--out");
  if (targetRuntime && explicitOut) throw new Error("--target-runtime and --out are mutually exclusive");
  const out=targetRuntime ? path.resolve("landing/runtime/project.config.js") : explicitOut;
  if (!passportPath || !marketingPath || !out) throw new Error("Usage: node scripts/build-landing-runtime.mjs --passport passport.json --marketing marketing.json [--brief landing-brief.json] [--integration integration.json] (--out project.config.js | --target-runtime) [--production]");
  const read = file => JSON.parse(fs.readFileSync(file,"utf8"));
  const built = buildCanonicalLandingProfile(read(passportPath), read(marketingPath), integrationPath ? read(integrationPath) : {}, { mode:args.includes("--production") ? "production" : "demo", brief: briefPath ? read(briefPath) : null });
  const profile = built.profile;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive:true });
  fs.writeFileSync(out, "/* Generated by scripts/build-landing-runtime.mjs. Do not edit by hand. */\nwindow.KEY_PROJECT = " + JSON.stringify(profile, null, 2) + ";\n");
  process.stdout.write(`Built ${profile.project.id} in ${profile.mode} mode: ${profile.composition.length} content modules; ${built.warnings.length} warning(s).\n`);
  for (const warning of built.warnings) process.stderr.write(`WARN ${warning.code || "BUILD_WARNING"}: ${warning.message}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode=1; });
