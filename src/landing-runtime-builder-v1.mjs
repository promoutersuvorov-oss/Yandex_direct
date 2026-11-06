import { resolveRuntimeModulesV1 } from "./landing-module-registry-v1.mjs";

const COPY_KEYS = [
  "heroKicker", "headline", "lead", "conceptTitle", "conceptCopy",
  "advantagesTitle", "advantagesIntro", "visualTitle", "visualCopy",
  "apartmentsTitle", "apartmentsIntro", "locationTitle", "locationCopy",
  "closingTitle", "closingCopy"
];
const PALETTES = Object.freeze({
  "urban-noir": { paper: "#f0efec", paperDeep: "#e2e0db", ink: "#202326", forest: "#252d33", sage: "#a9afb0", accent: "#b7a58e" },
  "warm-editorial": { paper: "#f4f2ed", paperDeep: "#e9e6de", ink: "#252823", forest: "#28362f", sage: "#aeb8a7", accent: "#b7a98f" },
  "garden-modern": { paper: "#f1f3ed", paperDeep: "#e3e9df", ink: "#263029", forest: "#30483a", sage: "#a9bca8", accent: "#c2b58f" }
});
const OFFER_MAP = Object.freeze({
  presentation: "presentation", apartment_selection: "quiz", mortgage_estimate: "calculator",
  viewing: "viewing", consultation: "consultation", callback: "callback", other: "other"
});
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const nonEmpty = value => typeof value === "string" && value.trim().length > 0;
const clone = value => JSON.parse(JSON.stringify(value));
const isFuture = (value, now) => !value || (Number.isFinite(Date.parse(value)) && Date.parse(value) > now);

function claimIsPublic(claim, knowledge, now) {
  if (!claim || claim.epistemicStatus !== "verified" ||
      !["allowed", "allowed_with_qualification"].includes(claim.publicUse) ||
      !claim.sourceIds?.length || !claim.evidenceIds?.length || !isFuture(claim.validUntil, now)) return false;
  const sources = new Map((knowledge.sources || []).map(item => [item.id, item]));
  const evidence = new Map((knowledge.evidence || []).map(item => [item.id, item]));
  return claim.sourceIds.every(id => sources.has(id)) &&
    claim.evidenceIds.every(id => evidence.has(id) && claim.sourceIds.includes(evidence.get(id).sourceId));
}
function assetIsPublic(asset, now, context, projectId, knowledge) {
  return Boolean(asset && asset.publicationStatus === "approved" &&
    asset.projectMatch === "confirmed" && asset.rightsStatus === "confirmed" &&
    asset.rightsEvidenceIds?.length && nonEmpty(asset.url) &&
    /^https:\/\//i.test(asset.url) && isFuture(asset.validUntil, now) &&
    asset.rightsEvidenceIds.every(id => (knowledge.evidence || []).some(item => item.id === id)) &&
    asset.subjectRefs?.some(ref => ref.type === "project" && ref.id === projectId) &&
    (!context || asset.allowedContexts?.includes(context)));
}
function mapOffer(offer) {
  if (!offer || offer.status !== "active" || offer.consentRequired === false) return null;
  const id = OFFER_MAP[offer.type];
  if (!id) return null;
  return { id, offerId: offer.id, type: offer.type, title: offer.title, scenarioId: offer.scenarioId || offer.id,
    description: offer.description || "Специалист KEY поможет разобраться в проекте и ответит на ваши вопросы." };
}

/**
 * Builds the legacy browser runtime profile from normalized knowledge and independent landing inputs.
 * legacyReferences is migration metadata returned by normalizePassportV1, never public data.
 */
