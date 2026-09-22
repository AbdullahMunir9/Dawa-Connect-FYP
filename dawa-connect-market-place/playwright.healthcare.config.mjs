import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/healthcare', timeout: 90000, workers: 1,
  outputDir: './test-results/healthcare',
  use: {
    baseURL: process.env.MAP_TEST_URL || 'http://localhost:3100',
    headless: true, viewport: { width: 1440, height: 1000 },
    launchOptions: { channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure',
  },
});
