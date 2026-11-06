const { test, expect } = require("@playwright/test");
const url = "http://127.0.0.1:4173/landing/runtime/index.html";

test("universal landing renders the demo profile and responsive editorial layout", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await expect(page.locator("#hero-title")).toContainText("Выбирайте дом, который подходит вашему ритму");
  await expect(page.locator("#footer-project")).toContainText("Демонстрационная версия");
  const order = await page.locator("main > section").evaluateAll(nodes => nodes.map(node => node.id));
  expect(order.indexOf("location")).toBeLessThan(order.indexOf("apartments"));
  expect(order.at(-1)).toBe("closing");
  await expect(page.locator("#advantage-grid .empty-state")).toBeVisible();
  await expect(page.locator(".desktop-nav a:visible")).toHaveCount(4);
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
  await expect(page.locator("#dialog-context")).toContainText("Ориентировочный платёж");
});

test("selection quiz preserves answers in its own CTA context", async ({ page }) => {
  await page.goto(url);
  await page.locator('label.choice').filter({ hasText: "Для себя или семьи" }).click();
  await page.locator('label.choice').filter({ hasText: /^2$/ }).click();
  await page.locator('label.choice').filter({ hasText: "1–3 месяца" }).click();
  await expect(page.locator('input[name="goal"][value="Для себя или семьи"]')).toBeChecked();
  await expect(page.locator('input[name="timing"][value="В течение 1–3 месяцев"]')).toBeChecked();
  await expect(page.locator('input[name="rooms"][value="2"]')).toBeChecked();
  await page.locator('#selection-form button[type="submit"]').click();
  await expect(page.locator("#lead-dialog")).toBeVisible();
  await expect(page.locator("#dialog-title")).toHaveText("Получить персональную подборку");
  await expect(page.locator("#dialog-context")).toContainText("Для себя или семьи");
  await expect(page.locator("#dialog-context")).toContainText("2");
  await expect(page.locator("#dialog-context")).toContainText("В течение 1–3 месяцев");
});

const productionProfile = {
  mode: "production",
  project: { id: "demo-project", name: "Тестовый ЖК", city: "Казань", district: "" },
  marketing: { heroKicker: "ТЕСТ", headline: "Проверяемая история проекта", lead: "Текст тестового проекта." },
  design: { palette: {} },
  composition: ["concept", "advantages", "visual-story", "apartments", "location", "calculator", "selection"],
  advantages: [], media: [], plans: [], infrastructure: [],
  offers: { presentation: { title: "Получить презентацию", scenarioId: "presentation_request", description: "Тестовая презентация." } },
  integration: { leadEndpoint: "https://hooks.example/lead", privacyPolicyUrl: "https://key.example/privacy", privacyPolicyVersion: "2026-11" },
  analytics: { enabled: false }
};

test("production webhook receives the canonical KEY payload with consent and ad attribution", async ({ page }) => {
  let received;
  await page.route("**/project.demo.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "window.KEY_PROJECT = " + JSON.stringify(productionProfile) + ";"
  }));
  await page.route("https://hooks.example/**", async route => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
      return;
    }
    received = route.request().postDataJSON();
    await route.fulfill({ status: 202, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ accepted: true }) });
  });
  await page.goto(url + "?utm_source=yandex&utm_campaign=universal-test");
  await page.locator(".hero [data-open-offer='presentation']").click();
  await page.locator('#lead-form input[name="name"]').fill("Тестовый клиент");
  await page.locator('#lead-form input[name="phone"]').fill("+7 999 123-45-67");
  await page.locator('#lead-form input[name="consent"]').check();
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Запрос принят");
  expect(received).toMatchObject({
    schemaVersion: "1.0.0",
    projectId: "demo-project",
    deviceClass: "desktop",
    contact: { name: "Тестовый клиент", preferredChannel: "phone" },
    consent: { policyVersion: "2026-11", policyUrl: "https://key.example/privacy" },
    conversion: { scenarioId: "presentation_request", offerId: "presentation", moduleId: "hero" },
    attribution: {
      first_touch: { utm_source: "yandex", utm_campaign: "universal-test" },
      last_touch: { utm_source: "yandex", utm_campaign: "universal-test" }
    }
  });
  expect(received.eventId).toMatch(/^evt_[a-f0-9]{32}$/);
  expect(received.leadId).toMatch(/^lead_[a-f0-9]{32}$/);
  expect(received.pageUrl).toContain("utm_source=yandex");
  expect(received.createdAt).toBeTruthy();
});

test("a webhook rejection never becomes a false success state", async ({ page }) => {
  await page.route("**/project.demo.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "window.KEY_PROJECT = " + JSON.stringify(productionProfile) + ";"
  }));
  await page.route("https://hooks.example/**", async route => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
      return;
    }
    await route.fulfill({ status: 202, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ accepted: false }) });
  });
  await page.goto(url);
  await page.locator(".hero [data-open-offer='presentation']").click();
  await page.locator('#lead-form input[name="name"]').fill("Тест");
  await page.locator('#lead-form input[name="phone"]').fill("+7 999 123-45-67");
  await page.locator('#lead-form input[name="consent"]').check();
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Не удалось передать запрос");
  await expect(page.locator("#form-status")).not.toContainText("Запрос принят");
  await expect(page.locator("#lead-submit")).toBeVisible();
});
