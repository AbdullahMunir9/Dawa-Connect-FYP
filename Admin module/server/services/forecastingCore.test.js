import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDemandForecast } from './forecastingCore.js';

const inventory = [{
  _id: 'p1', name: 'Panadol 500mg', category: 'Pain relief', unit: 'tablets',
  price: 100, stock: 3, createdAt: new Date('2026-07-01T00:00:00.000Z'),
}];

function order(month, quantity, status = 'Delivered') {
  return {
    status,
    createdAt: new Date(`${month}-15T08:00:00.000Z`),
    items: [{ productId: 'p1', name: 'Panadol 500mg', quantity, price: 100 }],
  };
}

test('forecast uses recent weighted demand and produces a weekly reorder target', () => {
  const report = buildDemandForecast({
    month: '2026-09',
    now: new Date('2026-10-24T08:00:00.000Z'),
    inventory,
    movementHistoryDays: 100,
    orders: [order('2026-07', 10), order('2026-08', 20), order('2026-09', 30)],
  });
  const product = report.products[0];
  assert.equal(product.forecastUnits, 23); // 10×0.2 + 20×0.3 + 30×0.5
  assert.equal(product.expectedWeeklyDemand, 6);
  assert.equal(product.recommendedWeeklyTarget >= product.expectedWeeklyDemand, true);
  assert.equal(product.suggestedReorderQuantity, product.recommendedWeeklyTarget - 3);
  assert.equal(product.action, 'reorder_now');
  assert.equal(report.summary.estimatedProductRevenue, 2300);
  assert.equal(report.assumption, 'weekly_replenishment');
});

test('cancelled orders do not influence forecasts', () => {
  const report = buildDemandForecast({
    month: '2026-09', inventory,
    now: new Date('2026-10-24T08:00:00.000Z'),
    orders: [order('2026-09', 10), order('2026-09', 900, 'Cancelled')],
  });
  assert.equal(report.products[0].forecastUnits, 5); // Jul/Aug zeros plus Sep 10 with the three-month weights.
  assert.equal(report.products[0].historicalUnits, 10);
});

test('current partial month is normalized and low data remains low confidence', () => {
  const report = buildDemandForecast({
    month: '2026-10', inventory,
    now: new Date('2026-10-15T08:00:00.000Z'),
    orders: [order('2026-10', 15)],
  });
  const product = report.products[0];
  assert.equal(product.forecastUnits, 16); // Projected 31 units × latest-month 0.5 weight.
  assert.equal(product.confidence, 'low');
  assert.match(report.limitations[0], /profit are not calculated/);
});

test('no delivered demand produces no automatic reorder recommendation', () => {
  const report = buildDemandForecast({ month: '2026-09', inventory, orders: [] });
  assert.equal(report.products[0].forecastUnits, 0);
  assert.equal(report.products[0].suggestedReorderQuantity, 0);
  assert.equal(report.products[0].action, 'no_demand_data');
  assert.equal(report.summary.productsToReorder, 0);
});
