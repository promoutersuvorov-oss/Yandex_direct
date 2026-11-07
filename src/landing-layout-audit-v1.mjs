const isArray = Array.isArray;
const list = value => isArray(value) ? value : [];
const unique = values => [...new Set(values.filter(Boolean))];

/**
 * Deterministic composition diagnostics for a review bundle.
 * This evaluates available content/asset/CTA structure, not screenshot aesthetics.
 * Human visual review and browser viewport tests remain separate gates.
 */
export function buildLandingLayoutAudit({ profile, manifest } = {}) {
  if (!profile || typeof profile !== "object") throw new Error("Layout audit requires a built project profile");
  const modules = list(manifest?.modules).length ? manifest.modules : list(profile.modules);
  const facts = list(profile.facts);
  const advantages = list(profile.advantages);
  const assets = list(profile.assets);
  const offers = list(profile.offers);
  const findings = [];
  const add = (severity, code, message, recommendation, moduleIds = [], evidence = {}) => {
    findings.push({ severity, code, message, recommendation, moduleIds, evidence });
  };
  const assetIds = new Set(assets.map(asset => asset.id));
  const activeOfferIds = new Set(offers.map(offer => offer.id));
  const factUse = new Map();
  const selected = modules.filter(module => module.decision !== "exclude");
  const hero = selected.find(module => module.moduleId === "hero");
  const mediaFor = module => list(module.assetIds).filter(id => assetIds.has(id));
  const factsFor = module => list(module.requiredFactIds).filter(id => facts.some(fact => fact.id === id));
  const advantagesFor = module => advantages.filter(item =>
    list(item.supportingFactIds).length &&
    list(item.supportingFactIds).every(id => list(module.requiredFactIds).includes(id))
  );
  const ctasFor = module => list(module.ctaIds).filter(id => activeOfferIds.has(id));

  if (!hero) {
    add("blocker", "LAYOUT_HERO_MISSING", "В выбранной композиции нет первого экрана.", "Добавить ровно один проверенный hero-модуль до генерации предпросмотра.");
  } else {
    const heroMedia = mediaFor(hero);
    const proofPoints = list(profile.marketing?.proofPoints);
    if (!heroMedia.length && proofPoints.length >= 2 && hero.variant !== "editorial-split") {
      add("suggestion", "HERO_PROOF_PANEL_RECOMMENDED",
        "У первого экрана нет одобренного медиа, но есть подтверждённые тезисы для визуального акцента.",
        "Использовать редакционную панель с 2–4 подтверждёнными тезисами; не подменять отсутствующее изображение случайным стоком.",
        ["hero"], { proofPoints: proofPoints.length, mediaAssets: 0 });
    } else if (!heroMedia.length) {
      add("warning", "HERO_WITHOUT_VISUAL_ANCHOR",
        "Первый экран не содержит одобренного визуального материала или достаточного набора тезисов.",
        "Запросить рендер/фотографию с подтверждёнными правами либо подготовить доказательную панель на основе проверенных фактов.",
        ["hero"], { proofPoints: proofPoints.length, mediaAssets: 0 });
    }
  }

  const emptyModules = [];
  const textOnlyModules = [];
  const imageLedWithoutAssets = [];
  const noCtaModules = [];
  for (const module of selected) {
    const ids = factsFor(module);
    ids.forEach(id => factUse.set(id, (factUse.get(id) || 0) + 1));
    const benefits = advantagesFor(module);
    const media = mediaFor(module);
    const ctas = ctasFor(module);
    const hasContent = ids.length || benefits.length || media.length || ctas.length;
    if (!hasContent) emptyModules.push(module.moduleId);
    if (!media.length && (ids.length || benefits.length) && module.variant !== "proof-led" && module.variant !== "editorial") textOnlyModules.push(module.moduleId);
    if (["image-led", "gallery-mosaic", "full-bleed"].includes(module.variant) && !media.length) imageLedWithoutAssets.push(module.moduleId);
    if (["contacts", "presentation", "gift"].includes(module.moduleId) && !ctas.length) noCtaModules.push(module.moduleId);
  }

  if (emptyModules.length) add("warning", "MODULES_WITHOUT_RENDERABLE_CONTENT",
    "В выбранной композиции есть секции без фактов, преимуществ, медиа или действия.",
    "Уточнить назначение каждой секции: добавить подтверждённый материал, назначить подходящий CTA или исключить пустой модуль.",
    emptyModules, { count: emptyModules.length });

  if (imageLedWithoutAssets.length) add("warning", "IMAGE_LAYOUT_WITHOUT_MEDIA",
    "Для визуально-зависимых вариантов макета не назначены одобренные изображения.",
    "Заменить вариант на редакционный/карточный либо запросить подходящий материал; не оставлять пустой медиаблок.",
    imageLedWithoutAssets, { count: imageLedWithoutAssets.length });

  if (textOnlyModules.length) add("suggestion", "TEXT_ONLY_SECTIONS_NEED_HIERARCHY",
    "Часть секций состоит из текста без одобренного медиа.",
    "Для таких секций использовать доказательные карточки, короткие тезисы и ясную типографическую иерархию вместо пустого места под изображение.",
    unique(textOnlyModules), { count: textOnlyModules.length });

  if (noCtaModules.length) add("suggestion", "CONVERSION_SECTIONS_WITHOUT_CTA",
    "В секциях, где ожидается следующий шаг покупателя, не назначено действие.",
    "Добавлять контекстный CTA только там, где он логично продолжает сценарий; не вести все действия в одну универсальную форму.",
    noCtaModules, { count: noCtaModules.length });

  const repeatedFacts = [...factUse.entries()].filter(([, count]) => count > 1);
  if (repeatedFacts.length) add("suggestion", "FACTS_REPEATED_ACROSS_SECTIONS",
    "Одни и те же подтверждённые факты используются в нескольких секциях.",
    "Проверить, не повторяется ли одна и та же мысль в соседних блоках; оставить повтор только там, где он усиливает отдельный сценарий.",
    [], { factIds: repeatedFacts.map(([id]) => id), occurrences: repeatedFacts.reduce((sum, [, count]) => sum + count, 0) });

  const ctaIds = selected.flatMap(ctasFor);
  const uniqueCtas = unique(ctaIds);
  if (ctaIds.length && uniqueCtas.length === 1 && selected.length > 2) {
    add("suggestion", "CTA_SCENARIO_NOT_DIVERSE",
      "Несколько секций ведут к одному и тому же сценарию обращения.",
      "Проверить, нужны ли отдельные действия для планировок, презентации и записи на просмотр; не создавать лишние CTA без реальной разницы в следующем шаге.",
      selected.filter(module => ctasFor(module).length).map(module => module.moduleId),
      { assignedCtas: ctaIds.length, uniqueScenarios: uniqueCtas.length });
  }

  const summary = {
    selectedModules: selected.length,
    modulesWithMedia: selected.filter(module => mediaFor(module).length).length,
    modulesWithFacts: selected.filter(module => factsFor(module).length).length,
    modulesWithAdvantages: selected.filter(module => advantagesFor(module).length).length,
    modulesWithCta: selected.filter(module => ctasFor(module).length).length,
    uniqueCtaScenarios: uniqueCtas.length
  };
  const blockers = findings.filter(item => item.severity === "blocker").length;
  const warnings = findings.filter(item => item.severity === "warning").length;
  return {
    schemaVersion: "1.0",
    evaluation: "deterministic-content-and-composition-heuristics",
    visualScreenshotAssessment: "not_performed",
    status: blockers ? "blocked" : warnings ? "needs_attention" : findings.length ? "suggestions" : "clear",
    summary,
    findings,
    humanReviewRequired: true,
    limits: [
      "Не оценивает художественное качество скриншота, красоту изображения или эмоциональную силу дизайна.",
      "Не заменяет проверку реального рендеринга в браузерах и на целевых разрешениях.",
      "Не создаёт факты, изображения, расстояния, цены или обещания."
    ]
  };
}
