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
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "test-results/universal-landing-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/universal-landing-mobile.png", fullPage: true });
});

test("apartment plans open a readable full-size preview and retain plan context", async ({ page }) => {
  const profile = structuredClone(productionProfile);
  profile.plans = [{
    id: "plan-42", assetId: "plan-asset-42", title: "Двухкомнатная квартира",
    rooms: 2, areaSqm: 64.8, floor: 7, finishing: "Без отделки",
    assetUrl: "https://assets.example/plan-42.svg",
    sources: [{ url: "https://developer.example/plans", title: "Планировки застройщика", accessedAt: "2026-11-06T10:00:00Z" }],
    status: "verified", publicUse: "allowed", rightsStatus: "approved"
  }];
  profile.offers.plan = { title: "Обсудить планировку", scenarioId: "plan_consultation", description: "Обсудим выбранный вариант." };
  await page.route("**/project.config.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "window.KEY_PROJECT = " + JSON.stringify(profile) + ";"
  }));
  await page.route("https://assets.example/**", route => route.fulfill({
    status: 200, contentType: "image/svg+xml", body: "<svg/>"
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await expect(page.locator("#plan-grid .plan-card")).toHaveCount(1);
  await page.locator(".plan-preview-trigger").click();
  const preview = page.locator("#plan-preview-dialog");
  await expect(preview).toBeVisible();
  await expect(preview.locator("#plan-preview-title")).toHaveText("Двухкомнатная квартира");
  await expect(preview.locator("#plan-preview-meta")).toContainText("64.8 м²");
  await expect(preview.locator("#plan-preview-image")).toBeVisible();
  await preview.locator("#plan-preview-cta").click();
  await expect(preview).toBeHidden();
  await expect(page.locator("#lead-dialog")).toBeVisible();
  await expect(page.locator("#dialog-title")).toHaveText("Обсудить планировку");
  await expect(page.locator("#dialog-context")).toContainText("Двухкомнатная квартира");
  await expect(page.locator("#dialog-context")).toContainText("64.8 м²");
  for (const width of [600, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    const metrics = await page.locator(".plan-card").evaluate(node => ({
      card: node.getBoundingClientRect().width,
      image: node.querySelector(".plan-preview-trigger").getBoundingClientRect().width,
      copy: node.querySelector(".plan-card-copy").getBoundingClientRect().width,
      columns: getComputedStyle(node).gridTemplateColumns.split(" ").length
    }));
    expect(metrics.columns).toBe(1);
    expect(metrics.image).toBeGreaterThan(metrics.card - 2);
    expect(metrics.copy).toBeGreaterThan(metrics.card - 2);
    const pageWidths = await page.evaluate(() => ({ view: document.documentElement.clientWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(Math.max(pageWidths.doc, pageWidths.body)).toBeLessThanOrEqual(pageWidths.view + 1);
  }
});
test("location section never presents a decorative placeholder as a real map", async ({ page }) => {
  await page.goto(url);
  await expect(page.locator("#location")).toBeVisible();
  await expect(page.locator(".location-art")).toBeHidden();
  await expect(page.locator(".map-orbit, .map-point")).toHaveCount(0);
  const profile = structuredClone(productionProfile);
  profile.locationMap = { url: "https://assets.example/location-map.webp", alt: "Карта расположения проекта", status: "approved", rightsStatus: "approved" };
  await page.route("**/project.config.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "window.KEY_PROJECT = " + JSON.stringify(profile) + ";"
  }));
  await page.goto(url);
  await expect(page.locator("#location")).toHaveClass(/has-map/);
  await expect(page.locator("#location-map")).toBeVisible();
  await expect(page.locator("#location-map")).toHaveAttribute("alt", "Карта расположения проекта");
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

test("advantages show the feature, buyer benefit and real source separately", async ({ page }) => {
  const profile = structuredClone(productionProfile);
  profile.advantages = [
    {
      id: "verified-advantage", title: "Закрытая территория",
      benefit: "Больше приватности в повседневной жизни.",
      strength: "core", status: "verified",
      evidence: [
        { claim: "Закрытая территория предусмотрена проектом", sourceTitle: "Официальная страница проекта" },
        { claim: "Параметр подтверждён", sourceTitle: "Проектная документация" }
      ],
      hook: "Рекламная формулировка не должна выдаваться за доказательство."
    },
    {
      id: "unverified-advantage", title: "Неподтверждённое обещание",
      benefit: "Не должно отображаться.",
      strength: "strong", status: "provisional",
      evidence: [{ claim: "Гипотеза", sourceTitle: "Черновой источник" }]
    },
    {
      id: "missing-evidence", title: "Без источника",
      benefit: "Тоже не должно отображаться.",
      strength: "strong", status: "verified", evidence: []
    }
  ];
  await page.route("**/project.config.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "window.KEY_PROJECT = " + JSON.stringify(profile) + ";"
  }));
  await page.goto(url);
  const cards = page.locator("#advantage-grid .advantage-card");
  await expect(cards).toHaveCount(1);
  await expect(cards.first().locator("h3")).toHaveText("Закрытая территория");
  await expect(cards.first().locator("p")).toHaveText("Больше приватности в повседневной жизни.");
  await expect(cards.first().locator(".advantage-evidence-label")).toHaveText("Фактическое основание");
  await expect(cards.first().locator(".advantage-evidence-value")).toContainText("Закрытая территория предусмотрена проектом — Официальная страница проекта");
  await expect(cards.first()).not.toContainText("Рекламная формулировка не должна выдаваться за доказательство.");
  await expect(page.locator("#advantages")).toBeVisible();
  for (const width of [600, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    const metrics = await cards.first().evaluate(node => ({
      width: node.getBoundingClientRect().width,
      gridColumns: getComputedStyle(node.parentElement).gridTemplateColumns.split(" ").length,
      evidenceWidth: node.querySelector(".advantage-evidence").getBoundingClientRect().width
    }));
    expect(metrics.gridColumns).toBe(1);
    expect(metrics.evidenceWidth).toBeGreaterThan(0);
    const pageWidths = await page.evaluate(() => ({
      view: document.documentElement.clientWidth,
      doc: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    expect(Math.max(pageWidths.doc, pageWidths.body)).toBeLessThanOrEqual(pageWidths.view + 1);
  }
});

test("approved passport quiz replaces the demo questions and submits project-specific answers", async ({ page }) => {
  const profile = structuredClone(productionProfile);
  profile.offers.quiz = { title: "Подобрать квартиру", scenarioId: "passport_selection", description: "Ответьте на вопросы." };
  profile.selectionQuiz = {
    title: "Подбор под ваш сценарий",
    description: "Два коротких вопроса.",
    resultOfferId: "selection",
    questions: [
      { id: "purpose", label: "Для чего выбираете квартиру?", options: [{ id: "family", label: "Для семьи" }, { id: "invest", label: "Для инвестиций" }] },
      { id: "budget", label: "Какой бюджет рассматриваете?", options: [{ id: "low", label: "До 10 млн" }, { id: "high", label: "Более 10 млн" }] }
    ]
  };
  await page.route("**/project.config.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "window.KEY_PROJECT = " + JSON.stringify(profile) + ";"
  }));
  await page.goto(url);
  await expect(page.locator("#selection-title")).toHaveText("Подбор под ваш сценарий");
  await expect(page.locator("#selection-form fieldset")).toHaveCount(2);
  await page.locator('label.choice').filter({ hasText: "Для семьи" }).click();
  await page.locator('label.choice').filter({ hasText: "Более 10 млн" }).click();
  await page.locator('#selection-form button[type="submit"]').click();
  await expect(page.locator("#lead-dialog")).toBeVisible();
  await expect(page.locator("#dialog-title")).toHaveText("Подобрать квартиру");
  await expect(page.locator("#dialog-context")).toContainText("family");
  await expect(page.locator("#dialog-context")).toContainText("high");
});

test("production webhook receives the canonical KEY payload with consent and ad attribution", async ({ page }) => {
  let received;
  let idempotencyKey;
  await page.route("**/project.config.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "window.KEY_PROJECT = " + JSON.stringify(productionProfile) + ";"
  }));
  await page.route("https://hooks.example/**", async route => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key" } });
      return;
    }
    received = route.request().postDataJSON();
    idempotencyKey = route.request().headers()["idempotency-key"];
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
  expect(idempotencyKey).toBe(received.eventId);
  expect(received.pageUrl).toContain("utm_source=yandex");
  expect(received.createdAt).toBeTruthy();
});

test("a webhook rejection never becomes a false success state", async ({ page }) => {
  await page.route("**/project.config.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "window.KEY_PROJECT = " + JSON.stringify(productionProfile) + ";"
  }));
  await page.route("https://hooks.example/**", async route => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key" } });
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

test("lead payload keeps the passport offer ID instead of the runtime CTA alias", async ({ page }) => {
  let received;
  const profile = structuredClone(productionProfile);
  profile.offers.presentation.offerId = "passport-presentation-v3";
  await page.route("**/project.config.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "window.KEY_PROJECT = " + JSON.stringify(profile) + ";"
  }));
  await page.route("https://hooks.example/**", async route => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key" } });
      return;
    }
    received = route.request().postDataJSON();
    await route.fulfill({ status: 202, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ accepted: true }) });
  });
  await page.goto(url);
  await page.locator(".hero [data-open-offer='presentation']").click();
  await page.locator('#lead-form input[name="name"]').fill("Тест");
  await page.locator('#lead-form input[name="phone"]').fill("+7 999 123-45-67");
  await page.locator('#lead-form input[name="consent"]').check();
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Запрос принят");
  expect(received.conversion).toMatchObject({
    scenarioId: "presentation_request",
    offerId: "passport-presentation-v3",
    moduleId: "hero"
  });
});

