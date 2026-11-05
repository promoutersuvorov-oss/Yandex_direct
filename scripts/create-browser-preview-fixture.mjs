import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const source = resolve("examples/project-passport.example.json");
const outputArg = process.argv.indexOf("--out");
const output = resolve(outputArg >= 0 ? process.argv[outputArg + 1] : "artifacts/browser-fixture/passport.json");
const passport = JSON.parse(readFileSync(source, "utf8"));
const stamp = "2026-11-05T10:00:00Z";
const evidence = (title, suffix) => ({
  url: "https://example.invalid/" + suffix,
  title,
  accessedAt: stamp,
  sourceType: "document"
});
const media = (id, url, type, alt) => ({
  id,
  url,
  type,
  status: "approved",
  alt,
  rightsNote: "Синтетический fixture для CI; не является материалом реального ЖК.",
  projectMatch: "confirmed",
  rightsStatus: "confirmed",
  rightsSource: evidence("Синтетическая запись о правах", "rights/" + id)
});

passport.project.name = "Синтетический ЖК — тест интерфейса";
passport.project.location.city = "Тестовый город";
passport.project.positioning = "Синтетические данные для автоматической проверки интерфейса. Не использовать в публикации.";
passport.verification.checkedAt = stamp;
passport.verification.manualReviewRequired = false;
passport.facts = [{
  id: "fixture-positioning-proof",
  claim: "Синтетический тезис для тестирования вывода позиционирования.",
  status: "verified",
  publicUse: "allowed",
  sources: [evidence("Синтетическое подтверждение для CI", "positioning")]
}];
passport.project.positioningStatus = "approved";
passport.project.positioningFactIds = ["fixture-positioning-proof"];
passport.advantages = [{
  id: "fixture-advantage",
  title: "Синтетическое преимущество",
  benefit: "Синтетическое описание для проверки композиции proof-led.",
  hook: "Синтетический тестовый тезис.",
  supportingFactIds: ["fixture-positioning-proof"],
  strength: "core"
}];
passport.infrastructure = [
  { name: "Тестовый городской парк", category: "park", distanceMeters: 450, walkingMinutes: 6, distanceEvidence: {
      method: "walking_route", checkedAt: stamp, validUntil: "2099-12-31T00:00:00Z",
      source: evidence("Синтетическое подтверждение пешего маршрута", "routes/park")
    }, status: "verified", publicLabel: "Синтетические данные для проверки карточки инфраструктуры",
    source: evidence("Синтетический источник инфраструктуры", "places/park") },
  { name: "Школа без подтверждённого расстояния", category: "school", status: "verified",
    publicLabel: "Объект подтверждён, маршрут не измерялся", source: evidence("Синтетический источник школы", "places/school") },
  { name: "Городской сквер", category: "park", distanceMeters: 1500, distanceEvidence: {
      method: "straight_line", checkedAt: stamp, validUntil: "2099-12-31T00:00:00Z",
      source: evidence("Синтетическое подтверждение расстояния по прямой", "routes/square")
    }, status: "verified", source: evidence("Синтетический источник сквера", "places/square") },
  { name: "Парк с устаревшим маршрутом", category: "park", distanceMeters: 900, walkingMinutes: 11, distanceEvidence: {
      method: "walking_route", checkedAt: "2020-01-01T00:00:00Z", validUntil: "2020-02-01T00:00:00Z",
      source: evidence("Устаревшее подтверждение маршрута", "routes/expired")
    }, status: "verified", source: evidence("Синтетический источник второго парка", "places/park-expired") },
  { name: "Неподтверждённый торговый центр", category: "shopping", status: "provisional",
    publicLabel: "Не должен появиться в публичном preview", source: evidence("Синтетический неподтверждённый источник", "places/unverified") }
];
passport.offers = [
  { id: "presentation", scenarioId: "presentation-request", title: "Получить тестовую презентацию", type: "presentation", status: "active", requiredFields: ["name", "phone"], consentRequired: true },
  { id: "selection", scenarioId: "guided-apartment-selection", title: "Тестовый подбор", type: "apartment_selection", status: "active", requiredFields: ["name", "phone"], consentRequired: true }
];
passport.assets.images = [
  media("fixture-hero", "https://example.invalid/tests/fixtures/preview-hero.svg", "render", "Синтетический фасад"),
  media("fixture-gallery", "https://example.invalid/tests/fixtures/preview-gallery.svg", "photo", "Синтетический двор")
];
passport.assets.plans = [
  media("fixture-plan", "https://example.invalid/tests/fixtures/preview-plan.svg", "plan", "Синтетическая планировка")
];
passport.apartmentPlans = [{
  id: "fixture-plan-45",
  title: "Тестовая двухкомнатная планировка",
  rooms: 2,
  areaSqm: 54.2,
  assetId: "fixture-plan",
  status: "verified",
  publicUse: "allowed",
  sources: [evidence("Синтетические данные планировки", "plans/fixture-plan-45")]
}];
passport.faq = [
  { id: "fixture-faq-territory", question: "Как устроена тестовая территория?", requiredFactIds: ["fixture-positioning-proof"] },
  { id: "fixture-faq-apartments", question: "Сколько квартир в тестовом проекте?", requiredFactIds: ["fixture-positioning-proof"] }
];
passport.selectionQuiz = {
  status: "approved",
  title: "Тестовый подбор квартиры",
  description: "Ответы используются только для проверки интерфейса и никуда не отправляются.",
  resultOfferId: "selection",
  questions: [
    {
      id: "purpose",
      label: "Для чего выбираете квартиру?",
      options: [
        { id: "living", label: "Для собственного проживания" },
        { id: "investment", label: "Для инвестиций" }
      ]
    },
    {
      id: "rooms",
      label: "Сколько комнат рассматриваете?",
      options: [
        { id: "one", label: "Одну" },
        { id: "two", label: "Две" },
        { id: "three", label: "Три и более" }
      ]
    },
    {
      id: "timing",
      label: "Когда планируете покупку?",
      options: [
        { id: "soon", label: "В ближайшее время" },
        { id: "later", label: "Позже" }
      ]
    }
  ]
};
passport.contentStrategy.modules = [
  { moduleId: "hero", decision: "include", reason: "Синтетический первый экран", variant: "editorial-split", assetIds: ["fixture-hero"], ctaIds: ["presentation"] },
  { moduleId: "gallery", decision: "include", reason: "Проверка нескольких изображений", variant: "gallery-mosaic", assetIds: ["fixture-hero", "fixture-gallery"] },
  { moduleId: "location", decision: "include", reason: "Проверка подтверждённой инфраструктуры", variant: "location-led", userQuestion: "Что находится рядом с домом?", requiredFactIds: ["fixture-positioning-proof"] },
  { moduleId: "floor-plans", decision: "include", reason: "Проверка данных планировки", variant: "plan-selector", assetIds: ["fixture-plan"], ctaIds: ["selection"] },
  { moduleId: "quiz", decision: "include", reason: "Проверка локального квиза", variant: "step-form", ctaIds: ["selection"] },
  { moduleId: "lifestyle", decision: "include", reason: "Проверка image-led layout", variant: "image-led", requiredFactIds: ["fixture-positioning-proof"], assetIds: ["fixture-gallery"] },
  { moduleId: "security", decision: "include", reason: "Проверка proof-led layout", variant: "proof-led", requiredFactIds: ["fixture-positioning-proof"] },
  { moduleId: "developer", decision: "include", reason: "Проверка immersive layout", variant: "immersive", assetIds: ["fixture-hero"] },
  { moduleId: "faq", decision: "include", reason: "Проверка структурированного FAQ", variant: "faq-accordion", requiredFactIds: ["fixture-positioning-proof"] }
];
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(passport, null, 2) + "\n", "utf8");
console.log("Synthetic browser fixture written to " + output + "; contains no real project or customer data.");
