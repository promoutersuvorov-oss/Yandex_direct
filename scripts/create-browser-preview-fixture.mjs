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
passport.facts = [];
passport.advantages = [];
passport.infrastructure = [];
passport.offers = [
  { id: "presentation", title: "Получить тестовую презентацию", type: "presentation", status: "active", requiredFields: [] },
  { id: "selection", title: "Тестовый подбор", type: "apartment_selection", status: "active", requiredFields: [] }
];
passport.assets.images = [
  media("fixture-hero", "http://127.0.0.1:4173/tests/fixtures/preview-hero.svg", "render", "Синтетический фасад"),
  media("fixture-gallery", "http://127.0.0.1:4173/tests/fixtures/preview-gallery.svg", "photo", "Синтетический двор")
];
passport.assets.plans = [
  media("fixture-plan", "http://127.0.0.1:4173/tests/fixtures/preview-plan.svg", "plan", "Синтетическая планировка")
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
passport.selectionQuiz = {
  status: "approved",
  title: "Тестовый подбор квартиры",
  description: "Ответы используются только для проверки интерфейса и никуда не отправляются.",
  resultOfferId: "selection",
  questions: [{
    id: "purpose",
    label: "Для чего выбираете квартиру?",
    options: [
      { id: "living", label: "Для собственного проживания" },
      { id: "investment", label: "Для инвестиций" }
    ]
  }]
};
passport.contentStrategy.modules = [
  { moduleId: "hero", decision: "include", reason: "Синтетический первый экран", variant: "editorial-split", assetIds: ["fixture-hero"], ctaIds: ["presentation"] },
  { moduleId: "gallery", decision: "include", reason: "Проверка нескольких изображений", variant: "gallery-mosaic", assetIds: ["fixture-hero", "fixture-gallery"] },
  { moduleId: "floor-plans", decision: "include", reason: "Проверка данных планировки", variant: "plan-selector", assetIds: ["fixture-plan"], ctaIds: ["selection"] },
  { moduleId: "quiz", decision: "include", reason: "Проверка локального квиза", variant: "step-form", ctaIds: ["selection"] }
];
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(passport, null, 2) + "\n", "utf8");
console.log("Synthetic browser fixture written to " + output + "; contains no real project or customer data.");
