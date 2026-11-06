const { test, expect } = require("@playwright/test");
const url = "http://127.0.0.1:4173/landing/runtime/index.html";

test("universal landing renders the demo profile and responsive editorial layout", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await expect(page.locator("#hero-title")).toContainText("Место, которое постепенно становится вашим");
  await expect(page.locator("#footer-project")).toContainText("Демонстрационная версия");
  await expect(page.locator("#advantage-grid .empty-state")).toBeVisible();
  for (const viewport of [{width:360,height:800},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}]) {
    await page.setViewportSize(viewport);
    const sizes = await page.evaluate(() => ({view:document.documentElement.clientWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
    expect(Math.max(sizes.doc,sizes.body)).toBeLessThanOrEqual(sizes.view + 1);
  }
  expect(errors).toEqual([]);
});

test("hero CTA opens a context-specific presentation form without false delivery success", async ({ page }) => {
  await page.goto(url);
  await page.locator('.hero [data-open-offer="presentation"]').click();
  const dialog = page.locator("#lead-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#dialog-title")).toHaveText("Получить презентацию");
  await expect(dialog.locator("#form-status")).toContainText("endpoint отправки не настроен");
  await dialog.locator('input[name="name"]').fill("Тест");
  await dialog.locator('input[name="phone"]').fill("+79990000000");
  await dialog.locator('input[name="consent"]').check();
  await dialog.locator('#lead-submit').click();
  await expect(dialog.locator("#form-status")).toContainText("Заявка не отправлена");
});

test("mortgage calculator computes a visitor-entered estimate and has its own next action", async ({ page }) => {
  await page.goto(url);
  const calculator = page.locator("#mortgage-calculator");
  await calculator.locator('[name="price"]').fill("8000000");
  await calculator.locator('[name="downPayment"]').fill("2000000");
  await calculator.locator('[name="rate"]').fill("12");
  await calculator.locator('[name="years"]').fill("20");
  await calculator.locator('button[type="submit"]').click();
  await expect(page.locator("#payment-result strong")).toContainText("66");
  await page.locator('#payment-result [data-open-offer="calculator"]').click();
  await expect(page.locator("#dialog-title")).toHaveText("Обсудить расчёт");
  await expect(page.locator("#dialog-context")).toContainText("estimatedMonthlyPayment");
});

test("selection quiz preserves answers in its own CTA context", async ({ page }) => {
  await page.goto(url);
  await page.locator('input[name="goal"][value="Для себя или семьи"]').check();
  await page.locator('input[name="rooms"][value="2"]').check();
  await page.locator('#selection-form button[type="submit"]').click();
  await expect(page.locator("#lead-dialog")).toBeVisible();
  await expect(page.locator("#dialog-title")).toHaveText("Получить персональную подборку");
  await expect(page.locator("#dialog-context")).toContainText("Для себя или семьи");
  await expect(page.locator("#dialog-context")).toContainText("2");
});
