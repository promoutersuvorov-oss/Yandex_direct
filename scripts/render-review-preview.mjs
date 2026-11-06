import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback;
}
const bundleDir = resolve(arg("--bundle", "artifacts/review-bundle"));
const output = resolve(arg("--out", resolve(bundleDir, "preview.html")));
const readJson = name => JSON.parse(readFileSync(resolve(bundleDir, name), "utf8"));
const profile = readJson("project-profile.json");
const manifest = readJson("module-manifest.json");
const report = readJson("generation-report.json");

if (report.status === "blocked" || report.publicationReadiness?.productionReady !== false) {
  throw new Error("Preview requires an unblocked review bundle with productionReady=false.");
}
if (!profile.project?.id || !Array.isArray(manifest.modules)) {
  throw new Error("Review bundle is missing project identity or module manifest.");
}

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const byId = (items, id) => (items || []).find(item => item.id === id);
const facts = profile.facts || [];
const advantages = profile.advantages || [];
const assets = profile.assets || [];
const infrastructure = profile.infrastructure || [];
const offers = profile.offers || [];
const faqItems = profile.faq || [];
const modules = manifest.modules;
const safeImageUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
};
const assetsFor = module => (module.assetIds || [])
  .map(id => byId(assets, id))
  .filter(asset => safeImageUrl(asset?.url) && ["photo", "render", "plan"].includes(asset.type));
const imageFor = module => assetsFor(module)[0];
const renderGallery = list => '<div class="media-grid">' + list.map((asset, index) =>
  '<figure class="media-card"><img src="' + esc(safeImageUrl(asset.url)) + '" alt="' +
  esc(asset.alt || profile.project.name || "Изображение проекта") + '" loading="' + (index === 0 ? "eager" : "lazy") +
  '"><figcaption>' + esc(asset.type === "plan" ? "Планировка" : asset.type === "render" ? "Визуализация" : "Фотография") +
  '</figcaption></figure>'
).join("") + '</div>';
const ctaAttributes = offer => `data-preview-cta="${esc(offer.id)}" data-preview-scenario="${esc(offer.scenarioId || offer.id)}" data-preview-title="${esc(offer.title)}" data-preview-required-fields="${esc(JSON.stringify(offer.requiredFields || []))}" data-preview-consent-required="${offer.consentRequired !== false}"`;
const renderPlans = offer => (profile.apartmentPlans || []).map(plan => {
  const asset = byId(assets, plan.assetId);
  if (!asset || !safeImageUrl(asset.url)) return "";
  const rooms = plan.rooms === 0 ? "Студия" : plan.rooms + "-комнатная";
  const meta = [rooms, Number(plan.areaSqm).toLocaleString("ru-RU") + " м²", plan.floor ? plan.floor + " этаж" : ""].filter(Boolean).join(" · ");
  const action = offer ? '<button class="cta" type="button" ' + ctaAttributes(offer) +
    ' data-preview-plan-id="' + esc(plan.id) + '" data-preview-plan-rooms="' + esc(plan.rooms) +
    '" data-preview-plan-area="' + esc(plan.areaSqm) + '" data-preview-plan-floor="' + esc(plan.floor ?? "") +
    '" data-preview-plan-finishing="' + esc(plan.finishing ?? "") +
    '" data-preview-plan-asset-id="' + esc(plan.assetId) + '">Обсудить эту планировку</button>' : "";
  return '<article class="plan-card"><img src="' + esc(safeImageUrl(asset.url)) + '" alt="' +
    esc(asset.alt || "Планировка квартиры") + '" loading="lazy"><div class="plan-copy"><p class="eyebrow">Планировка</p><h3>' +
    esc(plan.title || rooms) + '</h3><p>' + esc(meta) + '</p>' + (plan.finishing ? '<p>' + esc(plan.finishing) + '</p>' : "") +
    action + '</div></article>';
}).filter(Boolean).join("");
const renderMortgageCalculator = () => `
  <form class="mortgage-calculator" data-mortgage-calculator novalidate>
    <div class="mortgage-fields">
      <label>Стоимость квартиры, ₽<input name="price" type="number" inputmode="decimal" min="1" step="any" required placeholder="Введите стоимость"></label>
      <label>Первоначальный взнос, ₽<input name="downPayment" type="number" inputmode="decimal" min="0" step="any" required placeholder="Введите сумму"></label>
      <label>Ставка, % годовых<input name="rate" type="number" inputmode="decimal" min="0" max="100" step="any" required placeholder="По условиям банка"></label>
      <label>Срок кредита, лет<input name="years" type="number" inputmode="numeric" min="1" step="1" required placeholder="Например, 20"></label>
    </div>
    <button class="cta" type="submit">Рассчитать платёж</button>
    <p class="mortgage-note">Введите параметры конкретной банковской программы. Ставка и стоимость не подставляются автоматически.</p>
    <output class="mortgage-result" data-mortgage-result aria-live="polite" hidden></output>
  </form>`;
