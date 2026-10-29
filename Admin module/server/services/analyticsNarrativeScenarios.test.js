import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMeasuredAnalytics } from './analyticsCore.js';
import { buildCityOpportunity } from './cityOpportunityCore.js';
import { buildDemandForecast } from './forecastingCore.js';
import {
  buildNarrativeInput,
  buildTemplateNarrative,
  validateNarrativeOutput,
} from './analyticsNarrativeCore.js';

const NOW = new Date('2026-10-29T08:00:00.000Z');
const MONTH = '2026-10';
const PHARMACY = {
  city: 'Lahore', latitude: 31.5204, longitude: 74.3587, deliveryRadius: 3,
};

function product(id, name, { stock = 20, threshold = 5, price = 100 } = {}) {
  return {
    _id: id,
    name,
    category: 'QA medicine',
    unit: 'tablets',
    stock,
    threshold,
    price,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function order({
  id,
  productId = 'p1',
  name = 'Test Medicine 100mg',
  quantity = 1,
  price = 100,
  createdAt = '2026-10-10T08:00:00.000Z',
  status = 'Delivered',
} = {}) {
  const subtotal = quantity * price;
  return {
    id: id || `order-${createdAt}-${quantity}`,
    status,
    createdAt: new Date(createdAt),
    subtotal,
    tax: subtotal * 0.05,
    deliveryFee: 50,
    total: subtotal * 1.05 + 50,
    paymentMethod: 'cash',
    items: [{ productId, name, quantity, price, lineTotal: subtotal }],
  };
}

function cityOrder(latitude, longitude, ownerId, area) {
  return {
    ownerId,
    status: 'Delivered',
    deliveryAddress: { city: 'Lahore', latitude, longitude, area },
    items: [{ quantity: 2 }],
  };
}

function repeatedZone(latitude, longitude, area) {
  return Array.from({ length: 6 }, (_, index) => cityOrder(
    latitude + ((index % 2) * 0.0002),
    longitude + ((index % 2) * 0.0002),
    index % 2 ? 'pharmacy-b' : 'pharmacy-a',
    area,
  ));
}

function completeAnalytics({ inventory, orders, cityOrders = [] }) {
  const analytics = buildMeasuredAnalytics({ month: MONTH, inventory, orders, now: NOW });
  analytics.forecast = buildDemandForecast({
    month: MONTH,
    inventory,
    orders,
    now: NOW,
    movementHistoryDays: 120,
  });
  analytics.cityOpportunity = buildCityOpportunity({
    pharmacy: PHARMACY,
    orders: cityOrders,
    minimumOrdersPerZone: 5,
    minimumPharmaciesPerZone: 2,
  });
  analytics.dataQuality.hasInventoryMovementHistory = true;
  analytics.dataQuality.inventoryMovementHistoryDays = 120;
  analytics.dataQuality.forecastingReady = analytics.forecast.summary.productsWithDemand > 0;
  analytics.dataQuality.narrativeReady = true;
  return analytics;
}

function assertUsableNarrative(analytics) {
  const input = buildNarrativeInput(analytics);
  const report = buildTemplateNarrative(input);
  const validated = validateNarrativeOutput(report, input);
  const knownFacts = new Set(input.facts.map((fact) => fact.key));
  const sections = [
    validated.salesInsights,
    validated.inventoryActions,
    validated.deliveryOpportunities,
    validated.risksAndLimitations,
    validated.nextMonthActionPlan,
  ];

  assert.ok(validated.executiveSummary.headline.trim());
  assert.ok(validated.executiveSummary.overview.trim());
  assert.ok(validated.executiveSummary.factKeys.every((key) => knownFacts.has(key)));
  for (const section of sections) {
    assert.ok(section.length > 0);
    for (const item of section) {
      assert.ok(item.title.trim());
      assert.ok(item.explanation.trim());
      assert.ok(item.factKeys.every((key) => knownFacts.has(key)));
    }
  }
  return { input, report: validated };
}

test('scenario matrix keeps reports valid with many delivered orders', () => {
  const inventory = [
    product('p1', 'Test Medicine 100mg', { stock: 8, threshold: 10 }),
    product('p2', 'Test Syrup', { stock: 30, threshold: 5, price: 200 }),
  ];
  const orders = Array.from({ length: 30 }, (_, index) => order({
    id: `many-${index}`,
    productId: index % 3 ? 'p1' : 'p2',
    name: index % 3 ? 'Test Medicine 100mg' : 'Test Syrup',
    quantity: (index % 4) + 1,
    price: index % 3 ? 100 : 200,
    createdAt: `2026-10-${String((index % 28) + 1).padStart(2, '0')}T08:00:00.000Z`,
  }));
  const analytics = completeAnalytics({ inventory, orders });
  const { input } = assertUsableNarrative(analytics);

  assert.equal(analytics.summary.deliveredOrders, 30);
  assert.ok(analytics.summary.unitsSold > 30);
  assert.ok(input.facts.some((fact) => fact.key === 'summary.deliveredOrders' && fact.value === 30));
});

test('scenario matrix keeps reports valid with very little data', () => {
  const inventory = [product('p1', 'Test Medicine 100mg')];
  const analytics = completeAnalytics({ inventory, orders: [order({ id: 'single-order' })] });
  const { report } = assertUsableNarrative(analytics);

  assert.equal(analytics.summary.deliveredOrders, 1);
  assert.equal(analytics.forecast.products[0].confidence, 'low');
  assert.ok(report.risksAndLimitations.length > 0);
});

test('scenario matrix keeps reports valid for a month with no orders', () => {
  const inventory = [product('p1', 'Test Medicine 100mg')];
  const analytics = completeAnalytics({ inventory, orders: [] });
  const { input, report } = assertUsableNarrative(analytics);

  assert.equal(analytics.summary.ordersPlaced, 0);
  assert.equal(analytics.forecast.summary.productsWithDemand, 0);
  assert.ok(input.facts.some((fact) => fact.key === 'summary.ordersPlaced' && fact.value === 0));
  assert.ok(report.salesInsights.length > 0);
});

test('scenario matrix keeps low-stock recommendations evidence-bound', () => {
  const inventory = [product('p1', 'Test Medicine 100mg', { stock: 1, threshold: 5 })];
  const orders = [
    order({ id: 'july', createdAt: '2026-07-10T08:00:00.000Z', quantity: 8 }),
    order({ id: 'august', createdAt: '2026-08-10T08:00:00.000Z', quantity: 12 }),
    order({ id: 'september', createdAt: '2026-09-10T08:00:00.000Z', quantity: 16 }),
    order({ id: 'october', quantity: 10 }),
  ];
  const analytics = completeAnalytics({ inventory, orders });
  const { input, report } = assertUsableNarrative(analytics);

  assert.equal(analytics.summary.lowStockProducts, 1);
  assert.equal(analytics.forecast.products[0].action, 'reorder_now');
  assert.ok(input.facts.some((fact) => fact.key.endsWith('.suggestedReorder') && fact.value > 0));
  assert.ok(report.inventoryActions.some((item) => item.factKeys.some((key) => key.endsWith('.suggestedReorder'))));
});

test('scenario matrix does not invent demand for a dormant product', () => {
  const inventory = [product('p1', 'Dormant Medicine')];
  const analytics = completeAnalytics({ inventory, orders: [] });
  const { report } = assertUsableNarrative(analytics);

  assert.equal(analytics.forecast.products[0].forecastUnits, 0);
  assert.equal(analytics.forecast.products[0].suggestedReorderQuantity, 0);
  assert.equal(analytics.forecast.products[0].action, 'no_demand_data');
  assert.doesNotMatch(JSON.stringify(report), /reorder now/i);
});

test('scenario matrix explains sufficient privacy-safe city-zone data', () => {
  const inventory = [product('p1', 'Test Medicine 100mg')];
  const cityOrders = [
    ...repeatedZone(31.5204, 74.40, 'Gulberg'),
    ...repeatedZone(31.5204, 74.43, 'Model Town'),
  ];
  const analytics = completeAnalytics({ inventory, orders: [], cityOrders });
  const { input, report } = assertUsableNarrative(analytics);

  assert.equal(analytics.cityOpportunity.status, 'consider_expansion');
  assert.equal(analytics.cityOpportunity.summary.publishedZones, 2);
  assert.ok(input.facts.some((fact) => fact.key === 'city.scenario.radiusKm'));
  assert.ok(report.deliveryOpportunities[0].factKeys.some((key) => key.startsWith('city.')));
});

test('scenario matrix withholds city-zone recommendations when privacy thresholds are unmet', () => {
  const inventory = [product('p1', 'Test Medicine 100mg')];
  const cityOrders = Array.from({ length: 8 }, () => cityOrder(31.5204, 74.40, 'only-one', 'Gulberg'));
  const analytics = completeAnalytics({ inventory, orders: [], cityOrders });
  const { input, report } = assertUsableNarrative(analytics);

  assert.equal(analytics.cityOpportunity.status, 'insufficient_data');
  assert.equal(analytics.cityOpportunity.summary.publishedZones, 0);
  assert.equal(input.facts.some((fact) => fact.key === 'city.scenario.radiusKm'), false);
  assert.ok(report.deliveryOpportunities.length > 0);
});
