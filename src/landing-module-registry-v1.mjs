const MODULES = {
  hero: { slot:"hero", variants:{ "editorial-split":"split" }, capabilities:[], merge:"slot" },
  key: { slot:"hero", variants:{ "feature-led":"feature-led" }, capabilities:[], merge:"slot" },
  about: { sectionId:"concept", variants:{ "feature-led":"feature-led" }, capabilities:[], merge:"single" },
  gallery: { sectionId:"visual-story", variants:{ immersive:"editorial" }, capabilities:["approved-project-media"], merge:"append" },
  lifestyle: { sectionId:"visual-story", variants:{ "image-led":"editorial" }, capabilities:["approved-project-media"], merge:"append" },
  security: { sectionId:"advantages", variants:{ "proof-led":"evidence-cards" }, capabilities:[], merge:"append" },
  location: { sectionId:"location", variants:{ "location-led":"location-led" }, capabilities:[], merge:"single" },
  "floor-plans": { sectionId:"apartments", variants:{ "plan-selector":"plan-selector" }, capabilities:["current-inventory","rights-cleared-plan-assets"], merge:"single" },
  mortgage: { sectionId:"calculator", variants:{ "conversion-led":"user-input-estimate" }, capabilities:["verified-mortgage-terms"], merge:"single" },
  faq: { unsupported:true, reason:"В текущем runtime нет структурированного FAQ-компонента." },
  contacts: { slot:"closing", variants:{ "conversion-led":"closing-cta" }, capabilities:["approved-key-lead-workflow"], merge:"slot" }
};

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Resolves campaign module decisions to the existing KEY browser runtime.
 * No semantic fallback is performed: unknown IDs, variants and missing requirements
 * are reported rather than silently dropped or guessed.
 */
export function resolveRuntimeModulesV1(modules, options = {}) {
  const errors = [];
  const warnings = [];
  const capabilities = new Set(options.capabilities || []);
  const publishableFactIds = new Set(options.publishableFactIds || []);
  const sectionOrders = new Map();
  const slotPlacements = [];
  const sectionPlacements = [];

  if (!Array.isArray(modules)) {
    return { composition: [], placements: [], warnings, errors:[{code:"MODULE_LIST_INVALID",message:"Список модулей должен быть массивом."}] };
  }

  for (const module of modules) {
    if (!isObject(module) || typeof module.moduleId !== "string") {
      errors.push({code:"MODULE_DEFINITION_INVALID",moduleId:null,message:"Обнаружено некорректное определение модуля."});
      continue;
    }
    if (module.decision === "exclude") continue;
    if (!["include","conditional"].includes(module.decision)) {
      errors.push({code:"MODULE_DECISION_INVALID",moduleId:module.moduleId,message:"Неизвестное решение о включении модуля."});
      continue;
    }
    const definition = MODULES[module.moduleId];
    if (!definition) {
      errors.push({code:"MODULE_UNKNOWN",moduleId:module.moduleId,message:`Модуль "${module.moduleId}" отсутствует в Module Registry.`});
      continue;
    }
    if (definition.unsupported) {
      errors.push({code:"MODULE_UNSUPPORTED",moduleId:module.moduleId,message:definition.reason});
      continue;
    }
    const variant = module.variant || "";
    const runtimeVariant = definition.variants[variant];
    if (!runtimeVariant) {
      errors.push({code:"MODULE_VARIANT_UNSUPPORTED",moduleId:module.moduleId,variant,message:`Вариант "${variant || "(не указан)"}" не поддерживается для модуля "${module.moduleId}".`});
      continue;
    }
    const missingFacts = (module.requiredFactIds || []).filter(id => !publishableFactIds.has(id));
    const missingCapabilities = (definition.capabilities || []).filter(id => !capabilities.has(id));
    if (missingFacts.length || missingCapabilities.length) {
      const detail = [
        ...(missingFacts.length ? [`неподтверждённые обязательные факты: ${missingFacts.join(", ")}`] : []),
        ...(missingCapabilities.length ? [`не выполнены зависимости: ${missingCapabilities.join(", ")}`] : [])
      ].join("; ");
      const issue = {moduleId:module.moduleId,missingFacts,missingCapabilities,message:detail};
      if (module.decision === "conditional") warnings.push({code:"CONDITIONAL_MODULE_NOT_READY",...issue});
      else errors.push({code:"INCLUDED_MODULE_NOT_READY",...issue});
      continue;
    }
    const placement = {
      moduleId:module.moduleId,
      ...(definition.sectionId ? {sectionId:definition.sectionId} : {slot:definition.slot}),
      sourceOrder:Number.isInteger(module.order) ? module.order : 999,
      sourceVariant:variant,
      runtimeVariant,
      merge:definition.merge
    };
    if (definition.sectionId) {
      const prior = sectionOrders.get(definition.sectionId);
      if (prior && (prior.merge !== "append" || definition.merge !== "append")) {
        errors.push({code:"MODULE_SECTION_COLLISION",moduleId:module.moduleId,sectionId:definition.sectionId,
          message:`Несколько модулей претендуют на секцию "${definition.sectionId}", но Registry не разрешает их объединение.`});
        continue;
      }
      if (prior) prior.modules.push(module.moduleId);
      else sectionOrders.set(definition.sectionId,{order:placement.sourceOrder,merge:definition.merge,modules:[module.moduleId]});
      sectionPlacements.push(placement);
    } else {
      slotPlacements.push(placement);
    }
  }

  const composition = [...sectionOrders.entries()]
    .sort((a,b)=>a[1].order-b[1].order)
    .map(([sectionId])=>sectionId);
  return { composition, placements:[...slotPlacements,...sectionPlacements], warnings, errors };
}

export const LANDING_MODULE_REGISTRY_V1 = Object.freeze(Object.fromEntries(
  Object.entries(MODULES).map(([id,definition])=>[id,Object.freeze({...definition,
    ...(definition.variants ? {variants:Object.freeze({...definition.variants})} : {}),
    ...(definition.capabilities ? {capabilities:Object.freeze([...definition.capabilities])} : {})
  })])
));
