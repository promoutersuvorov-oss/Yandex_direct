const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const url = "http://127.0.0.1:4173/landing/runtime/index.html";
const cases = [
  {
    id: "galiley-voronezh",
    file: "artifacts/canonical-runtime/galiley/project.config.js",
    headline: "Проверьте, подходит ли вам ЖК «Галилей»",
    composition: ["concept", "location"],
    heroLayout: "fullscreen",
    paper: "#f1f3ed",
    expectedVisible: ["hero", "concept", "location"]
  },
  {
    id: "kd-905-voronezh",
    file: "artifacts/canonical-runtime/kd-905/project.config.js",
    headline: "Познакомьтесь с клубным домом «905»",
    composition: ["advantages", "location"],
    heroLayout: "split",
    paper: "#f4f2ed",
    expectedVisible: ["hero", "advantages", "location"]
  }
];

function loadProfile(file) {
  const source = fs.readFileSync(path.resolve(file), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { timeout: 1000 });
  return { source, profile: context.window.KEY_PROJECT };
}

for (const scenario of cases) {
  test(`primary runtime renders ${scenario.id} with its own composition and art direction on desktop and mobile`, async ({ page }) => {
    const { source, profile } = loadProfile(scenario.file);
    expect(profile.project.id).toBe(scenario.id);
    expect(profile.mode).toBe("demo");
    expect(profile.integration.leadEndpoint).toBe("");
    expect(profile.analytics.enabled).toBe(false);
    expect(Array.from(profile.composition)).toEqual(scenario.composition);
    expect(profile.design.heroLayout).toBe(scenario.heroLayout);

    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    await page.route("**/project.config.js", route => route.fulfill({
      status: 200, contentType: "application/javascript", body: source
    }));

    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(url, { waitUntil: "networkidle" });
      await expect(page.locator("#hero-title")).toHaveText(scenario.headline);
      await expect(page.locator("#footer-project")).toContainText("Демонстрационная версия");
      await expect(page.locator("#art-caption")).toContainText("Воронеж");
      await expect(page.locator("#hero-meta")).toContainText("Воронеж");
      await expect(page).toHaveTitle(profile.project.name + " — KEY");
      await expect(page.locator("#hero")).toHaveAttribute("data-layout", scenario.heroLayout);
      expect(await page.locator("html").evaluate(node => getComputedStyle(node).getPropertyValue("--paper").trim())).toBe(scenario.paper);

      const visibleSections = await page.locator("main > section:not(.closing-section)").evaluateAll(nodes =>
        nodes.filter(node => !node.hidden).map(node => node.id)
      );
      expect(visibleSections).toEqual(scenario.expectedVisible);
      for (const sectionId of ["concept", "advantages", "visual-story", "lifestyle", "apartments", "location", "faq", "calculator", "selection"]) {
        const section = page.locator("#" + sectionId);
        if (scenario.composition.includes(sectionId)) await expect(section).toBeVisible();
        else await expect(section).toBeHidden();
      }
      if (scenario.id === "kd-905-voronezh") {
        await expect(page.locator("#advantage-grid .empty-state")).toContainText("Непроверенные или неподкреплённые утверждения не публикуются");
        await expect(page.locator("#visual-story")).toBeHidden();
      }

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth
      }));
      expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewportWidth);

      const cta = page.locator(".hero [data-open-offer]").first();
      await expect(cta).toBeVisible();
      await cta.click();
      await expect(page.locator("#lead-dialog")).toBeVisible();
      await page.locator('#lead-form input[name="name"]').fill("Тест KEY");
      await page.locator('#lead-form input[name="phone"]').fill("+7 999 123-45-67");
      await page.locator('#lead-form input[name="consent"]').check();
      await page.locator("#lead-submit").click();
      await expect(page.locator("#form-status")).toContainText("Заявка не отправлена");
      await page.locator("#lead-dialog .icon-close").click();
    }
    expect(pageErrors).toEqual([]);
  });
}
