import { test, expect } from '@playwright/test';

// Fixtures are isolated browser interceptions; nothing is seeded into the database.
const registered = { id: 'test-pharmacy', name: 'Test DAWA Pharmacy', type: 'pharmacy', registered: true, latitude: 31.513, longitude: 74.345, address: 'Test Road, Lahore', distanceKm: 0.3, source: 'DawaConnect', href: '/pharmacies/test-pharmacy' };
const external = [
  { id: 'test-hospital', name: 'Test Hospital', type: 'hospital', registered: false, latitude: 31.52, longitude: 74.35, address: 'Test Avenue, Lahore', distanceKm: 1.1, source: 'Geoapify / OpenStreetMap' },
  { id: 'test-clinic', name: 'Test Clinic', type: 'clinic', registered: false, latitude: 31.515, longitude: 74.351, address: 'Test Street, Lahore', distanceKm: 0.8, source: 'Geoapify / OpenStreetMap' },
  { id: 'test-external-pharmacy', name: 'Test External Pharmacy', type: 'pharmacy', registered: false, latitude: 31.519, longitude: 74.34, address: 'Test Lane, Lahore', distanceKm: 0.9, source: 'Geoapify / OpenStreetMap' },
];

async function fixtures(page) {
  await page.route('**/api/healthcare/nearby?**', (route) => route.fulfill({ json: { registered: [registered], external, warnings: [] } }));
  await page.route('**/api/healthcare/areas?**', (route) => route.fulfill({ json: { areas: [{ id: 'test-area', label: 'Gulberg, Lahore, Pakistan', latitude: 31.51128, longitude: 74.345 }] } }));
  await page.route('**/api/healthcare/directions?**', (route) => route.fulfill({ json: { coordinates: [[31.51128, 74.345], [31.513, 74.345]], distanceKm: 0.5, durationMinutes: 3, mode: 'drive', steps: [{ instruction: 'Continue along Test Road.', distanceMeters: 500 }] } }));
}

async function chooseArea(page) {
  await page.getByLabel('Search for a city or area', { exact: false }).fill('Gulberg Lahore');
  await page.getByRole('button', { name: 'Search area', exact: true }).click();
  await page.getByRole('button', { name: 'Gulberg, Lahore, Pakistan', exact: false }).click();
}

test('the actual vector map initializes with working renderer assets', async ({ page }) => {
  await page.goto('/pharmacies/map');
  await expect(page.locator('[data-map-ready="true"]')).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
});

test('public healthcare endpoints reject invalid inputs before calling providers', async ({ request }) => {
  for (const path of ['/api/healthcare/nearby?lat=&lng=74&radius=10', '/api/healthcare/nearby?lat=31&lng=74&radius=200', '/api/healthcare/nearby?lat=31&lng=74&radius=10&offset=-300', '/api/healthcare/areas?q=x', '/api/healthcare/directions?fromLat=31&fromLng=74&toLat=91&toLng=74']) {
    expect((await request.get(path)).status()).toBe(400);
  }
  expect((await request.get('/api/healthcare/renderer/not-allowed.mjs')).status()).toBe(404);
});

test('additional result pages append without replacing registered pharmacies', async ({ page }) => {
  await fixtures(page);
  await page.route('**/api/healthcare/nearby?**', (route) => {
    const next = new URL(route.request().url()).searchParams.get('offset') === '100';
    return route.fulfill({ json: { registered: [registered], external: next ? [external[1]] : [external[0]], truncated: !next, nextOffset: next ? null : 100, warnings: [], sources: { external: true } } });
  });
  await page.goto('/pharmacies/map');
  await chooseArea(page);
  await page.getByRole('button', { name: 'Load more healthcare' }).click();
  await expect(page.getByRole('button', { name: /Test Clinic.*View details/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Test Hospital.*View details/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Test DAWA Pharmacy.*View details/ })).toHaveCount(1);
});

test('guest can search, filter healthcare, adjust radius and start directions', async ({ page }) => {
  await fixtures(page);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/pharmacies/map');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Find care');
  await expect(page).toHaveURL(/\/pharmacies\/map$/);
  await chooseArea(page);
  await expect(page.getByRole('button', { name: /Test DAWA Pharmacy.*View details/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Test Hospital.*View details/ })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Hospitals', exact: true }).uncheck();
  await expect(page.getByRole('button', { name: /Test Hospital.*View details/ })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Clinics', exact: true }).uncheck();
  await expect(page.getByRole('button', { name: /Test Clinic.*View details/ })).toHaveCount(0);
  await page.getByLabel('Filter healthcare results by name or address').fill('restaurant');
  await expect(page.getByText('No matching healthcare', { exact: true })).toBeVisible();
  await page.getByLabel('Filter healthcare results by name or address').fill('');
  const request = page.waitForRequest((req) => req.url().includes('/nearby?') && req.url().includes('radius=20'));
  await page.getByLabel('Within', { exact: true }).selectOption('20');
  await request;
  await page.getByRole('button', { name: /Test DAWA Pharmacy.*View details/ }).click();
  await expect(page.getByRole('link', { name: 'View pharmacy & products' })).toHaveAttribute('href', registered.href);
  await page.getByRole('button', { name: 'Start directions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Clear directions' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Pharmacies', exact: true }).uncheck();
  await expect(page.getByRole('button', { name: 'Clear directions' })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('mobile list/map toggle remains usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await fixtures(page);
  await page.goto('/pharmacies/map');
  await chooseArea(page);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByRole('button', { name: /Test Clinic.*View details/ }).click();
  await expect(page.getByRole('heading', { name: 'Test Clinic', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start directions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Clear directions' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('denied geolocation never silently becomes a fake user position', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, error) => error({ code: 1 });
  });
  let nearbyRequests = 0;
  page.on('request', (request) => { if (request.url().includes('/nearby?')) nearbyRequests++; });
  await page.goto('/pharmacies/map');
  await page.getByRole('button', { name: 'Use my location', exact: true }).first().click();
  await expect(page.getByRole('alert').filter({ hasText: 'Location permission was denied' })).toBeVisible();
  expect(nearbyRequests).toBe(0);
});

test('partial-data warning and route failure are visible without invented directions', async ({ page }) => {
  await fixtures(page);
  await page.route('**/api/healthcare/nearby?**', (route) => route.fulfill({ json: { registered: [registered], external: [], warnings: ['External healthcare listings are temporarily unavailable.'] } }));
  await page.route('**/api/healthcare/directions?**', (route) => route.fulfill({ status: 404, json: { message: 'No route was found. Try another travel mode.' } }));
  await page.goto('/pharmacies/map');
  await chooseArea(page);
  await expect(page.getByText('External healthcare listings are temporarily unavailable.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Test DAWA Pharmacy.*View details/ }).click();
  await page.getByRole('button', { name: 'Start directions', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'No route was found.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear directions' })).toHaveCount(0);
});
