const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const nonEmpty = value => typeof value === "string" && value.trim().length > 0;

/**
 * Summarizes a successfully built review/runtime profile. Existing builder
 * validation remains authoritative; this module reports commercial gaps.
 */
export function buildLandingReadinessReport({ profile, warnings = [], requestedMode = "review" } = {}) {
  if (!isObject(profile)) throw new Error("Readiness report requires a built landing profile");
  const ready = [];
  const advisory = [];
  const blockers = [];
  const add = (list, code, message, action) => list.push({ code, message, action });
  const advantages = Array.isArray(profile.advantages) ? profile.advantages : [];
  const plans = Array.isArray(profile.apartmentPlans) ? profile.apartmentPlans :
    Array.isArray(profile.plans) ? profile.plans : [];
  const infrastructure = Array.isArray(profile.infrastructure) ? profile.infrastructure : [];
  const assets = Array.isArray(profile.assets) ? profile.assets : [];
  const heroModule = Array.isArray(profile.modules) ? profile.modules.find(item => item.moduleId === "hero") : null;
  const heroAssetIds = new Set(heroModule?.assetIds || []);
  const heroMedia = profile.heroMedia || assets.find(asset => heroAssetIds.has(asset.id) && ["photo", "render", "video"].includes(asset.type)) ||
    assets.find(asset => ["photo", "render"].includes(asset.type));
  const composition = Array.isArray(profile.composition) ? profile.composition :
    Array.isArray(profile.modules) ? profile.modules.map(item => item.moduleId) : [];

  if (heroMedia?.url) ready.push({ code: "HERO_MEDIA_APPROVED", message: "Для первого экрана есть допущенное изображение." });
  else add(advisory, "HERO_MEDIA_MISSING", "Нет допущенного изображения для первого экрана.", "Получить актуальный рендер или фотографию с подтверждёнными правами.");

  if (advantages.length >= 3) ready.push({ code: "ADVANTAGES_SUFFICIENT", message: `Есть ${advantages.length} подтверждённых преимуществ.` });
  else add(advisory, "ADVANTAGES_LIMITED", `Подтверждено преимуществ: ${advantages.length}; желательно не менее трёх содержательных пунктов.`, "Проверить паспорт объекта и запросить подтверждения; не добавлять неподтверждённые обещания.");

  if (plans.length) ready.push({ code: "FLOOR_PLANS_AVAILABLE", message: `Доступно планировок: ${plans.length}.` });
  else add(advisory, "FLOOR_PLANS_MISSING", "Нет доступных к публикации планировок.", "Запросить актуальные планировки и подтверждение прав на публикацию.");

  if (infrastructure.length) {
    const withRoute = infrastructure.filter(item => Number.isFinite(item.distanceMeters) || Number.isFinite(item.walkingMinutes) || nonEmpty(item.distanceLabel)).length;
    ready.push({ code: "INFRASTRUCTURE_VERIFIED", message: `Подтверждено точек инфраструктуры: ${infrastructure.length}; с подтверждённой метрикой расстояния/пути: ${withRoute}.` });
    if (withRoute < infrastructure.length) add(advisory, "INFRASTRUCTURE_ROUTES_INCOMPLETE", "Для части инфраструктуры подтверждено наличие, но не маршрут или расстояние.", "Не показывать расстояния и время пути без отдельного актуального evidence.");
  } else add(advisory, "INFRASTRUCTURE_MISSING", "Нет подтверждённых объектов инфраструктуры для локальных преимуществ.", "Проверить точки интереса и источники.");

  const headline = profile.marketing?.headline || profile.project?.positioning;
  const lead = profile.marketing?.lead || profile.project?.address || profile.project?.city;
  if (nonEmpty(headline) && nonEmpty(lead)) ready.push({ code: "HERO_COPY_PRESENT", message: "Есть позиционирование и вводная информация для первого экрана." });
  else add(advisory, "HERO_COPY_REVIEW_REQUIRED", "Позиционирование или вводная информация для первого экрана требуют подготовки.", "Сформулировать конкретный, отличимый и подтверждённый первый экран.");

  if (composition.length >= 2) ready.push({ code: "PAGE_COMPOSITION_PRESENT", message: `В композиции ${composition.length} модулей.` });
  else add(advisory, "PAGE_COMPOSITION_SPARSE", "Композиция содержит меньше двух модулей.", "Проверить, достаточно ли содержательных секций для презентации проекта.");

  const integrationReady = profile.mode === "production" &&
    nonEmpty(profile.integration?.leadEndpoint) &&
    nonEmpty(profile.integration?.privacyPolicyUrl) &&
    nonEmpty(profile.integration?.privacyPolicyVersion);
  if (integrationReady) ready.push({ code: "LEAD_INTAKE_READY", message: "Профиль содержит production-приём заявок и политику конфиденциальности." });
  else {
    const target = requestedMode === "production" ? blockers : advisory;
    add(target, "LEAD_INTAKE_NOT_READY", "Нет подтверждённого production-приёма заявок с HTTPS endpoint и версией политики конфиденциальности.", "Подключить реальный согласованный KEY CRM workflow, проверить доставку и настроить политику конфиденциальности.");
  }

  for (const warning of warnings) {
    if (!warning || !nonEmpty(warning.code)) continue;
    add(advisory, warning.code, warning.message || "Сборщик обнаружил предупреждение.", "Проверить исходные данные и связанные подтверждения.");
  }

  const unique = list => [...new Map(list.map(item => [item.code + ":" + item.message, item])).values()];
  const report = {
    schemaVersion: "1.0",
    project: { id: profile.project?.id || profile.projectId || "", name: profile.project?.name || "", city: profile.project?.city || "" },
    requestedMode,
    builtMode: profile.mode || "review",
    status: blockers.length ? "blocked" : advisory.length ? "needs_attention" : "ready",
    counts: { ready: ready.length, warnings: 0, blockers: blockers.length },
    ready,
    warnings: unique(advisory),
    blockers: unique(blockers),
    manualReview: [
      "Сила и отличимость позиционирования относительно конкурентов.",
      "Качество первого экрана и визуальная иерархия на мобильном и desktop.",
      "Соответствие CTA реальным намерениям покупателей и этапам воронки."
    ],
    publicationAllowed: blockers.length === 0 && requestedMode === "production" && profile.mode === "production"
  };
  report.counts.warnings = report.warnings.length;
  return report;
}
