const { test, expect } = require("@playwright/test");

const url = "http://127.0.0.1:4173/artifacts/k15-review/preview.html";
const expectedModules = ["hero", "security", "lifestyle", "about", "contacts"];
const expectedScenarios = [
  "k15.layouts.check",
  "k15.presentation.request",
  "k15.viewing.request"
];

test("canonical K15 preview renders its approved five-module composition", async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveAttribute("data-theme", "warm-editorial");
  await expect(page.locator("h1")).toContainText("Приватность клубного дома в центре Воронежа");
  const hero = page.locator('section[data-module="hero"]');
  const heroAside = hero.locator(".hero-aside");
  await expect(hero).toHaveClass(/hero-with-proof/);
  await expect(heroAside).toBeVisible();
  await expect(heroAside.locator(".hero-aside-list li")).toHaveCount(3);
  await expect(hero.locator(".facts")).toHaveCount(0);
  await expect(hero.locator(".intro")).toContainText("Кольцовской, 15");
  await expect(hero.locator(".intro")).not.toContainText("закрытая охраняемая территория");

  const moduleIds = await page.locator("main > section[data-module]").evaluateAll(nodes =>
    nodes.map(node => node.dataset.module)
  );
  expect(moduleIds).toEqual(expectedModules);

  // The seven evidence-backed advantages must be distributed across their relevant sections.
  await expect(page.locator("main .benefit")).toHaveCount(7);
  for (const moduleId of ["security", "lifestyle", "about"]) {
    await expect(page.locator(`section[data-module="${moduleId}"] .benefit`).first()).toBeVisible();
  }

  const viewports = [
    { name: "mobile-360", width: 360, height: 800 },
    { name: "mobile-390", width: 390, height: 844 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "desktop-1440", width: 1440, height: 900 }
  ];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    await page.screenshot({ path: testInfo.outputPath(`canonical-k15-${viewport.name}.png`), fullPage: false });
    const heroColumns = await hero.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length);
    expect(heroColumns, `Hero proof panel should sit beside copy on desktop at ${viewport.name}`)
      .toBe(viewport.width > 760 ? 2 : 1);
    await expect(heroAside).toBeVisible();
    expect(
      Math.max(dimensions.document, dimensions.body),
      `Canonical K15 horizontal overflow at ${viewport.name}: ${JSON.stringify(dimensions)}`
    ).toBeLessThanOrEqual(dimensions.viewport + 1);
  }
  expect(pageErrors, "Canonical preview JavaScript errors").toEqual([]);
});

test("canonical K15 contextual CTAs open distinct local-only scenarios", async ({ page }) => {
  const outboundPosts = [];
  page.on("request", request => {
    if (request.method() === "POST") outboundPosts.push(request.url());
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const buttons = page.locator("button[data-preview-cta]");
  await expect(buttons).toHaveCount(4);
  const seen = [];
  for (const scenario of expectedScenarios) {
    const matchingButtons = page.locator(`button[data-preview-scenario="${scenario}"]`);
    const expectedCount = scenario === "k15.layouts.check" ? 2 : 1;
    await expect(matchingButtons).toHaveCount(expectedCount);

    // Both layout CTAs share one scenario contract; exercise each visible instance.
    for (let index = 0; index < expectedCount; index += 1) {
      const button = matchingButtons.nth(index);
      await button.scrollIntoViewIfNeeded();
      await button.click();
      const dialog = page.locator("#previewNotice");
      await expect(dialog).toBeVisible();
      const payload = JSON.parse(await page.locator("#noticePayload").textContent());
      expect(payload.state).toBe("preview_only");
      expect(payload.conversion.scenarioId).toBe(scenario);
      expect(payload.delivery).toEqual({ status: "disabled_in_preview", accepted: false });
      seen.push(payload.conversion.scenarioId);
      await page.locator("#previewNotice .close").click();
    }
  }
  expect(seen).toEqual([
    "k15.layouts.check",
    "k15.layouts.check",
    "k15.presentation.request",
    "k15.viewing.request"
  ]);
  expect(outboundPosts, "Review preview must never send lead submissions").toEqual([]);
});
