const { test, expect } = require("@playwright/test");

const url = "http://127.0.0.1:4173/artifacts/galiley-review/preview.html";

test("Galiley preview renders its own project identity and garden-modern composition", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });

  await expect(page.locator("body")).toHaveAttribute("data-theme", "garden-modern");
  await expect(page.getByRole("heading", { level: 1, name: "ЖК «Галилей»" })).toBeVisible();
  expect(await page.locator("main [data-module]").count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator("body")).toContainText("Сад внутри городского комплекса");
  // Infrastructure is grouped by type, preserving every verified place without
  // presenting a long undifferentiated sequence of cards.
  await expect(page.locator(".place-group[aria-label='Школы']")).toBeVisible();
  await expect(page.locator(".place-group[aria-label='Детские сады']")).toBeVisible();
  await expect(page.locator(".place-group .place-card")).toHaveCount(11);
  await expect(page.locator("body")).not.toContainText("Клубный дом «905»");
  await expect(page.locator("body")).toContainText("не принимает заявки");
  const heroLayout = await page.locator(".module.hero.text-only").evaluate(node => ({
    columns: getComputedStyle(node).gridTemplateColumns,
    copyWidth: getComputedStyle(node.querySelector(".module-copy")).maxWidth
  }));
  expect(heroLayout.columns.trim().split(/\s+/)).toHaveLength(1);
  expect(heroLayout.copyWidth).toBe("1040px");

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

  // Hero has one lead-magnet CTA. Other intentions belong in their own
  // semantic modules rather than competing with the presentation offer.
  const heroCtas = page.locator("#module-hero button[data-preview-cta]");
  await expect(heroCtas).toHaveCount(1);
  await expect(heroCtas.first()).toHaveText("Получить презентацию ЖК");
  await expect(heroCtas.first()).toHaveAttribute("data-preview-cta", "presentation");
  await dialog.locator(".close").click();
  await heroCtas.first().click();
  const presentationPayload = JSON.parse(await dialog.locator("#noticePayload").textContent());
  expect(presentationPayload.conversion).toMatchObject({
    scenarioId: "galiley.presentation",
    offerId: "presentation",
    moduleId: "hero"
  });
  expect(presentationPayload.requirements.requiredFields).toEqual(["phone"]);
  expect(presentationPayload.delivery).toEqual({ status: "disabled_in_preview", accepted: false });

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
