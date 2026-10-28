const DEFAULT_TIME_ZONE = 'Asia/Karachi';
const DELIVERED_STATUS = 'delivered';
const CANCELLED_STATUS = 'cancelled';

const integer = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
};

const decimal = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const money = (value) => Math.round((decimal(value) + Number.EPSILON) * 100) / 100;

function dateParts(value, timeZone = DEFAULT_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: Number(read('hour')),
  };
}

export function normalizeReportMonth(value, now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const supplied = String(value || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(supplied)) return supplied;
  if (supplied) throw Object.assign(new Error('Report month must use YYYY-MM format.'), { status: 400 });
  const parts = dateParts(now, timeZone);
  return `${parts.year}-${parts.month}`;
}

export function shiftReportMonth(monthValue, offset) {
  const month = normalizeReportMonth(monthValue);
  const [year, monthNumber] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + Number(offset || 0), 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function reportMonthBounds(monthValue) {
  const month = normalizeReportMonth(monthValue);
  const nextMonth = shiftReportMonth(month, 1);
  // Pakistan has used UTC+05:00 without daylight-saving changes during the period this app supports.
  return {
    month,
    start: new Date(`${month}-01T00:00:00+05:00`),
    end: new Date(`${nextMonth}-01T00:00:00+05:00`),
    startDate: `${month}-01`,
    endDate: `${nextMonth}-01`,
  };
}

function orderDate(order) {
  const candidates = [order?.createdAt, order?.date];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const value = typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate)
      ? `${candidate}T00:00:00+05:00`
      : candidate;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function monthKey(date, timeZone) {
  const parts = dateParts(date, timeZone);
  return parts ? `${parts.year}-${parts.month}` : '';
}

function productRevenue(order) {
  if (Number.isFinite(Number(order?.subtotal))) return money(order.subtotal);
  return money((order?.items || []).reduce((sum, item) => (
    sum + decimal(item?.lineTotal ?? (decimal(item?.price) * integer(item?.quantity ?? item?.qty)))
  ), 0));
}

function percentageChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round((((current - previous) / Math.abs(previous)) * 100 + Number.EPSILON) * 10) / 10;
}

function monthLabel(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PK', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function emptyDailyRows(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: days }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return {
      date: `${month}-${day}`,
      label: day,
      orders: 0,
      deliveredOrders: 0,
      productRevenue: 0,
    };
  });
}