export function buildLandingProfileFromKnowledge(knowledge, landingInputs, legacyReferences, marketing, integration = {}, options = {}) {
  const now = options.now ? Date.parse(options.now) : Date.now();
  if (!isObject(knowledge) || knowledge.contractVersion !== "0.1") throw new Error("Unsupported or missing normalized knowledge contractVersion");
  if (!nonEmpty(knowledge.project?.id) || !nonEmpty(knowledge.project?.name) || !nonEmpty(knowledge.project?.city)) throw new Error("Normalized project identity is incomplete");
  if (!isObject(landingInputs) || landingInputs.projectId !== knowledge.project.id) throw new Error("Landing Inputs must match normalized projectId");
  if (!isObject(legacyReferences?.factIdToClaimId)) throw new Error("Explicit legacyReferences.factIdToClaimId bridge is required");
  if (!isObject(marketing) || marketing.approvalStatus !== "approved" || marketing.projectId !== knowledge.project.id) throw new Error("Marketing copy must be approved for the same projectId");
  if (!isObject(marketing.copy)) throw new Error("Marketing copy.copy is required");
  for (const key of COPY_KEYS) if (!nonEmpty(marketing.copy[key])) throw new Error(`Approved marketing copy is missing: ${key}`);

  const claims = new Map((knowledge.claims || []).map(item => [item.id, item]));
  const publishableClaimIds = new Set([...claims.values()].filter(item => claimIsPublic(item, knowledge, now)).map(item => item.id));
  const legacyFactIsPublic = id => {
    const claimId = legacyReferences.factIdToClaimId[id];
    return Boolean(claimId && publishableClaimIds.has(claimId));
  };
  const claimFactIds = marketing.claimFactIds || {};
  for (const [key, ids] of Object.entries(claimFactIds)) {
    if (!COPY_KEYS.includes(key) || !Array.isArray(ids) || !ids.length) throw new Error(`Invalid marketing claim mapping for ${key}`);
    for (const id of ids) if (!legacyFactIsPublic(id)) throw new Error(`Marketing claim ${key} references non-publishable fact: ${id}`);
  }
  if (options.mode === "production") {
    if (!options.approvedMarketingStrategy || options.approvedMarketingStrategy.approvalStatus !== "approved") {
      throw new Error("Production mode requires a separately approved marketing strategy and Positioning Gate");
    }
  }

  const project = {
    id: knowledge.project.id, name: knowledge.project.name, city: knowledge.project.city,
    district: "", address: ""
  };
  const projectClaims = [...claims.values()].filter(item => item.subject?.type === "project" && publishableClaimIds.has(item.id));
  const districtClaim = projectClaims.find(item => item.predicate === "project.district");
  const addressClaim = projectClaims.find(item => item.predicate === "project.address");
  const claimText = item => item?.value?.value == null ? "" : String(item.value.value);
  project.district = claimText(districtClaim);
  project.address = claimText(addressClaim);

  const advantages = (landingInputs.marketingCandidates || []).filter(item =>
    item.classification === "marketing_candidate" && item.title && item.benefit &&
    item.supportingFactIds?.length && item.supportingFactIds.every(legacyFactIsPublic)
  ).map(item => {
    const evidence = item.supportingFactIds.map(id => {
      const claim = claims.get(legacyReferences.factIdToClaimId[id]);
      const source = (knowledge.sources || []).find(src => claim?.sourceIds?.includes(src.id) && nonEmpty(src.title));
      return source && claimText(claim) ? { claim: claimText(claim), sourceTitle: source.title } : null;
    }).filter(Boolean).slice(0, 3);
    return { id: item.id, title: item.title, benefit: item.benefit, strength: item.strength,
      audienceFit: item.audienceFit || [], hook: item.hook || "", evidence, status: "verified" };
  }).filter(item => item.evidence.length > 0);

  const usableAssets = (knowledge.assets || []).filter(asset =>
    assetIsPublic(asset, now, null, knowledge.project.id, knowledge) && ["render", "photo", "map", "plan"].includes(asset.assetKind));
  const media = usableAssets.filter(asset => ["render", "photo"].includes(asset.assetKind)).map(asset => ({
    url: asset.url, alt: asset.alt || knowledge.project.name,
    caption: asset.assetKind === "render" ? "Визуализация" : "Фотография",
    type: asset.assetKind, status: "approved", rightsStatus: "approved"
  }));
  const heroMedia = media[0] || null;
  const mapAsset = usableAssets.find(asset => asset.assetKind === "map" && assetIsPublic(asset, now, "location", knowledge.project.id, knowledge));
  const locationMap = mapAsset ? { url: mapAsset.url, alt: mapAsset.alt || (knowledge.project.name + " — карта расположения"),
    status: "approved", rightsStatus: "approved" } : null;

  const assetsById = new Map(usableAssets.filter(asset => asset.assetKind === "plan").map(asset => [asset.id, asset]));
  const plans = (knowledge.plans || []).filter(plan =>
    plan.planKind === "apartment_floor_plan" && plan.epistemicStatus === "verified" &&
    plan.publicUse === "allowed" && plan.sourceIds?.length && plan.evidenceIds?.length &&
    plan.sourceIds.every(id => (knowledge.sources || []).some(src => src.id === id)) &&
    plan.evidenceIds.every(id => (knowledge.evidence || []).some(ev => ev.id === id && plan.sourceIds.includes(ev.sourceId))) &&
    Number.isInteger(plan.rooms) && Number.isFinite(plan.area?.value) && plan.area.value > 0 && plan.area.unit === "m2" &&
    (!plan.finishingClaimId || publishableClaimIds.has(plan.finishingClaimId)) &&
    isFuture(plan.validUntil, now) && assetsById.has(plan.assetId)
  ).map(plan => {
    const asset = assetsById.get(plan.assetId);
    return { id: plan.id, assetId: plan.assetId, title: plan.title || (plan.rooms === 0 ? "Студия" : `${plan.rooms}-комнатная квартира`),
      rooms: plan.rooms, areaSqm: plan.area?.unit === "m2" ? plan.area.value : undefined,
      floor: plan.floor, finishing: plan.finishingClaimId ? claimText(claims.get(plan.finishingClaimId)) : undefined,
      assetUrl: asset.url, sources: plan.sourceIds, status: "verified", publicUse: "allowed", rightsStatus: "approved" };
  });

  const findWalkingRoute = poiId => (knowledge.routes || []).find(item =>
    item.destinationPoiId === poiId && item.method === "route" && item.mode === "walking" &&
    isFuture(item.validUntil, now) && item.sourceIds?.length &&
    item.sourceIds.every(id => (knowledge.sources || []).some(src => src.id === id)) &&
    Number.isFinite(Date.parse(item.observedAt)) &&
    (Number.isFinite(item.durationSeconds) || (Number.isFinite(item.distance?.value) && ["m","km"].includes(item.distance.unit)))
  );
  const infrastructure = (knowledge.pointsOfInterest || []).filter(poi => {
    const existence = (poi.claimIds || []).map(id => claims.get(id)).find(claim =>
      claim?.predicate === "poi.listed_by_source" && claimIsPublic(claim, knowledge, now));
    return Boolean(existence && findWalkingRoute(poi.id));
  }).map(poi => {
    const route = findWalkingRoute(poi.id);
    const distance = route?.distance;
    const distanceLabel = Number.isFinite(route?.durationSeconds) ?
      `${Math.round(route.durationSeconds / 60)} мин. пешком` :
      distance.unit === "km" ? `${distance.value.toLocaleString("ru-RU")} км` :
      distance.value >= 1000 ? `${(distance.value / 1000).toLocaleString("ru-RU")} км` : `${Math.round(distance.value)} м`;
    return { name: poi.name, distanceLabel, status: "verified" };
  });

  const offers = {};
  for (const offer of landingInputs.conversionCatalog || []) {
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

  const moduleResolution = resolveRuntimeModulesV1(landingInputs.strategy?.modules || [], {
    publishableFactIds: Object.entries(legacyReferences.factIdToClaimId)
      .filter(([,claimId]) => publishableClaimIds.has(claimId)).map(([factId]) => factId),
    capabilities: [
      ...(media.length ? ["approved-project-media"] : []),
      ...(plans.length ? ["current-inventory","rights-cleared-plan-assets"] : []),
      ...(integration.leadWorkflow?.approvalStatus === "approved" && integration.leadEndpoint &&
        integration.privacyPolicyUrl && integration.privacyPolicyVersion ? ["approved-key-lead-workflow"] : []),
      ...(integration.mortgageTerms?.approvalStatus === "approved" && integration.mortgageTerms?.evidenceIds?.length ?
        ["verified-mortgage-terms"] : [])
    ]
  });
  if (moduleResolution.errors.length) {
    throw new Error("Landing module registry rejected the selected strategy: " +
      moduleResolution.errors.map(item => item.message).join(" | "));
  }
  const composition = moduleResolution.composition;

  const designInput = landingInputs.design || {};
  const palette = PALETTES[designInput.theme] || PALETTES["warm-editorial"];
  const heroLayout = ["split", "fullscreen", "editorial"].includes(designInput.heroLayout) ? designInput.heroLayout : "split";
  const galleryLayout = ["mosaic", "editorial", "strip"].includes(designInput.galleryLayout) ? designInput.galleryLayout : "mosaic";
  const quiz = landingInputs.selectionFlow?.publicEligible && offers.quiz &&
    landingInputs.selectionFlow.resultOfferId === offers.quiz.offerId ? {
    title: landingInputs.selectionFlow.title, description: landingInputs.selectionFlow.description || "",
    resultOfferId: landingInputs.selectionFlow.resultOfferId,
    questions: (landingInputs.selectionFlow.questions || []).map(q => ({
      id:q.id, label:q.label, options:(q.options || []).map(o => ({id:o.id,label:o.label}))
    }))
  } : null;

  const endpoint = integration.leadEndpoint || "", privacyPolicyUrl = integration.privacyPolicyUrl || "";
  const privacyPolicyVersion = integration.privacyPolicyVersion || "";
  if (endpoint && !/^https:\/\//i.test(endpoint)) throw new Error("Production leadEndpoint must use HTTPS");
  if (privacyPolicyUrl && !/^https:\/\//i.test(privacyPolicyUrl)) throw new Error("privacyPolicyUrl must use HTTPS");
  const productionReady = Boolean(endpoint && privacyPolicyUrl && nonEmpty(privacyPolicyVersion));
  if (options.mode === "production" && !productionReady) throw new Error("Production mode requires HTTPS webhook, HTTPS privacy URL and policy version");
  return {
    mode: productionReady && options.mode === "production" ? "production" : "demo",
    project, composition,
    design: { palette, heroLayout, galleryLayout }, marketing: clone(marketing.copy), advantages, media, heroMedia,
    locationMap, plans, infrastructure, offers,
    integration: productionReady && options.mode === "production" ?
      { leadEndpoint:endpoint, privacyPolicyUrl, privacyPolicyVersion } :
      { leadEndpoint:"", privacyPolicyUrl:"", privacyPolicyVersion:"" },
    analytics: { enabled:false }, selectionQuiz: quiz,
    ...(options.approvedMarketingStrategy ? { marketingStrategy: clone(options.approvedMarketingStrategy), ctaMap: clone(options.approvedMarketingStrategy.ctaMap || {}) } : {})
  };
}
