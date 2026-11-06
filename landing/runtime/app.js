import { createLeadPayload } from "../../src/lead-payload.mjs";
import { createAttributionState } from "../../src/attribution.mjs";

(() => {
  "use strict";
  const data = window.KEY_PROJECT;
  if (!data || !data.project || !data.marketing) {
    document.body.dataset.runtimeError = "missing-project-data";
    return;
  }
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const text = (selector, value) => { const node = $(selector); if (node && typeof value === "string" && value.trim()) node.textContent = value; };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const project = data.project;
  const marketing = data.marketing;
  const palette = data.design?.palette || {};
  const paletteKeys = { paper: "--paper", paperDeep: "--paper-deep", ink: "--ink", forest: "--forest", sage: "--sage", accent: "--accent" };
  for (const [key, cssVar] of Object.entries(paletteKeys)) {
    if (typeof palette[key] === "string" && /^#[0-9a-f]{6}$/i.test(palette[key])) document.documentElement.style.setProperty(cssVar, palette[key]);
  }
  const dialog = $("#lead-dialog");
  const form = $("#lead-form");
  let activeOffer = null;
  let activeContext = {};
  let pendingLeadIds = null;
  const fmt = value => new Intl.NumberFormat("ru-RU").format(value);
  const safeUrl = value => { if (typeof value !== "string" || !value.trim()) return ""; try { const u = new URL(value, location.href); return ["https:","http:"].includes(u.protocol) ? u.href : ""; } catch { return ""; } };

  document.title = (project.name || "Жилой комплекс") + " — KEY";
  text("#hero-kicker", marketing.heroKicker); text("#hero-title", marketing.headline); text("#hero-lead", marketing.lead);
  text("#concept-title", marketing.conceptTitle); text("#concept-copy", marketing.conceptCopy);
  text("#advantages-title", marketing.advantagesTitle); text("#advantages-intro", marketing.advantagesIntro);
  text("#visual-title", marketing.visualTitle); text("#visual-copy", marketing.visualCopy);
  text("#apartments-title", marketing.apartmentsTitle); text("#apartments-intro", marketing.apartmentsIntro);
  text("#location-title", marketing.locationTitle); text("#location-copy", marketing.locationCopy);
  text("#closing-title", marketing.closingTitle); text("#closing-copy", marketing.closingCopy);
  if (data.selectionQuiz && Array.isArray(data.selectionQuiz.questions) && data.selectionQuiz.questions.length && data.offers?.quiz) {
    text("#selection-title", data.selectionQuiz.title);
    text("#selection-copy", data.selectionQuiz.description || marketing.selectionCopy || "Ответьте на несколько вопросов — специалист KEY поможет определить следующий шаг.");
    const quizForm = $("#selection-form");
    for (const fieldset of $$("fieldset", quizForm)) fieldset.remove();
    for (const question of data.selectionQuiz.questions) {
      const fieldset = document.createElement("fieldset");
      const legend = document.createElement("legend");
      legend.textContent = question.label;
      fieldset.append(legend);
      question.options.forEach((option, index) => {
        const label = document.createElement("label");
        label.className = "choice";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = question.id;
        input.value = option.id;
        input.required = index === 0;
        const span = document.createElement("span");
        span.textContent = option.label;
        label.append(input, span);
        fieldset.append(label);
      });
      quizForm.insertBefore(fieldset, quizForm.querySelector('button[type="submit"]'));
    }
  }
  text("#art-caption", [project.city, project.district].filter(Boolean).join(" · ") || "АРХИТЕКТУРА · ПРОСТРАНСТВО · ВАШ РИТМ");
  text("#footer-project", data.mode === "demo" ? "Демонстрационная версия. Не использовать как предложение о продаже." : "Актуальные условия уточняйте у специалиста KEY.");
  if (project.city || project.district) {
    const meta = $("#hero-meta"); meta.hidden = false;
    meta.innerHTML = [project.city, project.district, data.marketingStrategy?.primaryHook?.message].filter(Boolean).map(v => '<span>' + esc(v) + '</span>').join("");
  }

  const advantageGrid = $("#advantage-grid");
  if (Array.isArray(data.advantages) && data.advantages.length) {
    advantageGrid.innerHTML = data.advantages.filter(item => item && item.title && item.benefit && item.status === "verified").map((item, index) =>
      '<article class="advantage-card"><span class="card-index">0' + (index + 1) + '</span><h3>' + esc(item.title) + '</h3><p>' + esc(item.benefit) + '</p>' +
      (item.proof ? '<small>' + esc(item.proof) + '</small>' : '') + '</article>').join("");
  } else {
    advantageGrid.innerHTML = '<p class="empty-state">Добавьте подтверждённые преимущества проекта и объяснение их пользы для покупателя. Непроверенные гипотезы не публикуются.</p>';
  }

  const visualGrid = $("#visual-grid");
  const approvedMedia = Array.isArray(data.media) ? data.media.filter(m => m && m.status === "approved" && m.rightsStatus === "approved" && safeUrl(m.url)) : [];
  const heroMedia = data.heroMedia;
  if (heroMedia && heroMedia.status === "approved" && heroMedia.rightsStatus === "approved" && safeUrl(heroMedia.url)) {
    const heroImage = $("#hero-media");
    heroImage.src = safeUrl(heroMedia.url);
    heroImage.alt = heroMedia.alt || (project.name + " — визуализация проекта");
    heroImage.hidden = false;
    $(".hero-art").classList.add("has-media");
    $(".hero-art").setAttribute("role", "group");
    $(".hero-art").removeAttribute("aria-label");
  }
  if (approvedMedia.length) {
    visualGrid.innerHTML = approvedMedia.slice(0, 5).map((media, index) =>
      '<figure class="media-tile ' + (index === 0 ? "media-tile-main" : "") + '"><img src="' + esc(safeUrl(media.url)) + '" alt="' + esc(media.alt || project.name || "Материал проекта") + '" loading="' + (index === 0 ? "eager" : "lazy") + '"><figcaption>' + esc(media.caption || (media.type === "render" ? "Визуализация" : "Фотография")) + '</figcaption></figure>').join("");
  }

  const planGrid = $("#plan-grid");
  const approvedPlans = Array.isArray(data.plans) ? data.plans.filter(p => p && p.status === "verified" && p.publicUse === "allowed" && p.rightsStatus === "approved" && p.id && p.assetId && p.title && Number.isInteger(p.rooms) && Number.isFinite(p.areaSqm) && Array.isArray(p.sources) && p.sources.length > 0 && p.assetUrl && safeUrl(p.assetUrl)) : [];
  if (approvedPlans.length) {
    planGrid.innerHTML = approvedPlans.map(plan =>
      '<article class="plan-card"><img src="' + esc(safeUrl(plan.assetUrl)) + '" alt="' + esc(plan.title) + '" loading="lazy"><div class="plan-card-copy"><span class="eyebrow">ПЛАНИРОВКА</span><h3>' + esc(plan.title) + '</h3><p>' + esc([plan.rooms === 0 ? "Студия" : plan.rooms ? plan.rooms + " комнаты" : "", plan.areaSqm + " м²", plan.floor ? plan.floor + " этаж" : ""].filter(Boolean).join(" · ")) + '</p><button class="button button-outline" type="button" data-open-offer="plan" data-plan-id="' + esc(plan.id) + '">Обсудить планировку <span>↗</span></button></div></article>').join("");
  }

  const locationList = $("#location-list");
  const places = Array.isArray(data.infrastructure) ? data.infrastructure.filter(p => p && p.status === "verified" && p.name && p.distanceLabel) : [];
  if (places.length) locationList.innerHTML = places.map(place => '<li><strong>' + esc(place.name) + '</strong><span>' + esc(place.distanceLabel) + '</span></li>').join("");

  // The hero stays first. The remaining page is composed and ordered by each project's strategy.
  const sectionIds = ["concept","advantages","visual-story","apartments","location","calculator","selection"];
  const requested = Array.isArray(data.composition) ? data.composition : sectionIds;
  const composition = requested.filter((sectionId, index) => sectionIds.includes(sectionId) && requested.indexOf(sectionId) === index);
  if (data.mode !== "demo" && !data.advantages?.some(item => item?.status === "verified" && item.title && item.benefit)) $("#advantages").hidden = true;
  if (data.mode !== "demo" && !approvedMedia.length) $("#visual-story").hidden = true;
  if (data.mode !== "demo" && !approvedPlans.length) $("#apartments").hidden = true;
  if (data.mode !== "demo" && !places.length && !project.city && !project.district) $("#location").hidden = true;
  const main = $("main");
  const closing = $(".closing-section", main);
  for (const sectionId of composition) {
    const section = $("#" + sectionId);
    if (section && !section.hidden) main.insertBefore(section, closing);
  }
  for (const link of $$(".desktop-nav a")) {
    const target = $(link.getAttribute("href"));
    if (!target || target.hidden) link.hidden = true;
  }
  if ($(".desktop-nav a:not([hidden])").length === 0) $(".desktop-nav").hidden = true;
  function applyStrategyCta(button, cta) {
    if (!button || !cta) return;
    const planAction = button.dataset.openOffer === "plan" && cta.moduleId === "apartments";
    if (button.dataset.openOffer !== cta.offerKey && !planAction) return;
    button.dataset.openOffer = cta.offerKey;
    button.dataset.ctaId = cta.ctaId;
    button.dataset.hookId = cta.hookId || "";
    button.dataset.funnelId = cta.funnelId || "";
    button.dataset.segmentId = cta.segmentId || "";
    const arrow = button.querySelector("span");
    button.textContent = cta.label + (arrow ? " " : "");
    if (arrow) button.append(arrow);
  }
  for (const button of $("[data-open-offer]")) {
    const moduleId = button.closest("section")?.id || (button.closest("header") ? "hero" : "");
    applyStrategyCta(button, data.ctaMap?.[moduleId]);
  }
  const selectionCta = data.ctaMap?.selection;
  const selectionSubmit = $("#selection-form button[type='submit']");
  if (selectionCta && selectionSubmit) {
    selectionSubmit.textContent = selectionCta.label;
    selectionSubmit.dataset.ctaId = selectionCta.ctaId;
    selectionSubmit.dataset.hookId = selectionCta.hookId || "";
    selectionSubmit.dataset.funnelId = selectionCta.funnelId || "";
    selectionSubmit.dataset.segmentId = selectionCta.segmentId || "";
  }



  function openOffer(offerId, context = {}) {
    const offer = data.offers && data.offers[offerId];
    if (!offer) return;
    activeOffer = { ...offer, offerId };
    pendingLeadIds = null;
    form.reset();
    $("#lead-submit").hidden = false;
    $("#lead-submit").disabled = false;
    activeContext = {
      scenarioId: offer.scenarioId,
      offerId: offer.offerId || offerId,
      moduleId: context.moduleId || "unknown",
      ctaId: context.ctaId || "",
      hookId: context.hookId || "",
      funnelId: context.funnelId || "",
      segmentId: context.segmentId || "",
      entityContext: context.entityContext || {},
      qualificationAnswers: context.qualificationAnswers || null
    };
    text("#dialog-title", offer.title || "Обсудить проект");
    text("#dialog-description", offer.description || "Оставьте контакт, чтобы специалист KEY мог помочь.");
    const contextNode = $("#dialog-context");
    const details = Object.entries(context.displayContext || {}).filter(([, value]) => value !== undefined && value !== null && value !== "");
    contextNode.hidden = !details.length;
    contextNode.textContent = details.length ? "К вашему запросу: " + details.map(([key, value]) => key + " — " + value).join(" · ") : "";
    $("#form-status").textContent = data.integration && data.integration.leadEndpoint ? "После отправки запрос будет передан специалисту KEY." : "Демонстрационный режим: endpoint отправки не настроен.";
    $("#privacy-link").href = safeUrl(data.integration?.privacyPolicyUrl) || "#";
    dialog.showModal();
  }

  $$("[data-open-offer]").forEach(button => button.addEventListener("click", () => {
    const offerId = button.dataset.openOffer;
    const context = {
      moduleId: button.closest("section")?.id || (button.closest("header") ? "hero" : "unknown"),
      ctaId: button.dataset.ctaId || "",
      hookId: button.dataset.hookId || "",
      funnelId: button.dataset.funnelId || "",
      segmentId: button.dataset.segmentId || ""
    };
    if (button.dataset.planId) {
      const plan = approvedPlans.find(item => item.id === button.dataset.planId);
      if (plan) {
        context.entityContext = { plan: {
          id: plan.id, rooms: plan.rooms ?? 0, areaSqm: plan.areaSqm,
          assetId: plan.assetId || plan.id, ...(plan.floor ? { floor: plan.floor } : {}),
          ...(plan.finishing ? { finishing: plan.finishing } : {})
        }};
        context.displayContext = { "Планировка": plan.title, "Площадь": plan.areaSqm + " м²" };
      }
    }
    openOffer(offerId, context);
  }));
  $(".dialog-close-form").addEventListener("submit", () => { activeOffer = null; activeContext = {}; });
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => { activeOffer = null; activeContext = {}; pendingLeadIds = null; });

  $("#mortgage-calculator").addEventListener("submit", event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const price = Number(values.price), down = Number(values.downPayment), rate = Number(values.rate), years = Number(values.years);
    const principal = price - down, months = years * 12, monthlyRate = rate / 1200;
    const output = $("#payment-result");
    if (![price, down, rate, years].every(Number.isFinite) || price <= 0 || down < 0 || down >= price || rate < 0 || rate > 100 || years < 1 || years > 40) {
      output.textContent = "Проверьте параметры: первоначальный взнос должен быть меньше стоимости квартиры."; return;
    }
    const payment = monthlyRate === 0 ? principal / months : principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months));
    const calculatorCta = data.ctaMap?.calculator;
    const calculatorLabel = calculatorCta?.label || "Обсудить расчёт";
    output.innerHTML = '<span>Ориентировочный платёж</span><strong>' + fmt(Math.round(payment)) + ' ₽ / мес.</strong><button class="text-action" type="button" data-open-offer="' + esc(calculatorCta?.offerKey || "calculator") + '">' + esc(calculatorLabel) + ' ↗</button>';
    const calculatorButton = output.querySelector("[data-open-offer]");
    if (calculatorCta) {
      calculatorButton.dataset.ctaId = calculatorCta.ctaId;
      calculatorButton.dataset.hookId = calculatorCta.hookId || "";
      calculatorButton.dataset.funnelId = calculatorCta.funnelId || "";
      calculatorButton.dataset.segmentId = calculatorCta.segmentId || "";
    }
    calculatorButton.addEventListener("click", () => openOffer(calculatorCta?.offerKey || "calculator", {
      moduleId: "calculator",
      ctaId: calculatorCta?.ctaId || "",
      hookId: calculatorCta?.hookId || "",
      funnelId: calculatorCta?.funnelId || "",
      segmentId: calculatorCta?.segmentId || "",
      entityContext: { mortgage: { price, downPayment: down, ratePercent: rate, termYears: years, estimatedMonthlyPayment: Math.round(payment) } },
      displayContext: { "Ориентировочный платёж": fmt(Math.round(payment)) + " ₽ / мес." }
    }));
  });

  $("#selection-form").addEventListener("submit", event => {
    event.preventDefault();
    const answers = Object.fromEntries(new FormData(event.currentTarget));
    if (!Object.keys(answers).length) return;
    const cta = data.ctaMap?.selection;
    openOffer(cta?.offerKey || "quiz", {
      moduleId: "selection",
      ctaId: cta?.ctaId || "",
      hookId: cta?.hookId || "",
      funnelId: cta?.funnelId || "",
      segmentId: cta?.segmentId || "",
      qualificationAnswers: answers,
      displayContext: answers
    });
  });

  form.addEventListener("input", () => { if (!$("#lead-submit").disabled) pendingLeadIds = null; });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const endpoint = safeUrl(data.integration?.leadEndpoint);
    const policyUrl = safeUrl(data.integration?.privacyPolicyUrl);
    const policyVersion = typeof data.integration?.privacyPolicyVersion === "string" ? data.integration.privacyPolicyVersion.trim() : "";
    if (!endpoint) {
      $("#form-status").textContent = "Заявка не отправлена: интеграция ещё не настроена. Демонстрационный режим не передаёт персональные данные.";
      return;
    }
    const endpointUrl = new URL(endpoint);
    if (endpointUrl.protocol !== "https:" && !["localhost","127.0.0.1"].includes(endpointUrl.hostname)) {
      $("#form-status").textContent = "Отправка заблокирована: production endpoint должен использовать HTTPS."; return;
    }
    if (!policyUrl || new URL(policyUrl).protocol !== "https:" || !policyVersion) {
      $("#form-status").textContent = "Отправка заблокирована: не настроены политика обработки данных и её версия."; return;
    }
    if (!activeOffer) {
      $("#form-status").textContent = "Не удалось определить сценарий обращения. Закройте окно и повторите действие.";
      return;
    }
    const submit = $("#lead-submit");
    const values = Object.fromEntries(new FormData(form));
    if (!values.consent || !values.name || !values.phone) return;
    const digits = String(values.phone).replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) { $("#form-status").textContent = "Проверьте номер телефона."; return; }
    if (!pendingLeadIds) pendingLeadIds = { eventId: createStableId("evt"), leadId: createStableId("lead") };
    const now = new Date().toISOString();
    const width = window.innerWidth;
    let payload;
    try {
      payload = createLeadPayload({
        ...pendingLeadIds,
        projectId: project.id,
        createdAt: now,
        pageUrl: location.href,
        deviceClass: width <= 767 ? "mobile" : width <= 1024 ? "tablet" : "desktop",
        contact: { name: String(values.name).trim(), phone: String(values.phone).trim(), preferredChannel: "phone" },
        consent: { accepted: true, acceptedAt: now, policyUrl, policyVersion },
        conversion: {
          scenarioId: activeContext.scenarioId,
          offerId: activeContext.offerId,
          moduleId: activeContext.moduleId,
          ctaId: activeContext.ctaId,
          hookId: activeContext.hookId,
          funnelId: activeContext.funnelId,
          segmentId: activeContext.segmentId,
          entityContext: activeContext.entityContext
        },
        ...(activeContext.qualificationAnswers ? { qualification: { answers: activeContext.qualificationAnswers } } : {}),
        attribution: readAttribution(),
        ...(document.referrer ? { referrer: document.referrer } : {})
      });
    } catch {
      $("#form-status").textContent = "Не удалось подготовить запрос. Проверьте данные и повторите попытку.";
      return;
    }
    submit.disabled = true; submit.textContent = "Отправляем…"; $("#form-status").textContent = "Передаём запрос…";
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "omit" });
      if (!response.ok) throw new Error("delivery_failed");
      if ((response.headers.get("content-type") || "").includes("application/json")) {
        const acknowledgement = await response.json();
        if (acknowledgement?.accepted === false || acknowledgement?.success === false || acknowledgement?.status === "rejected") {
          throw new Error("delivery_not_accepted");
        }
      }
      $("#form-status").textContent = "Запрос принят. Специалист KEY свяжется с вами.";
      form.reset();
      pendingLeadIds = null;
      submit.hidden = true;
    } catch {
      $("#form-status").textContent = "Не удалось передать запрос. Проверьте соединение и попробуйте ещё раз. Ваши данные остались в форме.";
    } finally {
      submit.disabled = false;
      if (!submit.hidden) submit.innerHTML = 'Отправить запрос <span>↗</span>';
    }
  });

  function createStableId(prefix) {
    const token = window.crypto?.randomUUID
      ? window.crypto.randomUUID().replace(/-/g, "")
      : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return prefix + "_" + token;
  }

  function readAttribution() {
    let previous = null;
    try { previous = JSON.parse(sessionStorage.getItem("key:attribution") || "null"); } catch { previous = null; }
    const state = createAttributionState(location.search, previous);
    try { sessionStorage.setItem("key:attribution", JSON.stringify(state)); } catch {}
    return state.firstTouch || state.lastTouch ? state : null;
  }
  if (data.analytics?.enabled) {
    document.addEventListener("click", event => {
      const target = event.target.closest("[data-open-offer]");
      if (target) window.dispatchEvent(new CustomEvent("key:conversion-intent", { detail: { offerId: target.dataset.openOffer, projectId: project.id, moduleId: target.closest("section")?.id || "unknown" } }));
    });
  }
  const menu = $(".menu-toggle");
  menu.addEventListener("click", () => {
    const open = menu.getAttribute("aria-expanded") === "true";
    menu.setAttribute("aria-expanded", String(!open));
    $(".desktop-nav").classList.toggle("nav-open", !open);
  });
  $$(".desktop-nav a").forEach(link => link.addEventListener("click", () => { menu.setAttribute("aria-expanded", "false"); $(".desktop-nav").classList.remove("nav-open"); }));
})();
