import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMeasuredAnalytics, normalizeReportMonth, reportMonthBounds, shiftReportMonth } from './analyticsCore.js';

const inventory = [
  { _id: 'p1', name: 'Panadol 500mg', category: 'Pain relief', stock: 8, threshold: 10 },
  { _id: 'p2', name: 'Vitamin C', category: 'Supplements', stock: 0, threshold: 5 },
  { _id: 'p3', name: 'ORS', category: 'Hydration', stock: 40, threshold: 10 },
];

const orders = [
  {
    id: 'delivered-1', status: 'Delivered', createdAt: new Date('2026-10-05T05:15:00.000Z'),
    subtotal: 500, tax: 25, deliveryFee: 50, total: 575, payMethod: 'Cash on Delivery',
    items: [{ productId: 'p1', name: 'Panadol 500mg', quantity: 2, price: 250, lineTotal: 500 }],
  },
  {
    id: 'delivered-2', status: 'Delivered', date: '2026-10-10',
    subtotal: 300, tax: 15, deliveryFee: 50, total: 365, paymentMethod: 'cash',
    items: [{ productId: 'p2', name: 'Vitamin C', qty: 3, price: 100, lineTotal: 300 }],
  },
  {
    id: 'cancelled', status: 'Cancelled', createdAt: new Date('2026-10-12T10:00:00.000Z'),
    subtotal: 999, total: 999,
    items: [{ productId: 'p1', name: 'Panadol 500mg', quantity: 9, lineTotal: 999 }],
  },
  {
    id: 'previous', status: 'Delivered', createdAt: new Date('2026-09-08T10:00:00.000Z'),
    subtotal: 400, tax: 20, deliveryFee: 50, total: 470,
    items: [{ productId: 'p1', name: 'Panadol 500mg', quantity: 1, lineTotal: 400 }],
  },
];

test('month helpers validate, shift and use Pakistan calendar boundaries', () => {
  assert.equal(normalizeReportMonth('2026-10'), '2026-10');
  assert.equal(shiftReportMonth('2026-01', -1), '2025-12');
  const bounds = reportMonthBounds('2026-10');
  assert.equal(bounds.start.toISOString(), '2026-09-30T19:00:00.000Z');
  assert.equal(bounds.end.toISOString(), '2026-10-31T19:00:00.000Z');
  assert.throws(() => normalizeReportMonth('October 2026'), /YYYY-MM/);
});

test('measured analytics excludes cancelled orders from revenue and demand', () => {
  const report = buildMeasuredAnalytics({
    month: '2026-10', orders, inventory, now: new Date('2026-10-24T08:00:00.000Z'),
  });
  assert.equal(report.summary.ordersPlaced, 3);
  assert.equal(report.summary.deliveredOrders, 2);
  assert.equal(report.summary.cancelledOrders, 1);
  assert.equal(report.summary.productRevenue, 800);
  assert.equal(report.summary.grossCollected, 940);
  assert.equal(report.summary.unitsSold, 5);
  assert.equal(report.summary.averageOrderValue, 470);
  assert.equal(report.products[0].name, 'Vitamin C');
  assert.equal(report.products[0].unitsSold, 3);
  assert.equal(report.products.find((product) => product.productId === 'p1').unitsSold, 2);
  assert.equal(report.summary.lowStockProducts, 1);
  assert.equal(report.summary.outOfStockProducts, 1);
});

test('comparisons and daily/hourly buckets are derived from measured orders', () => {
  const report = buildMeasuredAnalytics({
    month: '2026-10', orders, inventory, now: new Date('2026-10-24T08:00:00.000Z'),
  });
  assert.equal(report.comparisons.productRevenuePercent, 100);
  assert.equal(report.daily.find((day) => day.date === '2026-10-05').productRevenue, 500);
  assert.equal(report.daily.find((day) => day.date === '2026-10-12').orders, 1);
  assert.equal(report.hourly[10].orders, 1); // 05:15 UTC is 10:15 in Pakistan.
  assert.equal(report.monthlyTrend.at(-2).productRevenue, 400);
  assert.equal(report.monthlyTrend.at(-1).productRevenue, 800);
  assert.equal(report.dataQuality.forecastingReady, false);
});
