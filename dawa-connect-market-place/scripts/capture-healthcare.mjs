import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
const network = new Map();
page.on('request', (request) => { if (/openfreemap|worker|healthcare\/basemap/.test(request.url())) network.set(request.url(), 'pending'); });
page.on('requestfinished', (request) => { if (network.has(request.url())) network.set(request.url(), 'finished'); });
page.on('requestfailed', (request) => { if (network.has(request.url())) network.set(request.url(), request.failure()?.errorText); });
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text().replace(/apiKey=[^\s&]+/g, 'apiKey=[redacted]')); });
await mkdir('test-results/healthcare-preview', { recursive: true });
try {
  await page.goto((process.env.MAP_TEST_URL || 'http://localhost:3100') + '/pharmacies/map');
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 45000 });
  await page.getByLabel('Search for a city or area').fill('Gulberg Lahore');
  const areaResponse = page.waitForResponse((response) => response.url().includes('/api/healthcare/areas?'), { timeout: 45000 });
  await page.getByRole('button', { name: 'Search area', exact: true }).click();
  console.log('Live area status:', (await areaResponse).status());
  const areas = page.getByRole('region', { name: 'Matching search areas' });
  await areas.getByRole('button').filter({ hasText: /Gulberg/ }).first().click();
  await page.getByRole('button', { name: /View details/ }).first().waitFor({ timeout: 45000 });
  await page.locator('[data-map-ready="true"]').screenshot({ path: 'test-results/healthcare-preview/map.png' });
  await page.screenshot({ path: 'test-results/healthcare-preview/desktop.png', fullPage: true });
  await page.getByRole('button', { name: /View details/ }).first().click();
  const routeResponse = page.waitForResponse((response) => response.url().includes('/api/healthcare/directions?'), { timeout: 45000 });
  await page.getByRole('button', { name: 'Start directions', exact: true }).click();
  console.log('Live selected-facility directions status:', (await routeResponse).status());
  await page.getByRole('button', { name: 'Clear directions' }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: 'test-results/healthcare-preview/directions.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.screenshot({ path: 'test-results/healthcare-preview/mobile.png', fullPage: true });
  console.log(JSON.stringify({ pageErrors: errors, horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1) }));
} catch (error) {
  await page.screenshot({ path: 'test-results/healthcare-preview/load-error.png', fullPage: true });
  console.log(JSON.stringify({ pageErrors: errors.slice(0, 12), network: [...network], mapReady: await page.locator('[data-map-ready]').getAttribute('data-map-ready').catch(() => null), alerts: await page.getByRole('alert').allTextContents(), failure: error.message }));
  process.exitCode = 1;
} finally { await browser.close(); }
