import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealthcareProvider, HealthcareProviderError } from './healthcareProvider.mjs';

const center = { latitude: 31.52, longitude: 74.35 };
const destination = { latitude: 31.53, longitude: 74.36 };
const query = { ...center, radiusKm: 10 };
const fakeKey = 'offline-test-key';

function feature(id, properties = {}, coordinates = [74.35, 31.52]) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: {
      place_id: id,
      name: `Facility ${id}`,
      categories: ['healthcare.pharmacy'],
      country_code: 'pk',
      formatted: 'Test Road, Lahore, Pakistan',
      city: 'Lahore',
      ...properties,
    },
  };
}

function response(features, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => ({ type: 'FeatureCollection', features }) };
}

function fixture(fetcher) {
  return createHealthcareProvider({ apiKey: () => fakeKey, fetcher });
}

test('nearby requests healthcare-only categories with radius and nearest bias; sanitizes results', async () => {
  let requested;
  const provider = fixture(async (url, options) => {
    requested = new URL(url);
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return response([
      feature('pharmacy', { datasource: { raw: { phone: '+92 000', apiKey: fakeKey, opening_hours: '24/7' } } }),
      feature('hospital', { categories: ['healthcare.hospital'] }, [74.36, 31.53]),
      feature('clinic', { categories: ['healthcare.clinic_or_praxis.cardiology'] }),
      feature('restaurant', { categories: ['catering.restaurant'] }),
      feature('veterinary', { categories: ['pet.veterinary'] }),
      feature('abroad', { country_code: 'in' }),
      feature('too-far', {}, [73, 32]),
      feature('invalid', { lat: null, lon: 74.35 }),
      feature('numeric-string', { lat: '31.52', lon: '74.35' }),
      feature('pharmacy'),
    ]);
  });
  const result = await provider.nearby(query);
  assert.equal(requested.pathname, '/v2/places');
  assert.equal(requested.searchParams.get('categories'), 'healthcare.pharmacy,healthcare.hospital,healthcare.clinic_or_praxis');
  assert.equal(requested.searchParams.get('filter'), 'circle:74.35,31.52,10000');
  assert.equal(requested.searchParams.get('bias'), 'proximity:74.35,31.52');
  assert.equal(requested.searchParams.get('apiKey'), fakeKey);
  assert.equal(result.truncated, false);
  assert.equal(result.facilities.length, 3);
  assert.deepEqual(result.facilities.map((facility) => facility.type).sort(), ['clinic', 'hospital', 'pharmacy']);
  assert.equal(result.facilities[2].type, 'hospital');
  for (const facility of result.facilities) {
    assert.equal(facility.registered, false);
    assert.equal(facility.isOpen, null);
    assert.equal(facility.rating, undefined);
    assert.equal(facility.source, 'Geoapify / OpenStreetMap');
    assert.equal(facility.latitude > 0, true);
  }
  assert.equal(JSON.stringify(result).includes(fakeKey), false);
});

test('nearby stops after three full pages and discloses possible truncation', async () => {
  const offsets = [];
  const provider = fixture(async (url) => {
    const offset = Number(new URL(url).searchParams.get('offset'));
    offsets.push(offset);
    return response(Array.from({ length: 100 }, (_, index) => feature(String(offset + index))));
  });
  const result = await provider.nearby(query);
  assert.deepEqual(offsets, [0, 100, 200]);
  assert.equal(result.facilities.length, 300);
  assert.equal(result.truncated, true);
});

test('nearby stops on a partial page and honours the start offset', async () => {
  const offsets = [];
  const provider = fixture(async (url) => {
    const offset = Number(new URL(url).searchParams.get('offset'));
    offsets.push(offset);
    return response(Array.from({ length: offsets.length === 1 ? 100 : 1 }, (_, index) => feature(String(offset + index))));
  });
  const result = await provider.nearby({ ...query, offset: 100 });
  assert.deepEqual(offsets, [100, 200]);
  assert.equal(result.facilities.length, 101);
  assert.equal(result.truncated, false);
});

test('areas only returns Pakistani administrative areas, never businesses', async () => {
  let requested;
  const provider = fixture(async (url) => {
    requested = new URL(url);
    return response([
      feature('city', { result_type: 'city', formatted: 'Lahore, Pakistan' }),
      feature('restaurant', { result_type: 'amenity', categories: ['catering.restaurant'] }),
      feature('foreign', { result_type: 'city', country_code: 'gb' }),
      feature('missing-country', { result_type: 'city', country_code: '' }),
      feature('invalid', { result_type: 'district', lat: true, lon: 74.35 }),
      feature('city', { result_type: 'city', formatted: 'Lahore, Pakistan' }),
    ]);
  });
  const areas = await provider.areas(' Lahore ');
  assert.equal(requested.pathname, '/v1/geocode/search');
  assert.equal(requested.searchParams.get('filter'), 'countrycode:pk');
  assert.equal(requested.searchParams.get('type'), 'locality');
  assert.equal(requested.searchParams.get('text'), 'Lahore');
  assert.equal(requested.searchParams.get('limit'), '5');
  assert.deepEqual(areas, [{ id: 'geoapify:city', label: 'Lahore, Pakistan', ...center }]);
});

