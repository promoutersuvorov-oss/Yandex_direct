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
    await expect.poll(async () => page.evaluate(() => {
      const state = JSON.parse(sessionStorage.getItem("k15-quiz") || "{}");
      return Object.values(state.a || {}).filter(Boolean).length;
    })).toBe(step);
    // The answer is saved immediately, while advancing the quiz step is delayed.
    // Wait for the persisted step transition before interacting with the next question.
    await expect.poll(async () => page.evaluate(() => {
      const state = JSON.parse(sessionStorage.getItem("k15-quiz") || "{}");
      return state.step;
    })).toBe(step);
    if (step < 3) {
      await expect(quiz.locator(".qprog span")).toContainText(`${step + 1} / 3`);
      const nextQuestion = step === 1 ? "Какая площадь вам нужна?" : "Как планируете покупать?";
      await expect(quiz.locator(".qbody h3")).toHaveText(nextQuestion);
      // WebKit can expose the new step before its entrance animation finishes.
      // Wait for the rendered step to become stable before clicking its option.
      await page.waitForFunction(() => {
        const body = document.querySelector("#qcard .qbody");
        return !!body && body.getAnimations().every(animation => animation.playState === "finished");
      });
    }
  }

  const form = quiz.locator("form.lead-form");
  await expect(quiz.locator(".chips span")).toHaveCount(3);
  const savedAnswers = await page.evaluate(() => JSON.parse(sessionStorage.getItem("k15-quiz") || "{}").a || {});
  expect(Object.values(savedAnswers).filter(Boolean)).toHaveLength(3);
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


test("K15 navigation, gallery, apartment and location controls remain interactive", async ({ page }) => {
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // The burger is intentionally hidden above the 1100px breakpoint.
  // Exercise it on a real mobile viewport, then restore desktop for the remaining controls.
  await page.setViewportSize({ width: 390, height: 844 });
  const burger = page.locator("#burger");
  await burger.click();
  await expect(burger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#mnav")).toHaveAttribute("aria-hidden", "false");
  await page.locator('#mnav a[href="#about"]').click();
  await expect(burger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#mnav")).toHaveAttribute("aria-hidden", "true");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#planTabs button[data-p="1"]').click();
  await expect(page.locator("#planTabs button[data-p=\"1\"]")).toHaveClass(/on/);
  await expect(page.locator("#planImg")).toHaveAttribute("data-zoom", /чертёж с площадями/);
  await page.locator('#planTabs button[data-p="0"]').click();
  await expect(page.locator("#planImg")).toHaveAttribute("data-zoom", /3D-вид/);

  await page.locator("#aptNext").click();
  await expect(page.locator("#aptCnt")).toHaveText(/^2 \/ \d+$/);
  await page.locator('#aptThumbs button[data-i="0"]').click();
  await expect(page.locator("#aptCnt")).toHaveText(/^1 \/ \d+$/);

  const firstPlace = await page.locator("#iName").textContent();
  const secondPlaceTab = page.locator('#iPills button[data-i="1"]');
  // The infrastructure tabs form a horizontally scrollable strip; reveal the
  // second tab inside that strip before clicking it (especially in WebKit).
  await secondPlaceTab.evaluate(el => el.scrollIntoView({ block: "nearest", inline: "center", behavior: "instant" }));
  await expect(secondPlaceTab).toBeInViewport();
  await secondPlaceTab.click();
  await expect(page.locator('#iPills button[data-i="1"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#iName")).not.toHaveText(firstPlace);
  await page.locator("#iNext").click();
  await expect(page.locator("#iCnt")).toHaveText(/^3 \/ \d+$/);

  const firstFaq = page.locator(".faq-list details").first();
  await firstFaq.locator("summary").click();
  await expect(firstFaq).toHaveAttribute("open", "");

  await page.locator("#galTrack .card[data-zoom]").first().click();
  const lightbox = page.locator("#lb");
  await expect(lightbox).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(lightbox).not.toBeVisible();

  await page.locator("[data-about]").first().click();
  const aboutDialog = page.locator("#aboutDlg");
  await expect(aboutDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(aboutDialog).not.toBeVisible();
});
