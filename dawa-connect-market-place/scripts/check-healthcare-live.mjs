// Read-only smoke test; never prints credentials or writes database records.
const base = process.env.MAP_TEST_URL || 'http://localhost:3100';
for (const path of [
  '/pharmacies/map',
  '/api/healthcare/areas?q=Gulberg%20Lahore',
  '/api/healthcare/nearby?lat=31.51128&lng=74.345&radius=10',
  '/api/healthcare/directions?fromLat=31.51128&fromLng=74.345&toLat=31.5204&toLng=74.3587&mode=drive',
  '/api/healthcare/basemap',
]) {
  try {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(60000) });
    if (!response.headers.get('content-type')?.includes('application/json')) {
      console.log(JSON.stringify({ path, status: response.status, redirected: response.redirected }));
      continue;
    }
    const data = await response.json();
    console.log(JSON.stringify({ path, status: response.status, message: data.message,
      areas: data.areas?.length, areaExample: data.areas?.[0]?.label,
      registered: data.registered?.length, external: data.external?.length,
      warnings: data.warnings, truncated: data.truncated,
      routePoints: data.coordinates?.length, routeKm: data.distanceKm, steps: data.steps?.length,
      styleLayers: data.layers?.length, styleSources: data.sources ? Object.keys(data.sources) : undefined,
      credentialLeak: /apiKey=|api_key=/.test(JSON.stringify(data))
    }));
  } catch (error) { console.log(JSON.stringify({ path, error: error.name })); process.exitCode = 1; }
}
