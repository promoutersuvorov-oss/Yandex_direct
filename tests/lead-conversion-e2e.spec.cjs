const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const url = "http://127.0.0.1:4173/landing/runtime/index.html";
const endpoint = "http://127.0.0.1:4173/__test/lead";
const privacyUrl = "https://key.example.test/privacy";
const profileFile = path.resolve("artifacts/canonical-runtime/lead-test/project.config.js");

function loadProfile() {
  const source = fs.readFileSync(profileFile, "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { timeout: 1000 });
  return { source, profile: context.window.KEY_PROJECT };
}

function withLocalTestEndpoint() {
  const { profile } = loadProfile();
  profile.integration = {
    leadEndpoint: endpoint,
    privacyPolicyUrl: privacyUrl,
    privacyPolicyVersion: "ci-test-policy-v1"
  };
  return {
    profile,
    source: "window.KEY_PROJECT = " + JSON.stringify(profile) + ";"
  };
}

async function openPage(page, source) {
  await page.route("**/project.config.js", route => route.fulfill({
    status: 200, contentType: "application/javascript", body: source
  }));
  await page.goto(url + "?utm_source=yandex&utm_medium=cpc&utm_campaign=key_lead_e2e&utm_content=hero", {
    waitUntil: "networkidle"
  });
  await page.locator(".hero [data-open-offer]").first().click();
  await expect(page.locator("#lead-dialog")).toBeVisible();
}

async function fillContact(page) {
  await page.locator('#lead-form input[name="name"]').fill("Тест KEY");
  await page.locator('#lead-form input[name="phone"]').fill("+7 900 123-45-67");
  await page.locator('#lead-form input[name="consent"]').check();
}

test("demo profile never sends contact data to a network endpoint", async ({ page }) => {
  const { source, profile } = loadProfile();
  expect(profile.mode).toBe("demo");
  expect(profile.integration.leadEndpoint).toBe("");
  let leadRequests = 0;
  page.on("request", request => {
    if (request.url().includes("/__test/lead")) leadRequests += 1;
  });
  await openPage(page, source);
  await fillContact(page);
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Заявка не отправлена");
  expect(leadRequests).toBe(0);
});

test("approved test CTA metadata reaches a canonical payload and accepted JSON acknowledgement", async ({ page }) => {
  const { profile, source } = withLocalTestEndpoint();
  const cta = profile.ctaMap.hero;
  expect(cta).toMatchObject({
    moduleId: "hero",
    ctaId: "hero_presentation",
    offerKey: "presentation",
    funnelId: "test_funnel",
    hookId: "test_hook",
    segmentId: "test_segment"
  });
  expect(profile.offers.presentation.scenarioId).toBe("presentation_request");

  const requests = [];
  await page.route(endpoint, async route => {
    requests.push({
      payload: route.request().postDataJSON(),
      headers: await route.request().allHeaders()
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accepted: true })
    });
  });
  await openPage(page, source);
  await fillContact(page);
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Запрос принят");
  expect(requests).toHaveLength(1);

  const { payload, headers } = requests[0];
  expect(payload.schemaVersion).toBe("1.0.0");
  expect(payload.projectId).toBe("galiley-voronezh");
  expect(payload.contact).toMatchObject({ name: "Тест KEY", phone: "+7 900 123-45-67" });
  expect(payload.consent).toMatchObject({
    policyVersion: "ci-test-policy-v1",
    policyUrl: privacyUrl
  });
  expect(Number.isFinite(Date.parse(payload.consent.acceptedAt))).toBe(true);
  expect(payload.deviceClass).toBe("desktop");
  expect(payload.conversion).toMatchObject({
    scenarioId: "presentation_request",
    offerId: "presentation",
    moduleId: "hero",
    ctaId: "hero_presentation",
    hookId: "test_hook",
    funnelId: "test_funnel",
    segmentId: "test_segment"
  });
  expect(payload.attribution.first_touch).toMatchObject({
    utm_source: "yandex",
    utm_medium: "cpc",
    utm_campaign: "key_lead_e2e"
  });
  expect(payload.attribution.last_touch).toMatchObject({
    utm_source: "yandex",
    utm_medium: "cpc"
  });
  expect(payload.eventId).toMatch(/^evt_[a-f0-9]+$/);
  expect(payload.leadId).toMatch(/^lead_[a-f0-9]+$/);
  expect(headers["idempotency-key"]).toBe(payload.eventId);
  expect(payload).not.toHaveProperty("internalCommercialData");
  expect(payload).not.toHaveProperty("admin");
});

