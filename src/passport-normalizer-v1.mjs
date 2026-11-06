const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const nonEmpty = value => typeof value === "string" && value.trim().length > 0;
const clone = value => JSON.parse(JSON.stringify(value));

function stableHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stableId(prefix, value) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("ru-RU");
  const slug = normalized.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "item";
  return `${prefix}_${slug}_${stableHash(normalized)}`;
}

function asClaimValue(value) {
  if (typeof value === "string") return { kind: "text", value };
  if (typeof value === "number" && Number.isFinite(value)) return { kind: "number", value };
  if (typeof value === "boolean") return { kind: "boolean", value };
  if (Array.isArray(value) && value.every(item => typeof item === "string")) {
    return { kind: "text_list", value: [...value] };
  }
  if (value === null || value === undefined) return null;
  return null;
}

const STATUS_MAP = Object.freeze({
  verified: "verified",
  provisional: "provisional",
  hypothesis: "hypothesis",
  missing: "unknown",
  conflicting: "conflicting",
  expired: "outdated"
});

function createCollector(warnings) {
  const sources = [];
  const evidence = [];
  const sourceIds = new Map();
  const evidenceIds = new Map();

  function addSource(source, path) {
    if (!isObject(source) || !nonEmpty(source.title) || !nonEmpty(source.accessedAt)) {
      warnings.push({
        code: "SOURCE_INCOMPLETE",
        path,
        message: "Источник без title/accessedAt не перенесён в реестр источников."
      });
      return null;
    }
    const key = JSON.stringify([
      source.url || "",
      source.title,
      source.accessedAt,
      source.sourceType || ""
    ]);
    let id = sourceIds.get(key);
    if (!id) {
      id = stableId("source", key);
      const item = {
      id,
      ...(nonEmpty(source.url) ? { url: source.url } : {}),
      title: source.title,
      ...(source.sourceType ? { sourceType: source.sourceType } : {}),
      accessedAt: source.accessedAt,
      ...(source.publishedAt ? { publishedAt: source.publishedAt } : {})
    };
      sources.push(item);
      sourceIds.set(key, id);
    }

    if (nonEmpty(source.quoteOrEvidence)) {
      const evidenceKey = JSON.stringify([id, source.quoteOrEvidence]);
      const evidenceId = stableId("evidence", evidenceKey);
      if (!evidenceIds.has(evidenceKey)) {
        evidence.push({
          id: evidenceId,
          sourceId: id,
          extract: source.quoteOrEvidence,
          observedAt: source.accessedAt,
          limitations: []
        });
        evidenceIds.set(evidenceKey, evidenceId);
      }
    }
    return id;
  }

  function addEvidenceForSource(source, path) {
    const sourceId = addSource(source, path);
    if (!sourceId) return { sourceId: null, evidenceId: null };
    if (!nonEmpty(source.quoteOrEvidence)) return { sourceId, evidenceId: null };
    const evidenceKey = JSON.stringify([sourceId, source.quoteOrEvidence]);
    return { sourceId, evidenceId: evidenceIds.get(evidenceKey) || null };
  }

  function addSources(list, path) {
    const sourceIds = [];
    const evidenceIds = [];
    if (!Array.isArray(list)) return { sourceIds, evidenceIds };
    list.forEach((source, index) => {
      const result = addEvidenceForSource(source, `${path}[${index}]`);
      if (result.sourceId) sourceIds.push(result.sourceId);
      if (result.evidenceId) evidenceIds.push(result.evidenceId);
    });
    return { sourceIds: [...new Set(sourceIds)], evidenceIds: [...new Set(evidenceIds)] };
  }

  return { sources, evidence, addSource, addSources, addEvidenceForSource };
}

function mapPublicationPolicy(value) {
  if (["allowed", "allowed_with_qualification", "internal_only", "blocked"].includes(value)) return value;
  return "internal_only";
}

function makeClaim({
  id, subject, predicate, value, status, publicUse, sourceIds = [], evidenceIds = [],
  modality = "declared", observedAt, validUntil, limitations = []
}) {
  return {
    id,
    subject,
    predicate,
    value,
    modality,
    epistemicStatus: STATUS_MAP[status] || "unknown",
    sourceIds,
    evidenceIds,
    publicUse: sourceIds.length > 0 && evidenceIds.length > 0
      ? mapPublicationPolicy(publicUse)
      : "internal_only",
    ...(observedAt ? { observedAt } : {}),
    ...(validUntil ? { validUntil } : {}),
    limitations: [...limitations]
  };
}

