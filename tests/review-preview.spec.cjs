const { test, expect } = require("@playwright/test");

const url = "http://127.0.0.1:4173/artifacts/review-bundle/preview.html";

test("synthetic landing renders distinct interactive modules responsively", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1, name: "Синтетический ЖК — тест интерфейса" })).toBeVisible();
  await expect(page.locator('[data-module="gallery"] .media-card')).toHaveCount(2);
  await expect(page.locator('[data-module="floor-plans"] .plan-card')).toHaveCount(1);
  await expect(page.locator('form[data-preview-quiz]')).toBeVisible();

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
