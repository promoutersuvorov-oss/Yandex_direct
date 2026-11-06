const { test, expect } = require("@playwright/test");

const url = "http://127.0.0.1:4173/artifacts/galiley-review/preview.html";

test("Galiley preview renders its own project identity and garden-modern composition", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({ path: "test-results/galiley-preview-desktop.png", fullPage: true });

  await expect(page.locator("body")).toHaveAttribute("data-theme", "garden-modern");
  await expect(page.locator("body")).toHaveAttribute("data-composition", "architectural");
  await expect(page.getByRole("heading", { level: 1, name: "ЖК «Галилей»" })).toBeVisible();
  await expect(page.locator("#module-hero .hero-meta")).toContainText("Воронеж");
  await expect(page.locator("#module-hero .hero-meta-item:nth-child(2) dd")).toHaveText("Ленинский район");
  await expect(page.locator("#module-hero .hero-meta")).not.toContainText("Кривошеина");
  const heroCopy = page.locator("#module-hero .module-copy.hero-editorial");
  await expect(heroCopy).toBeVisible();
  await expect(heroCopy.locator(".hero-proof li")).toHaveCount(2);
  const heroCopyColumns = await heroCopy.evaluate(node => getComputedStyle(node).gridTemplateColumns);
  expect(heroCopyColumns.trim().split(/\s+/)).toHaveLength(2);
  await expect(heroCopy.locator(".hero-proof")).toContainText("сад");
  await expect(heroCopy.locator(".hero-proof")).toContainText("баварском стиле");
  expect(await page.locator("main [data-module]").count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator("body")).toContainText("Сад внутри городского комплекса");
  // Infrastructure is grouped by type as a compact editorial list, not
  // repeated cards with identical labels.
  const schoolGroup = page.locator(".place-group").filter({ has: page.locator(".place-group-name", { hasText: "Школы" }) });
  const kindergartenGroup = page.locator(".place-group").filter({ has: page.locator(".place-group-name", { hasText: "Детские сады" }) });
  await expect(schoolGroup).toBeVisible();
  await expect(kindergartenGroup).toBeVisible();
  await expect(schoolGroup).not.toHaveAttribute("open", "");
  await expect(kindergartenGroup).not.toHaveAttribute("open", "");
  await expect(schoolGroup.locator(".place-group-count")).toContainText("5 объектов");
  await expect(kindergartenGroup.locator(".place-group-count")).toContainText("6 объектов");
  await expect(page.locator(".place-group .place-item")).toHaveCount(11);
  // The grouped infrastructure list is the single source of visible detail;
  // generic location facts would repeat the same schools and kindergartens.
  const locationSection = page.locator("#module-location");
  await expect(locationSection.locator(".facts")).toHaveCount(0);
  await expect(locationSection.locator(".place-group")).toHaveCount(2);
  await expect(page.locator(".place-card")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Клубный дом «905»");
  await expect(page.locator("body")).toContainText("не принимает заявки");
  const heroLayout = await page.locator(".module.hero.text-only").evaluate(node => ({
    columns: getComputedStyle(node).gridTemplateColumns,
    copyWidth: getComputedStyle(node.querySelector(".module-copy")).maxWidth,
    headingFont: getComputedStyle(node.querySelector("h1")).fontFamily,
    backgroundImage: getComputedStyle(node).backgroundImage,
    paddingTop: Number.parseFloat(getComputedStyle(node).paddingTop)
  }));
  expect(heroLayout.columns.trim().split(/\s+/)).toHaveLength(1);
  expect(heroLayout.copyWidth).toBe("1040px");
  expect(heroLayout.headingFont).toContain("Inter");
  expect(heroLayout.backgroundImage).toContain("repeating-linear-gradient");
  expect(heroLayout.paddingTop).toBeLessThan(120);

  // Strategy-selected text-only modules must have distinct two-column layouts
  // on desktop, not merely different data-variant labels.
  for (const moduleId of ["lifestyle", "about"]) {
    const copy = page.locator(`#module-${moduleId} .module-copy.editorial-pair`);
    await expect(copy).toBeVisible();
    const columns = await copy.evaluate(node => getComputedStyle(node).gridTemplateColumns);
    expect(columns.trim().split(/\s+/)).toHaveLength(2);
  }

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
  const mobileHeroCopy = page.locator("#module-hero .module-copy.hero-editorial");
  const mobileHeroColumns = await mobileHeroCopy.evaluate(node => getComputedStyle(node).gridTemplateColumns);
  expect(mobileHeroColumns.trim().split(/\s+/)).toHaveLength(1);
  await expect(mobileHeroCopy.locator(".hero-proof li")).toHaveCount(2);
  for (const moduleId of ["lifestyle", "about"]) {
    const copy = page.locator(`#module-${moduleId} .module-copy.editorial-pair`);
    const columns = await copy.evaluate(node => getComputedStyle(node).gridTemplateColumns);
    expect(columns.trim().split(/\s+/)).toHaveLength(1);
  }

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(Math.max(dimensions.document, dimensions.body)).toBeLessThanOrEqual(dimensions.viewport + 1);
  await page.screenshot({ path: "test-results/galiley-preview-mobile.png", fullPage: true });
});

test("cinematic composition does not reserve an empty column for a text-only hero", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("body").evaluate(node => node.dataset.composition = "cinematic");

  const hero = page.locator("#module-hero");
  await expect(hero).toHaveClass(/text-only/);
  const columns = await hero.evaluate(node => getComputedStyle(node).gridTemplateColumns);
  expect(columns.trim().split(/\s+/)).toHaveLength(1);
});
