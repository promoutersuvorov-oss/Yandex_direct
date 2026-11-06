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
  text("#art-caption", [project.city, project.district].filter(Boolean).join(" · ") || "АРХИТЕКТУРА · ПРОСТРАНСТВО · ВАШ РИТМ");
  text("#footer-project", data.mode === "demo" ? "Демонстрационная версия. Не использовать как предложение о продаже." : "Актуальные условия уточняйте у специалиста KEY.");
  if (project.city || project.district) {
    const meta = $("#hero-meta"); meta.hidden = false;
    meta.innerHTML = [project.city, project.district].filter(Boolean).map(v => '<span>' + esc(v) + '</span>').join("");
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
  const approvedPlans = Array.isArray(data.plans) ? data.plans.filter(p => p && p.status === "verified" && p.rightsStatus === "approved" && p.id && p.title && Number.isFinite(p.areaSqm) && p.assetUrl && safeUrl(p.assetUrl)) : [];
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
  for (const link of $(".desktop-nav a")) {
    const target = $(link.getAttribute("href"));
    if (!target || target.hidden) link.hidden = true;
  }
  if ($(".desktop-nav a:not([hidden])").length === 0) $(".desktop-nav").hidden = true;

  function openOffer(offerId, context = {}) {
    const offer = data.offers && data.offers[offerId];
    if (!offer) return;
    activeOffer = { ...offer, offerId };
    activeContext = { projectId: project.id, projectName: project.name, scenarioId: offer.scenarioId, moduleId: context.moduleId || "unknown", offerId, entityContext: context };
    text("#dialog-title", offer.title || "Обсудить проект");
    text("#dialog-description", offer.description || "Оставьте контакт, чтобы специалист KEY мог помочь.");
    const contextNode = $("#dialog-context");
    const details = Object.entries(context).filter(([key, value]) => key !== "moduleId" && value !== undefined && value !== null && value !== "");
    contextNode.hidden = !details.length;
    contextNode.textContent = details.length ? "К вашему запросу: " + details.map(([key, value]) => key + " — " + value).join(" · ") : "";
    $("#form-status").textContent = data.integration && data.integration.leadEndpoint ? "После отправки запрос будет передан специалисту KEY." : "Демонстрационный режим: endpoint отправки не настроен.";
    $("#privacy-link").href = safeUrl(data.integration?.privacyPolicyUrl) || "#";
    dialog.showModal();
  }

  $$("[data-open-offer]").forEach(button => button.addEventListener("click", () => {
    const offerId = button.dataset.openOffer;
    openOffer(offerId, { moduleId: button.closest("section")?.id || "unknown", ...(button.dataset.planId ? { planId: button.dataset.planId } : {}) });
  }));
  $(".dialog-close-form").addEventListener("submit", () => { activeOffer = null; activeContext = {}; });
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => { activeOffer = null; activeContext = {}; });

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
    output.innerHTML = '<span>Ориентировочный платёж</span><strong>' + fmt(Math.round(payment)) + ' ₽ / мес.</strong><button class="text-action" type="button" data-open-offer="calculator">Обсудить расчёт ↗</button>';
    output.querySelector("[data-open-offer]").addEventListener("click", () => openOffer("calculator", { moduleId: "calculator", price, downPayment: down, rate, years, estimatedMonthlyPayment: Math.round(payment) }));
  });

  $("#selection-form").addEventListener("submit", event => {
    event.preventDefault();
    const answers = Object.fromEntries(new FormData(event.currentTarget));
    if (!answers.goal || !answers.rooms) return;
    openOffer("quiz", { moduleId: "selection", ...answers });
  });

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
    if (!policyUrl || !policyVersion) {
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
    const payload = {
      schemaVersion: "1.0.0",
      project: { id: project.id, name: project.name },
      contact: { name: String(values.name).trim(), phone: String(values.phone).trim() },
      consent: { accepted: true, acceptedAt: new Date().toISOString(), policyUrl, policyVersion },
      conversion: activeContext,
      attribution: readAttribution(),
      pageUrl: location.href,
      referrer: document.referrer || null,
      createdAt: new Date().toISOString()
    };
    submit.disabled = true; submit.textContent = "Отправляем…"; $("#form-status").textContent = "Передаём запрос…";
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "omit" });
      if (!response.ok) throw new Error("delivery_failed");
      $("#form-status").textContent = "Запрос принят. Специалист KEY свяжется с вами.";
      form.reset();
      submit.hidden = true;
    } catch {
      $("#form-status").textContent = "Не удалось передать запрос. Проверьте соединение и попробуйте ещё раз. Ваши данные остались в форме.";
    } finally {
      submit.disabled = false;
      if (!submit.hidden) { submit.innerHTML = 'Отправить запрос <span>↗</span>'; }
    }
  });

  function readAttribution() {
    const keys = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","yclid","ysclid","gclid","gbraid","wbraid","fbclid","vk_click_id","rb_clickid","erid"];
    const current = {}; const params = new URLSearchParams(location.search);
    for (const key of keys) {
      const value = params.get(key);
      if (value && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value)) current[key] = value;
    }
    let previous = {};
    try { previous = JSON.parse(sessionStorage.getItem("key:attribution") || "{}"); } catch { previous = {}; }
    const state = {
      firstTouch: previous.firstTouch || (Object.keys(current).length ? current : null),
      lastTouch: Object.keys(current).length ? current : (previous.lastTouch || null)
    };
    try { sessionStorage.setItem("key:attribution", JSON.stringify(state)); } catch {}
    return state.firstTouch || state.lastTouch ? { first_touch: state.firstTouch, last_touch: state.lastTouch } : null;
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
