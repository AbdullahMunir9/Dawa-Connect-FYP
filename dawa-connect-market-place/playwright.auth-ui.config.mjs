import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/auth-ui",
  timeout: 45_000,
  workers: 1,
  outputDir: "./test-results/auth-ui",
  use: {
    baseURL: process.env.AUTH_UI_TEST_URL || "http://localhost:3100",
    headless: true,
    viewport: { width: 1440, height: 720 },
    launchOptions: { channel: "msedge" },
    screenshot: "only-on-failure",
  },
});
