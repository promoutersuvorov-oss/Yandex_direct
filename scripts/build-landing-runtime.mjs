import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
  const project = {
    id: passport.project.id,
    name: passport.project.name,
    city: passport.project.location.city,
    district: passport.project.location.district?.status === "verified" ? passport.project.location.district.value : "",
    address: passport.project.location.address?.status === "verified" ? String(passport.project.location.address.value) : ""
  };
  const advantages = (passport.advantages || []).filter(item =>
    item.title && item.benefit && item.supportingFactIds?.length &&
    item.supportingFactIds.every(id => facts.has(id))
  ).map(item => ({ id: item.id, title: item.title, benefit: item.benefit, proof: item.hook || "" , status: "verified" }));

  const assets = Object.values(passport.assets || {}).flat().filter(Boolean);
  const usableAssets = assets.filter(asset => approvedAsset(asset, now));
  const media = usableAssets.filter(asset => ["render", "photo"].includes(asset.type)).map(asset => ({
    url: asset.url, alt: asset.alt || passport.project.name, caption: asset.type === "render" ? "Визуализация" : "Фотография",
    type: asset.type, status: "approved", rightsStatus: "approved"
  }));
  const heroMedia = media[0] || null;
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
    if (item.distanceMeters !== undefined || item.walkingMinutes !== undefined) {
      return item.distanceEvidence?.source?.url && future(item.distanceEvidence.validUntil, now) &&
        (item.distanceEvidence.method !== "straight_line" || item.walkingMinutes === undefined);
    }
    return true;
  }).map(item => {
    let distanceLabel = item.publicLabel || "";
    if (!distanceLabel && item.walkingMinutes !== undefined) distanceLabel = `${item.walkingMinutes} мин. пешком`;
    else if (!distanceLabel && item.distanceMeters !== undefined) distanceLabel = item.distanceMeters >= 1000 ?
      `${(item.distanceMeters / 1000).toLocaleString("ru-RU")} км` : `${Math.round(item.distanceMeters)} м`;
    return { name: item.name, distanceLabel, status: "verified" };
  }).filter(item => item.distanceLabel);

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
  const composition = decisions
    .filter(m => (m.requiredFactIds || []).every(id => facts.has(id)))
    .map(m => ({ id: MODULE_MAP[m.moduleId], order: m.order ?? 999 }))
    .filter(m => m.id)
    .sort((a,b) => a.order - b.order)
    .map(m => m.id)
    .filter((id,index,all) => all.indexOf(id) === index);
  const strategy = passport.contentStrategy.visualDirection || {};
  const palette = PALETTES[strategy.theme] || PALETTES["warm-editorial"];
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
    design: { palette }, marketing: clone(marketing.copy), advantages, media, heroMedia, plans, infrastructure,
    offers, integration: productionReady && options.mode === "production" ? { leadEndpoint:endpoint, privacyPolicyUrl, privacyPolicyVersion } : { leadEndpoint:"", privacyPolicyUrl:"", privacyPolicyVersion:"" },
    analytics: { enabled:false }, selectionQuiz: quiz
  };
}

async function main() {
  const args = process.argv.slice(2);
  const get = key => { const i=args.indexOf(key); return i >= 0 ? args[i+1] : null; };
  const passportPath=get("--passport"), marketingPath=get("--marketing"), integrationPath=get("--integration"), out=get("--out");
  if (!passportPath || !marketingPath || !out) throw new Error("Usage: node scripts/build-landing-runtime.mjs --passport passport.json --marketing marketing.json [--integration integration.json] --out project.config.js [--production]");
  const read = file => JSON.parse(fs.readFileSync(file,"utf8"));
  const profile = buildLandingProfile(read(passportPath), read(marketingPath), integrationPath ? read(integrationPath) : {}, { mode:args.includes("--production") ? "production" : "demo" });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive:true });
  fs.writeFileSync(out, "/* Generated by scripts/build-landing-runtime.mjs. Do not edit by hand. */\nwindow.KEY_PROJECT = " + JSON.stringify(profile, null, 2) + ";\n");
  process.stdout.write(`Built ${profile.project.id} in ${profile.mode} mode: ${profile.composition.length} content modules.\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode=1; });
