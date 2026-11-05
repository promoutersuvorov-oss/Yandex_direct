const { test, expect } = require("@playwright/test");

const url = "http://127.0.0.1:4173/artifacts/kd905-review/preview.html";

test("KD 905 uses its own editorial composition and only verified project facts", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });

  await expect(page.locator("body")).toHaveAttribute("data-theme", "warm-editorial");
  await expect(page.locator("body")).not.toContainText("EDITORIAL-SPLIT");
  await expect(page.locator("body")).not.toContainText("IMAGE-LED");
  await expect(page.getByRole("heading", { level: 1, name: "Клубный дом «905»" })).toBeVisible();
  await expect(page.locator("main [data-module]")).toHaveCount(6);
  await expect(page.locator("body")).toContainText("45 квартир");
  await expect(page.locator("body")).toContainText("Центр с более спокойным ритмом");
  await expect(page.locator("body")).toContainText("Подземный паркинг");
  await expect(page.locator("body")).toContainText("движения автомобилей");
  await expect(page.locator("body")).toContainText("не принимает заявки");
  await expect(page.locator("body")).toContainText("ул. Революции 1905 года, 14");
  await expect(page.getByRole("heading", { name: "Вопросы и ответы" })).toHaveCount(0);
  await expect(page.locator('main [data-module="hero"]')).toHaveClass(/text-only/);
  await expect(page.locator('main [data-module="lifestyle"]')).toHaveAttribute("data-variant", "feature-led");

  await expect(page.locator("main img")).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.locator("button[data-preview-cta]")).toHaveCount(0);

  const visualTokens = await page.evaluate(() => ({
    background: getComputedStyle(document.body).backgroundColor,
    headingFont: getComputedStyle(document.querySelector("h1")).fontFamily,
    parkingCardBackground: getComputedStyle(document.querySelector('[data-module="security"] .benefit')).backgroundColor,
    parkingCardText: getComputedStyle(document.querySelector('[data-module="security"] .benefit p')).color,
    heroColumns: getComputedStyle(document.querySelector('[data-module="hero"]')).gridTemplateColumns
  }));
  expect(visualTokens.background).toBe("rgb(243, 238, 229)");
  expect(visualTokens.headingFont).toContain("Georgia");
  expect(visualTokens.parkingCardBackground).toBe("rgb(217, 205, 189)");
  expect(visualTokens.parkingCardText).toBe("rgb(81, 74, 66)");
  expect(visualTokens.heroColumns.trim().split(/\s+/)).toHaveLength(1);

  await page.screenshot({ path: "test-results/kd905-preview-desktop.png", fullPage: true });
  expect(pageErrors).toEqual([]);
});

test("KD 905 internal preview fits a narrow mobile viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1, name: "Клубный дом «905»" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(Math.max(dimensions.document, dimensions.body)).toBeLessThanOrEqual(dimensions.viewport + 1);
  await page.screenshot({ path: "test-results/kd905-preview-mobile.png", fullPage: true });
});
