const { test, expect } = require("@playwright/test");

const url = "http://127.0.0.1:4173/landing/reference/K15_landing_edited.html";

test.beforeEach(async ({ page }) => {
  // Never send test leads to the live Google Apps Script endpoint.
  await page.route("https://script.google.com/**", async route => {
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
  });
});

test("K15 loads and has no horizontal overflow on target viewports", async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#hero")).toBeAttached();

  // Scroll each rendered reveal element into the viewport; this exercises real user-visible IO behavior
  // and avoids assuming that programmatic scroll jumps are animated identically by every engine.
  const revealNodes = page.locator(".rv");
  const revealCount = await revealNodes.count();
  const unrevealed = [];
  for (let i = 0; i < revealCount; i++) {
    const node = revealNodes.nth(i);
    const isVisible = await node.evaluate(el => el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }));
    if (!isVisible) continue;
    await node.scrollIntoViewIfNeeded();
    try {
      await expect(node).toHaveClass(/(?:^|\\s)in(?:\\s|$)/, { timeout: 1500 });
    } catch {
      unrevealed.push(await node.evaluate(el => ({
        tag: el.tagName,
        id: el.id,
        className: String(el.className).slice(0, 100),
        text: (el.innerText || "").trim().replace(/\\s+/g, " ").slice(0, 90)
      })));
    }
  }
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
    await page.waitForTimeout(250);
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    await page.screenshot({
      path: testInfo.outputPath(`k15-${viewport.name}.png`),
      fullPage: true
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
    await quiz.locator(".opt").first().click();
    if (step < 3) {
      await expect(quiz.locator(".qprog span")).toContainText(`${step + 1} / 3`);
    }
  }

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
  await page.unroute("https://script.google.com/**");
  await page.route("https://script.google.com/**", route => route.abort("failed"));
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
