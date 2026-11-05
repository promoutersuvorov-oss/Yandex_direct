const { test, expect } = require("@playwright/test");

const url = "http://127.0.0.1:4173/artifacts/galiley-review/preview.html";

test("Galiley preview renders its own project identity and garden-modern composition", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });

  await expect(page.locator("body")).toHaveAttribute("data-theme", "garden-modern");
  await expect(page.getByRole("heading", { level: 1, name: "ЖК «Галилей»" })).toBeVisible();
  await expect(page.locator("main [data-module]").count()).resolves.toBeGreaterThanOrEqual(3);
  await expect(page.locator("body")).toContainText("городской сад");
  await expect(page.locator("body")).not.toContainText("Клубный дом «905»");
  await expect(page.locator("body")).toContainText("не принимает заявки");

  const cta = page.locator("button[data-preview-cta]").first();
  await expect(cta).toBeVisible();
  await cta.click();

  const dialog = page.locator("#previewNotice");
  await expect(dialog).toBeVisible();
  const payload = JSON.parse(await dialog.locator("#noticePayload").textContent());
  expect(payload).toMatchObject({
    schemaVersion: "key-cta-context/2.0",
    state: "preview_only",
    projectId: "galiley-voronezh",
    requirements: { consentRequired: true },
    delivery: { status: "disabled_in_preview", accepted: false }
  });
  await expect(dialog).toContainText("Ничего не отправляется");
  await expect(page.locator("form[data-lead-form]")).toHaveCount(0);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(Math.max(dimensions.document, dimensions.body)).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(pageErrors).toEqual([]);
});

test("Galiley preview remains usable on a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(url, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: "ЖК «Галилей»" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(Math.max(dimensions.document, dimensions.body)).toBeLessThanOrEqual(dimensions.viewport + 1);
  await page.screenshot({ path: "test-results/galiley-preview-mobile.png", fullPage: true });
});
