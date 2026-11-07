const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const url = "http://127.0.0.1:4173/landing/runtime/index.html";
const profilePath = "artifacts/canonical-runtime/brief-intent/project.config.js";

test("approved LANDING BRIEF maps contextual CTAs into PII-free runtime intent events", async ({ page }) => {
  const source = fs.readFileSync(path.resolve(profilePath), "utf8");
  const context = { window: {} };
  require("node:vm").runInNewContext(source, context, { timeout: 1000 });
  const profile = context.window.KEY_PROJECT;

  expect(profile.project.id).toBe("galiley-voronezh");
  expect(profile.mode).toBe("demo");
  expect(profile.integration.leadEndpoint).toBe("");
  expect(profile.analytics.enabled).toBe(false);
  expect(profile.ctaMap.hero.ctaId).toBe("test_hero_presentation");
  expect(profile.ctaMap.closing.ctaId).toBe("test_closing_presentation");

  const postRequests = [];
  page.on("request", request => {
    if (request.method() === "POST") postRequests.push(request.url());
  });
  await page.addInitScript(() => {
    window.__keyIntentEvents = [];
    window.addEventListener("key:conversion-intent", event => window.__keyIntentEvents.push(event.detail));
  });
  await page.route("**/project.config.js", route => route.fulfill({
    status: 200, contentType: "application/javascript", body: source
  }));

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto(url, { waitUntil: "networkidle" });
    const hero = page.locator("#hero [data-open-offer]");
    const closing = page.locator("#closing [data-open-offer]");
    await expect(hero).toHaveText("TEST: получить презентацию ↗");
    await expect(closing).toHaveText("TEST: обсудить проект ↗");

    await hero.click();
    await expect(page.locator("#lead-dialog")).toBeVisible();
    const heroEvent = await page.evaluate(() => window.__keyIntentEvents.at(-1));
    expect(heroEvent).toEqual({
      projectId: "galiley-voronezh",
      ctaId: "test_hero_presentation",
      intent: "get_information",
      offerId: "presentation",
      scenarioId: "galiley.presentation",
      moduleId: "hero",
      funnelId: "test_presentation_funnel",
      hookId: "walkable_daily_needs",
      segmentId: "young_professionals",
      qualificationQuestionIds: []
    });
    expect(JSON.stringify(heroEvent)).not.toMatch(/Тест KEY|Анна|999/);

    await page.locator('#lead-form input[name="name"]').fill("Тест KEY");
    await page.locator('#lead-form input[name="phone"]').fill("+7 999 123-45-67");
    await page.locator('#lead-form input[name="consent"]').check();
    await page.locator("#lead-submit").click();
    await expect(page.locator("#form-status")).toContainText("Демонстрационный режим не передаёт персональные данные");
    expect(postRequests).toEqual([]);
    await page.locator("#lead-dialog .icon-close").click();

    await closing.click();
    const closingEvent = await page.evaluate(() => window.__keyIntentEvents.at(-1));
    expect(closingEvent.ctaId).toBe("test_closing_presentation");
    expect(closingEvent.moduleId).toBe("closing");
    expect(closingEvent.intent).toBe("get_information");
    expect(closingEvent.funnelId).toBe("test_presentation_funnel");
    expect(JSON.stringify(closingEvent)).not.toMatch(/Тест KEY|Анна|999/);
    await expect(page.locator("#lead-dialog")).toBeVisible();
    await page.locator("#lead-dialog .icon-close").click();
  }
  expect(postRequests).toEqual([]);
});