test("approved marketing strategy controls the hero CTA and persists IDs to the lead", async ({ page }) => {
  let received;
  const profile = structuredClone(productionProfile);
  profile.marketingStrategy = {
    primaryHook: { message: "Закрытая территория" }
  };
  profile.ctaMap = {
    hero: {
      ctaId: "hero_presentation",
      label: "Получить презентацию",
      intent: "get_information",
      offerKey: "presentation",
      offerId: "presentation",
      scenarioId: "presentation_request",
      funnelId: "location_to_presentation",
      hookId: "walkable_daily_needs",
      segmentId: "young_professionals"
    }
  };
  await page.route("**/project.config.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "window.KEY_PROJECT = " + JSON.stringify(profile) + ";"
  }));
  await page.route("https://hooks.example/**", async route => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key" } });
      return;
    }
    received = route.request().postDataJSON();
    await route.fulfill({ status: 202, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ accepted: true }) });
  });
  await page.goto(url);
  await expect(page.locator("#hero-meta")).toContainText("Закрытая территория");
  await expect(page.locator(".hero [data-open-offer='presentation']")).toHaveText("Получить презентацию ↗");
  await page.locator(".hero [data-open-offer='presentation']").click();
  await page.locator('#lead-form input[name="name"]').fill("Тест стратегии");
  await page.locator('#lead-form input[name="phone"]').fill("+7 999 123-45-67");
  await page.locator('#lead-form input[name="consent"]').check();
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Запрос принят");
  expect(received.conversion).toMatchObject({
    scenarioId: "presentation_request",
    offerId: "presentation",
    moduleId: "hero",
    ctaId: "hero_presentation",
    hookId: "walkable_daily_needs",
    funnelId: "location_to_presentation",
    segmentId: "young_professionals"
  });
});


