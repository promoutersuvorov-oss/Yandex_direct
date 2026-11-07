const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const nonEmpty = value => typeof value === "string" && value.trim().length > 0;

/**
 * Summarizes the output of the canonical runtime builder. This deliberately
 * consumes its diagnostics instead of reimplementing evidence/publication gates.
 */
export function buildLandingReadinessReport({ profile, warnings = [], requestedMode = "demo" } = {}) {
  if (!isObject(profile)) throw new Error("Readiness report requires a built landing profile");
  const ready = [];
  const advisory = [];
  const blockers = [];
  const add = (list, code, message, action) => list.push({ code, message, action });

  if (profile.heroMedia?.url) ready.push({ code: "HERO_MEDIA_APPROVED", message: "Для первого экрана есть допущенное изображение." });
  else add(advisory, "HERO_MEDIA_MISSING", "Нет допущенного изображения для первого экрана.", "Получить у застройщика актуальный рендер или фотографию с подтверждёнными правами.");

  const advantageCount = Array.isArray(profile.advantages) ? profile.advantages.length : 0;
  if (advantageCount >= 3) ready.push({ code: "ADVANTAGES_SUFFICIENT", message: `Есть ${advantageCount} подтверждённых преимуществ.` });
  else add(advisory, "ADVANTAGES_LIMITED", `Подтверждено преимуществ: ${advantageCount}; желательно не менее трёх содержательных пунктов.`, "Проверить паспорт объекта и запросить недостающие подтверждения; не добавлять неподтверждённые обещания.");

  if (Array.isArray(profile.plans) && profile.plans.length) ready.push({ code: "FLOOR_PLANS_AVAILABLE", message: `Доступно планировок: ${profile.plans.length}.` });
  else add(advisory, "FLOOR_PLANS_MISSING", "Нет доступных к публикации планировок.", "Запросить актуальные планировки и подтверждение прав на публикацию.");

  if (Array.isArray(profile.infrastructure) && profile.infrastructure.length) {
    const withRoute = profile.infrastructure.filter(item => nonEmpty(item.distanceLabel)).length;
    ready.push({ code: "INFRASTRUCTURE_VERIFIED", message: `Подтверждено точек инфраструктуры: ${profile.infrastructure.length}; с подтверждённым маршрутом: ${withRoute}.` });
    if (withRoute < profile.infrastructure.length) add(advisory, "INFRASTRUCTURE_ROUTES_INCOMPLETE", "Для части инфраструктуры подтверждено наличие, но не маршрут или расстояние.", "Не показывать расстояния и время пути без отдельного актуального evidence.");
  } else add(advisory, "INFRASTRUCTURE_MISSING", "Нет подтверждённых объектов инфраструктуры для локальных преимуществ.", "Проверить точки интереса и источники.");

  const copy = profile.marketing || {};
  if (nonEmpty(copy.headline) && nonEmpty(copy.lead)) ready.push({ code: "HERO_COPY_PRESENT", message: "Заголовок и вводный текст подготовлены." });
  else add(blockers, "HERO_COPY_INCOMPLETE", "Не заполнены заголовок или вводный текст.", "Подготовить и согласовать обязательные поля маркетингового текста.");

  if (Array.isArray(profile.composition) && profile.composition.length >= 2) ready.push({ code: "PAGE_COMPOSITION_PRESENT", message: `В композиции ${profile.composition.length} модулей.` });
  else add(advisory, "PAGE_COMPOSITION_SPARSE", "Композиция содержит меньше двух модулей.", "Проверить, достаточно ли содержательных секций для презентации проекта.");

  const integrationReady = profile.mode === "production" &&
    nonEmpty(profile.integration?.leadEndpoint) &&
    nonEmpty(profile.integration?.privacyPolicyUrl) &&
    nonEmpty(profile.integration?.privacyPolicyVersion);
  if (integrationReady) ready.push({ code: "LEAD_INTAKE_READY", message: "Профиль содержит production-приём заявок и политику конфиденциальности." });
  else add(blockers, "LEAD_INTAKE_NOT_READY", "Нет подтверждённого production-приёма заявок с HTTPS endpoint и версией политики конфиденциальности.", "Подключить реальный согласованный KEY CRM workflow, проверить доставку и настроить политику конфиденциальности.");

  for (const warning of warnings) {
    if (!warning || !nonEmpty(warning.code)) continue;
    add(advisory, warning.code, warning.message || "Сборщик обнаружил предупреждение.", "Проверить исходные данные и связанные подтверждения.");
  }

  const unique = list => [...new Map(list.map(item => [item.code + ":" + item.message, item])).values()];
  const report = {
    schemaVersion: "1.0",
    project: { id: profile.project?.id || "", name: profile.project?.name || "", city: profile.project?.city || "" },
    requestedMode,
    builtMode: profile.mode || "unknown",
    status: blockers.length ? "blocked" : advisory.length ? "needs_attention" : "ready",
    counts: { ready: ready.length, warnings: advisory.length, blockers: blockers.length },
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
