# KEY Performance Engine — v1

## Purpose

Keep every generated landing fast on real devices while keeping the engineering feedback loop short. Performance is a product quality signal, not a cosmetic score.

## Measurement contract

The browser smoke suite records a diagnostic baseline for the canonical K15 landing:

- navigation timing: response start, DOM interactive, DOMContentLoaded and load event;
- LCP and CLS where the browser exposes the corresponding PerformanceObserver entries;
- document size, DOM element count, image/script/stylesheet counts;
- resource count, transfer/encoded bytes, external hosts, largest resources and slowest resources.

The report is attached to the Playwright test result as `k15-performance-baseline.json`. Chromium, Firefox and WebKit are measured independently. These are lab diagnostics, not field Core Web Vitals and not a claim about every visitor's device/network.

## Guardrails

- The first measurement release is diagnostic-only. It must not fail CI on noisy absolute timing values.
- Do not remove browser engines or reduce functional assertions to make CI faster.
- Do not lazy-load the actual LCP/hero image. Keep a responsive preload and verify that the selected source matches the viewport.
- Lazy-load below-the-fold images and defer non-critical third-party scripts where doing so does not break consent, attribution or lead delivery.
- Preserve image dimensions/aspect ratios to prevent layout shifts.
- Keep font loading deliberate; avoid blocking first render on non-essential font weights.
- Do not inline large media into HTML. Prefer optimized, cacheable image assets with responsive variants.
- Performance budgets must be introduced only after a reproducible baseline exists and must be based on measured production-like builds, not synthetic fixtures alone.

## Initial diagnostic findings (2026-11-07)

The first CI capture recorded a K15 HTML document transfer of approximately 190 KB. The lab browser readings differed materially: Firefox reported LCP around 210 ms, while Chromium and WebKit did not expose an LCP entry in this capture. CLS was low in this run (0–0.013).

**Important limitation:** the repository currently contains only `K15_landing_edited.html` under `landing/reference/`; the referenced local `images/` directory is not present in this branch. The page therefore falls back to generated SVG placeholder artwork. These measurements are useful for document and browser diagnostics, but they are not a valid image-heavy production baseline. The report now records visual-slot counts, attempted media loads, real images and generated placeholders so this limitation remains visible.

A previous successful CI run measured these job durations:

| Job | Total | Browser installation | Browser tests |
|---|---:|---:|---:|
| Chromium | 58 s | 25 s | 22 s |
| Firefox | 42 s | 12 s | 22 s |
| WebKit | 133 s | 64 s | 50 s |

The clearest CI bottleneck is browser installation, especially WebKit, followed by its longer test execution. Source integrity itself took about 20 seconds. The workflow now caches Playwright browser binaries per engine and runs independent spec files with two workers. The next successful run will show whether those changes help; no improvement is claimed until measured.

## Optimization sequence

1. Capture and compare the baseline across browser engines.
2. Identify the largest transfer contributors, slowest resources and blocking work.
3. Optimize the measured bottleneck, one category at a time.
4. Re-run functional browser tests and the performance report.
5. Add stable budgets for resource weight/count and Core Web Vitals only after validating measurement variance.
6. Add field measurements after a production analytics endpoint and privacy-safe consent model are configured.

## CI efficiency

CI duration is tracked separately from page performance. Candidate improvements include dependency/browser caching, sharing prepared test artifacts across the browser matrix, and controlled Playwright worker parallelism. Any change must preserve all existing browser coverage and assertions. Compare wall-clock job duration before and after each change.

## Business outcome

The goal is not a Lighthouse score by itself. Faster first meaningful content, stable layout and responsive interactions should reduce friction from ad click to relevant action. Final evaluation must connect performance changes to qualified lead rate and cost per qualified lead when sufficient field data is available.
