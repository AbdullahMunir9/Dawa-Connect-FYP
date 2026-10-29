import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  createAnalyticsExcel,
  createAnalyticsPdf,
  createAnalyticsReportFile,
} from './analyticsReportService.js';

function reportData() {
  const evidence = [
    { key: 'summary.deliveredOrders', label: 'Delivered orders', value: 12, display: '12', format: 'integer', category: 'sales' },
    { key: 'summary.productRevenue', label: 'Product revenue', value: 12400, display: 'PKR 12,400', format: 'currency', category: 'sales' },
    { key: 'forecast.summary.productsToReorder', label: 'Products to reorder', value: 1, display: '1', format: 'integer', category: 'forecast' },
    { key: 'city.status', label: 'City opportunity status', value: 'consider expansion', display: 'Consider expansion', format: 'text', category: 'city' },
  ];
  const item = (title, priority, factKeys) => ({
    title,
    explanation: 'Review the verified evidence and confirm the action against current pharmacy operations.',
    priority,
    factKeys,
  });
  return {
    exportedAt: '2026-10-29T05:00:00.000Z',
    pharmacy: { name: 'AL-Shifa', address: 'Lahore', email: '', phone: '' },
    analytics: {
      meta: { month: '2026-10', monthLabel: 'Oct 2026', calculationVersion: 'v1' },
      summary: {
        ordersPlaced: 14, deliveredOrders: 12, cancelledOrders: 2, cancellationRate: 14.3,
        productRevenue: 12400, deliveryFees: 600, tax: 620, grossCollected: 13620,
        averageOrderValue: 1135, unitsSold: 28, inventoryProducts: 2, activeProducts: 2,
        lowStockProducts: 1, outOfStockProducts: 0,
      },
      comparisons: { productRevenuePercent: 15 },
      daily: [
        { date: '2026-10-01', orders: 2, deliveredOrders: 2, productRevenue: 1200 },
        { date: '2026-10-02', orders: 1, deliveredOrders: 1, productRevenue: 800 },
      ],
      products: [{
        name: 'Panadol 500mg', category: 'Pain relief', unitsSold: 18, revenue: 9000,
        orderCount: 8, currentStock: 3, threshold: 10, stockStatus: 'low_stock',
      }],
      forecast: {
        forecastMonthLabel: 'November 2026',
        summary: { forecastUnits: 35, productsWithDemand: 1, productsToReorder: 1, suggestedReorderUnits: 9 },
        products: [{
          name: 'Panadol 500mg', category: 'Pain relief', currentStock: 3, forecastUnits: 35,
          estimatedProductRevenue: 17500, expectedWeeklyDemand: 8, safetyStock: 4,
          recommendedWeeklyTarget: 12, suggestedReorderQuantity: 9, weeksOfCover: 0.4,
          confidence: 'medium', action: 'reorder_now',
        }],
      },
      cityOpportunity: {
        status: 'consider_expansion', currentRadiusKm: 5,
        recommendation: 'Review a controlled radius test with the pharmacy owner.',
        summary: { publishedZones: 2, hiddenZones: 1, insideRadiusOrders: 6, outsideRadiusOrders: 12 },
        zones: [{ label: 'Gulberg', distanceKm: 7, orders: 6, units: 12, insideCurrentRadius: false }],
        scenarios: [{ radiusKm: 10, additionalReachKm: 5, opportunityOrders: 12, opportunityUnits: 24, confidence: 'medium' }],
      },
      dataQuality: { warnings: ['Current stock is a live balance.'] },
    },
    narrative: {
      promptVersion: 'analytics-narrative-v1', calculationVersion: 'v1', provider: 'groq',
      model: 'openai/gpt-oss-20b', generationMethod: 'ai', generatedAt: '2026-10-29T04:37:32.609Z',
      disclaimer: 'Planning support only. All actions require pharmacy-owner review.',
      evidence,
      report: {
        executiveSummary: {
          headline: 'Measured performance is ready for owner review',
          overview: 'The report combines measured sales, inventory planning and privacy-qualified delivery evidence.',
          factKeys: ['summary.deliveredOrders', 'summary.productRevenue'],
        },
        salesInsights: [item('Review delivered performance', 'medium', ['summary.deliveredOrders', 'summary.productRevenue'])],
        inventoryActions: [item('Review priority stock', 'high', ['forecast.summary.productsToReorder'])],
        deliveryOpportunities: [item('Consider a controlled delivery test', 'medium', ['city.status'])],
        risksAndLimitations: [item('Respect the data limits', 'high', ['city.status'])],
        nextMonthActionPlan: [item('Review the plan weekly', 'high', ['forecast.summary.productsToReorder'])],
      },
    },
  };
}

test('PDF export creates an in-memory PDF with a complete file signature', async () => {
  const buffer = await createAnalyticsPdf(reportData());
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.match(buffer.subarray(-64).toString('ascii'), /%%EOF/);
  assert.ok(buffer.length > 5000);
});

test('Excel export creates the expected audit-friendly workbook sheets', async () => {
  const buffer = await createAnalyticsExcel(reportData());
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 2).toString('ascii'), 'PK');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
    'Overview', 'Daily Sales', 'Products', 'Forecast', 'City Opportunity', 'Narrative', 'Evidence',
  ]);
  assert.equal(workbook.getWorksheet('Overview').getCell('B2').value, 'AL-Shifa');
  assert.equal(workbook.getWorksheet('Products').getCell('A2').value, 'Panadol 500mg');
  assert.equal(workbook.getWorksheet('Forecast').getCell('I2').value, 9);
  assert.equal(workbook.getWorksheet('Narrative').rowCount, 7);
  assert.equal(workbook.getWorksheet('Evidence').rowCount, 5);
  assert.equal(JSON.stringify(workbook.model).includes('Private Customer'), false);
});

test('report export rejects unsupported formats before accessing pharmacy data', async () => {
  await assert.rejects(() => createAnalyticsReportFile('owner', '2026-10', 'csv'), /pdf or xlsx/);
});
