const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const list = value => Array.isArray(value) ? value : [];
const ids = items => new Set(list(items).map(item => item?.id).filter(Boolean));

function requireRefs(errors, label, values, allowed) {
  for (const value of list(values)) if (!allowed.has(value)) errors.push(`${label} references unknown ID: ${value}`);
}
function requireUnique(errors, label, items) {
  const seen = new Set();
  for (const item of list(items)) {
    if (!item?.id) continue;
    if (seen.has(item.id)) errors.push(`${label} contains duplicate ID: ${item.id}`);
    seen.add(item.id);
  }
}

/**
 * Validate semantic references that JSON Schema cannot express.
 * Structural validation remains the responsibility of schemas/landing-brief.schema.json.
 */
export function validateLandingBriefReferences(brief, passport, options = {}) {
  const errors = [];
  if (!isObject(brief)) return ["LANDING BRIEF must be an object"];
  if (!isObject(passport)) return ["Project passport must be an object"];
  if (brief.projectId !== passport.project?.id) errors.push("LANDING BRIEF projectId must match passport.project.id");

  const segmentIds = ids(brief.segments);
  const hookIds = ids(brief.hooks);
  const offerIds = ids(brief.offers);
  const funnelIds = ids(brief.funnels);
  const ctaIds = ids(brief.ctas);
  const questionIds = ids(brief.qualification?.questions);
  const passportOffers = new Map(list(passport.offers).map(offer => [offer?.id, offer]));
  const factIds = new Set(list(passport.facts)
    .filter(fact => fact?.status === "verified" &&
      ["allowed", "allowed_with_qualification"].includes(fact.publicUse) &&
      list(fact.sources).length > 0 &&
      (!fact.expiresAt || Date.parse(fact.expiresAt) > (options.now ?? Date.now())))
    .map(fact => fact.id));

  requireUnique(errors, "segments", brief.segments);
  requireUnique(errors, "hooks", brief.hooks);
  requireUnique(errors, "offers", brief.offers);
  requireUnique(errors, "funnels", brief.funnels);
  requireUnique(errors, "CTAs", brief.ctas);
  requireUnique(errors, "qualification questions", brief.qualification?.questions);

  for (const hook of list(brief.hooks)) {
    requireRefs(errors, `hook ${hook?.id} segmentIds`, hook?.segmentIds, segmentIds);
    requireRefs(errors, `hook ${hook?.id} supportingFactIds`, hook?.supportingFactIds, factIds);
  }
  for (const offer of list(brief.offers)) {
    requireRefs(errors, `offer ${offer?.id} segmentIds`, offer?.segmentIds, segmentIds);
    requireRefs(errors, `offer ${offer?.id} qualificationQuestionIds`, offer?.qualificationQuestionIds, questionIds);
    const passportOffer = passportOffers.get(offer?.passportOfferId);
    if (!passportOffer) errors.push(`offer ${offer?.id} references unknown passportOfferId: ${offer?.passportOfferId}`);
    else {
      if (passportOffer.type !== offer.type) errors.push(`offer ${offer.id} type does not match passport offer ${offer.passportOfferId}`);
      if (passportOffer.scenarioId && passportOffer.scenarioId !== offer.scenarioId) {
        errors.push(`offer ${offer.id} scenarioId does not match passport offer ${offer.passportOfferId}`);
      }
    }
  }
  for (const funnel of list(brief.funnels)) {
    requireRefs(errors, `funnel ${funnel?.id} segmentIds`, funnel?.segmentIds, segmentIds);
    requireRefs(errors, `funnel ${funnel?.id} hookIds`, funnel?.hookIds, hookIds);
    if (funnel?.offerId && !offerIds.has(funnel.offerId)) errors.push(`funnel ${funnel.id} references unknown offerId: ${funnel.offerId}`);
  }
  const moduleIds = new Set();
  const intentTypes = {
    get_information: "presentation",
    select_apartment: "apartment_selection",
    calculate_payment: "mortgage_estimate",
    book_viewing: "viewing",
    request_consultation: "consultation",
    request_callback: "callback",
    other: "other"
  };
  for (const cta of list(brief.ctas)) {
    if (cta?.offerId && !offerIds.has(cta.offerId)) errors.push(`CTA ${cta.id} references unknown offerId: ${cta.offerId}`);
    if (cta?.funnelId && !funnelIds.has(cta.funnelId)) errors.push(`CTA ${cta.id} references unknown funnelId: ${cta.funnelId}`);
    if (cta?.hookId && !hookIds.has(cta.hookId)) errors.push(`CTA ${cta.id} references unknown hookId: ${cta.hookId}`);
    requireRefs(errors, `CTA ${cta?.id} segmentIds`, cta?.segmentIds, segmentIds);
    requireRefs(errors, `CTA ${cta?.id} qualificationQuestionIds`, cta?.qualificationQuestionIds, questionIds);
    const offer = list(brief.offers).find(item => item?.id === cta?.offerId);
    if (offer && cta.scenarioId && offer.scenarioId !== cta.scenarioId) {
      errors.push(`CTA ${cta.id} scenarioId must match its offer scenarioId`);
    }
    if (offer && intentTypes[cta?.intent] && offer.type !== intentTypes[cta.intent]) {
      errors.push(`CTA ${cta.id} intent ${cta.intent} does not match offer type ${offer.type}`);
    }
    const funnel = list(brief.funnels).find(item => item?.id === cta?.funnelId);
    if (funnel && offer && funnel.offerId !== offer.id) errors.push(`CTA ${cta.id} offer does not match its funnel offer`);
    if (funnel && cta?.hookId && !list(funnel.hookIds).includes(cta.hookId)) {
      errors.push(`CTA ${cta.id} hook is not included in its funnel`);
    }
    if (funnel && list(cta?.segmentIds).some(id => !list(funnel.segmentIds).includes(id))) {
      errors.push(`CTA ${cta.id} segment is not included in its funnel`);
    }
    if (cta?.moduleId) {
      if (moduleIds.has(cta.moduleId)) errors.push(`Multiple CTAs target module ${cta.moduleId}; keep one primary action per module`);
      moduleIds.add(cta.moduleId);
    }
  }

  const strategy = brief.strategy || {};
  if (strategy.primarySegmentId && !segmentIds.has(strategy.primarySegmentId)) errors.push("strategy.primarySegmentId references an unknown segment");
  if (strategy.primaryHookId && !hookIds.has(strategy.primaryHookId)) errors.push("strategy.primaryHookId references an unknown hook");
  if (strategy.primaryCtaId && !ctaIds.has(strategy.primaryCtaId)) errors.push("strategy.primaryCtaId references an unknown CTA");
  const primaryHook = list(brief.hooks).find(item => item?.id === strategy.primaryHookId);
  const primaryCta = list(brief.ctas).find(item => item?.id === strategy.primaryCtaId);
  if (primaryHook && strategy.primarySegmentId && !list(primaryHook.segmentIds).includes(strategy.primarySegmentId)) {
    errors.push("strategy primary hook must target the primary segment");
  }
  if (primaryCta && strategy.primarySegmentId && !list(primaryCta.segmentIds).includes(strategy.primarySegmentId)) {
    errors.push("strategy primary CTA must target the primary segment");
  }
  if (primaryCta && strategy.primaryHookId && primaryCta.hookId !== strategy.primaryHookId) {
    errors.push("strategy primary CTA must use the primary hook");
  }
  requireRefs(errors, "positioning supportingFactIds", strategy.positioning?.supportingFactIds, factIds);
  for (const item of list(strategy.secondaryPositioning)) {
    if (item?.segmentId && !segmentIds.has(item.segmentId)) errors.push(`secondary positioning ${item.id} references an unknown segment`);
    requireRefs(errors, `secondary positioning ${item?.id} supportingFactIds`, item?.supportingFactIds, factIds);
  }
  return errors;
}
