const asArray = value => Array.isArray(value) ? value : [];
const unique = values => [...new Set(values.filter(Boolean))];

/**
 * Selects only renderer-supported composition variants from already-approved content.
 * Explicit valid variants are preserved. This is a deterministic layout decision,
 * not visual-AI scoring or a publication approval.
 */
export function selectLandingLayoutVariants({ profile, manifest } = {}) {
  if (!profile || typeof profile !== "object") throw new Error("Layout selection requires a built project profile");
  if (!manifest || !Array.isArray(manifest.modules)) throw new Error("Layout selection requires a module manifest");

  const facts = asArray(profile.facts);
  const advantages = asArray(profile.advantages);
  const assets = asArray(profile.assets);
  const offers = asArray(profile.offers);
  const assetIds = new Set(assets.map(item => item.id));
  const factIds = new Set(facts.map(item => item.id));
  const offerIds = new Set(offers.map(item => item.id));
  const proofPoints = asArray(profile.marketing?.proofPoints);
  const decisions = [];

  const modules = manifest.modules.map(module => {
    if (module.decision === "exclude") return { ...module };
    const requestedVariant = module.variant ?? null;
    const requested = requestedVariant || "default";
    const mediaCount = asArray(module.assetIds).filter(id => assetIds.has(id)).length;
    const factCount = asArray(module.requiredFactIds).filter(id => factIds.has(id)).length;
    const advantageCount = advantages.filter(item =>
      asArray(item.supportingFactIds).length > 0 &&
      asArray(item.supportingFactIds).every(id => asArray(module.requiredFactIds).includes(id))
    ).length;
    const ctaCount = asArray(module.ctaIds).filter(id => offerIds.has(id)).length;
    let selectedVariant = requested;
    let reason = "Сохранён исходный вариант: автоматическая замена не даёт подтверждённого улучшения.";

    if (module.moduleId === "hero" && mediaCount === 0 && proofPoints.length >= 2 &&
        ["default", "feature-led"].includes(requested)) {
      selectedVariant = "editorial-split";
      reason = "Нет одобренного медиа; 2–4 подтверждённых тезиса позволяют собрать редакционный первый экран с доказательной панелью.";
    } else if (["contacts", "presentation", "gift"].includes(module.moduleId) &&
        ctaCount > 0 && ["default", "editorial"].includes(requested)) {
      selectedVariant = "conversion-led";
      reason = "Секция содержит действующий следующий шаг; выделен поддерживаемый конверсионный вариант.";
    } else if (module.moduleId !== "hero" && mediaCount === 0 &&
        (factCount > 0 || advantageCount > 0) &&
        ["default", "image-led", "feature-led"].includes(requested)) {
      selectedVariant = "proof-led";
      reason = requested === "image-led"
        ? "Запрошенный image-led вариант не обеспечен одобренным медиа; безопасная замена — доказательная композиция."
        : "Секция опирается на подтверждённые факты/преимущества без медиа; выбрана доказательная карточная композиция.";
    }

    const automatic = selectedVariant !== requested;
    decisions.push({
      moduleId: module.moduleId,
      requestedVariant,
      selectedVariant,
      automatic,
      reason,
      basis: { approvedMediaCount: mediaCount, publishableFactCount: factCount,
        supportedAdvantageCount: advantageCount, activeCtaCount: ctaCount,
        availableHeroProofPoints: module.moduleId === "hero" ? proofPoints.length : undefined }
    });
    return {
      ...module,
      variant: selectedVariant,
      layoutSelection: { requestedVariant, selectedVariant, automatic, reason }
    };
  });

  return {
    manifest: { ...manifest, modules },
    report: {
      schemaVersion: "1.0",
      method: "deterministic-supported-variant-selection",
      status: "selected",
      automaticChanges: decisions.filter(item => item.automatic).length,
      preservedChoices: decisions.filter(item => !item.automatic).length,
      decisions,
      limits: [
        "Выбор использует только одобренные медиа, опубликованные факты, преимущества и активные CTA.",
        "Скриншоты, художественное качество и поведение пользователей не оцениваются.",
        "Не создаёт факты, изображения, планировки, CTA или новые возможности рендерера.",
        "Не заменяет браузерную и человеческую визуальную проверку и не разрешает публикацию."
      ]
    }
  };
}
