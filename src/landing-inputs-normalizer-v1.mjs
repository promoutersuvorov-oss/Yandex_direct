const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const nonEmpty = value => typeof value === "string" && value.trim().length > 0;

const DESIGN_ENUMS = Object.freeze({
  theme: ["urban-noir", "warm-editorial", "garden-modern"],
  composition: ["editorial", "cinematic", "architectural"],
  heroLayout: ["split", "fullscreen", "editorial"],
  galleryLayout: ["mosaic", "editorial", "strip"]
});

function copyStringList(value) {
  return Array.isArray(value) ? value.filter(nonEmpty).map(item => item.trim()) : [];
}

/**
 * Separates campaign strategy and conversion inputs from verified project knowledge.
 * Marketing candidates remain candidates: this adapter never promotes them to facts.
 *
 * @param {object} passport Project Passport 1.0.0.
 * @returns {{ landingInputs: object|null, internal: object|null, warnings: object[], errors: object[] }}
 */
export function normalizeLandingInputsV1(passport) {
  const warnings = [];
  const errors = [];
  if (!isObject(passport)) {
    return { landingInputs: null, internal: null, warnings, errors: [{
      code: "PASSPORT_NOT_OBJECT", path: "$", message: "Паспорт должен быть JSON-объектом."
    }] };
  }
  if (passport.schemaVersion !== "1.0.0") {
    return { landingInputs: null, internal: null, warnings, errors: [{
      code: "UNSUPPORTED_SCHEMA_VERSION", path: "$.schemaVersion",
      message: "Адаптер принимает только Project Passport 1.0.0."
    }] };
  }
  if (!isObject(passport.project) || !nonEmpty(passport.project.id)) {
    return { landingInputs: null, internal: null, warnings, errors: [{
      code: "PROJECT_ID_REQUIRED", path: "$.project.id", message: "Для Landing Inputs необходим project.id."
    }] };
  }

  const project = passport.project;
  const strategy = isObject(passport.contentStrategy) ? passport.contentStrategy : {};
  const sourcePositioningStatus = project.positioningStatus || (nonEmpty(project.positioning) ? "draft" : "missing");
  const positioning = {
    statement: nonEmpty(project.positioning) ? project.positioning : "",
    status: sourcePositioningStatus,
    supportingFactIds: copyStringList(project.positioningFactIds),
    audiences: copyStringList(project.audiences)
  };
  if (positioning.statement && positioning.status !== "approved") {
    warnings.push({ code: "POSITIONING_NOT_APPROVED", path: "$.project.positioning",
      message: "Позиционирование сохранено как черновик и не считается утверждённым публичным утверждением." });
  }

  const modules = Array.isArray(strategy.modules) ? strategy.modules.filter(isObject).map((item, index) => ({
    moduleId: item.moduleId,
    decision: item.decision,
    reason: item.reason,
    ...(Number.isInteger(item.order) ? { order: item.order } : {}),
    requiredFactIds: copyStringList(item.requiredFactIds),
    ...(nonEmpty(item.variant) ? { variant: item.variant } : {}),
    ...(nonEmpty(item.userQuestion) ? { userQuestion: item.userQuestion } : {}),
    ...(nonEmpty(item.whyIncluded) ? { whyIncluded: item.whyIncluded } : {}),
    ...(nonEmpty(item.positionReason) ? { positionReason: item.positionReason } : {}),
    assetIds: copyStringList(item.assetIds),
    ctaIds: copyStringList(item.ctaIds),
    dependencies: copyStringList(item.dependencies),
    qaCriteria: copyStringList(item.qaCriteria),
    ...(nonEmpty(item.replacementModuleId) ? { replacementModuleId: item.replacementModuleId } : {}),
    sourceIndex: index
  })) : [];

  const visual = isObject(strategy.visualDirection) ? strategy.visualDirection : {};
  const design = {};
  for (const [key, allowed] of Object.entries(DESIGN_ENUMS)) {
    if (allowed.includes(visual[key])) design[key] = visual[key];
    else if (visual[key] !== undefined && visual[key] !== null && visual[key] !== "") {
      warnings.push({ code: "UNSUPPORTED_DESIGN_TOKEN", path: `$.contentStrategy.visualDirection.${key}`,
        message: "Значение не входит в allowlist и не перенесено в исполняемые design tokens." });
    }
  }
  for (const key of ["mood", "imageTreatment", "signatureInteraction"]) {
    if (nonEmpty(visual[key])) design[key] = visual[key].trim();
  }
  if (Array.isArray(visual.palette) && visual.palette.length) {
    design.paletteBrief = copyStringList(visual.palette);
    warnings.push({ code: "PALETTE_REQUIRES_TOKENIZATION", path: "$.contentStrategy.visualDirection.palette",
      message: "Палитра сохранена как описательный brief; значения не превращены в CSS или runtime-токены." });
  }

  const offers = Array.isArray(passport.offers) ? passport.offers.filter(isObject).map(offer => ({
    id: offer.id,
    title: offer.title,
    type: offer.type,
    status: offer.status,
    scenarioId: nonEmpty(offer.scenarioId) ? offer.scenarioId : offer.id,
    ...(nonEmpty(offer.description) ? { description: offer.description } : {}),
    requiredFields: copyStringList(offer.requiredFields),
    consentRequired: offer.consentRequired !== false,
    publicEligible: offer.status === "active"
  })) : [];

  const offerIds = new Set(offers.map(item => item.id));
  let selectionFlow = null;
  if (isObject(passport.selectionQuiz)) {
    const quiz = passport.selectionQuiz;
    const resultOfferExists = offerIds.has(quiz.resultOfferId);
    selectionFlow = {
      status: quiz.status,
      title: quiz.title,
      ...(nonEmpty(quiz.description) ? { description: quiz.description } : {}),
      questions: Array.isArray(quiz.questions) ? clone(quiz.questions) : [],
      resultOfferId: quiz.resultOfferId,
      resultOfferExists,
      publicEligible: quiz.status === "approved" && resultOfferExists
    };
    if (!resultOfferExists) warnings.push({ code: "QUIZ_RESULT_OFFER_MISSING",
      path: "$.selectionQuiz.resultOfferId", message: "Результат квиза ссылается на отсутствующий offer; публикация flow заблокирована." });
    if (quiz.status !== "approved") warnings.push({ code: "QUIZ_NOT_APPROVED",
      path: "$.selectionQuiz.status", message: "Черновой квиз сохранён, но не допущен к публичному сценарию." });
  }

  const faq = Array.isArray(passport.faq) ? passport.faq.filter(isObject).map(item => ({
    id: item.id,
    question: item.question,
    requiredFactIds: copyStringList(item.requiredFactIds),
    claimQualifications: Array.isArray(item.claimQualifications) ? item.claimQualifications.filter(isObject).map(entry => ({
      factId: entry.factId,
      text: entry.text
    })) : [],
    publicationStatus: item.publicationStatus === "approved" ? "approved" : "draft",
    answerStatus: "not_generated"
  })) : [];

  const candidates = Array.isArray(passport.advantages) ? passport.advantages.filter(isObject).map(item => ({
    id: item.id,
    title: item.title,
    benefit: item.benefit,
    strength: item.strength,
    supportingFactIds: copyStringList(item.supportingFactIds),
    audienceFit: copyStringList(item.audienceFit),
    hook: nonEmpty(item.hook) ? item.hook : "",
    classification: "marketing_candidate",
    verificationRequired: true
  })) : [];

  const landingInputs = {
    projectId: project.id,
    strategy: {
      coreIdea: nonEmpty(strategy.coreIdea) ? strategy.coreIdea : "",
      primaryCta: nonEmpty(strategy.primaryCta) ? strategy.primaryCta : "",
      secondaryCtas: copyStringList(strategy.secondaryCtas),
      audiencePriority: copyStringList(strategy.audiencePriority),
      informationGaps: copyStringList(strategy.informationGaps),
      modules
    },
    positioning,
    design,
    marketingCandidates: candidates,
    lifestyleStories: Array.isArray(strategy.lifestyleStories) ? strategy.lifestyleStories.filter(isObject).map(item => ({
      id:item.id, title:item.title, description:item.description, sceneLabel:item.sceneLabel || "",
      assetId:item.assetId, supportingFactIds:copyStringList(item.supportingFactIds),
      publicationStatus:item.publicationStatus || "draft"
    })) : [],
    contentQualifications: Array.isArray(strategy.contentQualifications) ? strategy.contentQualifications.filter(isObject).map(item => ({
      moduleId:item.moduleId, contentId:item.contentId, factId:item.factId, text:item.text
    })) : [],
    conversionCatalog: offers,
    ...(selectionFlow ? { selectionFlow } : {}),
    faqDrafts: faq,
    readiness: {
      layoutsAvailable: project.inventory?.layoutsAvailable === true,
      layoutsAvailableStatus: project.inventory?.layoutsAvailable === true ? "declared_true" : "not_confirmed"
    }
  };

  const internal = {
    projectId: project.id,
    ...(isObject(passport.commercial) ? { commercial: clone(passport.commercial) } : {}),
    ...(isObject(passport.marketContext) ? { marketContext: clone(passport.marketContext) } : {}),
    ...(isObject(passport.verification) ? { verification: clone(passport.verification) } : {})
  };

  if (passport.brokerNotes !== undefined || passport.restrictedData !== undefined) {
    warnings.push({ code: "TOP_LEVEL_RESTRICTED_FIELDS_IGNORED", path: "$",
      message: "Неподдерживаемые top-level brokerNotes/restrictedData не переносятся; используйте protected commercial." });
  }

  return { landingInputs, internal, warnings, errors };
}
