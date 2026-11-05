import { readFileSync, existsSync, statSync } from "node:fs";

const htmlPath = "landing/reference/K15_landing_edited.html";
const errors = [];
const warnings = [];
if (!existsSync(htmlPath) || statSync(htmlPath).size === 0) {
  console.error("K15 HTML baseline is missing or empty.");
  process.exit(1);
}
const html = readFileSync(htmlPath, "utf8");
const normalized = html.toLowerCase();
const requireCheck = (condition, message) => { if (!condition) errors.push(message); };
const warn = (condition, message) => { if (!condition) warnings.push(message); };
const count = (re, source = html) => [...source.matchAll(re)].length;

requireCheck(normalized.trimStart().startsWith("<!doctype html>"), "Missing HTML doctype.");
requireCheck(normalized.includes('<html lang="ru"'), "Missing Russian document language.");
requireCheck(normalized.includes('name="viewport"'), "Missing responsive viewport.");
requireCheck(normalized.includes("<body") && normalized.includes("</html>"), "Incomplete HTML shell.");

const sectionIds = [...html.matchAll(/<section\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
requireCheck(sectionIds.includes("hero"), "Hero section is missing.");
requireCheck(sectionIds.includes("apartments"), "Apartment section is missing.");
requireCheck(sectionIds.includes("location"), "Location section is missing.");
requireCheck(sectionIds.includes("contacts"), "Contacts section is missing.");
requireCheck(new Set(sectionIds).size === sectionIds.length, "Duplicate section IDs detected.");

const modalBlock = (html.match(/const MODALS\s*=\s*\{([\s\S]*?)\n\};/m) || [])[1] || "";
const modalKeys = [...modalBlock.matchAll(/^\s*([A-Za-z]\w*)\s*:/gm)].map(m => m[1]);
const wiredModalKeys = [...new Set([...html.matchAll(/data-modal=["']([^"']+)["']/g)].map(m => m[1]))];
requireCheck(modalKeys.length > 0, "No modal definitions found.");
requireCheck(wiredModalKeys.every(key => modalKeys.includes(key)), "A data-modal control references an undefined modal.");
requireCheck(html.includes("function openModal("), "Modal open handler is missing.");
requireCheck(html.includes('<dialog id="modal">'), "Main modal dialog is missing.");

const quizBlock = (html.match(/const QUIZ\s*=\s*\[([\s\S]*?)\n\];/m) || [])[1] || "";
const quizQuestions = count(/\{k:/g, quizBlock);
requireCheck(quizQuestions >= 2, "Quiz has fewer than two configured questions.");
requireCheck(html.includes("quiz_done") && html.includes("quiz_step_"), "Quiz analytics hooks are missing.");

requireCheck(html.includes("function leadForm("), "Lead form factory is missing.");
requireCheck(html.includes("document.addEventListener('submit'"), "Lead submit handler is missing.");
requireCheck(html.includes("async function sendLead("), "Lead transport function is missing.");
requireCheck(html.includes("lead_error") && html.includes("Заявка принята"), "Lead error/success states are not both present.");
requireCheck(html.includes("uconsent"), "Consent control is missing.");

requireCheck(html.includes("utm_source") && html.includes("yclid"), "UTM/click attribution fields are missing.");
requireCheck(html.includes("function goal("), "Analytics event function is missing.");

const imagesDir = "landing/reference/images";
const checklistPath = "landing/reference/files/checklist.pdf";
warn(existsSync(imagesDir), "K15 image directory is absent from the repository; visual assets cannot be verified.");
warn(existsSync(checklistPath), "Configured local checklist PDF is absent from the repository.");
warn(/presentationUrl:\s*''/.test(html), "Presentation URL is empty in the K15 configuration.");
warn(/metrikaId:\s*''/.test(html) && /vkPixelId:\s*''/.test(html), "Yandex Metrika and VK pixel IDs are empty; live analytics is not configured.");
warn(/endpoint:\s*'https:\/\/script\.google\.com/.test(html), "A public Google Apps Script endpoint is embedded in client code; review abuse protection before traffic.");
warn(/const a = Object\.keys\(o\)\.length \? o : prev/.test(html), "Attribution comment says first-touch, but new UTM values replace previous session values; verify/fix first-touch vs last-touch behavior.");
warn(/f\.push\(\['74','квартиры'\]\)/.test(html), "A hard-coded '74 apartments' claim exists; verify against a current primary source before publication.");
warn(/tg:\s*'#'/.test(html) || /yt:\s*'#'/.test(html), "At least one social URL is still a # placeholder.");
warn(/mapTileUrl:\s*'https:\/\/tile\.openstreetmap\.org/.test(html), "Public OpenStreetMap tile endpoint is configured; confirm tile usage policy and capacity for paid traffic.");
warn(/\{DELIVERY_DATE\}|\{PARKING_TERMS\}/.test(html), "Unresolved change-sensitive placeholders remain in K15 configuration.");

console.log(`K15 static audit: ${sectionIds.length} sections, ${modalKeys.length} modal definitions, ${wiredModalKeys.length} wired modal keys, ${quizQuestions} quiz questions.`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (errors.length) {
  console.error(errors.map(e => `FAIL: ${e}`).join("\n"));
  process.exit(1);
}
console.log(`PASS: structural checks passed. Known warnings: ${warnings.length}. Browser and live integration checks are not covered by this script.`);
