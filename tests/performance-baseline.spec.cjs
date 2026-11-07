const { test, expect } = require("@playwright/test");

const url = "http://127.0.0.1:4173/landing/reference/K15_landing_edited.html";

test("K15 records browser performance baseline without flaky speed assertions", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.__keyPerformance = { lcp: null, cls: 0 };
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          window.__keyPerformance.lcp = Math.round(entry.startTime);
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__keyPerformance.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
  });

  const startedAt = Date.now();
  const response = await page.goto(url, { waitUntil: "load" });
  expect(response && response.ok(), "K15 document should load successfully").toBeTruthy();
  await expect(page.locator("#hero")).toBeAttached();
  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource").map(entry => {
      let host = "same-origin";
      let path = entry.name;
      try {
        const parsed = new URL(entry.name);
        host = parsed.origin === location.origin ? "same-origin" : parsed.hostname;
        path = parsed.pathname;
      } catch {}
      return {
        type: entry.initiatorType,
        host,
        path: path.slice(0, 140),
        durationMs: Math.round(entry.duration),
        transferBytes: entry.transferSize || 0,
        encodedBytes: entry.encodedBodySize || 0,
        decodedBytes: entry.decodedBodySize || 0
      };
    });
    const byTransfer = [...resources].sort((a, b) => b.transferBytes - a.transferBytes);
    const byDuration = [...resources].sort((a, b) => b.durationMs - a.durationMs);
    return {
      capturedAt: new Date().toISOString(),
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        bytes: new TextEncoder().encode(document.documentElement.outerHTML).length,
        htmlElements: document.getElementsByTagName("*").length,
        images: document.images.length,
        scripts: document.scripts.length,
        stylesheets: document.styleSheets.length
      },
      visualSlots: (() => {
        const slots = Array.from(document.querySelectorAll(".slot"));
        return {
          total: slots.length,
          hydrated: slots.filter(slot => Boolean(slot.querySelector(".art"))).length,
          imageAttempts: slots.filter(slot => slot.dataset.loaded === "1").length,
          realImages: slots.filter(slot => slot.classList.contains("real")).length,
          generatedPlaceholders: slots.filter(slot => Boolean(slot.querySelector(".art")) && !slot.classList.contains("real")).length
        };
      })(),
      navigation: navigation ? {
        responseStartMs: Math.round(navigation.responseStart),
        domInteractiveMs: Math.round(navigation.domInteractive),
        domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
        loadEventMs: Math.round(navigation.loadEventEnd),
        transferBytes: navigation.transferSize || 0,
        encodedBytes: navigation.encodedBodySize || 0
      } : null,
      webVitals: {
        lcpMs: window.__keyPerformance?.lcp ?? null,
        cls: Number((window.__keyPerformance?.cls ?? 0).toFixed(4))
      },
      resources: {
        count: resources.length,
        totalTransferBytes: resources.reduce((sum, item) => sum + item.transferBytes, 0),
        totalEncodedBytes: resources.reduce((sum, item) => sum + item.encodedBytes, 0),
        externalHosts: [...new Set(resources.map(item => item.host).filter(host => host !== "same-origin"))],
        largestByTransfer: byTransfer.slice(0, 10),
        slowest: byDuration.slice(0, 10)
      }
    };
  });

  metrics.wallClockToCaptureMs = Date.now() - startedAt;
  await testInfo.attach("k15-performance-baseline.json", {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: "application/json"
  });
  console.log("KEY_PERFORMANCE_BASELINE " + JSON.stringify({
    navigation: metrics.navigation,
    webVitals: metrics.webVitals,
    resourceCount: metrics.resources.count,
    totalTransferBytes: metrics.resources.totalTransferBytes,
    externalHosts: metrics.resources.externalHosts
  }));
});
