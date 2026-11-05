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
const imageFor = module => (module.assetIds || []).map(id => byId(assets, id)).find(asset => asset?.url && ["photo", "render", "plan"].includes(asset.type));
const factsFor = module => (module.requiredFactIds || []).map(id => byId(facts, id)).filter(Boolean);
const advantagesFor = module => advantages.filter(item => (item.supportingFactIds || []).some(id => (module.requiredFactIds || []).includes(id)));
const labelFor = module => ({
  hero: "О проекте", key: "Главная идея", gallery: "Архитектура и пространство",
  about: "О проекте", security: "Территория и безопасность", quiz: "Подбор квартиры",
  location: "Расположение", places: "Рядом с домом", lifestyle: "Образ жизни",
  life: "Образ жизни", gift: "Презентация", presentation: "Презентация",
  apartments: "Квартиры и планировки", "floor-plans": "Планировки", price: "Стоимость",
  developer: "О застройщике", mortgage: "Финансовые условия", steps: "Следующий шаг",
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
  const offer = offerFor(module);
  const heading = module.moduleId === "hero"
    ? (profile.project.positioning || profile.project.name || labelFor(module))
    : labelFor(module);
  const intro = module.moduleId === "hero"
    ? (profile.project.positioning || module.reason || "")
    : (module.userQuestion || module.whyIncluded || module.reason || "");
  const factList = factsHere.map(fact => `<li>${esc(fact.claim)}</li>`).join("");
  const benefitList = advantagesHere.map(item => `<article class="benefit"><h3>${esc(item.title)}</h3><p>${esc(item.benefit)}</p></article>`).join("");
  const image = asset ? `<figure><img src="${esc(asset.url)}" alt="${esc(asset.alt || profile.project.name || "Изображение проекта")}" loading="lazy"></figure>` : "";
  const cta = button(offer, module.moduleId === "hero" ? "Обсудить проект" : "");
  const extra = module.moduleId === "location" || module.moduleId === "places"
    ? infrastructure.map(item => `<li><strong>${esc(item.name)}</strong>${item.publicLabel ? ` — ${esc(item.publicLabel)}` : ""}${Number.isFinite(item.walkingMinutes) ? ` · ${esc(item.walkingMinutes)} мин пешком` : ""}</li>`).join("")
    : "";
  return `<section class="module ${module.moduleId === "hero" ? "hero" : ""}" id="module-${esc(module.moduleId)}" aria-labelledby="heading-${index}">
    <div class="module-copy"><p class="eyebrow">${String(index + 1).padStart(2, "0")} / ${esc(module.variant || "раздел")}</p>
      <h2 id="heading-${index}">${esc(heading)}</h2>
      ${intro ? `<p class="intro">${esc(intro)}</p>` : ""}
      ${benefitList ? `<div class="benefits">${benefitList}</div>` : ""}
      ${factList || extra ? `<ul class="facts">${factList}${extra}</ul>` : ""}
      ${cta}
    </div>${image}
  </section>`;
}

const sections = modules.map(renderModule).join("\n");
const title = profile.project.name || "Презентация жилого комплекса";
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
:root{color-scheme:dark;--bg:#17191d;--panel:#202329;--text:#f5f1ea;--muted:#b9b5ae;--line:#ffffff20;--accent:#d8c6a8;--pad:clamp(22px,5vw,72px);font-family:Inter,Onest,Arial,sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);line-height:1.55}a,button{font:inherit}.top{padding:20px var(--pad);display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);color:var(--muted);font-size:13px}.brand{color:var(--text);letter-spacing:.16em;font-weight:700}.module{min-height:52vh;padding:clamp(64px,10vw,140px) var(--pad);display:grid;grid-template-columns:minmax(0,1.05fr) minmax(260px,.95fr);align-items:center;gap:clamp(28px,6vw,90px);border-bottom:1px solid var(--line);max-width:1440px;margin:auto}.module:nth-child(odd){background:#1b1e23}.module.hero{min-height:78vh}.module-copy{max-width:720px}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:var(--accent)}h1,h2{font-family:Georgia,serif;font-weight:500;line-height:1.05;letter-spacing:-.035em}h1{font-size:clamp(42px,7vw,88px);margin:18px 0}h2{font-size:clamp(34px,5vw,64px);margin:16px 0 24px}.intro{font-size:clamp(17px,2vw,21px);color:var(--muted);max-width:58ch}.facts{padding-left:20px;color:var(--muted);display:grid;gap:12px}.benefits{display:grid;gap:14px;margin:28px 0}.benefit{padding:18px 0;border-top:1px solid var(--line)}.benefit h3{margin:0 0 5px;font-size:18px}.benefit p{margin:0;color:var(--muted)}figure{margin:0;overflow:hidden;border-radius:8px;background:var(--panel);min-height:240px}figure img{width:100%;height:100%;min-height:240px;max-height:580px;object-fit:cover}.cta{display:inline-flex;margin-top:24px;padding:14px 22px;border-radius:999px;border:1px solid var(--accent);background:var(--accent);color:#17191d;cursor:pointer;font-weight:600}.cta:focus-visible,.close:focus-visible{outline:3px solid white;outline-offset:4px}.footer{padding:50px var(--pad);color:var(--muted);font-size:13px}.notice{position:fixed;inset:auto 18px 18px;z-index:5;max-width:520px;margin:auto;padding:16px 18px;background:#f5f1ea;color:#17191d;border-radius:10px;box-shadow:0 12px 50px #0008;display:none}.notice[open]{display:block}.notice p{margin:0 32px 0 0}.close{position:absolute;right:10px;top:8px;border:0;background:none;font-size:24px;cursor:pointer;color:inherit}
@media(max-width:760px){.module,.module.hero{grid-template-columns:1fr;min-height:unset;padding-block:68px}.module figure{grid-row:1}.module-copy{grid-row:2}figure img{max-height:360px}.top{font-size:11px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}}
</style>
</head>
<body>
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
 dialog.showModal();
}));
dialog.querySelector(".close").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()});
</script>
</body></html>`;
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html, "utf8");
console.log(`Review preview written to ${output} (${modules.length} selected modules; no lead delivery enabled).`);