test("a retry reuses the same lead IDs and idempotency key after a transport failure", async ({ page }) => {
  const deliveries = [];
  await page.route("**/project.config.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "window.KEY_PROJECT = " + JSON.stringify(productionProfile) + ";"
  }));
  await page.route("https://hooks.example/**", async route => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key" } });
      return;
    }
    deliveries.push({
      payload: route.request().postDataJSON(),
      key: route.request().headers()["idempotency-key"]
    });
    if (deliveries.length === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ accepted: false }) });
    } else {
      await route.fulfill({ status: 202, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ accepted: true }) });
    }
  });
  await page.goto(url);
  await page.locator(".hero [data-open-offer='presentation']").click();
  await page.locator('#lead-form input[name="name"]').fill("Повторная отправка");
  await page.locator('#lead-form input[name="phone"]').fill("+7 999 123-45-67");
  await page.locator('#lead-form input[name="consent"]').check();
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Не удалось передать запрос");
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Запрос принят");
  expect(deliveries).toHaveLength(2);
  expect(deliveries[1].payload.eventId).toBe(deliveries[0].payload.eventId);
  expect(deliveries[1].payload.leadId).toBe(deliveries[0].payload.leadId);
  expect(deliveries[0].key).toBe(deliveries[0].payload.eventId);
  expect(deliveries[1].key).toBe(deliveries[0].payload.eventId);
});

