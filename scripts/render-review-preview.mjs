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
const modules = manifest.modules;
const safeImageUrl = value => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
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
const renderPlans = offer => (profile.apartmentPlans || []).map(plan => {
  const asset = byId(assets, plan.assetId);
  if (!asset || !safeImageUrl(asset.url)) return "";
  const rooms = plan.rooms === 0 ? "Студия" : plan.rooms + "-комнатная";
  const meta = [rooms, Number(plan.areaSqm).toLocaleString("ru-RU") + " м²", plan.floor ? plan.floor + " этаж" : ""].filter(Boolean).join(" · ");
  const action = offer ? '<button class="cta" type="button" data-preview-cta="' + esc(offer.id) +
    '" data-preview-title="' + esc(offer.title) + '" data-preview-plan-id="' + esc(plan.id) + '">Обсудить эту планировку</button>' : "";
  return '<article class="plan-card"><img src="' + esc(safeImageUrl(asset.url)) + '" alt="' +
    esc(asset.alt || "Планировка квартиры") + '" loading="lazy"><div class="plan-copy"><p class="eyebrow">Планировка</p><h3>' +
    esc(plan.title || rooms) + '</h3><p>' + esc(meta) + '</p>' + (plan.finishing ? '<p>' + esc(plan.finishing) + '</p>' : "") +
    action + '</div></article>';
}).filter(Boolean).join("");
const renderQuiz = quiz => {
  if (!quiz) return "";
  const questions = quiz.questions.map((question, index) =>
    '<fieldset class="quiz-question"><legend>' + (index + 1) + '. ' + esc(question.label) + '</legend>' +
    question.options.map(option => '<label class="quiz-option"><input type="radio" name="' + esc(question.id) +
      '" value="' + esc(option.id) + '" required><span>' + esc(option.label) + '</span></label>').join("") + '</fieldset>'
  ).join("");
  return '<form class="preview-quiz" data-preview-quiz data-result-offer="' + esc(quiz.resultOfferId) +
    '"><h3>' + esc(quiz.title) + '</h3>' + (quiz.description ? '<p>' + esc(quiz.description) + '</p>' : "") +
    questions + '<button class="cta" type="submit">Завершить подбор</button></form>';
};
const factsFor = module => (module.requiredFactIds || []).map(id => byId(facts, id)).filter(Boolean);
const advantagesFor = module => advantages.filter(item => (item.supportingFactIds || []).some(id => (module.requiredFactIds || []).includes(id)));
const labelFor = module => ({
  hero: "О проекте", key: "Главная идея", gallery: "Архитектура и пространство",
  about: "О проекте", security: "Территория и безопасность", quiz: "Подбор квартиры",
  location: "Расположение", places: "Рядом с домом", lifestyle: "Образ жизни",
  life: "Образ жизни", gift: "Презентация", presentation: "Презентация",
  apartments: "Квартиры и планировки", "floor-plans": "Планировки", price: "Условия покупки",
  developer: "О застройщике", mortgage: "Финансовый сценарий", steps: "Следующий шаг",
  faq: "Вопросы и ответы", contacts: "Связаться с KEY"
}[module.moduleId] || module.moduleId.replace(/[-_]/g, " "));
const offerFor = module => (module.ctaIds || []).map(id => byId(offers, id)).find(Boolean);
const button = (offer, fallback) => offer
  ? `<button class="cta" type="button" data-preview-cta="${esc(offer.id)}" data-preview-title="${esc(offer.title)}">${esc(offer.title)}</button>`
  : fallback ? `<button class="cta" type="button" data-preview-cta="generic" data-preview-title="${esc(fallback)}">${esc(fallback)}</button>` : "";

