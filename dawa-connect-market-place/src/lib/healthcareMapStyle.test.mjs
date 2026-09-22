import test from 'node:test';
import assert from 'node:assert/strict';
import { validMapResource, healthcareOnlyStyle, rewriteMapResources } from './healthcareMapStyle.mjs';

test('map proxy paths reject traversal, arbitrary services and hosts', () => {
  for (const path of ['v1/styles/positron/style.json', 'v1/tile/osm-bright/{z}/{x}/{y}.pbf', 'v1/font/{fontstack}/{range}.pbf']) assert.equal(validMapResource(path), true);
  for (const path of ['../.env', 'v1/tile/../secret', 'v1/styles/%2e%2e/%2e%2e/other.json', 'v1/styles/%252e%252e/other.json', 'https://evil.test', 'v2/places', 'v1/tile/test?apiKey=secret', 'v1/tile\\secret']) assert.equal(validMapResource(path), false);
});

test('style is credential-free with no built-in business markers; road labels kept', () => {
  const source = {
    version: 8, glyphs: 'https://maps.geoapify.com/v1/font/{fontstack}/{range}.pbf?apiKey=private',
    sprite: 'https://maps.geoapify.com/v1/styles/positron/sprite?apiKey=private',
    sources: { osm: { type: 'vector', url: 'https://maps.geoapify.com/v1/tilejson/osm-bright.json?apiKey=private' } },
    layers: [{ id: 'poi-level-1', 'source-layer': 'poi' }, { id: 'shop-label', 'source-layer': 'poi' }, { id: 'road-label', 'source-layer': 'transportation_name' }, { id: 'water', 'source-layer': 'water' }]
  };
  const safe = healthcareOnlyStyle(source);
  assert.equal(JSON.stringify(safe).includes('private'), false);
  assert.equal(safe.glyphs, '/api/healthcare/map/v1/font/{fontstack}/{range}.pbf');
  assert.deepEqual(safe.layers.map((layer) => layer.id), ['road-label', 'water']);
  assert.equal(source.layers.length, 4);
  assert.deepEqual(rewriteMapResources({ tiles: ['https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.pbf?apiKey=private'] }), { tiles: ['/api/healthcare/map/v1/tile/osm-bright/{z}/{x}/{y}.pbf'] });
});
