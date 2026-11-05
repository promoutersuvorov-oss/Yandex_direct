const { test, expect } = require("@playwright/test");

const url = "http://127.0.0.1:4173/artifacts/review-bundle/preview.html";

test("generated review preview adapts to mobile and desktop without horizontal overflow", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();

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

test("preview CTA opens an honest non-production notice and never submits personal data", async ({ page }) => {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const cta = page.locator("[data-preview-cta]").first();
  await expect(cta).toBeVisible();
  await cta.click();

  const dialog = page.locator("#previewNotice");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("отправка заявок отключена");
  await expect(page.locator("form")).toHaveCount(0);
  await dialog.locator(".close").click();
  await expect(dialog).not.toBeVisible();
});
