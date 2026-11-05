const { test, expect } = require("@playwright/test");
const url = "http://127.0.0.1:4173/artifacts/review-bundle/reference.html";

test("editorial reference concept responds across viewport sizes without errors", async ({ page }) => {
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(url,{waitUntil:"networkidle"});
  await expect(page.locator(".hero h1")).toBeVisible();
  await expect(page.locator(".preview")).toContainText("НЕ ДЛЯ ПУБЛИКАЦИИ");
  await expect(page.locator("main .section").first()).toBeVisible();
  await expect(page.locator("main .section").first()).toHaveAttribute("data-variant", /.+/);
  for(const viewport of [{width:360,height:800},{width:390,height:844},{width:768,height:1024},{width:1440,height:900}]){
    await page.setViewportSize(viewport);
    const sizes=await page.evaluate(()=>({view:document.documentElement.clientWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
    expect(Math.max(sizes.doc,sizes.body)).toBeLessThanOrEqual(sizes.view+1);
  }
  expect(errors).toEqual([]);
  const styles=await page.locator("style").textContent();
  expect(styles).toContain(".section.variant-feature-led");
  expect(styles).toContain(".section.variant-plan-selector");
  await expect(page.locator('.section.variant-image-led .section-layout.image-first')).toHaveCount(1);
  await expect(page.locator('.section.variant-proof-led .proof-layout')).toHaveCount(1);
  await expect(page.locator('.section.variant-immersive > .section-image')).toHaveCount(1);
  expect(styles).toContain("prefers-reduced-motion");
});

test("editorial reference CTA opens honest non-submitting dialog", async ({ page }) => {
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await page.locator(".hero [data-action]").click();
  const dialog=page.locator("#actionDialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("сбор и отправка персональных данных отключены");
  await dialog.locator(".close").click();
  await expect(dialog).not.toBeVisible();
});

test("approved quiz keeps answers local and opens contextual dialog", async ({ page }) => {
  await page.goto(url,{waitUntil:"domcontentloaded"});
  const quiz=page.locator("form[data-quiz]");
  if(await quiz.count()){
    await quiz.locator('input[type="radio"]').first().check();
    await quiz.locator('button[type="submit"]').click();
    await expect(page.locator("#actionDialog")).toBeVisible();
    await expect(page.locator("#dialogContext")).toContainText("{");
  }
});