function renderModule(module, index) {
  const factsHere = factsFor(module);
  const advantagesHere = advantagesFor(module);
  const asset = imageFor(module);
  const moduleAssets = assetsFor(module);
  const offer = offerFor(module);
  const heading = module.moduleId === "hero"
    ? (profile.project.name || labelFor(module))
    : labelFor(module);
  const strongestAdvantage = [...advantages].sort((a, b) =>
    ({ core: 0, strong: 1, supporting: 2 }[a.strength] ?? 3) -
    ({ core: 0, strong: 1, supporting: 2 }[b.strength] ?? 3)
  )[0];
  // Never expose the strategist's internal rationale as visitor-facing copy.
  const intro = module.moduleId === "hero"
    ? (profile.project.positioning || strongestAdvantage?.benefit || "")
    : (module.userQuestion || "");
  const factList = factsHere.map(fact => `<li>${esc(fact.claim)}</li>`).join("");
  const benefitList = advantagesHere.map(item => `<article class="benefit"><h3>${esc(item.title)}</h3><p>${esc(item.benefit)}</p></article>`).join("");
  const image = module.moduleId === "gallery" && moduleAssets.length
    ? renderGallery(moduleAssets)
    : ["floor-plans", "apartments", "quiz"].includes(module.moduleId) ? ""
    : asset ? '<figure><img src="' + esc(safeImageUrl(asset.url)) + '" alt="' + esc(asset.alt || profile.project.name || "Изображение проекта") + '" loading="lazy"></figure>' : "";
  const plans = (module.moduleId === "floor-plans" || module.moduleId === "apartments") ? renderPlans(offer) : "";
  const quiz = module.moduleId === "quiz" ? renderQuiz(profile.selectionQuiz) : "";
  const cta = ["floor-plans", "apartments", "quiz"].includes(module.moduleId) ? "" : button(offer, module.moduleId === "hero" ? "Обсудить проект" : "");
  const extra = module.moduleId === "location" || module.moduleId === "places"
    ? infrastructure.map(item => `<li><strong>${esc(item.name)}</strong>${item.publicLabel ? ` — ${esc(item.publicLabel)}` : ""}${Number.isFinite(item.walkingMinutes) ? ` · ${esc(item.walkingMinutes)} мин пешком` : ""}</li>`).join("")
    : "";
  const headingTag = module.moduleId === "hero" ? "h1" : "h2";
  return `<section class="module ${module.moduleId === "hero" ? "hero" : ""}" data-module="${esc(module.moduleId)}" data-variant="${esc(module.variant || "default")}" id="module-${esc(module.moduleId)}" aria-labelledby="heading-${index}">
    <div class="module-copy"><p class="eyebrow">${String(index + 1).padStart(2, "0")} / ${esc(module.variant || "раздел")}</p>
      <${headingTag} id="heading-${index}">${esc(heading)}</${headingTag}>
      ${intro ? `<p class="intro">${esc(intro)}</p>` : ""}
      ${benefitList ? `<div class="benefits">${benefitList}</div>` : ""}
      ${factList || extra ? `<ul class="facts">${factList}${extra}</ul>` : ""}
      ${plans}
      ${quiz}
      ${cta}
    </div>${image}
  </section>`;
}