test("a successful HTTP status without a structured acceptance acknowledgement is not success", async ({ page }) => {
  await page.route("**/project.config.js", route => route.fulfill({
    contentType: "application/javascript",
    body: "window.KEY_PROJECT = " + JSON.stringify(productionProfile) + ";"
  }));
  await page.route("https://hooks.example/**", async route => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key" } });
      return;
    }
    await route.fulfill({ status: 202, contentType: "text/plain", headers: { "Access-Control-Allow-Origin": "*" }, body: "accepted" });
  });
  await page.goto(url);
  await page.locator(".hero [data-open-offer='presentation']").click();
  await page.locator('#lead-form input[name="name"]').fill("Тест подтверждения");
  await page.locator('#lead-form input[name="phone"]').fill("+7 999 123-45-67");
  await page.locator('#lead-form input[name="consent"]').check();
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Не удалось передать запрос");
  await expect(page.locator("#form-status")).not.toContainText("Запрос принят");
});


test("all hero compositions preserve the CTA and collapse safely on mobile", async ({ page }) => {
  for (const layout of ["split", "editorial", "fullscreen"]) {
    const profile = structuredClone(productionProfile);
    profile.design = { palette: {}, heroLayout: layout };
    await page.route("**/project.config.js", route => route.fulfill({
      contentType: "application/javascript",
      body: "window.KEY_PROJECT = " + JSON.stringify(profile) + ";"
    }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    const hero = page.locator("#hero");
    await expect(hero).toHaveAttribute("data-layout", layout);
    await expect(page.locator('.hero [data-open-offer="presentation"]')).toBeVisible();
    await expect(page.locator(".hero-art")).toBeVisible();
    const desktopColumns = await hero.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length);
    expect(desktopColumns).toBe(layout === "fullscreen" ? 1 : 2);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => ({
      view: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      columns: getComputedStyle(document.querySelector("#hero")).gridTemplateColumns.split(" ").length
    }));
    expect(Math.max(mobile.document, mobile.body)).toBeLessThanOrEqual(mobile.view + 1);
    expect(mobile.columns).toBe(1);
    await expect(page.locator('.hero [data-open-offer="presentation"]')).toBeVisible();
  }
});


test("all gallery compositions preserve their layout and contain horizontal scrolling on mobile", async ({ page }) => {
  for (const layout of ["mosaic", "editorial", "strip"]) {
    const profile = structuredClone(productionProfile);
    profile.design = { palette: {}, heroLayout: "split", galleryLayout: layout };
    profile.media = [1,2,3,4,5].map(index => ({
      id: "gallery-" + index,
      url: "https://assets.example/gallery-" + index + ".jpg",
      alt: "Тестовое изображение " + index,
      caption: "Кадр " + index,
      type: "render",
      status: "approved",
      rightsStatus: "approved"
    }));
    await page.route("**/project.config.js", route => route.fulfill({
      contentType: "application/javascript",
      body: "window.KEY_PROJECT = " + JSON.stringify(profile) + ";"
    }));
    await page.route("https://assets.example/**", route => route.fulfill({
      status: 200, contentType: "image/svg+xml",
      body: "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='480'><rect width='640' height='480' fill='#aab4a6'/></svg>"
    }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    const grid = page.locator("#visual-grid");
    await expect(grid).toHaveAttribute("data-layout", layout);
    await expect(grid.locator(".media-tile")).toHaveCount(5);
    const desktop = await grid.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(" ").length);
    expect(desktop).toBe(layout === "strip" ? 5 : layout === "editorial" ? 2 : 3);
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => ({
      view: document.documentElement.clientWidth,
      doc: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      grid: document.querySelector("#visual-grid"),
      gridClient: document.querySelector("#visual-grid").clientWidth,
      gridScroll: document.querySelector("#visual-grid").scrollWidth
    }));
    expect(Math.max(mobile.doc, mobile.body)).toBeLessThanOrEqual(mobile.view + 1);
    if (layout === "strip") expect(mobile.gridScroll).toBeGreaterThan(mobile.gridClient);
    await expect(grid.locator(".media-tile img")).toHaveCount(5);
  }
});
