import { normalizeReportMonth, shiftReportMonth } from './analyticsCore.js';

const DELIVERED_STATUS = 'delivered';
const DEFAULT_TIME_ZONE = 'Asia/Karachi';

const numeric = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const whole = (value) => Math.max(0, Math.trunc(numeric(value)));
const money = (value) => Math.round((numeric(value) + Number.EPSILON) * 100) / 100;

function localParts(value, timeZone = DEFAULT_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return { year: read('year'), month: read('month'), day: Number(read('day')) };
}

function orderDate(order) {
  for (const candidate of [order?.createdAt, order?.date]) {
    if (!candidate) continue;
    const normalized = typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate)
      ? `${candidate}T00:00:00+05:00`
      : candidate;
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function monthKey(value, timeZone) {
  const parts = localParts(value, timeZone);
  return parts ? `${parts.year}-${parts.month}` : '';
}

function daysInMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function weightedAverage(values) {
  const recent = values.slice(-3);
  if (!recent.length) return 0;
  const weightSets = { 1: [1], 2: [0.4, 0.6], 3: [0.2, 0.3, 0.5] };
  const weights = weightSets[recent.length];
  return recent.reduce((sum, value, index) => sum + value * weights[index], 0);
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function confidenceFor({ historyMonths, demandMonths, totalUnits, movementHistoryDays }) {
  if (historyMonths >= 5 && demandMonths >= 4 && totalUnits >= 30 && movementHistoryDays >= 90) return 'high';
  if (historyMonths >= 2 && demandMonths >= 2 && totalUnits >= 8) return 'medium';
  return 'low';
}

function bufferRate(confidence, values) {
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const variability = average ? Math.min(0.5, standardDeviation(values) / average) : 0;
  const minimum = confidence === 'high' ? 0.15 : confidence === 'medium' ? 0.2 : 0.3;
  return Math.max(minimum, variability);
}

function normalizedMonthDemand(month, units, selectedMonth, currentMonth, now, timeZone) {
  if (month !== selectedMonth || selectedMonth !== currentMonth) return units;
  const today = localParts(now, timeZone)?.day || 1;
  const monthDays = daysInMonth(month);
  // During the first week, use seven as the denominator to prevent extreme extrapolation.
  return units * (monthDays / Math.max(7, Math.min(today, monthDays)));
}

function buildProductSeries({ product, months, demand, selectedMonth, currentMonth, now, timeZone }) {
  const createdMonth = product.createdAt ? monthKey(product.createdAt, timeZone) : months[0];
  return months.map((month) => ({
    month,
    eligible: !createdMonth || month >= createdMonth,
    complete: month !== currentMonth || selectedMonth !== currentMonth,
    actualUnits: demand.get(`${String(product._id || product.id)}:${month}`) || 0,
  })).map((row) => ({
    ...row,
    normalizedUnits: row.eligible
      ? normalizedMonthDemand(row.month, row.actualUnits, selectedMonth, currentMonth, now, timeZone)
      : null,
  }));
}

function backtestProducts(products) {
  let absoluteError = 0;
  let actualTotal = 0;
  let samples = 0;
  for (const product of products) {
    const eligible = product.history.filter((row) => row.eligible);
    for (let index = 2; index < eligible.length; index += 1) {
      if (!eligible[index].complete) continue;
      const prior = eligible.slice(Math.max(0, index - 3), index).map((row) => row.normalizedUnits);
      const predicted = weightedAverage(prior);
      const actual = eligible[index].actualUnits;
      absoluteError += Math.abs(predicted - actual);
      actualTotal += actual;
      samples += 1;
    }
  }
  return {
    samples,
    meanAbsoluteError: samples ? Math.round((absoluteError / samples) * 10) / 10 : null,
    weightedAbsolutePercentageError: actualTotal
      ? Math.round((absoluteError / actualTotal) * 1000) / 10
      : null,
  };
}

export function buildDemandForecast({
  month: requestedMonth,
  orders = [],
  inventory = [],
  now = new Date(),
  timeZone = DEFAULT_TIME_ZONE,
  movementHistoryDays = 0,
} = {}) {
  const month = normalizeReportMonth(requestedMonth, now, timeZone);
  const currentMonth = normalizeReportMonth('', now, timeZone);
  const forecastMonth = shiftReportMonth(month, 1);
  const historyMonths = Array.from({ length: 12 }, (_, index) => shiftReportMonth(month, index - 11));
  const demand = new Map();

  for (const order of orders) {
    if (String(order?.status || '').toLowerCase() !== DELIVERED_STATUS) continue;
    const date = orderDate(order);
    const orderMonth = date ? monthKey(date, timeZone) : '';
    if (!historyMonths.includes(orderMonth)) continue;
    for (const item of order.items || []) {
      const productId = String(item?.productId || '');
      if (!productId) continue;
      const key = `${productId}:${orderMonth}`;
      demand.set(key, (demand.get(key) || 0) + whole(item?.quantity ?? item?.qty));
    }
  }

  const intermediate = inventory.map((product) => {
    const history = buildProductSeries({
      product, months: historyMonths, demand, selectedMonth: month, currentMonth, now, timeZone,
    });
    const eligibleValues = history.filter((row) => row.eligible).map((row) => row.normalizedUnits);
    const recentValues = eligibleValues.slice(-3);
    const totalUnits = history.reduce((sum, row) => sum + row.actualUnits, 0);
    const demandMonths = history.filter((row) => row.eligible && row.actualUnits > 0).length;
    const forecastUnits = Math.ceil(weightedAverage(recentValues));
    const confidence = confidenceFor({
      historyMonths: eligibleValues.length,
      demandMonths,
      totalUnits,
      movementHistoryDays,
    });
    const monthDays = daysInMonth(forecastMonth);
    const weeklyDemand = forecastUnits ? Math.ceil((forecastUnits / monthDays) * 7) : 0;
    const safetyStock = weeklyDemand ? Math.ceil(weeklyDemand * bufferRate(confidence, recentValues)) : 0;
    const weeklyTarget = weeklyDemand + safetyStock;
    const currentStock = whole(product.stock);
    const suggestedReorderQuantity = Math.max(0, weeklyTarget - currentStock);
    const weeksOfCover = weeklyDemand ? Math.round((currentStock / weeklyDemand) * 10) / 10 : null;
    const action = forecastUnits === 0 ? 'no_demand_data'
      : suggestedReorderQuantity > 0 ? 'reorder_now'
        : weeksOfCover !== null && weeksOfCover > 3 ? 'watch_overstock' : 'adequate';

    return {
      productId: String(product._id || product.id),
      name: String(product.name || 'Unknown product'),
      category: String(product.category || 'General'),
      unit: String(product.unit || ''),
      currentStock,
      forecastUnits,
      estimatedProductRevenue: money(forecastUnits * numeric(product.price)),
      expectedWeeklyDemand: weeklyDemand,
      safetyStock,
      recommendedWeeklyTarget: weeklyTarget,
      suggestedReorderQuantity,
      weeksOfCover,
      confidence,
      action,
      historyMonths: eligibleValues.length,
      demandMonths,
      historicalUnits: totalUnits,
      method: 'weighted_moving_average',
      explanation: forecastUnits === 0
        ? 'No delivered demand was measured in the available history.'
        : suggestedReorderQuantity > 0
          ? `Current stock is below the weekly demand target plus a ${Math.round(bufferRate(confidence, recentValues) * 100)}% safety buffer.`
          : 'Current stock covers the calculated weekly target and safety buffer.',
      history,
    };
  });

  const backtest = backtestProducts(intermediate);
  const products = intermediate.map(({ history: _history, ...product }) => product)
    .sort((left, right) => {
      const priority = { reorder_now: 0, adequate: 1, watch_overstock: 2, no_demand_data: 3 };
      return priority[left.action] - priority[right.action]
        || right.suggestedReorderQuantity - left.suggestedReorderQuantity
        || right.forecastUnits - left.forecastUnits
        || left.name.localeCompare(right.name);
    });
  const productsWithDemand = products.filter((product) => product.forecastUnits > 0);

  return {
    forecastMonth,
    forecastMonthLabel: (() => {
      const [year, monthNumber] = forecastMonth.split('-').map(Number);
      return new Intl.DateTimeFormat('en-PK', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
    })(),
    assumption: 'weekly_replenishment',
    method: 'three_month_weighted_moving_average',
    summary: {
      forecastUnits: productsWithDemand.reduce((sum, product) => sum + product.forecastUnits, 0),
      estimatedProductRevenue: money(productsWithDemand.reduce((sum, product) => sum + product.estimatedProductRevenue, 0)),
      productsWithDemand: productsWithDemand.length,
      productsToReorder: products.filter((product) => product.action === 'reorder_now').length,
      suggestedReorderUnits: products.reduce((sum, product) => sum + product.suggestedReorderQuantity, 0),
    },
    products,
    backtest,
    limitations: [
      'Revenue is a sales estimate based on current selling prices; purchase expense and profit are not calculated.',
      'Recommendations assume pharmacies review and replenish stock once per week.',
      'Supplier lead time, damaged stock and expired-stock workflows are outside the current model.',
      'Low-confidence recommendations should be treated as an early planning signal, not an automatic purchase order.',
    ],
  };
}