const sections = modules.map(renderModule).join("\n");
const title = profile.project.name || "Презентация жилого комплекса";
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
body[data-theme="warm-editorial"] .module[data-variant="conversion-led"]{background:#e9dfd3}
body[data-theme="garden-modern"]{--bg:#101b18;--panel:#1d2c26;--text:#edf2e9;--muted:#b6c4b8;--line:#dcebdd24;--accent:#b5c89b;--cta-text:#172019;font-family:Inter,Arial,sans-serif}
body[data-theme="garden-modern"] h1,body[data-theme="garden-modern"] h2{font-family:Inter,Arial,sans-serif;letter-spacing:-.055em;font-weight:600}
body[data-theme="garden-modern"] .module:nth-child(odd){background:#15231e}
body[data-theme="garden-modern"] .module[data-variant="proof-led"]{background:#1b3027}
body[data-theme="garden-modern"] .module[data-variant="conversion-led"]{background:#233329}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);line-height:1.55}a,button{font:inherit}.top{padding:20px var(--pad);display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);color:var(--muted);font-size:13px}.brand{color:var(--text);letter-spacing:.16em;font-weight:700}.module{min-height:52vh;padding:clamp(64px,10vw,140px) var(--pad);display:grid;grid-template-columns:minmax(0,1.05fr) minmax(260px,.95fr);align-items:center;gap:clamp(28px,6vw,90px);border-bottom:1px solid var(--line);max-width:1440px;margin:auto}.module:nth-child(odd){background:#1b1e23}.module.hero{min-height:78vh}.module-copy{max-width:720px}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:var(--accent)}h1,h2{font-family:Georgia,serif;font-weight:500;line-height:1.05;letter-spacing:-.035em}h1{font-size:clamp(42px,7vw,88px);margin:18px 0}h2{font-size:clamp(34px,5vw,64px);margin:16px 0 24px}.intro{font-size:clamp(17px,2vw,21px);color:var(--muted);max-width:58ch}.facts{padding-left:20px;color:var(--muted);display:grid;gap:12px}.benefits{display:grid;gap:14px;margin:28px 0}.benefit{padding:18px 0;border-top:1px solid var(--line)}.benefit h3{margin:0 0 5px;font-size:18px}.benefit p{margin:0;color:var(--muted)}figure{margin:0;overflow:hidden;border-radius:8px;background:var(--panel);min-height:240px}figure img{width:100%;height:100%;min-height:240px;max-height:580px;object-fit:cover}.media-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.media-card:first-child{grid-row:span 2}.media-card figcaption{padding:8px 12px;color:var(--muted);font-size:12px}.plan-card{display:grid;grid-template-columns:minmax(120px,.8fr) minmax(0,1fr);gap:18px;padding:18px;margin:18px 0;background:var(--panel);border:1px solid var(--line);border-radius:10px}.plan-card img{width:100%;height:auto;align-self:center;object-fit:contain}.plan-copy h3{margin:4px 0;font-size:22px}.plan-copy p{color:var(--muted)}.plan-copy .cta{margin-top:8px}.preview-quiz{margin:24px 0;padding:22px;background:var(--panel);border:1px solid var(--line);border-radius:10px}.preview-quiz h3{font-size:24px;margin:0 0 8px}.quiz-question{border:0;border-top:1px solid var(--line);padding:18px 0;margin:0}.quiz-question legend{font-weight:600;padding:0 0 12px}.quiz-option{display:flex;gap:10px;align-items:center;padding:9px 0;cursor:pointer;color:var(--muted)}.quiz-option input{accent-color:var(--accent);width:18px;height:18px}.cta{display:inline-flex;margin-top:24px;padding:14px 22px;border-radius:999px;border:1px solid var(--accent);background:var(--accent);color:var(--cta-text);cursor:pointer;font-weight:600}.cta:focus-visible,.close:focus-visible{outline:3px solid white;outline-offset:4px}.footer{padding:50px var(--pad);color:var(--muted);font-size:13px}.notice{position:fixed;inset:auto 18px 18px;z-index:5;max-width:520px;margin:auto;padding:16px 18px;background:#f5f1ea;color:#17191d;border-radius:10px;box-shadow:0 12px 50px #0008;display:none}.notice[open]{display:block}.notice p{margin:0 32px 0 0}.close{position:absolute;right:10px;top:8px;border:0;background:none;font-size:24px;cursor:pointer;color:inherit}
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
@media(max-width:760px){.module,.module.hero,.module[data-variant="editorial-split"],.module[data-variant="gallery-mosaic"],.module[data-variant="plan-selector"],.module[data-variant="step-form"],.module[data-variant="feature-led"],.module[data-variant="image-led"],.module[data-variant="location-led"]{grid-template-columns:1fr;min-height:unset;padding-block:68px}.module figure,.module .media-grid{grid-row:1}.module-copy{grid-row:2}.module[data-variant="full-bleed"]{display:flex;min-height:64svh;padding-block:68px}.module[data-variant="full-bleed"] figure{position:absolute;inset:0;grid-row:auto}.module[data-variant="full-bleed"] .module-copy{grid-row:auto}figure img{max-height:360px}.plan-card{grid-template-columns:1fr}.plan-card img{max-height:260px}.top{font-size:11px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
</style>
</head>
<body data-theme="${esc(designTheme)}">
<header class="top"><span class="brand">KEY</span><span>${esc(city)} · предварительная версия</span></header>
<main>
${sections || '<section class="module"><div class="module-copy"><h1>Материалы проекта готовятся</h1><p class="intro">Для этой версии ещё не выбраны разделы презентации.</p></div></section>'}
</main>
<footer class="footer">Предварительная сборка для внутренней проверки. Не является опубликованной страницей и не принимает заявки.</footer>
<dialog class="notice" id="previewNotice" aria-labelledby="noticeTitle"><button class="close" type="button" aria-label="Закрыть">×</button><strong id="noticeTitle">Сценарий обращения</strong><p id="noticeText">В этой предварительной версии отправка заявок отключена. Перед публикацией необходимо подключить и проверить доставку обращений KEY.</p></dialog>
<script>
const dialog=document.getElementById("previewNotice");
document.querySelectorAll("[data-preview-cta]").forEach(button=>button.addEventListener("click",()=>{
 document.getElementById("noticeTitle").textContent=button.dataset.previewTitle||"Сценарий обращения";
 const planContext=button.dataset.previewPlanId ? " Выбрана планировка: "+button.dataset.previewPlanId+"." : "";
 document.getElementById("noticeText").textContent="Это предварительная версия: отправка заявок отключена, данные не передаются."+planContext;
 dialog.showModal();
}));
document.querySelectorAll("form[data-preview-quiz]").forEach(form=>form.addEventListener("submit",event=>{
 event.preventDefault();
 const answers=Array.from(new FormData(form).entries());
 document.getElementById("noticeTitle").textContent="Подбор завершён";
 document.getElementById("noticeText").textContent="Ответы ("+answers.length+") сохранены только в этой предварительной версии. Отправка заявок отключена.";
 dialog.showModal();
}));
dialog.querySelector(".close").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()});
</script>
</body></html>`;
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html, "utf8");
console.log(`Review preview written to ${output} (${modules.length} selected modules; no lead delivery enabled).`);
