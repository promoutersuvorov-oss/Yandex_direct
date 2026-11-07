const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const url = "http://127.0.0.1:4173/landing/runtime/index.html";
const generatedConfig = path.resolve("artifacts/canonical-runtime/project.config.js");
const generatedSource = fs.readFileSync(generatedConfig, "utf8");
const context = { window: {} };
vm.runInNewContext(generatedSource, context, { timeout: 1000 });
const generatedProfile = context.window.KEY_PROJECT;

test("canonical passport builder output is consumed by the primary browser runtime", async ({ page }) => {
  expect(generatedProfile.project.id).toBe("galiley-voronezh");
  expect(generatedProfile.mode).toBe("demo");
  expect(generatedProfile.integration.leadEndpoint).toBe("");
  expect(generatedProfile.analytics.enabled).toBe(false);

  await page.route("**/project.config.js", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: generatedSource
  }));
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });

  await expect(page.locator("#hero-title")).toHaveText(generatedProfile.marketing.headline);
  await expect(page.locator("#footer-project")).toContainText("Демонстрационная версия");
  await expect(page.locator("#art-caption")).toContainText("Воронеж");
  await expect(page.locator("#hero-meta")).toContainText("Воронеж");
  await expect(page).toHaveTitle("ЖК «Галилей» — KEY");
  expect(Array.from(generatedProfile.composition)).toEqual(["concept", "location"]);
  const visibleSections = await page.locator("main > section:not(.closing-section)").evaluateAll(nodes =>
    nodes.filter(node => !node.hidden).map(node => node.id)
  );
  expect(visibleSections).toEqual(["hero", "concept", "location"]);

  for (const sectionId of ["concept", "advantages", "visual-story", "lifestyle", "apartments", "location", "faq", "calculator", "selection"]) {
    const section = page.locator("#" + sectionId);
    if (generatedProfile.composition.includes(sectionId)) {
      await expect(section).toBeVisible();
    } else {
      await expect(section).toBeHidden();
    }
  }

  await page.locator(".hero [data-open-offer]").first().click();
  await expect(page.locator("#lead-dialog")).toBeVisible();
  await page.locator('#lead-form input[name="name"]').fill("Тест KEY");
  await page.locator('#lead-form input[name="phone"]').fill("+7 999 123-45-67");
  await page.locator('#lead-form input[name="consent"]').check();
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Заявка не отправлена");
  expect(pageErrors).toEqual([]);
});