function calculateMonth(month, orders, inventory, timeZone) {
  const monthOrders = orders.filter((order) => {
    const date = orderDate(order);
    return date && monthKey(date, timeZone) === month;
  });
  const delivered = monthOrders.filter((order) => String(order.status || '').toLowerCase() === DELIVERED_STATUS);
  const cancelled = monthOrders.filter((order) => String(order.status || '').toLowerCase() === CANCELLED_STATUS);
  const productRevenueTotal = money(delivered.reduce((sum, order) => sum + productRevenue(order), 0));
  const tax = money(delivered.reduce((sum, order) => sum + decimal(order.tax), 0));
  const deliveryFees = money(delivered.reduce((sum, order) => sum + decimal(order.deliveryFee), 0));
  const grossCollected = money(delivered.reduce((sum, order) => sum + decimal(order.total), 0));
  const unitsSold = delivered.reduce((sum, order) => sum + (order.items || [])
    .reduce((itemSum, item) => itemSum + Math.max(0, integer(item?.quantity ?? item?.qty)), 0), 0);
  const statusCounts = new Map();
  const paymentCounts = new Map();
  const products = new Map();
  const daily = emptyDailyRows(month);
  const dailyByDate = new Map(daily.map((row) => [row.date, row]));
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    orders: 0,
  }));

  for (const order of monthOrders) {
    const status = String(order.status || 'Unknown').trim() || 'Unknown';
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    const date = orderDate(order);
    const parts = dateParts(date, timeZone);
    const key = parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
    const day = dailyByDate.get(key);
    if (day) day.orders += 1;
    if (Number.isInteger(parts?.hour) && hourly[parts.hour]) hourly[parts.hour].orders += 1;

    if (status.toLowerCase() !== DELIVERED_STATUS) continue;
    if (day) {
      day.deliveredOrders += 1;
      day.productRevenue = money(day.productRevenue + productRevenue(order));
    }
    const paymentMethod = String(order.payMethod || order.paymentMethod || 'Other').trim() || 'Other';
    const payment = paymentCounts.get(paymentMethod) || { method: paymentMethod, orders: 0, amount: 0 };
    payment.orders += 1;
    payment.amount = money(payment.amount + decimal(order.total));
    paymentCounts.set(paymentMethod, payment);

    for (const item of order.items || []) {
      const productId = String(item?.productId || '').trim();
      const name = String(item?.name || 'Unknown product').trim() || 'Unknown product';
      const keyValue = productId || `name:${name.toLowerCase()}`;
      const quantity = Math.max(0, integer(item?.quantity ?? item?.qty));
      const lineRevenue = money(item?.lineTotal ?? (decimal(item?.price) * quantity));
      const existing = products.get(keyValue) || {
        productId: productId || null,
        name,
        category: String(item?.category || 'General'),
        unit: String(item?.unit || ''),
        unitsSold: 0,
        revenue: 0,
        orderCount: 0,
      };
      existing.unitsSold += quantity;
      existing.revenue = money(existing.revenue + lineRevenue);
      existing.orderCount += 1;
      products.set(keyValue, existing);
    }
  }

  const inventoryById = new Map(inventory.map((product) => [String(product._id || product.id), product]));
  const inventoryByName = new Map(inventory.map((product) => [String(product.name || '').trim().toLowerCase(), product]));
  const productMetrics = [...products.values()].map((product) => {
    const inventoryItem = (product.productId && inventoryById.get(product.productId))
      || inventoryByName.get(product.name.toLowerCase());
    const currentStock = inventoryItem ? Math.max(0, integer(inventoryItem.stock)) : null;
    const threshold = inventoryItem ? Math.max(0, integer(inventoryItem.threshold)) : null;
    return {
      ...product,
      currentStock,
      threshold,
      stockStatus: currentStock === null ? 'unknown' : currentStock === 0 ? 'out_of_stock'
        : currentStock <= threshold ? 'low_stock' : 'healthy',
    };
  }).sort((left, right) => right.unitsSold - left.unitsSold || right.revenue - left.revenue || left.name.localeCompare(right.name));

  const activeProducts = inventory.filter((product) => Math.max(0, integer(product.stock)) > 0).length;
  const lowStockProducts = inventory.filter((product) => {
    const stock = Math.max(0, integer(product.stock));
    return stock > 0 && stock <= Math.max(0, integer(product.threshold));
  }).length;
  const outOfStockProducts = inventory.filter((product) => Math.max(0, integer(product.stock)) === 0).length;

  return {
    month,
    label: monthLabel(month),
    summary: {
      ordersPlaced: monthOrders.length,
      deliveredOrders: delivered.length,
      cancelledOrders: cancelled.length,
      cancellationRate: monthOrders.length ? Math.round((cancelled.length / monthOrders.length) * 1000) / 10 : 0,
      productRevenue: productRevenueTotal,
      tax,
      deliveryFees,
      grossCollected,
      averageOrderValue: delivered.length ? money(grossCollected / delivered.length) : 0,
      unitsSold,
      inventoryProducts: inventory.length,
      activeProducts,
      lowStockProducts,
      outOfStockProducts,
    },
    daily,
    hourly,
    statuses: [...statusCounts.entries()].map(([status, count]) => ({ status, count }))
      .sort((left, right) => right.count - left.count),
    paymentMethods: [...paymentCounts.values()].sort((left, right) => right.amount - left.amount),
    products: productMetrics,
  };
}

export function buildMeasuredAnalytics({ month: requestedMonth, orders = [], inventory = [], now = new Date(), timeZone = DEFAULT_TIME_ZONE } = {}) {
  const month = normalizeReportMonth(requestedMonth, now, timeZone);
  const current = calculateMonth(month, orders, inventory, timeZone);
  const previousMonth = shiftReportMonth(month, -1);
  const previous = calculateMonth(previousMonth, orders, inventory, timeZone);
  const monthlyTrend = Array.from({ length: 6 }, (_, index) => shiftReportMonth(month, index - 5))
    .map((trendMonth) => {
      const result = calculateMonth(trendMonth, orders, inventory, timeZone);
      return {
        month: trendMonth,
        label: result.label,
        ordersPlaced: result.summary.ordersPlaced,
        deliveredOrders: result.summary.deliveredOrders,
        productRevenue: result.summary.productRevenue,
        grossCollected: result.summary.grossCollected,
      };
    });

  return {
    meta: {
      month,
      monthLabel: current.label,
      previousMonth,
      timeZone,
      generatedAt: now.toISOString(),
      source: 'measured',
      calculationVersion: 'v1',
    },
    summary: current.summary,
    comparisons: {
      deliveredOrdersPercent: percentageChange(current.summary.deliveredOrders, previous.summary.deliveredOrders),
      productRevenuePercent: percentageChange(current.summary.productRevenue, previous.summary.productRevenue),
      grossCollectedPercent: percentageChange(current.summary.grossCollected, previous.summary.grossCollected),
      averageOrderValuePercent: percentageChange(current.summary.averageOrderValue, previous.summary.averageOrderValue),
    },
    daily: current.daily,
    hourly: current.hourly,
    statuses: current.statuses,
    paymentMethods: current.paymentMethods,
    products: current.products,
    monthlyTrend,
    dataQuality: {
      hasInventoryMovementHistory: false,
      forecastingReady: false,
      narrativeReady: false,
      warnings: [
        'Current stock is live inventory, not a reconstructed month-end balance.',
        'Forecasts and purchase recommendations are withheld until inventory movement history is available.',
      ],
    },
  };
}

export const ANALYTICS_TIME_ZONE = DEFAULT_TIME_ZONE;
