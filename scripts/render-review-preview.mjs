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
const ctaAttributes = offer => `data-preview-cta="${esc(offer.id)}" data-preview-scenario="${esc(offer.scenarioId || offer.id)}" data-preview-title="${esc(offer.title)}" data-preview-description="${esc(offer.description || "")}" data-preview-type="${esc(offer.type || "other")}" data-preview-required-fields="${esc(JSON.stringify(offer.requiredFields || []))}" data-preview-consent-required="${offer.consentRequired !== false}"`;
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
  school: "Образование", kindergarten: "Детский сад", park: "Парк и прогулки",
  shopping: "Покупки", transport: "Транспорт", healthcare: "Здоровье",
  leisure: "Досуг", other: "Рядом с домом"
};
const formatDistance = meters => meters < 1000
  ? Math.round(meters).toLocaleString("ru-RU") + " м"
  : (meters / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + " км";
const renderLocation = () => {
  const cards = infrastructure.map(item => {
    const details = Number.isFinite(item.distanceMeters)
      ? [(item.distanceMethod === "walking_route" ? "по маршруту — " : "по прямой — ") + formatDistance(item.distanceMeters),
         item.distanceMethod === "walking_route" && Number.isFinite(item.walkingMinutes)
           ? item.walkingMinutes.toLocaleString("ru-RU") + " мин пешком" : ""].filter(Boolean)
      : [];
    return '<article class="place-card"><p class="place-category">' + esc(infrastructureCategory[item.category] || infrastructureCategory.other) +
      '</p><h3>' + esc(item.name) + '</h3>' +
      (item.publicLabel ? '<p class="place-label">' + esc(item.publicLabel) + '</p>' : "") +
      (details.length ? '<p class="place-distance">' + details.map(esc).join(" · ") + '</p>' : "") +
      '</article>';
  }).join("");
  if (!cards && !profile.project.address) return "";
  return '<div class="location-content">' +
    (profile.project.address ? '<p class="location-address"><span>Адрес проекта</span>' + esc(profile.project.address) + '</p>' : "") +
    (cards ? '<div class="place-grid" aria-label="Подтверждённые объекты инфраструктуры">' + cards + '</div>' : "") +
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
const offerFor = module => offersFor(module)[0];
const buttonsFor = module => {
  const assigned = offersFor(module);
  return assigned.length ? '<div class="cta-group">' + assigned.map(offer =>
    `<button class="cta" type="button" ${ctaAttributes(offer)}>${esc(offer.title)}</button>`
  ).join("") + '</div>' : "";
};

function renderModule(module, index) {
  const advantagesHere = module.moduleId === "hero" ? [] : advantagesFor(module);
  const benefitFactIds = new Set(advantagesHere.flatMap(item => item.supportingFactIds || []));
  const factsHere = module.moduleId === "faq" ? [] : factsFor(module).filter(fact => !benefitFactIds.has(fact.id));
  const asset = imageFor(module);
  const moduleAssets = assetsFor(module);
  const offer = offerFor(module);
  const heading = module.moduleId === "hero"
    ? (profile.marketing?.headline || profile.project.name || labelFor(module))
    : labelFor(module);
  // Hero marketing copy is exported only after its explicit fact references pass the evidence gate.
  const intro = module.moduleId === "hero"
    ? (profile.marketing?.lead || profile.project.positioning || "")
    : (module.userQuestion || "");
  const heroProof = module.moduleId === "hero" && Array.isArray(profile.marketing?.proofPoints) && profile.marketing.proofPoints.length
    ? '<aside class="hero-aside" aria-label="Ключевые особенности дома"><p class="hero-aside-kicker">Главное о доме</p><ol class="hero-aside-list">' + profile.marketing.proofPoints.map((point, proofIndex) => '<li><span class="hero-aside-index">' + String(proofIndex + 1).padStart(2, "0") + '</span><strong>' + esc(point.label) + '</strong></li>').join("") + '</ol><span class="hero-aside-mark" aria-hidden="true">К–15</span></aside>'
    : "";
  const factList = factsHere.map(fact => `<li>${esc(fact.claim)}</li>`).join("");
  const benefitList = advantagesHere.map(item => `<article class="benefit"><h3>${esc(item.title)}</h3><p>${esc(item.benefit)}</p></article>`).join("");
  const image = module.moduleId === "gallery" && moduleAssets.length
    ? renderGallery(moduleAssets)
    : ["floor-plans", "apartments", "quiz"].includes(module.moduleId) ? ""
    : asset ? '<figure><img src="' + esc(safeImageUrl(asset.url)) + '" alt="' + esc(asset.alt || profile.project.name || "Изображение проекта") + '" loading="lazy"></figure>' : "";
  const plans = (module.moduleId === "floor-plans" || module.moduleId === "apartments") ? renderPlans(offer) : "";
  const quiz = module.moduleId === "quiz" ? renderQuiz(profile.selectionQuiz, byId(offers, profile.selectionQuiz?.resultOfferId)) : "";
  const faq = module.moduleId === "faq" ? renderFaq(faqItems) : "";
  const cta = ["floor-plans", "apartments", "quiz"].includes(module.moduleId) ? "" : buttonsFor(module);
  const locationContent = module.moduleId === "location" || module.moduleId === "places" ? renderLocation() : "";
  const headingTag = module.moduleId === "hero" ? "h1" : "h2";
  const renderVariant = module.variant === "image-led" && !image ? "feature-led" : (module.variant || "default");
  const moduleClasses = ["module", module.moduleId === "hero" ? "hero" : "", image || plans ? "" : "text-only", module.moduleId === "hero" && heroProof ? "hero-with-proof" : ""].filter(Boolean).join(" ");
  return `<section class="${moduleClasses}" data-module="${esc(module.moduleId)}" data-variant="${esc(renderVariant)}" id="module-${esc(module.moduleId)}" aria-labelledby="heading-${index}">
    <div class="module-copy"><p class="eyebrow">${String(index + 1).padStart(2, "0")}</p>
      <${headingTag} id="heading-${index}">${esc(heading)}</${headingTag}>
      ${intro ? `<p class="intro">${esc(intro)}</p>` : ""}
      ${benefitList ? `<div class="benefits">${benefitList}</div>` : ""}
      ${factList ? `<ul class="facts">${factList}</ul>` : ""}
      ${locationContent}
      ${plans}
      ${quiz}
      ${faq}
      ${cta}
    </div>${heroProof}${image}
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
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);line-height:1.55}a,button{font:inherit}.top{padding:20px var(--pad);display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);color:var(--muted);font-size:13px}.brand{color:var(--text);letter-spacing:.16em;font-weight:700}.module{min-height:52vh;padding:clamp(64px,10vw,140px) var(--pad);display:grid;grid-template-columns:minmax(0,1.05fr) minmax(260px,.95fr);align-items:center;gap:clamp(28px,6vw,90px);border-bottom:1px solid var(--line);max-width:1440px;margin:auto}.module:nth-child(odd){background:#1b1e23}.module.hero{min-height:78vh}.module-copy{max-width:720px}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:var(--accent)}h1,h2{font-family:Georgia,serif;font-weight:500;line-height:1.05;letter-spacing:-.035em}h1{font-size:clamp(42px,7vw,88px);margin:18px 0}h2{font-size:clamp(34px,5vw,64px);margin:16px 0 24px}.intro{font-size:clamp(17px,2vw,21px);color:var(--muted);max-width:58ch}.facts{padding-left:20px;color:var(--muted);display:grid;gap:12px}.location-content{display:grid;gap:18px;margin:28px 0}.location-address{margin:0;padding:16px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:18px}.location-address span{display:block;margin-bottom:4px;color:var(--accent);font-size:10px;text-transform:uppercase;letter-spacing:.14em}.place-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.place-card{padding:20px;background:var(--panel);border:1px solid var(--line);border-radius:8px;min-width:0}.place-category{margin:0 0 10px;color:var(--accent);font-size:10px;text-transform:uppercase;letter-spacing:.12em}.place-card h3{margin:0;font-size:19px;line-height:1.2}.place-label{margin:8px 0 0;color:var(--muted)}.place-distance{margin:14px 0 0;padding-top:12px;border-top:1px solid var(--line);font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}.benefits{display:grid;gap:14px;margin:28px 0}.benefit{padding:18px 0;border-top:1px solid var(--line)}.benefit h3{margin:0 0 5px;font-size:18px}.benefit p{margin:0;color:var(--muted)}figure{margin:0;overflow:hidden;border-radius:8px;background:var(--panel);min-height:240px}figure img{width:100%;height:100%;min-height:240px;max-height:580px;object-fit:cover}.media-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.media-card:first-child{grid-row:span 2}.media-card figcaption{padding:8px 12px;color:var(--muted);font-size:12px}.plan-card{display:grid;grid-template-columns:minmax(120px,.8fr) minmax(0,1fr);gap:18px;padding:18px;margin:18px 0;background:var(--panel);border:1px solid var(--line);border-radius:10px}.plan-card img{width:100%;height:auto;align-self:center;object-fit:contain}.plan-copy h3{margin:4px 0;font-size:22px}.plan-copy p{color:var(--muted)}.plan-copy .cta{margin-top:8px}.preview-quiz{margin:24px 0;padding:22px;background:var(--panel);border:1px solid var(--line);border-radius:10px}.quiz-question[hidden],.quiz-actions [hidden]{display:none!important}.faq-list{display:grid;gap:0;margin:28px 0;border-top:1px solid var(--line)}.faq-item{border-bottom:1px solid var(--line);padding:0}.faq-item summary{cursor:pointer;list-style:none;padding:20px 36px 20px 0;position:relative;font-size:clamp(17px,2vw,21px);font-weight:600}.faq-item summary::-webkit-details-marker{display:none}.faq-item summary:after{content:"+";position:absolute;right:4px;top:16px;color:var(--accent);font-size:26px;font-weight:400}.faq-item[open] summary:after{content:"−"}.faq-answer{max-width:68ch;padding:0 24px 18px 0;color:var(--muted)}.faq-answer p{margin:0 0 10px}.quiz-progress{margin:18px 0}.quiz-progress progress{width:100%;height:8px;accent-color:var(--accent)}.quiz-progress p{margin:6px 0;color:var(--muted);font-size:13px}.quiz-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.quiz-actions .cta{margin-top:0}.quiz-secondary{padding:12px 18px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--text);cursor:pointer}.notice pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:38vh;overflow:auto;padding:12px;background:#e9e3d9;border-radius:8px;font-size:12px}.preview-quiz h3{font-size:24px;margin:0 0 8px}.quiz-question{border:0;border-top:1px solid var(--line);padding:18px 0;margin:0}.quiz-question legend{font-weight:600;padding:0 0 12px}.quiz-option{display:flex;gap:10px;align-items:center;padding:9px 0;cursor:pointer;color:var(--muted)}.quiz-option input{appearance:auto;accent-color:var(--accent);width:18px;height:18px;min-width:18px;flex:0 0 18px;position:relative;z-index:1;pointer-events:auto}.cta{display:inline-flex;margin-top:24px;padding:14px 22px;border-radius:999px;border:1px solid var(--accent);background:var(--accent);color:var(--cta-text);cursor:pointer;font-weight:600}.cta:focus-visible,.close:focus-visible{outline:3px solid white;outline-offset:4px}.footer{padding:50px var(--pad);color:var(--muted);font-size:13px}.notice{position:fixed;inset:auto 18px 18px;z-index:5;max-width:520px;margin:auto;padding:16px 18px;background:#f5f1ea;color:#17191d;border-radius:10px;box-shadow:0 12px 50px #0008;display:none}.notice[open]{display:block}.notice p{margin:0 32px 0 0}.notice #noticeOffer{margin:16px 0;padding:16px;background:#e9e3d9;border-radius:8px}.notice #noticeOffer h3{margin:0 0 8px;font-size:20px}.notice #noticeOffer p{margin:0;color:#4d4a45}.preview-form{display:grid;gap:12px;margin:16px 0}.preview-form label{display:grid;gap:5px;font-size:13px;font-weight:600}.preview-form input,.preview-form select{width:100%;padding:12px;border:1px solid #c9c1b5;border-radius:7px;background:white;color:#17191d;font:inherit}.preview-form .preview-consent{display:flex;align-items:flex-start;gap:9px;font-weight:400}.preview-form .preview-consent input{width:18px;margin-top:3px}.preview-form button{padding:13px 18px;border:0;border-radius:999px;background:#25231f;color:white;font:inherit;font-weight:600}.preview-form button:disabled{opacity:.5}.preview-disclaimer{font-size:12px;color:#625d55}.payload-details{margin-top:12px;font-size:12px}.payload-details summary{cursor:pointer;color:#625d55}.notice pre{margin-top:10px}.close{position:absolute;right:10px;top:8px;border:0;background:none;font-size:24px;cursor:pointer;color:inherit}
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
@media(max-width:760px){.place-grid{grid-template-columns:1fr}.module.text-only,.module.hero.text-only{min-height:unset;padding-block:52px}.module,.module.hero,.module[data-variant="editorial-split"],.module[data-variant="gallery-mosaic"],.module[data-variant="plan-selector"],.module[data-variant="step-form"],.module[data-variant="feature-led"],.module[data-variant="image-led"],.module[data-variant="location-led"]{grid-template-columns:1fr;min-height:unset;padding-block:68px}.module figure,.module .media-grid{grid-row:1}.module-copy{grid-row:2}.module[data-variant="full-bleed"]{display:flex;min-height:64svh;padding-block:68px}.module[data-variant="full-bleed"] figure{position:absolute;inset:0;grid-row:auto}.module[data-variant="full-bleed"] .module-copy{grid-row:auto}figure img{max-height:360px}.plan-card{grid-template-columns:1fr}.plan-card img{max-height:260px}.top{font-size:11px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
.hero-aside{position:relative;align-self:stretch;min-height:340px;max-width:430px;width:100%;justify-self:end;display:flex;flex-direction:column;justify-content:center;padding:clamp(22px,3vw,38px);overflow:hidden;border:1px solid var(--line);background:linear-gradient(145deg,#e7ddcf 0%,#ded1c0 100%);color:#25231f}.hero-aside-kicker{position:relative;z-index:1;margin:0 0 22px;color:#8e513d;font:600 10px/1.2 Inter,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase}.hero-aside-list{position:relative;z-index:1;display:grid;gap:0;list-style:none;margin:0;padding:0}.hero-aside-list li{display:grid;grid-template-columns:38px minmax(0,1fr);align-items:center;gap:12px;padding:18px 0;border-top:1px solid #25231f2b}.hero-aside-list li:last-child{border-bottom:1px solid #25231f2b}.hero-aside-index{color:#9a5b43;font:12px/1 Inter,Arial,sans-serif;font-variant-numeric:tabular-nums}.hero-aside-list strong{font:400 clamp(17px,1.8vw,22px)/1.2 Georgia,"Times New Roman",serif}.hero-aside-mark{position:absolute;right:-18px;bottom:-72px;color:#25231f0b;font:400 clamp(150px,22vw,260px)/.8 Georgia,serif;letter-spacing:-.09em;pointer-events:none}.module.hero.text-only.hero-with-proof{grid-template-columns:minmax(0,1.08fr) minmax(280px,.72fr);gap:clamp(32px,6vw,90px);min-height:clamp(560px,78vh,820px);padding-block:clamp(64px,9vw,120px)}.module.hero.text-only.hero-with-proof .module-copy{max-width:700px}.module.hero.text-only.hero-with-proof .hero-aside{grid-column:2;grid-row:1}.cta-group{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.cta-group .cta{margin-top:24px}.module.hero .cta-group{margin-top:6px}body[data-theme="warm-editorial"] .hero-aside{background:linear-gradient(145deg,#e7ddcf 0%,#ded1c0 100%)}@media(max-width:760px){.module.hero.text-only.hero-with-proof{grid-template-columns:1fr;min-height:unset;gap:28px}.module.hero.text-only.hero-with-proof .module-copy{grid-column:1;grid-row:1}.module.hero.text-only.hero-with-proof .hero-aside{grid-column:1;grid-row:2;justify-self:stretch;max-width:none;min-height:260px}.hero-aside-mark{font-size:180px}}body[data-theme="warm-editorial"] .module[data-variant="proof-led"] .benefits{grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch}body[data-theme="warm-editorial"] .module[data-variant="proof-led"] .benefit{height:100%;padding:22px 24px;background:#d9cdbd;border:1px solid #c9bca9;border-radius:8px}body[data-theme="warm-editorial"] .module[data-variant="proof-led"] .benefit p{color:#514a42}@media(max-width:760px){body[data-theme="warm-editorial"] .module[data-variant="proof-led"] .benefits{grid-template-columns:1fr}}
</style>
</head>
<body data-theme="${esc(designTheme)}" data-composition="${esc(["editorial", "cinematic", "architectural"].includes(profile.design?.composition) ? profile.design.composition : "editorial")}">
<header class="top"><span class="brand">KEY</span><span>${esc(city)} · предварительная версия</span></header>
<main>
${sections || '<section class="module"><div class="module-copy"><h1>Материалы проекта готовятся</h1><p class="intro">Для этой версии ещё не выбраны разделы презентации.</p></div></section>'}
</main>
<footer class="footer">Предварительная сборка для внутренней проверки. Не является опубликованной страницей и не принимает заявки.</footer>
<dialog class="notice" id="previewNotice" aria-labelledby="noticeTitle"><button class="close" type="button" aria-label="Закрыть">×</button><strong id="noticeTitle">Сценарий обращения</strong><p id="noticeText">Предварительный просмотр сценария. Отправка отключена.</p><div id="noticeOffer"></div><div id="noticeFormMount"></div><p class="preview-disclaimer">Демонстрационный режим: данные формы остаются только в этом окне и никуда не отправляются. Отправка заявок отключена. Тексты согласий и юридические документы должны быть утверждены KEY.</p><details class="payload-details"><summary>Технический контекст сценария</summary><pre id="noticePayload" hidden></pre></details></dialog>
<script>
const dialog=document.getElementById("previewNotice");
const noticeTitle=document.getElementById("noticeTitle");
const noticeText=document.getElementById("noticeText");
const noticeOffer=document.getElementById("noticeOffer");
const noticeFormMount=document.getElementById("noticeFormMount");
const noticePayload=document.getElementById("noticePayload");
const fieldLabels={name:"Как к вам обращаться",phone:"Номер телефона",email:"Электронная почта",preferredChannel:"Как удобнее ответить",preferredTime:"Когда удобно связаться"};
const valueCopy={
 presentation:"Оставьте контакты, чтобы получить презентацию этого жилого комплекса.",
 apartment_selection:"Оставьте контакты, чтобы специалист KEY подготовил подборку квартир с учётом ваших пожеланий.",
 mortgage_estimate:"Оставьте контакты, чтобы получить индивидуальный кредитный расчёт по выбранным параметрам.",
 consultation:"Оставьте контакты, чтобы получить ответ специалиста KEY на ваш вопрос.",
 callback:"Оставьте контакты и выберите удобное время для обратного звонка."
};
const renderPreviewForm=(fields,consentRequired)=>{
 if(!fields.length&&!consentRequired)return "";
 const inputs=fields.map(field=>{
  if(field==="preferredChannel")return '<label>'+fieldLabels[field]+'<select name="'+field+'"><option value="phone">Телефон</option><option value="messenger">Мессенджер</option></select></label>';
  if(field==="preferredTime")return '<label>'+fieldLabels[field]+'<input name="'+field+'" placeholder="Например, сегодня после 18:00"></label>';
  return '<label>'+fieldLabels[field]+'<input name="'+field+'" '+(field==="phone"?'type="tel" autocomplete="tel"':'type="text"')+' placeholder="'+(field==="phone"?"+7 (___) ___-__-__":field==="name"?"Ваше имя":"Ваш email")+'"></label>';
 }).join("");
 return '<form class="preview-form" data-preview-contact-form>'+inputs+(consentRequired?'<label class="preview-consent"><input type="checkbox" name="consent"><span>Согласен(на) на обработку персональных данных. Демонстрационный текст, требует юридического утверждения.</span></label>':"")+'<button type="submit">Продолжить — получить результат</button></form>';
};
const showPreview=(title,message,payload,offer={})=>{
 noticeTitle.textContent=title;
 noticeText.textContent=message;
 noticeOffer.innerHTML=offer.description?'<h3>'+offer.title+'</h3><p>'+offer.description+'</p>':(offer.title?'<h3>'+offer.title+'</h3><p>'+(valueCopy[offer.type]||"Оставьте контакты, чтобы получить выбранную информацию от KEY.")+'</p>':"");
 const fields=offer.fields||[];
 noticeFormMount.innerHTML=renderPreviewForm(fields,offer.consentRequired!==false);
 noticePayload.hidden=!payload;
 noticePayload.textContent=payload?JSON.stringify(payload,null,2):"";
 const form=noticeFormMount.querySelector("[data-preview-contact-form]");
 form?.addEventListener("submit",event=>{
  event.preventDefault();
  const consent=form.querySelector('[name="consent"]');
  if(consent&&!consent.checked){consent.focus();return;}
  noticeText.textContent="Сценарий заполнения проверен. В демонстрационном режиме данные не сохраняются и не отправляются.";
 });
 dialog.showModal();
};
document.querySelectorAll("[data-preview-cta]").forEach(button=>button.addEventListener("click",()=>{
 const section=button.closest("[data-module]");
 const plan=button.dataset.previewPlanId?{
  id:button.dataset.previewPlanId,rooms:Number(button.dataset.previewPlanRooms),
  areaSqm:Number(button.dataset.previewPlanArea),
  floor:button.dataset.previewPlanFloor?Number(button.dataset.previewPlanFloor):null,
  finishing:button.dataset.previewPlanFinishing||null,assetId:button.dataset.previewPlanAssetId
 }:null;
 const payload={schemaVersion:"key-cta-context/2.0",state:"preview_only",projectId:${JSON.stringify(projectId)},
  conversion:{scenarioId:button.dataset.previewScenario||button.dataset.previewCta,offerId:button.dataset.previewCta==="generic"?null:button.dataset.previewCta,moduleId:section?.dataset.module||null,entityContext:plan?{plan}:{}},
  requirements:{requiredFields:JSON.parse(button.dataset.previewRequiredFields||"[]"),consentRequired:button.dataset.previewConsentRequired!=="false"},
  delivery:{status:"disabled_in_preview",accepted:false}};
 showPreview(button.dataset.previewTitle||"Сценарий обращения","Предпросмотр контекста обращения. Ничего не отправляется.",payload,{
  title:button.dataset.previewTitle||"Получить результат",description:button.dataset.previewDescription||"",
  type:button.dataset.previewType||"other",fields:JSON.parse(button.dataset.previewRequiredFields||"[]"),
  consentRequired:button.dataset.previewConsentRequired!=="false"
 });
}));
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
  previous.disabled=current===0;next.hidden=current===steps.length-1;
  submit.hidden=current!==steps.length-1;progress.value=current+1;
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
  const answers=steps.map(step=>{const selected=step.querySelector("input:checked");return selected?{questionId:selected.name,optionId:selected.value}:null});
  const missing=answers.findIndex(answer=>!answer);
  if(missing!==-1){current=missing;updateStep();steps[current].querySelector("input")?.reportValidity();return;}
  const payload={schemaVersion:"key-cta-context/2.0",state:"preview_only",projectId:${JSON.stringify(projectId)},
   conversion:{scenarioId:form.dataset.resultScenario||form.dataset.resultOffer,offerId:form.dataset.resultOffer,moduleId:form.dataset.moduleId||"quiz",entityContext:{quizAnswers:answers}},
   requirements:{requiredFields:JSON.parse(form.dataset.previewRequiredFields||"[]"),consentRequired:form.dataset.previewConsentRequired!=="false"},
   delivery:{status:"disabled_in_preview",accepted:false}};
  showPreview("Подбор завершён","Ответы подготовлены локально. Данные не отправляются. Выберите следующий полезный шаг.",payload,{
   title:"Получить персональную подборку",type:"apartment_selection",
   description:valueCopy.apartment_selection,
   fields:JSON.parse(form.dataset.previewRequiredFields||"[]"),
   consentRequired:form.dataset.previewConsentRequired!=="false"
  });
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
