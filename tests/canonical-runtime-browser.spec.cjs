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
    heroLayout: "editorial",
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

test("production lead handoff sends consented contact and CTA context and accepts acknowledgement", async ({ page }) => {
  const { profile } = loadProfile("artifacts/canonical-runtime/kd-905/project.config.js");
  profile.mode = "production";
  profile.integration = {
    leadEndpoint: "https://leads.key.test/submit",
    privacyPolicyUrl: "https://key.test/privacy",
    privacyPolicyVersion: "2026-11-07"
  };
  const source = "window.KEY_PROJECT = " + JSON.stringify(profile) + ";";
  let receivedPayload = null;
  let receivedIdempotencyKey = "";
  await page.route("**/project.config.js", route => route.fulfill({
    status: 200, contentType: "application/javascript", body: source
  }));
  await page.route("https://leads.key.test/submit", async route => {
    receivedPayload = route.request().postDataJSON();
    receivedIdempotencyKey = route.request().headers()["idempotency-key"] || "";
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ accepted: true })
    });
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator('.hero [data-open-offer="presentation"]').first().click();
  await expect(page.locator("#lead-dialog")).toBeVisible();
  await page.locator('#lead-form input[name="name"]').fill("Тестовый покупатель");
  await page.locator('#lead-form input[name="phone"]').fill("+7 999 123-45-67");
  await page.locator('#lead-form input[name="consent"]').check();
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Запрос принят");
  expect(receivedPayload).toBeTruthy();
  expect(receivedPayload.projectId).toBe(profile.project.id);
  expect(receivedPayload.contact).toMatchObject({
    name: "Тестовый покупатель",
    phone: "+7 999 123-45-67"
  });
  expect(receivedPayload.consent).toMatchObject({
    accepted: true,
    policyUrl: "https://key.test/privacy",
    policyVersion: "2026-11-07"
  });
  expect(receivedPayload.conversion).toMatchObject({
    offerId: "presentation",
    scenarioId: "presentation_request",
    moduleId: "hero"
  });
  expect(receivedPayload.eventId).toBe(receivedIdempotencyKey);
  expect(receivedPayload.leadId).toMatch(/^lead_/);
});

for (const scenario of cases) {
  test(`primary runtime renders ${scenario.id} with its own composition and art direction on desktop and mobile`, async ({ page }) => {
    const { source, profile } = loadProfile(scenario.file);
    expect(profile.project.id).toBe(scenario.id);
    expect(profile.mode).toBe("demo");
    expect(profile.integration.leadEndpoint).toBe("");
    expect(profile.analytics.enabled).toBe(false);
    expect(Array.from(profile.composition)).toEqual(scenario.composition);
    expect(profile.design.heroLayout).toBe(scenario.heroLayout);
    if (scenario.id === "galiley-voronezh") expect(profile.heroMedia).toBeNull();

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
      if (scenario.id === "galiley-voronezh") {
        await expect(page.locator("#hero .hero-fallback")).toBeVisible();
        await expect(page.locator("#hero .hero-fallback-title")).toBeVisible();
        await expect(page.locator("#hero .hero-fallback-title")).toHaveCSS("overflow-wrap", "normal");
        await expect(page.locator("#hero .hero-fallback-title")).toHaveCSS("word-break", "normal");
      }
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
        await expect(page.locator("#advantage-grid .advantage-card")).toHaveCount(1);
        await expect(page.locator("#advantage-grid .advantage-card")).toContainText("Подземный паркинг");
        await expect(page.locator("#advantage-grid .advantage-evidence")).toContainText("наличие свободных мест");
        const advantageCard = await page.locator("#advantage-grid .advantage-card").boundingBox();
        expect(advantageCard?.width || 0).toBeGreaterThan(viewport.width > 720 ? 500 : 200);
        await expect(page.locator("#location-list")).toContainText("Детский сад № 108");
        await expect(page.locator("#location-list")).toContainText("Парк «Орлёнок»");
        await expect(page.locator(".location-evidence-note")).toContainText("Официальная страница Клубного дома «905»");
        await expect(page.locator("#location-list .place-qualification").first()).toContainText("Расстояние и маршрут не подтверждены");
        await expect(page.locator("#location-list .place-distance")).toHaveCount(0);
        await expect(page.locator("#visual-story")).toBeHidden();
      }
      if (scenario.heroLayout === "fullscreen") {
        await expect(page.locator("#hero .hero-fallback-title")).toBeHidden();
        await expect(page.locator("#hero .hero-fallback-index")).toBeHidden();
      }

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth
      }));
      expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewportWidth);

      const visualMetrics = await page.evaluate(() => {
        const hero = document.querySelector("#hero");
        const title = document.querySelector("#hero-title");
        const lead = document.querySelector("#hero-lead");
        const cta = document.querySelector("#hero [data-open-offer]");
        const rect = node => {
          const box = node.getBoundingClientRect();
          return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
        };
        return {
          hero: rect(hero),
          title: { ...rect(title), fontSize: getComputedStyle(title).fontSize, lineHeight: getComputedStyle(title).lineHeight },
          lead: { ...rect(lead), fontSize: getComputedStyle(lead).fontSize, lineHeight: getComputedStyle(lead).lineHeight },
          cta: rect(cta),
          paper: getComputedStyle(document.documentElement).getPropertyValue("--paper").trim()
        };
      });
      expect(visualMetrics.hero.height).toBeGreaterThan(0);
      expect(visualMetrics.title.height).toBeGreaterThan(visualMetrics.lead.height / 2);
      expect(visualMetrics.cta.width).toBeGreaterThan(0);
      if (process.env.KEY_BROWSER === "chromium") {
        const slug = scenario.id + "-" + viewport.width + "x" + viewport.height;
        const outputDir = path.resolve("artifacts/visual-review");
        fs.mkdirSync(outputDir, { recursive: true });
        await page.screenshot({
          path: path.join(outputDir, slug + ".png"),
          fullPage: true,
          animations: "disabled"
        });
        fs.writeFileSync(path.join(outputDir, slug + ".json"), JSON.stringify({
          projectId: profile.project.id,
          projectName: profile.project.name,
          viewport,
          expectedComposition: scenario.expectedVisible,
          heroLayout: scenario.heroLayout,
          visualMetrics,
          note: "Automated visual-review evidence only; not a human design approval."
        }, null, 2));
      }

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
