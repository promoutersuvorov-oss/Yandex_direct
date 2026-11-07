const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.cjs",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    browserName: process.env.KEY_BROWSER || "chromium",
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  outputDir: "test-results"
});