const renderQuiz = (quiz, offer) => {
  if (!quiz) return "";
  const total = quiz.questions.length;
  const questions = quiz.questions.map((question, index) =>
    '<fieldset class="quiz-question" data-quiz-step="' + index + '"' + (index === 0 ? "" : " hidden") +
    '><legend>' + (index + 1) + '. ' + esc(question.label) + '</legend>' +
    question.options.map(option => '<label class="quiz-option"><input type="radio" name="' + esc(question.id) +
      '" value="' + esc(option.id) + '" required><span>' + esc(option.label) + '</span></label>').join("") + '</fieldset>'
  ).join("");
  return '<form class="preview-quiz" data-preview-quiz data-result-offer="' + esc(quiz.resultOfferId) +
    '" data-result-scenario="' + esc(offer?.scenarioId || offer?.id || quiz.resultOfferId) +
    '" data-preview-required-fields="' + esc(JSON.stringify(offer?.requiredFields || [])) +
    '" data-preview-consent-required="' + (offer?.consentRequired !== false) +
    '" data-module-id="quiz"><h3>' + esc(quiz.title) + '</h3>' + (quiz.description ? '<p>' + esc(quiz.description) + '</p>' : "") +
    '<div class="quiz-progress"><progress data-quiz-progress max="' + total + '" value="1" aria-label="Прогресс подбора"></progress>' +
    '<p data-quiz-status role="status" aria-live="polite">Вопрос 1 из ' + total + '</p></div>' +
    questions + '<div class="quiz-actions"><button class="quiz-secondary" type="button" data-quiz-prev disabled>Назад</button>' +
    '<button class="cta" type="button" data-quiz-next' + (total === 1 ? ' hidden' : '') + '>Далее</button>' +
    '<button class="cta" type="submit" data-quiz-submit' + (total > 1 ? ' hidden' : '') + '>Завершить подбор</button></div></form>';
};
const renderFaq = items => items.length ? '<div class="faq-list">' + items.map(item => '<details class="faq-item"><summary>' + esc(item.question) + '</summary><div class="faq-answer">' + item.answers.map(answer => '<p>' + esc(answer) + '</p>').join("") + '</div></details>').join("") + '</div>' : "";
const infrastructureCategory = {
  school: "Школы", kindergarten: "Детские сады", park: "Парк и прогулки",
  shopping: "Покупки", transport: "Транспорт", healthcare: "Здоровье",
  leisure: "Досуг", other: "Рядом с домом"
};
const formatDistance = meters => meters < 1000
  ? Math.round(meters).toLocaleString("ru-RU") + " м"
  : (meters / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + " км";
const renderLocation = () => {
  const groups = new Map();
  for (const item of infrastructure) {
    const category = item.category || "other";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  }
  const placeItem = item => {
    const details = Number.isFinite(item.distanceMeters)
      ? [(item.distanceMethod === "walking_route" ? "по маршруту — " : "по прямой — ") + formatDistance(item.distanceMeters),
         item.distanceMethod === "walking_route" && Number.isFinite(item.walkingMinutes)
           ? item.walkingMinutes.toLocaleString("ru-RU") + " мин пешком" : ""].filter(Boolean)
      : [];
    return '<li class="place-item"><span class="place-name">' + esc(item.name) + '</span>' +
      (details.length ? '<span class="place-distance">' + details.map(esc).join(" · ") + '</span>' : "") +
      '</li>';
  };
  const groupedCards = [...groups.entries()].map(([category, items]) =>
    '<details class="place-group">' +
      '<summary class="place-group-title"><span class="place-group-name">' + esc(infrastructureCategory[category] || infrastructureCategory.other) +
      '</span><span class="place-group-count">' + items.length + ' ' + (items.length === 1 ? 'объект' : items.length < 5 ? 'объекта' : 'объектов') + '</span></summary>' +
      '<ul class="place-list">' + items.map(placeItem).join("") + '</ul></details>'
  ).join("");
  if (!groupedCards && !profile.project.address) return "";
  return '<div class="location-content">' +
    (profile.project.address ? '<p class="location-address"><span>Адрес проекта</span>' + esc(profile.project.address) + '</p>' : "") +
    (groupedCards ? '<div class="place-groups" aria-label="Инфраструктура рядом с проектом">' + groupedCards + '</div>' : "") +
    '</div>';
};
const factsFor = module => (module.requiredFactIds || []).map(id => byId(facts, id)).filter(Boolean);
const renderedAdvantageIds = new Set();
const advantagesFor = module => advantages
  .filter(item => (item.supportingFactIds || []).length > 0 &&
    item.supportingFactIds.every(id => (module.requiredFactIds || []).includes(id)) &&
    !renderedAdvantageIds.has(item.id))
  .map(item => { renderedAdvantageIds.add(item.id); return item; });
const labelFor = module => ({
  hero: "О проекте", key: "Главная идея", gallery: "Архитектура и пространство",
  about: "О проекте", security: "Практичные решения", quiz: "Подбор квартиры",
  location: "Расположение", places: "Рядом с домом", lifestyle: "Образ жизни",
  life: "Образ жизни", gift: "Презентация", presentation: "Презентация",
  apartments: "Квартиры и планировки", "floor-plans": "Планировки", price: "Условия покупки",
  developer: "О застройщике", mortgage: "Финансовый сценарий", steps: "Следующий шаг",
  faq: "Вопросы и ответы", contacts: "Связаться с KEY"
}[module.moduleId] || module.moduleId.replace(/[-_]/g, " "));
const offersFor = module => (module.ctaIds || []).map(id => byId(offers, id)).filter(Boolean);
const offerFor = module => {
  const linkedOffers = offersFor(module);
  if (linkedOffers.length > 1) {
    throw new Error(`Module "${module.moduleId}" may define only one primary CTA; split distinct intents into separate modules.`);
  }
  return linkedOffers[0];
};
const renderConversionChoices = () => {
  // The public project profile contains only active offers; status is intentionally omitted by the bundle builder.
  const activeOffers = offers.filter(offer => offer.id && offer.title && offer.type !== "mortgage_estimate");
  if (activeOffers.length < 2) return "";
  return '<section class="conversion-options" data-module="conversion-options" aria-labelledby="conversion-options-title">' +
    '<p class="eyebrow">Следующий шаг</p><h2 id="conversion-options-title">Выберите, что хотите узнать</h2>' +
    '<p class="conversion-intro">Можно запросить презентацию, подобрать квартиру или перейти к другому доступному сценарию.</p>' +
    '<div class="conversion-grid">' + activeOffers.map(offer =>
      '<button class="conversion-option" type="button" ' + ctaAttributes(offer) + '><span>' + esc(offer.title) +
      '</span><span class="conversion-arrow" aria-hidden="true">↗</span></button>'
    ).join("") + '</div></section>';
};
const button = (offer, fallback) => offer
  ? `<button class="cta" type="button" ${ctaAttributes(offer)}>${esc(offer.title)}</button>`
  : fallback ? `<button class="cta" type="button" data-preview-cta="generic" data-preview-scenario="generic" data-preview-title="${esc(fallback)}" data-preview-required-fields="[]" data-preview-consent-required="true">${esc(fallback)}</button>` : "";

function renderModule(module, index) {
  const advantagesHere = module.moduleId === "hero" ? [] : advantagesFor(module);
  const benefitFactIds = new Set(advantagesHere.flatMap(item => item.supportingFactIds || []));
  const factsHere = module.moduleId === "faq" ? [] : factsFor(module).filter(fact => !benefitFactIds.has(fact.id));
  const asset = imageFor(module);
  const moduleAssets = assetsFor(module);
  const offer = offerFor(module);
  const heading = module.moduleId === "hero"
    ? (profile.project.name || labelFor(module))
    : labelFor(module);
  // Never expose the strategist's internal rationale or an unapproved positioning hypothesis.
  const intro = module.moduleId === "hero"
    ? (profile.project.positioning || "")
    : (module.userQuestion || "");
  const factList = factsHere.map(fact => `<li>${esc(fact.claim)}</li>`).join("");
  const heroMetaItems = module.moduleId === "hero"
    ? [["Город", profile.project.city], ["Район", profile.project.district]].filter(([, value]) => typeof value === "string" && value.trim())
    : [];
  const heroMeta = heroMetaItems.length
    ? `<dl class="hero-meta" aria-label="Расположение проекта">${heroMetaItems.map(([label, value]) => `<div class="hero-meta-item"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>`
    : "";
  const benefitList = advantagesHere.map(item => `<article class="benefit"><h3>${esc(item.title)}</h3><p>${esc(item.benefit)}</p></article>`).join("");
  const image = module.moduleId === "gallery" && moduleAssets.length
    ? renderGallery(moduleAssets)
    : ["floor-plans", "apartments", "quiz"].includes(module.moduleId) ? ""
    : asset ? '<figure><img src="' + esc(safeImageUrl(asset.url)) + '" alt="' + esc(asset.alt || profile.project.name || "Изображение проекта") + '" loading="lazy"></figure>' : "";
  const plans = (module.moduleId === "floor-plans" || module.moduleId === "apartments") ? renderPlans(offer) : "";
  const quiz = module.moduleId === "quiz" ? renderQuiz(profile.selectionQuiz, byId(offers, profile.selectionQuiz?.resultOfferId)) : "";
  const mortgage = module.moduleId === "mortgage" ? renderMortgageCalculator() : "";
  const faq = module.moduleId === "faq" ? renderFaq(faqItems) : "";
  const cta = ["floor-plans", "apartments", "quiz", "mortgage"].includes(module.moduleId) ? "" : button(offer, "");
  const locationContent = module.moduleId === "location" || module.moduleId === "places" ? renderLocation() : "";
  const headingTag = module.moduleId === "hero" ? "h1" : "h2";
  const renderVariant = module.variant === "image-led" && !image ? "feature-led" : (module.variant || "default");
  const moduleClasses = ["module", module.moduleId === "hero" ? "hero" : "", image || plans ? "" : "text-only"].filter(Boolean).join(" ");
  return `<section class="${moduleClasses}" data-module="${esc(module.moduleId)}" data-variant="${esc(renderVariant)}" id="module-${esc(module.moduleId)}" aria-labelledby="heading-${index}">
    <div class="module-copy"><p class="eyebrow">${String(index + 1).padStart(2, "0")}</p>
      <${headingTag} id="heading-${index}">${esc(heading)}</${headingTag}>
      ${intro ? `<p class="intro">${esc(intro)}</p>` : ""}
      ${heroMeta}
      ${benefitList ? `<div class="benefits">${benefitList}</div>` : ""}
      ${factList ? `<ul class="facts">${factList}</ul>` : ""}
      ${locationContent}
      ${plans}
      ${quiz}
      ${mortgage}
      ${faq}
      ${cta}
    </div>${image}
  </section>`;
}

const sections = modules.map(renderModule).join("\n");
const title = profile.project.name || "Презентация жилого комплекса";
const projectId = profile.project.id || null;
const designTheme = ["urban-noir", "warm-editorial", "garden-modern"].includes(profile.design?.theme)
  ? profile.design.theme : "urban-noir";
const city = profile.project.city || "";
const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#17191d">
<title>${esc(title)} — предварительная презентация</title>
<style>
:root{color-scheme:dark;--bg:#17191d;--panel:#202329;--text:#f5f1ea;--muted:#b9b5ae;--line:#ffffff20;--accent:#d8c6a8;--cta-text:#17191d;--pad:clamp(22px,5vw,72px);font-family:Inter,Onest,Arial,sans-serif}
body[data-theme="warm-editorial"]{color-scheme:light;--bg:#f3eee5;--panel:#e7dfd2;--text:#25231f;--muted:#69645c;--line:#25231f24;--accent:#9a5b43;--cta-text:#fff;font-family:Georgia,"Times New Roman",serif}
body[data-theme="warm-editorial"] .module:nth-child(odd){background:#eee7dc}
body[data-theme="warm-editorial"] .module[data-variant="proof-led"]{background:#e5dccf}
body[data-theme="warm-editorial"] .module[data-variant="proof-led"] .benefit{background:#d9cdbd;color:#25231f;border:1px solid #c9bca9}
body[data-theme="warm-editorial"] .module[data-variant="proof-led"] .benefit p{color:#514a42}
body[data-theme="warm-editorial"] .module[data-variant="conversion-led"]{background:#e9dfd3}
body[data-theme="garden-modern"]{--bg:#101b18;--panel:#1d2c26;--text:#edf2e9;--muted:#b6c4b8;--line:#dcebdd24;--accent:#b5c89b;--cta-text:#172019;font-family:Inter,Arial,sans-serif}
body[data-theme="garden-modern"] h1,body[data-theme="garden-modern"] h2{font-family:Inter,Arial,sans-serif;letter-spacing:-.055em;font-weight:600}
body[data-theme="garden-modern"] .module:nth-child(odd){background:#15231e}
body[data-theme="garden-modern"] .module[data-variant="proof-led"]{background:#1b3027}
body[data-theme="garden-modern"] .module[data-variant="conversion-led"]{background:#233329}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);line-height:1.55}a,button{font:inherit}.top{padding:20px var(--pad);display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);color:var(--muted);font-size:13px}.brand{color:var(--text);letter-spacing:.16em;font-weight:700}.module{min-height:52vh;padding:clamp(64px,10vw,140px) var(--pad);display:grid;grid-template-columns:minmax(0,1.05fr) minmax(260px,.95fr);align-items:center;gap:clamp(28px,6vw,90px);border-bottom:1px solid var(--line);max-width:1440px;margin:auto}.module:nth-child(odd){background:#1b1e23}.module.hero{min-height:78vh}.module-copy{max-width:720px}.module.text-only{grid-template-columns:minmax(0,1fr)}.module.text-only .module-copy{max-width:920px}.module.hero.text-only .module-copy{max-width:1040px}.module.hero.text-only h1{max-width:12ch}.module.hero.text-only .intro{max-width:52ch}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:var(--accent)}h1,h2{font-family:Georgia,serif;font-weight:500;line-height:1.05;letter-spacing:-.035em}h1{font-size:clamp(42px,7vw,88px);margin:18px 0}h2{font-size:clamp(34px,5vw,64px);margin:16px 0 24px}.intro{font-size:clamp(17px,2vw,21px);color:var(--muted);max-width:58ch}.facts{padding-left:20px;color:var(--muted);display:grid;gap:12px}.location-content{display:grid;gap:18px;margin:28px 0}.location-address{margin:0;padding:16px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:18px}.location-address span{display:block;margin-bottom:4px;color:var(--accent);font-size:10px;text-transform:uppercase;letter-spacing:.14em}.place-list{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 28px}.place-groups{display:grid;gap:28px}.place-group{min-width:0}.place-group-title{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin:0 0 12px;padding-bottom:10px;border-bottom:1px solid var(--line);font-size:16px;font-weight:600}.place-group-title span{color:var(--muted);font-size:12px;font-weight:400;white-space:nowrap}.place-item{min-width:0;padding:13px 0;border-bottom:1px solid var(--line)}.place-name{display:block;font-size:15px;line-height:1.4}.place-item .place-distance{display:block;margin:6px 0 0;padding:0;border:0}.place-distance{margin:14px 0 0;padding-top:12px;border-top:1px solid var(--line);font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}.benefits{display:grid;gap:14px;margin:28px 0}.benefit{padding:18px 0;border-top:1px solid var(--line)}.benefit h3{margin:0 0 5px;font-size:18px}.benefit p{margin:0;color:var(--muted)}figure{margin:0;overflow:hidden;border-radius:8px;background:var(--panel);min-height:240px}figure img{width:100%;height:100%;min-height:240px;max-height:580px;object-fit:cover}.media-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.media-card:first-child{grid-row:span 2}.media-card figcaption{padding:8px 12px;color:var(--muted);font-size:12px}.plan-card{display:grid;grid-template-columns:minmax(120px,.8fr) minmax(0,1fr);gap:18px;padding:18px;margin:18px 0;background:var(--panel);border:1px solid var(--line);border-radius:10px}.plan-card img{width:100%;height:auto;align-self:center;object-fit:contain}.plan-copy h3{margin:4px 0;font-size:22px}.plan-copy p{color:var(--muted)}.plan-copy .cta{margin-top:8px}.preview-quiz{margin:24px 0;padding:22px;background:var(--panel);border:1px solid var(--line);border-radius:10px}.mortgage-calculator{margin:24px 0;padding:22px;background:var(--panel);border:1px solid var(--line);border-radius:10px}.mortgage-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.mortgage-fields label{display:grid;gap:7px;color:var(--muted);font-size:13px}.mortgage-fields input{width:100%;min-width:0;padding:13px 14px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text);font:inherit}.mortgage-note{margin:14px 0 0;color:var(--muted);font-size:12px}.mortgage-result{display:block;margin-top:18px;padding:18px;background:var(--bg);border-left:3px solid var(--accent);font-size:18px;font-weight:600}.mortgage-result[hidden]{display:none}@media(max-width:600px){.mortgage-fields{grid-template-columns:1fr}}.quiz-question[hidden],.quiz-actions [hidden]{display:none!important}.faq-list{display:grid;gap:0;margin:28px 0;border-top:1px solid var(--line)}.faq-item{border-bottom:1px solid var(--line);padding:0}.faq-item summary{cursor:pointer;list-style:none;padding:20px 36px 20px 0;position:relative;font-size:clamp(17px,2vw,21px);font-weight:600}.faq-item summary::-webkit-details-marker{display:none}.faq-item summary:after{content:"+";position:absolute;right:4px;top:16px;color:var(--accent);font-size:26px;font-weight:400}.faq-item[open] summary:after{content:"−"}.faq-answer{max-width:68ch;padding:0 24px 18px 0;color:var(--muted)}.faq-answer p{margin:0 0 10px}.quiz-progress{margin:18px 0}.quiz-progress progress{width:100%;height:8px;accent-color:var(--accent)}.quiz-progress p{margin:6px 0;color:var(--muted);font-size:13px}.quiz-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.quiz-actions .cta{margin-top:0}.quiz-secondary{padding:12px 18px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--text);cursor:pointer}.notice pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:38vh;overflow:auto;padding:12px;background:#e9e3d9;border-radius:8px;font-size:12px}.preview-quiz h3{font-size:24px;margin:0 0 8px}.quiz-question{border:0;border-top:1px solid var(--line);padding:18px 0;margin:0}.quiz-question legend{font-weight:600;padding:0 0 12px}.quiz-option{display:flex;gap:10px;align-items:center;padding:9px 0;cursor:pointer;color:var(--muted)}.quiz-option input{appearance:auto;accent-color:var(--accent);width:18px;height:18px;min-width:18px;flex:0 0 18px;position:relative;z-index:1;pointer-events:auto}.cta{display:inline-flex;margin-top:24px;padding:14px 22px;border-radius:999px;border:1px solid var(--accent);background:var(--accent);color:var(--cta-text);cursor:pointer;font-weight:600}.cta:focus-visible,.close:focus-visible{outline:3px solid white;outline-offset:4px}.conversion-options{padding:clamp(28px,5vw,64px) var(--pad);background:var(--panel);border-top:1px solid var(--line)}.conversion-options h2{max-width:760px;margin:0 0 12px;font-size:clamp(28px,4vw,48px);letter-spacing:-.035em}.conversion-intro{max-width:620px;color:var(--muted);line-height:1.6}.conversion-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:12px;margin-top:26px}.conversion-option{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:76px;padding:18px 20px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--text);font:inherit;text-align:left;cursor:pointer;transition:border-color .2s,transform .2s}.conversion-option:hover{border-color:var(--accent);transform:translateY(-2px)}.conversion-arrow{color:var(--accent);font-size:20px}.conversion-option:focus-visible{outline:2px solid var(--accent);outline-offset:3px}@media(max-width:600px){.conversion-grid{grid-template-columns:1fr}.conversion-option{min-height:64px}}.footer{padding:50px var(--pad);color:var(--muted);font-size:13px}.notice{position:fixed;inset:auto 18px 18px;z-index:5;max-width:520px;margin:auto;padding:16px 18px;background:#f5f1ea;color:#17191d;border-radius:10px;box-shadow:0 12px 50px #0008;display:none}.notice[open]{display:block}.notice p{margin:0 32px 0 0}.close{position:absolute;right:10px;top:8px;border:0;background:none;font-size:24px;cursor:pointer;color:inherit}
.place-group{border-bottom:1px solid var(--line)}.place-group-title{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0;padding:16px 28px 16px 0;position:relative;font-size:16px;font-weight:600}.place-group-title::-webkit-details-marker{display:none}.place-group-title:after{content:"+";position:absolute;right:4px;top:10px;color:var(--accent);font-size:24px;font-weight:400}.place-group[open]>.place-group-title:after{content:"−"}.place-group-count{color:var(--muted);font-size:12px;font-weight:400;white-space:nowrap}.place-group .place-list{padding:0 0 12px}
/* Composition archetypes change the page rhythm and geometry independently of its palette. */
body[data-composition="editorial"] .module{max-width:1320px;grid-template-columns:minmax(0,1.12fr) minmax(280px,.88fr);padding-block:clamp(88px,12vw,168px)}
body[data-composition="editorial"] .module-copy{max-width:650px}
body[data-composition="editorial"] .module.text-only{grid-template-columns:minmax(0,1fr)}
body[data-composition="editorial"] .module.hero{min-height:84vh}
body[data-composition="editorial"] h1,body[data-composition="editorial"] h2{font-family:Georgia,"Times New Roman",serif;font-weight:400;letter-spacing:-.055em}
body[data-composition="editorial"] figure{border-radius:2px}
body[data-composition="cinematic"] .module{max-width:none;min-height:66vh;padding-inline:clamp(24px,7vw,112px);border-bottom-color:transparent}
body[data-composition="cinematic"] .module:nth-child(even){background:transparent}
body[data-composition="cinematic"] .module.hero{min-height:min(92svh,980px)}
body[data-composition="cinematic"] .module.hero[data-variant]:not([data-variant="full-bleed"]):not([data-variant="immersive"]){grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
body[data-composition="cinematic"] .module.hero.text-only{grid-template-columns:minmax(0,1fr)}
body[data-composition="cinematic"] .module-copy{max-width:760px}
body[data-composition="cinematic"] .module.text-only{grid-template-columns:minmax(0,1fr)}
body[data-composition="cinematic"] h1{font-size:clamp(52px,9vw,124px);letter-spacing:-.065em}
body[data-composition="cinematic"] figure{border-radius:0}
body[data-composition="architectural"] .module{max-width:1600px;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:clamp(24px,4vw,64px);padding-block:clamp(56px,8vw,104px);border-bottom:1px solid var(--line)}
body[data-composition="architectural"] .module:nth-child(odd){background:transparent}
body[data-composition="architectural"] .module-copy{max-width:680px}
body[data-composition="architectural"] .module.text-only{grid-template-columns:minmax(0,1fr)}
body[data-composition="architectural"] .eyebrow{font-family:Inter,Arial,sans-serif;font-variant-numeric:tabular-nums;border-bottom:1px solid var(--line);padding-bottom:12px;max-width:72px}
body[data-composition="architectural"] h1,body[data-composition="architectural"] h2{font-family:Inter,Arial,sans-serif;font-weight:600;letter-spacing:-.07em;line-height:.98}
body[data-composition="architectural"] figure{border-radius:0;outline:1px solid var(--line);outline-offset:8px}
@media(max-width:760px){body[data-composition="editorial"] .module,body[data-composition="cinematic"] .module,body[data-composition="architectural"] .module{padding-block:60px}body[data-composition="cinematic"] .module.hero{min-height:68svh}body[data-composition="architectural"] figure{outline-offset:4px}}
/* Text-only hero art direction: evidence-backed location metadata replaces empty space, never synthetic project imagery. */
.hero-meta{display:flex;flex-wrap:wrap;gap:clamp(22px,5vw,64px);margin:clamp(28px,5vw,56px) 0 0;padding:18px 0 0;border-top:1px solid var(--line)}
.hero-meta-item{display:grid;gap:5px;min-width:120px;margin:0}
.hero-meta dt{color:var(--muted);font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase}
.hero-meta dd{margin:0;color:var(--text);font-size:14px;font-weight:550}
body[data-composition="editorial"] .hero.text-only{background:linear-gradient(115deg,transparent 0 68%,color-mix(in srgb,var(--accent) 7%,transparent) 68% 100%)}
body[data-composition="editorial"] .hero.text-only h1{max-width:10ch;font-size:clamp(54px,8.4vw,112px);line-height:.98}
body[data-composition="editorial"] .hero.text-only .hero-meta{max-width:680px}
body[data-composition="cinematic"] .hero.text-only{position:relative;isolation:isolate;overflow:hidden;background:radial-gradient(ellipse at 78% 24%,rgba(216,198,168,.15),transparent 42%),linear-gradient(135deg,transparent 58%,rgba(216,198,168,.055))}
body[data-composition="cinematic"] .hero.text-only:after{content:"";position:absolute;z-index:-1;right:-10vw;top:10%;width:min(48vw,620px);aspect-ratio:1;border:1px solid var(--line);border-radius:50%;box-shadow:0 0 0 42px rgba(255,255,255,.018),0 0 0 84px rgba(255,255,255,.012);pointer-events:none}
body[data-composition="cinematic"] .hero.text-only h1{max-width:11ch;font-size:clamp(58px,10vw,136px);line-height:.9}
body[data-composition="cinematic"] .hero.text-only .hero-meta{max-width:760px;margin-top:clamp(38px,7vw,82px)}
body[data-composition="architectural"] .hero.text-only{position:relative;isolation:isolate;background-image:repeating-linear-gradient(90deg,transparent 0 119px,var(--line) 120px 121px),repeating-linear-gradient(0deg,transparent 0 119px,var(--line) 120px 121px);background-size:100% 100%;background-position:center}
body[data-composition="architectural"] .hero.text-only .module-copy{max-width:1040px}
body[data-composition="architectural"] .hero.text-only h1{max-width:9ch;font-size:clamp(58px,9.4vw,128px)}
body[data-composition="architectural"] .hero.text-only .hero-meta{max-width:620px;margin-left:auto;border-top:0;border-left:2px solid var(--accent);padding:4px 0 4px 22px;gap:24px}
body[data-composition="architectural"] .hero.text-only .hero-meta-item{min-width:150px}
@media(max-width:760px){.hero-meta{gap:18px 28px;margin-top:28px;padding-top:14px}body[data-composition="cinematic"] .hero.text-only:after{right:-34vw;top:18%;width:78vw}body[data-composition="architectural"] .hero.text-only .hero-meta{margin-left:0;padding-left:16px;gap:16px}}
/* Strategy-selected variants are real layout choices, not passive metadata. */
.module[data-variant="editorial-split"]{grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:clamp(32px,7vw,110px)}
.module[data-variant="gallery-mosaic"]{grid-template-columns:minmax(220px,.72fr) minmax(0,1.28fr)}
.module[data-variant="gallery-mosaic"] .media-grid{grid-template-columns:minmax(0,1.3fr) minmax(0,.8fr);grid-template-rows:repeat(2,minmax(130px,1fr))}
.module[data-variant="gallery-mosaic"] .media-card:first-child{grid-row:span 2}
.module[data-variant="plan-selector"]{grid-template-columns:1fr}
.module[data-variant="plan-selector"] .module-copy{max-width:1160px}
.module[data-variant="plan-selector"] .plan-card{max-width:900px}
.module[data-variant="step-form"]{grid-template-columns:1fr}
.module[data-variant="step-form"] .module-copy{max-width:1160px}
.module[data-variant="step-form"] .preview-quiz{max-width:760px}
.module[data-variant="feature-led"]{grid-template-columns:minmax(0,1fr)}
.module[data-variant="feature-led"] .module-copy{max-width:900px}
.module[data-variant="proof-led"]{background:#222720}
.module[data-variant="proof-led"] .benefit{padding:22px 24px;background:#292e28;border:1px solid var(--line);border-radius:8px}
.module[data-variant="image-led"]{grid-template-columns:minmax(0,1fr)}
.module[data-variant="image-led"] .module-copy{max-width:1050px}
.module[data-variant="image-led"] figure,.module[data-variant="image-led"] .media-grid{width:100%;max-width:1320px}
.module[data-variant="location-led"]{grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr)}
.module[data-variant="location-led"] .facts{padding:24px 28px;background:var(--panel);border:1px solid var(--line);border-radius:10px}
.module[data-variant="conversion-led"]{background:#26241f}
.module[data-variant="conversion-led"] .module-copy{max-width:900px}
.module[data-variant="conversion-led"] .cta{font-size:16px;padding:17px 26px}
.module[data-variant="immersive"]{position:relative;display:flex;align-items:flex-end;min-height:78vh;overflow:hidden}
.module[data-variant="immersive"] figure{position:absolute;inset:0;z-index:0;border-radius:0}
.module[data-variant="immersive"] figure img{height:100%;max-height:none;filter:brightness(.58)}
.module[data-variant="immersive"] .module-copy{position:relative;z-index:1;max-width:760px}
.module[data-variant="full-bleed"]{position:relative;display:flex;align-items:flex-end;min-height:76vh;overflow:hidden}
.module[data-variant="full-bleed"] figure{position:absolute;inset:0;z-index:0;border-radius:0}
.module[data-variant="full-bleed"] figure img{height:100%;max-height:none;filter:brightness(.55)}
.module[data-variant="full-bleed"] .module-copy{position:relative;z-index:1;max-width:760px}
.module.text-only,.module.text-only[data-variant="location-led"]{grid-template-columns:minmax(0,1fr);min-height:auto;padding-block:clamp(52px,7vw,88px)}.module.hero.text-only{min-height:clamp(440px,58vh,620px)}.module.text-only .module-copy{max-width:1000px}
@media(max-width:760px){.place-list{grid-template-columns:1fr}.module.text-only,.module.hero.text-only{min-height:unset;padding-block:52px}.module,.module.hero,.module[data-variant="editorial-split"],.module[data-variant="gallery-mosaic"],.module[data-variant="plan-selector"],.module[data-variant="step-form"],.module[data-variant="feature-led"],.module[data-variant="image-led"],.module[data-variant="location-led"]{grid-template-columns:1fr;min-height:unset;padding-block:68px}.module figure,.module .media-grid{grid-row:1}.module-copy{grid-row:2}.module[data-variant="full-bleed"]{display:flex;min-height:64svh;padding-block:68px}.module[data-variant="full-bleed"] figure{position:absolute;inset:0;grid-row:auto}.module[data-variant="full-bleed"] .module-copy{grid-row:auto}figure img{max-height:360px}.plan-card{grid-template-columns:1fr}.plan-card img{max-height:260px}.top{font-size:11px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
</style>
</head>
<body data-theme="${esc(designTheme)}" data-composition="${esc(["editorial", "cinematic", "architectural"].includes(profile.design?.composition) ? profile.design.composition : "editorial")}">
<header class="top"><span class="brand">KEY</span><span>${esc(city)} · предварительная версия</span></header>
<main>
${sections || '<section class="module"><div class="module-copy"><h1>Материалы проекта готовятся</h1><p class="intro">Для этой версии ещё не выбраны разделы презентации.</p></div></section>'}
${renderConversionChoices()}
</main>
<footer class="footer">Предварительная сборка для внутренней проверки. Не является опубликованной страницей и не принимает заявки.</footer>
<dialog class="notice" id="previewNotice" aria-labelledby="noticeTitle"><button class="close" type="button" aria-label="Закрыть">×</button><strong id="noticeTitle">Сценарий обращения</strong><p id="noticeText">В этой предварительной версии отправка заявок отключена. Перед публикацией необходимо подключить и проверить доставку обращений KEY.</p><pre id="noticePayload" hidden></pre></dialog>
<script>
const dialog=document.getElementById("previewNotice");
const noticeTitle=document.getElementById("noticeTitle");
const noticeText=document.getElementById("noticeText");
const noticePayload=document.getElementById("noticePayload");
const showPreview=(title,message,payload)=>{
 noticeTitle.textContent=title;
 noticeText.textContent=message;
 noticePayload.hidden=!payload;
 noticePayload.textContent=payload?JSON.stringify(payload,null,2):"";
 dialog.showModal();
};
document.querySelectorAll("[data-preview-cta]").forEach(button=>button.addEventListener("click",()=>{
 const section=button.closest("[data-module]");
 const plan=button.dataset.previewPlanId?{
  id:button.dataset.previewPlanId,
  rooms:Number(button.dataset.previewPlanRooms),
  areaSqm:Number(button.dataset.previewPlanArea),
  floor:button.dataset.previewPlanFloor?Number(button.dataset.previewPlanFloor):null,
  finishing:button.dataset.previewPlanFinishing||null,
  assetId:button.dataset.previewPlanAssetId
 }:null;
 const payload={schemaVersion:"key-cta-context/2.0",state:"preview_only",projectId:${JSON.stringify(projectId)},
  conversion:{scenarioId:button.dataset.previewScenario||button.dataset.previewCta,offerId:button.dataset.previewCta==="generic"?null:button.dataset.previewCta,moduleId:section?.dataset.module||null,entityContext:plan?{plan}:{}},
  requirements:{requiredFields:JSON.parse(button.dataset.previewRequiredFields||"[]"),consentRequired:button.dataset.previewConsentRequired!=="false"},
  delivery:{status:"disabled_in_preview",accepted:false}};
 showPreview(button.dataset.previewTitle||"Сценарий обращения","Предпросмотр контекста обращения. Ничего не отправляется.",payload);
}));
document.querySelectorAll("form[data-mortgage-calculator]").forEach(form=>{
 form.addEventListener("submit",event=>{
  event.preventDefault();
  const fields=Object.fromEntries(new FormData(form).entries());
  const price=Number(fields.price);
  const downPayment=Number(fields.downPayment);
  const annualRate=Number(fields.rate);
  const years=Number(fields.years);
  const inputs=form.querySelectorAll("input");
  inputs.forEach(input=>input.setCustomValidity(""));
  if(!Number.isFinite(price)||price<=0){form.elements.price.setCustomValidity("Укажите стоимость квартиры больше нуля.");}
  if(!Number.isFinite(downPayment)||downPayment<0||downPayment>=price){form.elements.downPayment.setCustomValidity("Взнос должен быть не меньше нуля и меньше стоимости квартиры.");}
  if(!Number.isFinite(annualRate)||annualRate<0||annualRate>100){form.elements.rate.setCustomValidity("Укажите ставку от 0 до 100% годовых.");}
  if(!Number.isInteger(years)||years<1){form.elements.years.setCustomValidity("Укажите срок кредита в полных годах.");}
  if(!form.reportValidity())return;
  const principal=price-downPayment;
  const months=years*12;
  const monthlyRate=annualRate/1200;
  const payment=monthlyRate===0?principal/months:principal*monthlyRate/(1-Math.pow(1+monthlyRate,-months));
  const format=value=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(Math.round(value))+" ₽";
  const result=form.querySelector("[data-mortgage-result]");
  result.textContent="Ориентировочный платёж — "+format(payment)+" в месяц. Сумма кредита: "+format(principal)+".";
  result.hidden=false;
 });
});
document.querySelectorAll("form[data-preview-quiz]").forEach(form=>{
 const steps=Array.from(form.querySelectorAll("[data-quiz-step]"));
 const previous=form.querySelector("[data-quiz-prev]");
 const next=form.querySelector("[data-quiz-next]");
 const submit=form.querySelector("[data-quiz-submit]");
 const progress=form.querySelector("[data-quiz-progress]");
 const status=form.querySelector("[data-quiz-status]");
 let current=0;
 const updateStep=()=>{
  steps.forEach((step,index)=>{step.hidden=index!==current});
  previous.disabled=current===0;
  next.hidden=current===steps.length-1;
  submit.hidden=current!==steps.length-1;
  progress.value=current+1;
  status.textContent="Вопрос "+(current+1)+" из "+steps.length;
 };
 next?.addEventListener("click",()=>{
  const selected=steps[current].querySelector("input:checked");
  if(!selected){steps[current].querySelector("input")?.reportValidity();return;}
  current=Math.min(current+1,steps.length-1);updateStep();
 });
 previous?.addEventListener("click",()=>{current=Math.max(0,current-1);updateStep()});
 form.addEventListener("submit",event=>{
  event.preventDefault();
  const answers=steps.map(step=>{
   const selected=step.querySelector("input:checked");
   return selected?{questionId:selected.name,optionId:selected.value}:null;
  });
  const missing=answers.findIndex(answer=>!answer);
  if(missing!==-1){current=missing;updateStep();steps[current].querySelector("input")?.reportValidity();return;}
  const payload={schemaVersion:"key-cta-context/2.0",state:"preview_only",projectId:${JSON.stringify(projectId)},
   conversion:{scenarioId:form.dataset.resultScenario||form.dataset.resultOffer,offerId:form.dataset.resultOffer,moduleId:form.dataset.moduleId||"quiz",entityContext:{quizAnswers:answers}},
   requirements:{requiredFields:JSON.parse(form.dataset.previewRequiredFields||"[]"),consentRequired:form.dataset.previewConsentRequired!=="false"},
   delivery:{status:"disabled_in_preview",accepted:false}};
  showPreview("Подбор завершён","Ответы подготовлены локально для проверки сценария. Данные не отправляются.",payload);
 });
 updateStep();
});
dialog.querySelector(".close").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()});
</script>
</body></html>`;
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html, "utf8");
console.log(`Review preview written to ${output} (${modules.length} selected modules; no lead delivery enabled).`);
