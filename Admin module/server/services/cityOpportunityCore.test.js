import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCityOpportunity, geographicDistanceKm } from './cityOpportunityCore.js';

const pharmacy = { city: 'Lahore', latitude: 31.5204, longitude: 74.3587, deliveryRadius: 3 };

function cityOrder({ latitude, longitude, ownerId, area = '', status = 'Delivered' }) {
  return {
    ownerId,
    status,
    subtotal: 500,
    deliveryAddress: { city: 'Lahore', latitude, longitude, area },
    items: [{ quantity: 2 }],
  };
}

function repeatedZone(latitude, longitude, count, area) {
  return Array.from({ length: count }, (_, index) => cityOrder({
    latitude: latitude + ((index % 2) * 0.0002),
    longitude: longitude + ((index % 2) * 0.0002),
    ownerId: index % 2 ? 'pharmacy-b' : 'pharmacy-a',
    area,
  }));
}

test('distance calculation is stable for nearby coordinates', () => {
  const distance = geographicDistanceKm(pharmacy, { latitude: 31.5204, longitude: 74.3687 });
  assert.equal(distance > 0.9 && distance < 1, true);
});

test('city opportunity publishes only privacy-safe aggregated zones', () => {
  const report = buildCityOpportunity({
    pharmacy,
    minimumOrdersPerZone: 5,
    minimumPharmaciesPerZone: 2,
    orders: [
      ...repeatedZone(31.5204, 74.40, 6, 'Gulberg'),
      ...repeatedZone(31.5204, 74.43, 6, 'Model Town'),
      cityOrder({ latitude: 31.50, longitude: 74.35, ownerId: 'pharmacy-a', area: 'Hidden' }),
    ],
  });
  assert.equal(report.summary.publishedZones, 2);
  assert.equal(report.summary.hiddenZones, 1);
  assert.equal(report.zones.some((zone) => zone.label === 'Gulberg'), true);
  assert.equal('latitude' in report.zones[0], false);
  assert.equal('ownerId' in report.zones[0], false);
  assert.equal('productRevenue' in report.zones[0], false);
  assert.equal('contributingPharmacies' in report.zones[0], false);
  assert.equal(report.status, 'consider_expansion');
  assert.equal(report.selectedScenario.opportunityOrders >= 10, true);
});

test('an area label is hidden until repeated by enough orders in its aggregate zone', () => {
  const orders = repeatedZone(31.5204, 74.40, 5, 'Gulberg').map((order, index) => ({
    ...order,
    deliveryAddress: { ...order.deliveryAddress, area: index === 0 ? 'Rare Area' : '' },
  }));
  const report = buildCityOpportunity({ pharmacy, orders });
  assert.equal(report.zones.length, 1);
  assert.notEqual(report.zones[0].label, 'Rare Area');
  assert.match(report.zones[0].label, /city zone$/);
});

test('single-pharmacy and cancelled activity stays hidden', () => {
  const orders = [
    ...Array.from({ length: 8 }, () => cityOrder({ latitude: 31.52, longitude: 74.40, ownerId: 'only-one' })),
    cityOrder({ latitude: 31.52, longitude: 74.40, ownerId: 'another', status: 'Cancelled' }),
  ];
  const report = buildCityOpportunity({ pharmacy, orders });
  assert.equal(report.status, 'insufficient_data');
  assert.equal(report.zones.length, 0);
  assert.equal(report.summary.hiddenZones, 1);
});

test('missing pharmacy location returns a safe unavailable result', () => {
  const report = buildCityOpportunity({ pharmacy: { city: 'Lahore', deliveryRadius: 10 }, orders: [] });
  assert.equal(report.status, 'missing_location');
  assert.match(report.recommendation, /map coordinates/);
});

test('invalid and boolean pharmacy coordinates cannot become real map points', () => {
  for (const location of [
    { latitude: true, longitude: 74.35 },
    { latitude: '   ', longitude: 74.35 },
    { latitude: 91, longitude: 74.35 },
    { latitude: 31.52, longitude: -181 },
  ]) {
    const report = buildCityOpportunity({ pharmacy: { city: 'Lahore', deliveryRadius: 10, ...location }, orders: [] });
    assert.equal(report.status, 'missing_location');
  }
});
