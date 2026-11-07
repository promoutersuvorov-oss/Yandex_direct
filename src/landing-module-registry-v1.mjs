const MODULES = {
  hero: { status:"implemented", runtimeComponent:"HeroSection", slot:"hero", variants:{ "editorial-split":"split", "image-led":"fullscreen" }, capabilities:[], merge:"slot" },
  key: { status:"partial", runtimeComponent:"HeroSection", slot:"hero", variants:{ "feature-led":"feature-led" }, capabilities:[], merge:"slot",
    reason:"Ключевые факты пока выводятся через hero slot; отдельного самостоятельного блока key нет." },
  about: { status:"implemented", runtimeComponent:"ConceptSection", sectionId:"concept", variants:{ "feature-led":"feature-led", "architectural":"feature-led" }, capabilities:[], merge:"single" },
  gallery: { status:"implemented", runtimeComponent:"GallerySection", sectionId:"visual-story", variants:{ immersive:"editorial" }, capabilities:["approved-project-media"], merge:"append" },
  lifestyle: { status:"partial", runtimeComponent:"LifestyleSection", sectionId:"lifestyle", variants:{ "image-led":"image-led", "feature-led":"image-led" }, capabilities:["approved-lifestyle-stories"], merge:"single",
    reason:"Есть отдельная секция и evidence gate; глубина визуальных сценариев ограничена текущими вариантами." },
  security: { status:"partial", runtimeComponent:"AdvantagesSection", sectionId:"advantages", variants:{ "proof-led":"evidence-cards" }, capabilities:[], merge:"append",
    reason:"Рендерится как карточки преимуществ, но отдельного специализированного security-компонента нет." },
  location: { status:"implemented", runtimeComponent:"LocationSection", sectionId:"location", variants:{ "location-led":"location-led" }, capabilities:[], merge:"single" },
  "floor-plans": { status:"partial", aliasOf:"apartments", runtimeComponent:"ApartmentsSection", sectionId:"apartments", variants:{ "plan-selector":"plan-selector" }, capabilities:["current-inventory","rights-cleared-plan-assets"], merge:"single",
    reason:"Legacy alias; canonical module ID — apartments." },
  apartments: { status:"implemented", runtimeComponent:"ApartmentsSection", sectionId:"apartments", variants:{ "plan-selector":"plan-selector" }, capabilities:["current-inventory","rights-cleared-plan-assets"], merge:"single" },
  quiz: { status:"implemented", runtimeComponent:"SelectionQuiz", sectionId:"selection", variants:{ "step-form":"step-form" }, capabilities:["approved-selection-flow"], merge:"single" },
  mortgage: { status:"partial", runtimeComponent:"PaymentCalculator", sectionId:"calculator", variants:{ "conversion-led":"user-input-estimate" }, capabilities:["verified-mortgage-terms"], merge:"single",
    reason:"Есть калькулятор пользовательского сценария; банковские программы и актуальные ипотечные ставки не подключены." },
  faq: { status:"implemented", runtimeComponent:"FaqAccordion", sectionId:"faq", variants:{ "faq-accordion":"evidence-accordion", "proof-led":"evidence-accordion" }, capabilities:["approved-faq-answers"], merge:"single" },
  contacts: { status:"partial", runtimeComponent:"LeadDialogAndClosing", slot:"closing", variants:{ "conversion-led":"closing-cta" }, capabilities:["approved-key-lead-workflow"], merge:"slot",
    reason:"UI и клиентский handoff реализованы; production CRM delivery и юридическое согласование не подключены." },

  territory: { status:"unsupported", unsupported:true, reason:"Нет самостоятельного runtime-компонента территории; не подменять его общими преимуществами." },
  gift: { status:"unsupported", unsupported:true, reason:"Нет проверенного универсального модуля выдачи материалов; презентация доступна только как CTA-сценарий при наличии реального файла и delivery path." },
  price: { status:"unsupported", unsupported:true, reason:"Нет отдельного компонента публикации актуальных цен и inventory; не выводить цену из устаревших данных." },
  developer: { status:"unsupported", unsupported:true, reason:"Нет самостоятельного runtime-компонента застройщика и проверки внешних документов." },
  progress: { status:"unsupported", unsupported:true, reason:"Нет компонента хронологии строительства с датированными официальными обновлениями." },
  steps: { status:"unsupported", unsupported:true, reason:"Нет отдельного компонента этапов покупки с подтверждённым процессом KEY." },
  "faq-legal": { status:"unsupported", unsupported:true, reason:"Нет отдельного компонента юридических пояснений и утверждённого юридического контента." },
  "footer-nav": { status:"unsupported", unsupported:true, reason:"Футер является частью общего shell, но не поддерживается как независимо компонуемый модуль." },
  modal: { status:"unsupported", unsupported:true, reason:"Диалог существует как shared UI primitive, но не является самостоятельным контентным модулем." },
  lightbox: { status:"unsupported", unsupported:true, reason:"Просмотрщик существует как shared UI primitive, но не является самостоятельным контентным модулем." },
  promo: { status:"unsupported", unsupported:true, reason:"Нет отдельного промо-компонента с проверкой срока действия и условий акции." },
  map: { status:"unsupported", unsupported:true, reason:"Список мест и location-контент не равны интерактивной карте; самостоятельный map renderer отсутствует." }
};

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Resolves campaign module decisions to the existing KEY browser runtime.
 * Every catalog ID has an explicit capability status. Unsupported modules,
 * unknown IDs, variants and missing requirements fail closed.
 */
export function resolveRuntimeModulesV1(modules, options = {}) {
  const errors = [];
  const warnings = [];
  const capabilities = new Set(options.capabilities || []);
  const publishableFactIds = new Set(options.publishableFactIds || []);
  const publishableFactIdsByModule = options.publishableFactIdsByModule || {};
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
    if (definition.status === "unsupported" || definition.unsupported) {
      errors.push({code:"MODULE_UNSUPPORTED",moduleId:module.moduleId,message:definition.reason});
      continue;
    }
    const variant = module.variant || "";
    const runtimeVariant = definition.variants[variant];
    if (!runtimeVariant) {
      errors.push({code:"MODULE_VARIANT_UNSUPPORTED",moduleId:module.moduleId,variant,message:`Вариант "${variant || "(не указан)"}" не поддерживается для модуля "${module.moduleId}".`});
      continue;
    }
    const modulePublishableFactIds = new Set([
      ...publishableFactIds,
      ...(Array.isArray(publishableFactIdsByModule[module.moduleId]) ? publishableFactIdsByModule[module.moduleId] : [])
    ]);
    const missingFacts = (module.requiredFactIds || []).filter(id => !modulePublishableFactIds.has(id));
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
      merge:definition.merge,
      status:definition.status,
      runtimeComponent:definition.runtimeComponent,
      ...(definition.aliasOf ? {aliasOf:definition.aliasOf} : {})
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
