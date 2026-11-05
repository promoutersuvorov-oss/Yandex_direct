const { test, expect } = require("@playwright/test");

const url = "http://127.0.0.1:4173/artifacts/review-bundle/preview.html";

const fixtureSvg = (label, background) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="${background}"/><text x="600" y="410" text-anchor="middle" font-family="Arial,sans-serif" font-size="48" fill="#ffffff">${label}</text></svg>`;

async function serveSyntheticMedia(page) {
  await page.route("https://example.invalid/tests/fixtures/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    const media = {
      "/tests/fixtures/preview-hero.svg": fixtureSvg("Синтетический фасад", "#52616b"),
      "/tests/fixtures/preview-gallery.svg": fixtureSvg("Синтетический двор", "#718477"),
      "/tests/fixtures/preview-plan.svg": fixtureSvg("Синтетическая планировка", "#9b8f82")
    };
    const body = media[pathname];
    return body ? route.fulfill({ status: 200, contentType: "image/svg+xml", body }) : route.fulfill({ status: 404, body: "Not found" });
  });
}

test("synthetic landing renders distinct interactive modules responsively", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await serveSyntheticMedia(page);\n  await page.goto(url, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1, name: "Синтетический ЖК — тест интерфейса" })).toBeVisible();
  await expect(page.locator('[data-module="gallery"] .media-card')).toHaveCount(2);
  await expect(page.locator('[data-module="floor-plans"] .plan-card')).toHaveCount(1);
  await expect(page.locator('form[data-preview-quiz]')).toBeVisible();
  const heroColumns = await page.locator('[data-module="hero"]').evaluate(el => getComputedStyle(el).gridTemplateColumns);
  const galleryColumns = await page.locator('[data-module="gallery"] .media-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns);
  expect(heroColumns).not.toBe("none");
  expect(galleryColumns).not.toBe("none");

  await page.locator("main img").evaluateAll(images => images.forEach(image => { image.loading = "eager"; }));
  await page.waitForFunction(() => Array.from(document.querySelectorAll("main img")).every(image => image.complete));
  const imageHealth = await page.locator("main img").evaluateAll(images =>
    images.map(image => ({ alt: image.alt, src: image.currentSrc, loaded: image.complete && image.naturalWidth > 0 }))
  );
  expect(imageHealth.length).toBeGreaterThanOrEqual(3);
  expect(imageHealth.every(image => image.loaded), JSON.stringify(imageHealth)).toBeTruthy();

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 }
  ]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    expect(Math.max(dimensions.document, dimensions.body)).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
  expect(pageErrors).toEqual([]);
});

test("preview CTA preserves selected apartment context and never claims delivery", async ({ page }) => {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const planCta = page.locator('[data-preview-plan-id="fixture-plan-45"]');
  await expect(planCta).toBeVisible();
  await planCta.click();

  const dialog = page.locator("#previewNotice");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("fixture-plan-45");
  await expect(dialog).toContainText("отправка заявок отключена");
  await expect(page.locator("form[data-lead-form]")).toHaveCount(0);
  await dialog.locator(".close").click();
  await expect(dialog).not.toBeVisible();
});

test("selection quiz validates required answers and keeps answers local in preview", async ({ page }) => {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const quiz = page.locator('form[data-preview-quiz]');
  await expect(quiz).toBeVisible();
  await quiz.locator('input[name="purpose"][value="living"]').check();
  await quiz.locator('button[type="submit"]').click();

  const dialog = page.locator("#previewNotice");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Ответы (1) сохранены только в этой предварительной версии");
  await expect(dialog).toContainText("Отправка заявок отключена");
  await expect(page.locator("form[data-lead-form]")).toHaveCount(0);
});