test("failed delivery preserves contact data and retries with the same idempotency key", async ({ page }) => {
  const { source } = withLocalTestEndpoint();
  const attempts = [];
  await page.route(endpoint, async route => {
    attempts.push({
      payload: route.request().postDataJSON(),
      idempotencyKey: (await route.request().allHeaders())["idempotency-key"]
    });
    if (attempts.length === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"accepted":false}' });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"accepted":true}' });
    }
  });
  await openPage(page, source);
  await fillContact(page);
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Не удалось передать запрос");
  await expect(page.locator('#lead-form input[name="name"]')).toHaveValue("Тест KEY");
  await expect(page.locator('#lead-form input[name="phone"]')).toHaveValue("+7 900 123-45-67");
  await expect(page.locator("#lead-submit")).toBeEnabled();

  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Запрос принят");
  expect(attempts).toHaveLength(2);
  expect(attempts[1].payload.eventId).toBe(attempts[0].payload.eventId);
  expect(attempts[1].payload.leadId).toBe(attempts[0].payload.leadId);
  expect(attempts[1].idempotencyKey).toBe(attempts[0].idempotencyKey);
});

test("malformed acknowledgement and request timeout never display a success state", async ({ page }) => {
  const { source } = withLocalTestEndpoint();
  await page.route(endpoint, route => route.fulfill({
    status: 200, contentType: "text/plain", body: "OK"
  }));
  await openPage(page, source);
  await fillContact(page);
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Не удалось передать запрос");
  await expect(page.locator("#lead-submit")).toBeEnabled();
  await page.close();

  const timeoutPage = await page.context().newPage();
  await timeoutPage.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) =>
      nativeSetTimeout(callback, delay === 12000 ? 10 : delay, ...args);
  });
  let routeAborted = false;
  await timeoutPage.route(endpoint, async route => {
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"accepted":true}' });
    } catch {
      routeAborted = true;
    }
  });
  await openPage(timeoutPage, source);
  await fillContact(timeoutPage);
  await timeoutPage.locator("#lead-submit").click();
  await expect(timeoutPage.locator("#form-status")).toContainText("Не удалось передать запрос");
  await expect(timeoutPage.locator("#lead-submit")).toBeEnabled();
  expect(routeAborted).toBe(true);
  await timeoutPage.close();
});

test("native consent validation and invalid phone prevent any lead request", async ({ page }) => {
  const { source } = withLocalTestEndpoint();
  let requests = 0;
  await page.route(endpoint, async route => {
    requests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"accepted":true}' });
  });
  await openPage(page, source);
  await page.locator('#lead-form input[name="name"]').fill("Тест KEY");
  await page.locator('#lead-form input[name="phone"]').fill("123");
  await page.locator("#lead-submit").click();
  await expect(page.locator('#lead-form input[name="consent"]')).not.toBeChecked();
  expect(requests).toBe(0);

  await page.locator('#lead-form input[name="consent"]').check();
  await page.locator("#lead-submit").click();
  await expect(page.locator("#form-status")).toContainText("Проверьте номер телефона");
  expect(requests).toBe(0);
});

test("duplicate submit is blocked while a lead request is in flight", async ({ page }) => {
  const { source } = withLocalTestEndpoint();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const requests = [];
  await page.route(endpoint, async route => {
    requests.push(route.request().postDataJSON());
    await gate;
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"accepted":true}' });
  });
  await openPage(page, source);
  await fillContact(page);
  const submit = page.locator("#lead-submit");
  await submit.click();
  await expect.poll(() => requests.length).toBe(1);
  await expect(submit).toBeDisabled();
  await submit.evaluate(button => button.click());
  expect(requests).toHaveLength(1);
  release();
  await expect(page.locator("#form-status")).toContainText("Запрос принят");
  expect(requests).toHaveLength(1);
});