/**
 * Converts a Project Passport 1.0.0 into the internal Normalized Project Knowledge contract.
 *
 * The adapter is pure: it never mutates the source passport, creates only deterministic IDs,
 * and never infers concrete property units from aggregate project inventory.
 *
 * @param {object} passport Source Project Passport 1.0.0.
 * @returns {{ knowledge: object|null, warnings: object[], errors: object[] }}
 */
export function normalizePassportV1(passport) {
  const warnings = [];
  const errors = [];

  if (!isObject(passport)) {
    return {
      knowledge: null,
      warnings,
      errors: [{ code: "PASSPORT_NOT_OBJECT", path: "$", message: "Паспорт должен быть JSON-объектом." }]
    };
  }
  if (passport.schemaVersion !== "1.0.0") {
    return {
      knowledge: null,
      warnings,
      errors: [{
        code: "UNSUPPORTED_SCHEMA_VERSION",
        path: "$.schemaVersion",
        message: `Ожидалась версия 1.0.0, получено: ${String(passport.schemaVersion)}.`
      }]
    };
  }

  const project = passport.project;
  if (!isObject(project) || !nonEmpty(project.id) || !nonEmpty(project.name) || !nonEmpty(project.location?.city)) {
    return {
      knowledge: null,
      warnings,
      errors: [{
        code: "PROJECT_IDENTITY_INCOMPLETE",
        path: "$.project",
        message: "Для нормализации обязательны project.id, project.name и project.location.city."
      }]
    };
  }

  const collector = createCollector(warnings);
  const claims = [];
  const plans = [];
  const assets = [];
  const pointsOfInterest = [];
  const routes = [];
  const assetIds = new Set();

  const projectRef = { type: "project", id: project.id };
  const normalizedProject = {
    id: project.id,
    name: project.name,
    city: project.location.city,
    organizationIds: []
  };
  const organizations = [];

  function addProjectClaim(entry, predicate, path, options = {}) {
    if (!isObject(entry)) return null;
    if (entry.value === null || entry.value === undefined || entry.status === "missing") {
      if (entry.status === "missing") warnings.push({
        code: "PROJECT_VALUE_MISSING",
        path,
        message: "Поле явно отмечено как missing; claim со значением не создан."
      });
      return null;
    }
    const value = asClaimValue(entry.value);
    if (!value) {
      warnings.push({
        code: "UNSUPPORTED_CLAIM_VALUE",
        path,
        message: "Значение не соответствует поддерживаемым типам ClaimValue; поле оставлено без нормализации."
      });
      return null;
    }
    const provenance = collector.addSources(entry.sources || [], `${path}.sources`);
    const claimId = stableId("claim", `project:${project.id}:${predicate}`);
    claims.push(makeClaim({
      id: claimId,
      subject: projectRef,
      predicate,
      value,
      status: entry.status,
      publicUse: entry.status === "verified" ? (options.publicUse || "allowed_with_qualification") : "internal_only",
      sourceIds: provenance.sourceIds,
      evidenceIds: provenance.evidenceIds,
      observedAt: entry.lastChecked,
      validUntil: entry.expiresAt,
      limitations: [entry.note, options.limitation].filter(nonEmpty)
    }));
    if (!provenance.sourceIds.length) {
      warnings.push({ code: "PROJECT_CLAIM_WITHOUT_SOURCE", path, message: "Значение сохранено как claim без нормализованного источника." });
    }
    return claimId;
  }

  function addEvidencedProjectClaim(field, predicate, path) {
    const claimId = addProjectClaim(project.location?.[field], predicate, path);
    if (claimId) normalizedProject[field === "address" ? "addressClaimId" : "districtClaimId"] = claimId;
  }

  addEvidencedProjectClaim("address", "project.address", "$.project.location.address");
  addEvidencedProjectClaim("district", "project.district", "$.project.location.district");

  const developer = project.developer;
  if (isObject(developer) && nonEmpty(developer.value)) {
    const provenance = collector.addSources(developer.sources || [], "$.project.developer.sources");
    const organizationId = stableId("organization", `${project.id}:${developer.value}`);
    organizations.push({
      id: organizationId,
      name: developer.value,
      sourceIds: provenance.sourceIds,
      evidenceIds: provenance.evidenceIds,
      epistemicStatus: STATUS_MAP[developer.status] || "unknown"
    });
    normalizedProject.organizationIds.push(organizationId);
  }

  addProjectClaim(project.class, "project.class", "$.project.class");
  addProjectClaim(project.delivery, "project.delivery", "$.project.delivery");
  addProjectClaim(project.constructionStatus, "project.construction_status", "$.project.constructionStatus");
  const inventory = project.inventory || {};
  addProjectClaim(inventory.apartmentCount, "project.inventory.apartment_count", "$.project.inventory.apartmentCount");
  if (isObject(inventory.priceFrom) && inventory.priceFrom.value !== null && inventory.priceFrom.value !== undefined) {
    warnings.push({
      code: "PRICE_FROM_REQUIRES_COMMERCIAL_TERM",
      path: "$.project.inventory.priceFrom",
      message: "Цена не перенесена в Project Knowledge: для CommercialTerm необходимы валюта, scope, дата наблюдения и срок действия."
    });
  }
  addProjectClaim(inventory.finishing, "project.inventory.finishing", "$.project.inventory.finishing");
  if (typeof inventory.layoutsAvailable === "boolean") {
    warnings.push({
      code: "LAYOUT_READINESS_NOT_MIGRATED",
      path: "$.project.inventory.layoutsAvailable",
      message: "layoutsAvailable — признак готовности данных для Landing Inputs/QA, а не факт об объекте; в Project Knowledge не переносится."
    });
  }


  function addLegacyFact(fact, index) {
    const path = `$.facts[${index}]`;
    if (!isObject(fact) || !nonEmpty(fact.id) || !nonEmpty(fact.claim)) {
      warnings.push({ code: "FACT_MALFORMED", path, message: "Факт без id или claim пропущен." });
      return;
    }
    const provenance = collector.addSources(fact.sources || [], `${path}.sources`);
    const claimId = stableId("claim", `fact:${fact.id}`);
    claims.push(makeClaim({
      id: claimId,
      subject: projectRef,
      predicate: "project.fact",
      value: { kind: "text", value: fact.claim },
      status: fact.status,
      publicUse: fact.publicUse,
      sourceIds: provenance.sourceIds,
      evidenceIds: provenance.evidenceIds,
      validUntil: fact.expiresAt,
      limitations: fact.note ? [fact.note] : []
    }));
    if (!provenance.sourceIds.length) {
      warnings.push({ code: "FACT_WITHOUT_SOURCE", path, message: "Факт перенесён, но не имеет нормализованного источника." });
    }
  }
  (passport.facts || []).forEach(addLegacyFact);

  const assetGroups = isObject(passport.assets) ? passport.assets : {};
  for (const [groupName, group] of Object.entries(assetGroups)) {
    if (!Array.isArray(group)) {
      warnings.push({ code: "ASSET_GROUP_NOT_ARRAY", path: `$.assets.${groupName}`, message: "Группа активов должна быть массивом; пропущена." });
      continue;
    }
    group.forEach((asset, index) => {
      const path = `$.assets.${groupName}[${index}]`;
      if (!isObject(asset) || !nonEmpty(asset.id)) {
        warnings.push({ code: "ASSET_ID_MISSING", path, message: "Актив без стабильного id пропущен." });
        return;
      }
      if (assetIds.has(asset.id)) {
        warnings.push({ code: "ASSET_ID_DUPLICATE", path, message: `Повторный asset id "${asset.id}" пропущен.` });
        return;
      }
      assetIds.add(asset.id);
      const rights = asset.rightsSource
        ? collector.addEvidenceForSource(asset.rightsSource, `${path}.rightsSource`)
        : { sourceId: null, evidenceId: null };
      if (asset.rightsStatus === "confirmed" && !rights.evidenceId) {
        warnings.push({
          code: "ASSET_RIGHTS_EVIDENCE_MISSING",
          path,
          message: "Права отмечены как confirmed, но отдельное evidence не приложено; право использования требует повторной проверки."
        });
      }
      if (asset.projectMatch === "conflicting") {
        warnings.push({ code: "ASSET_PROJECT_MATCH_CONFLICTING", path, message: "Актив имеет конфликтующую привязку к проекту и нормализован как unconfirmed." });
      }
      assets.push({
        id: asset.id,
        assetKind: asset.type === "pdf" ? "document" : (["photo", "render", "video", "plan", "map", "logo"].includes(asset.type) ? asset.type : "other"),
        ...(nonEmpty(asset.url) ? { url: asset.url } : {}),
        ...(nonEmpty(asset.alt) ? { alt: asset.alt } : {}),
        subjectRefs: [projectRef],
        projectMatch: asset.projectMatch === "confirmed" ? "confirmed" : "unconfirmed",
        publicationStatus: asset.status === "approved" ? "approved" : asset.status === "restricted" ? "blocked" : asset.status === "missing" ? "missing" : "pending",
        rightsStatus: asset.rightsStatus === "confirmed" ? "confirmed" : asset.rightsStatus === "blocked" ? "blocked" : asset.rightsStatus === "pending" ? "pending" : "unknown",
        rightsEvidenceIds: rights.evidenceId ? [rights.evidenceId] : [],
        rightsLimitations: nonEmpty(asset.rightsNote) ? [asset.rightsNote] : [],
        ...(asset.validUntil ? { validUntil: asset.validUntil } : {}),
        allowedContexts: Array.isArray(asset.usage) ? [...asset.usage] : []
      });
    });
  }

  const assetById = new Map(assets.map(asset => [asset.id, asset]));
  (passport.apartmentPlans || []).forEach((plan, index) => {
    const path = `$.apartmentPlans[${index}]`;
    if (!isObject(plan) || !nonEmpty(plan.id) || !nonEmpty(plan.assetId)) {
      warnings.push({ code: "PLAN_MALFORMED", path, message: "Планировка без id или assetId пропущена." });
      return;
    }
    const planAsset = assetById.get(plan.assetId);
    if (!planAsset || planAsset.assetKind !== "plan") {
      warnings.push({
        code: "PLAN_ASSET_UNRESOLVED",
        path,
        message: `Для планировки "${plan.id}" не найден связанный актив типа plan; запись пропущена.`
      });
      return;
    }
    const provenance = collector.addSources(plan.sources || [], `${path}.sources`);
    let finishingClaimId;
    if (nonEmpty(plan.finishing)) {
      finishingClaimId = stableId("claim", `plan:${plan.id}:finishing`);
      claims.push(makeClaim({
        id: finishingClaimId,
        subject: { type: "plan", id: plan.id },
        predicate: "plan.finishing",
        value: { kind: "text", value: plan.finishing },
        status: plan.status,
        publicUse: plan.publicUse,
        sourceIds: provenance.sourceIds,
        evidenceIds: provenance.evidenceIds,
        validUntil: plan.expiresAt,
        limitations: []
      }));
    }
    plans.push({
      id: plan.id,
      planKind: "apartment_floor_plan",
      subjectRef: projectRef,
      assetId: plan.assetId,
      ...(nonEmpty(plan.title) ? { title: plan.title } : {}),
      ...(Number.isInteger(plan.rooms) ? { rooms: plan.rooms } : {}),
      ...(typeof plan.areaSqm === "number" ? { area: { kind: "measurement", value: plan.areaSqm, unit: "m2" } } : {}),
      ...(Number.isInteger(plan.floor) ? { floor: plan.floor } : {}),
      ...(finishingClaimId ? { finishingClaimId } : {}),
      sourceIds: provenance.sourceIds,
      evidenceIds: provenance.evidenceIds,
      epistemicStatus: STATUS_MAP[plan.status] || "unknown",
      publicUse: plan.status === "verified" && provenance.sourceIds.length > 0 && provenance.evidenceIds.length > 0 &&
        planAsset.projectMatch === "confirmed" && planAsset.rightsStatus === "confirmed" &&
        planAsset.rightsEvidenceIds.length > 0 && planAsset.publicationStatus === "approved"
        ? mapPublicationPolicy(plan.publicUse) : "internal_only",
      ...(plan.expiresAt ? { validUntil: plan.expiresAt } : {})
    });
  });

  (passport.infrastructure || []).forEach((item, index) => {
    const path = `$.infrastructure[${index}]`;
    if (!isObject(item) || !nonEmpty(item.name)) {
      warnings.push({ code: "POI_NAME_MISSING", path, message: "Объект инфраструктуры без имени пропущен." });
      return;
    }
    const poiId = stableId("poi", `${project.id}:${item.category || "other"}:${item.name}`);
    const poiClaimIds = [];
    const poiSources = item.source ? collector.addEvidenceForSource(item.source, `${path}.source`) : { sourceId: null, evidenceId: null };
    const existenceClaimId = stableId("claim", `poi:${poiId}:listed`);
    claims.push(makeClaim({
      id: existenceClaimId,
      subject: { type: "poi", id: poiId },
      predicate: "poi.listed_by_source",
      value: { kind: "boolean", value: true },
      status: item.status,
      publicUse: item.status === "verified" && poiSources.sourceId ? "allowed_with_qualification" : "internal_only",
      sourceIds: poiSources.sourceId ? [poiSources.sourceId] : [],
      evidenceIds: poiSources.evidenceId ? [poiSources.evidenceId] : []
    }));
    poiClaimIds.push(existenceClaimId);

    pointsOfInterest.push({
      id: poiId,
      name: item.name,
      category: item.category || "other",
      status: "unknown",
      sourceIds: poiSources.sourceId ? [poiSources.sourceId] : [],
      claimIds: poiClaimIds
    });

    const distanceEvidence = item.distanceEvidence;
    const hasDistance = typeof item.distanceMeters === "number" || typeof item.walkingMinutes === "number";
    if (!hasDistance) return;
    if (!isObject(distanceEvidence) || !distanceEvidence.source) {
      warnings.push({ code: "ROUTE_EVIDENCE_MISSING", path, message: "Метрика расстояния/времени не имеет отдельного evidence и не может стать маршрутом." });
      return;
    }
    const routeSource = collector.addEvidenceForSource(distanceEvidence.source, `${path}.distanceEvidence.source`);
    if (!routeSource.sourceId || !routeSource.evidenceId) {
      warnings.push({ code: "ROUTE_EVIDENCE_INCOMPLETE", path, message: "Источник метрики не содержит конкретного фрагмента evidence." });
      return;
    }
    const method = distanceEvidence.method;
    if (method === "straight_line") {
      const value = typeof item.distanceMeters === "number"
        ? { kind: "measurement", value: item.distanceMeters, unit: "m" }
        : null;
      if (value) {
        const distanceClaimId = stableId("claim", `poi:${poiId}:straight-line-distance`);
        claims.push(makeClaim({
          id: distanceClaimId,
          subject: { type: "poi", id: poiId },
          predicate: "poi.straight_line_distance",
          value,
          modality: "measured",
          status: item.status,
          publicUse: "allowed_with_qualification",
          sourceIds: [routeSource.sourceId],
          evidenceIds: [routeSource.evidenceId],
          observedAt: distanceEvidence.checkedAt,
          validUntil: distanceEvidence.validUntil,
          limitations: ["Расстояние по прямой; не является длиной маршрута или временем в пути."]
        }));
        poiClaimIds.push(distanceClaimId);
      }
      if (typeof item.walkingMinutes === "number") {
        warnings.push({ code: "STRAIGHT_LINE_WALKING_TIME", path, message: "walkingMinutes при method=straight_line проигнорирован как противоречивое значение." });
      }
      return;
    }
    if (method !== "walking_route") {
      warnings.push({ code: "ROUTE_METHOD_UNSUPPORTED", path, message: `Метод "${String(method)}" не поддержан; маршрут не создан.` });
      return;
    }

    if (!nonEmpty(distanceEvidence.checkedAt)) {
      warnings.push({ code: "ROUTE_OBSERVED_AT_MISSING", path, message: "Маршрут не создан: отсутствует дата проверки маршрута." });
      return;
    }
    const routeId = stableId("route", `${project.id}:${poiId}:walking:${distanceEvidence.checkedAt || ""}`);
    const route = {
      id: routeId,
      originRef: projectRef,
      destinationPoiId: poiId,
      mode: "walking",
      method: "route",
      sourceIds: [routeSource.sourceId],
      ...(distanceEvidence.checkedAt ? { observedAt: distanceEvidence.checkedAt } : {}),
      ...(distanceEvidence.validUntil ? { validUntil: distanceEvidence.validUntil } : {})
    };
    if (typeof item.distanceMeters === "number") route.distance = { kind: "measurement", value: item.distanceMeters, unit: "m" };
    if (typeof item.walkingMinutes === "number") route.durationSeconds = Math.round(item.walkingMinutes * 60);
    routes.push(route);
  });

  const knowledge = {
    contractVersion: "0.1",
    source: { schemaVersion: "1.0.0", projectId: project.id },
    project: normalizedProject,
    organizations,
    claims,
    sources: collector.sources,
    evidence: collector.evidence,
    assets,
    plans,
    pointsOfInterest,
    routes,
    structures: { phases: [], buildings: [], sections: [] },
    propertyUnits: [],
    siteFeatures: [],
    commercialTerms: [],
    ...(passport.marketContext ? { internalMarketContext: clone(passport.marketContext) } : {})
  };

  if (isObject(inventory.areaRange) && inventory.areaRange.value !== null && inventory.areaRange.value !== undefined) {
    warnings.push({
      code: "AREA_RANGE_NOT_MAPPED",
      path: "$.project.inventory.areaRange",
      message: "Диапазон площади не помещается в текущий ClaimValue; он не преобразован в неподдерживаемый тип measurement_range."
    });
  }
  if ((passport.facts || []).length === 0) {
    warnings.push({ code: "NO_LEGACY_FACTS", path: "$.facts", message: "Паспорт не содержит facts; claims не созданы." });
  }
  if (isObject(project.inventory) && typeof project.inventory.apartmentCount?.value === "number") {
    warnings.push({
      code: "AGGREGATE_INVENTORY_NOT_EXPANDED",
      path: "$.project.inventory.apartmentCount",
      message: "Агрегированное количество квартир не преобразовано в PropertyUnit: индивидуальные квартиры в паспорте не описаны."
    });
  }
  if (Array.isArray(passport.advantages) && passport.advantages.length) {
    warnings.push({
      code: "MARKETING_ADVANTAGES_NOT_MIGRATED",
      path: "$.advantages",
      message: "Преимущества не включены в Project Knowledge: это маркетинговые интерпретации, а не первичные факты."
    });
  }
  if (Array.isArray(passport.offers) && passport.offers.length) {
    warnings.push({
      code: "OFFERS_NOT_MIGRATED",
      path: "$.offers",
      message: "Офферы должны мигрировать в Conversion Catalog, а не в Project Knowledge."
    });
  }
  if (nonEmpty(project.positioning) || Array.isArray(project.audiences) && project.audiences.length) {
    warnings.push({
      code: "PROJECT_POSITIONING_NOT_MIGRATED",
      path: "$.project",
      message: "Positioning и audiences относятся к Landing Brief/Customer Experience, а не к Project Knowledge."
    });
  }
  if (isObject(project.location?.coordinates)) {
    warnings.push({
      code: "COORDINATES_WITHOUT_PROVENANCE",
      path: "$.project.location.coordinates",
      message: "Координаты не перенесены: в legacy поле нет отдельного источника и evidence."
    });
  }
  if (passport.contentStrategy || passport.selectionQuiz || passport.faq) {
    warnings.push({
      code: "LANDING_STRATEGY_NOT_MIGRATED",
      path: "$",
      message: "contentStrategy, selectionQuiz и FAQ остаются в Landing Brief/Specification и Conversion Flow."
    });
  }
  if (passport.commercial) {
    warnings.push({
      code: "PROTECTED_COMMERCIAL_NOT_MIGRATED",
      path: "$.commercial",
      message: "Настройки интеграции и внутренние коммерческие заметки не копируются в NPK."
    });
  }
  if (passport.verification) {
    warnings.push({
      code: "VERIFICATION_IS_DERIVED",
      path: "$.verification",
      message: "verification не переносится как первичный источник истины; его следует пересчитать из claims и evidence."
    });
  }

  return { knowledge, warnings, errors };
}