const route = {
  type: 'Feature',
  geometry: {
    type: 'MultiLineString',
    coordinates: [[[74.35, 31.52], [74.355, 31.525]], [[74.355, 31.525], [74.36, 31.53]]],
  },
  properties: {
    distance: 1850,
    time: 420,
    legs: [{ steps: [{ distance: 850, instruction: { text: 'Continue along Test Road.' } }] },
      { steps: [{ distance: 1000, instruction: { text: 'Turn left.' } }, { instruction: {} }] }],
  },
};

test('directions keeps metric route data and swaps GeoJSON coordinates to map latitude/longitude', async () => {
  let requested;
  const provider = fixture(async (url) => {
    requested = new URL(url);
    return response([route]);
  });
  const result = await provider.directions({ from: center, to: destination, mode: 'walk' });
  assert.equal(requested.pathname, '/v1/routing');
  assert.equal(requested.searchParams.get('waypoints'), '31.52,74.35|31.53,74.36');
  assert.equal(requested.searchParams.get('mode'), 'walk');
  assert.equal(requested.searchParams.get('units'), 'metric');
  assert.equal(requested.searchParams.get('details'), 'instruction_details');
  assert.deepEqual(result, {
    coordinates: [[31.52, 74.35], [31.525, 74.355], [31.53, 74.36]],
    distanceKm: 1.85,
    durationMinutes: 7,
    mode: 'walk',
    steps: [{ instruction: 'Continue along Test Road.', distanceMeters: 850 }, { instruction: 'Turn left.', distanceMeters: 1000 }],
  });
});

test('empty and invalid routing responses fail without inventing a straight-line route', async () => {
  for (const features of [[], [{ ...route, geometry: { type: 'MultiLineString', coordinates: [[[74.35, 31.52], [null, 31.53]]] } }],
    [{ ...route, properties: { ...route.properties, distance: -1 } }]]) {
    const provider = fixture(async () => response(features));
    await assert.rejects(provider.directions({ from: center, to: destination }), { code: 'no_route', status: 404 });
  }
});

test('missing configuration is reported before making requests', async () => {
  const provider = createHealthcareProvider({ apiKey: () => '', fetcher: () => assert.fail('must not fetch') });
  await assert.rejects(provider.nearby(query), { code: 'not_configured', status: 503 });
});

test('quota, authentication, server, and network failures have sanitized errors', async () => {
  for (const [status, code, expectedStatus] of [[429, 'quota_exceeded', 429], [401, 'key_rejected', 503],
    [403, 'key_rejected', 503], [500, 'unavailable', 503]]) {
    const provider = fixture(async () => response([], status));
    await assert.rejects(provider.nearby(query), { code, status: expectedStatus });
  }
  const provider = fixture(async (url) => { throw new Error(`fetch failed: ${url}`); });
  await assert.rejects(provider.nearby(query), (error) => {
    assert.ok(error instanceof HealthcareProviderError);
    assert.equal(error.status, 503);
    assert.equal(String(error).includes(fakeKey), false);
    assert.equal(String(error).includes('https://'), false);
    return true;
  });
});

test('malformed payloads and upstream no-route errors are explicit', async () => {
  const malformed = fixture(async () => ({ ok: true, status: 200, json: async () => ({ message: fakeKey }) }));
  await assert.rejects(malformed.areas('Lahore'), { code: 'invalid_response', status: 503 });
  const unavailableRoute = fixture(async () => response([], 400));
  await assert.rejects(unavailableRoute.directions({ from: center, to: destination }), { code: 'no_route', status: 404 });
});

test('invalid inputs are rejected without spending provider requests', async () => {
  const provider = fixture(() => assert.fail('must not fetch'));
  for (const request of [provider.nearby({ ...query, latitude: '' }), provider.nearby({ ...query, radiusKm: 51 }),
    provider.nearby({ ...query, longitude: Infinity }), provider.nearby({ ...query, offset: -1 }),
    provider.areas('x'), provider.areas('x'.repeat(121)),
    provider.directions({ from: center, to: destination, mode: 'truck' }),
    provider.directions({ from: { latitude: null, longitude: null }, to: destination })]) {
    await assert.rejects(request, { code: 'invalid_request', status: 400 });
  }
});
