const { test, expect } = require("@playwright/test");

const url = "http://127.0.0.1:4173/landing/reference/K15_landing_edited.html";

test.beforeEach(async ({ page }) => {
  // Never send test leads to the live Google Apps Script endpoint.
  // Match by parsed host/path to keep the mock reliable in WebKit as well.
  await page.route("**/*", async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.hostname === "script.google.com" &&
        requestUrl.pathname.startsWith("/macros/s/") &&
        requestUrl.pathname.endsWith("/exec")) {
      await route.fulfill({
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Content-Type": "text/plain"
        },
        body: "mock-success"
      });
      return;
    }
    await route.continue();
  });
});

test("K15 loads and has no horizontal overflow on target viewports", async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#hero")).toBeAttached();

  // Scroll in viewport-sized steps so IntersectionObserver is exercised without
  // waiting once per reveal element (which made WebKit unnecessarily slow).
  const unrevealed = await page.evaluate(async () => {
    document.documentElement.style.setProperty("scroll-behavior", "auto", "important");
    const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const step = Math.max(320, Math.floor(window.innerHeight * 0.8));
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    for (let y = 0; y <= maxY; y += step) {
      window.scrollTo(0, Math.min(y, maxY));
      await frame();
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    window.scrollTo(0, maxY);
    await frame();
    const nodes = Array.from(document.querySelectorAll(".rv"));
    return nodes.filter(node =>
      node.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }) &&
      node.getBoundingClientRect().height > 0 && !node.classList.contains("in")
    ).map(node => ({
      tag: node.tagName,
      id: node.id,
      className: String(node.className).slice(0, 100),
      top: Math.round(node.getBoundingClientRect().top + window.scrollY),
      text: (node.innerText || "").trim().replace(/\s+/g, " ").slice(0, 90)
    }));
  });
  expect(unrevealed, "Visible reveal elements must activate when scrolled into view").toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);

  const viewports = [
    { name: "mobile-360", width: 360, height: 800 },
    { name: "mobile-390", width: 390, height: 844 },
    { name: "tablet-768", width: 768, height: 1024 },
    { name: "desktop-1440", width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(75);
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    await page.screenshot({
      path: testInfo.outputPath(`k15-${viewport.name}.png`),
      fullPage: false
    });
    expect(
      Math.max(dimensions.document, dimensions.body),
      `Horizontal overflow at ${viewport.name}: ${JSON.stringify(dimensions)}`
    ).toBeLessThanOrEqual(dimensions.viewport + 1);
  }

  expect(pageErrors, "Uncaught JavaScript errors").toEqual([]);
});

test("contextual presentation CTA opens its own modal and form validates", async ({ page }) => {
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const cta = page.locator('button[data-modal="presentation"]').first();
  await cta.scrollIntoViewIfNeeded();
  await cta.click();

  const modal = page.locator("#modal");
  await expect(modal).toBeVisible();
  await expect(page.locator("#mTitle")).toContainText("Презентация");

  const form = modal.locator("form.lead-form");
  await form.locator('button[type="submit"]').click();
  await expect(form.locator(".ferr")).toContainText("Укажите имя и телефон");

  await form.locator('[name="uname"]').fill("Тестовый пользователь");
  await form.locator('[name="uphone"]').fill("79991234567");
  const consent = form.locator(".consent");
  await consent.locator(".swt").click();
  await expect(consent.locator('[name="uconsent"]')).toBeChecked();
  await form.locator('button[type="submit"]').click();

  await expect(modal.locator(".thanks")).toBeVisible();
  await expect(modal.locator(".thanks")).toContainText("Заявка принята");
});

test("three-step quiz preserves answers and submits with quiz context", async ({ page }) => {
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const quiz = page.locator("#qcard");
  for (let step = 1; step <= 3; step++) {
    const option = quiz.locator(".opt").first();
    await option.click();
    // Assert the stable outcome, not the 260ms selected-state animation.
    // WebKit may finish the click after the quiz has already advanced.
    if (step < 3) {
      await expect(quiz.locator(".qprog span")).toContainText(`${step + 1} / 3`);
    } else {
      await expect(quiz.locator("form.lead-form")).toBeVisible();
    }
  }

  const summary = quiz.locator(".chips");
  await expect(summary).toContainText("1");
  await expect(summary).toContainText("До 60 м²");
  await expect(summary).toContainText("Собственные средства");

  const form = quiz.locator("form.lead-form");
  await expect(form).toBeVisible();
  await form.locator('[name="uname"]').fill("Тестовый пользователь");
  await form.locator('[name="uphone"]').fill("79991234567");
  const consent = form.locator(".consent");
  await consent.locator(".swt").click();
  await expect(consent.locator('[name="uconsent"]')).toBeChecked();
  await form.locator('button[type="submit"]').click();

  await expect(quiz.locator(".thanks")).toBeVisible();
  await expect(quiz.locator(".thanks")).toContainText("Заявка принята");
});


test("failed lead transport never displays a success state", async ({ page }) => {
  // Replace the successful mock from beforeEach with a deliberate network failure.
  await page.unroute("**/*");
  await page.route("**/*", route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.hostname === "script.google.com" &&
        requestUrl.pathname.startsWith("/macros/s/") &&
        requestUrl.pathname.endsWith("/exec")) return route.abort("failed");
    return route.continue();
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const cta = page.locator('button[data-modal="presentation"]').first();
  await cta.scrollIntoViewIfNeeded();
  await cta.click();

  const modal = page.locator("#modal");
  const form = modal.locator("form.lead-form");
  await form.locator('[name="uname"]').fill("Тестовый пользователь");
  await form.locator('[name="uphone"]').fill("79991234567");
  await form.locator(".consent .swt").click();
  await expect(form.locator('[name="uconsent"]')).toBeChecked();
  await form.locator('button[type="submit"]').click();

  await expect(form.locator(".ferr")).toContainText("Не удалось отправить заявку");
  await expect(form.locator(".thanks")).toHaveCount(0);
  await expect(form.locator('button[type="submit"]')).toBeEnabled();
});
