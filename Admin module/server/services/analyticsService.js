import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { pharmacyDatabase } from './pharmacyService.js';
import {
  ANALYTICS_TIME_ZONE,
  buildMeasuredAnalytics,
  normalizeReportMonth,
  reportMonthBounds,
  shiftReportMonth,
} from './analyticsCore.js';
import { buildDemandForecast } from './forecastingCore.js';
import { buildCityOpportunity } from './cityOpportunityCore.js';

const PRODUCTS_COLLECTION = process.env.PHARMACY_PRODUCTS_COLLECTION || 'products';
const { ObjectId } = mongoose.Types;

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function escapedRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function localDateString(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ANALYTICS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return `${read('year')}-${read('month')}-${read('day')}`;
}

function analyticsOrderFilter(ownerId, firstMonth, lastMonth) {
  const first = reportMonthBounds(firstMonth);
  const last = reportMonthBounds(lastMonth);
  return {
    ownerId,
    $or: [
      { createdAt: { $gte: first.start, $lt: last.end } },
      { date: { $gte: first.start, $lt: last.end } },
      { date: { $gte: first.startDate, $lt: last.endDate } },
    ],
  };
}

async function cityOpportunityAnalytics(db, ownerId, month) {
  const [user, profile] = await Promise.all([
    db.collection('users').findOne({ _id: new ObjectId(ownerId) }, {
      projection: { city: 1, latitude: 1, longitude: 1, location: 1, serviceRadiusKm: 1 },
    }),
    db.collection('profiles').findOne({ ownerId }, {
      projection: { city: 1, latitude: 1, longitude: 1, location: 1, deliveryRadius: 1 },
    }),
  ]);
  const city = String(profile?.city || user?.city || '').trim();
  const locationCoordinates = profile?.location?.coordinates || user?.location?.coordinates;
  const pharmacy = {
    city,
    latitude: profile?.latitude ?? user?.latitude ?? locationCoordinates?.[1],
    longitude: profile?.longitude ?? user?.longitude ?? locationCoordinates?.[0],
    deliveryRadius: profile?.deliveryRadius ?? user?.serviceRadiusKm ?? 10,
  };
  if (!city) return buildCityOpportunity({ pharmacy, orders: [] });

  const monthBounds = reportMonthBounds(month);
  const currentMonth = normalizeReportMonth();
  const periodEnd = month === currentMonth ? new Date() : monthBounds.end;
  const periodStart = new Date(periodEnd.getTime() - (90 * 86_400_000));
  const cityPattern = new RegExp(`^${escapedRegex(city)}$`, 'i');
  const stringDateRange = month === currentMonth
    ? { $gte: localDateString(periodStart), $lte: localDateString(periodEnd) }
    : { $gte: localDateString(periodStart), $lt: localDateString(periodEnd) };
  const orders = await db.collection('orders').find({
    status: 'Delivered',
    'deliveryAddress.city': cityPattern,
    $or: [
      { createdAt: { $gte: periodStart, $lt: periodEnd } },
      { date: { $gte: periodStart, $lt: periodEnd } },
      { date: stringDateRange },
    ],
  }, {
    projection: {
      ownerId: 1,
      status: 1,
      items: 1,
      deliveryAddress: 1,
    },
  }).toArray();

  return buildCityOpportunity({
    pharmacy,
    orders,
    analysisDays: 90,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    gridKm: boundedInteger(process.env.ANALYTICS_CITY_GRID_KM, 2, 1, 10),
    minimumOrdersPerZone: boundedInteger(process.env.ANALYTICS_CITY_MIN_ZONE_ORDERS, 5, 3, 100),
    minimumPharmaciesPerZone: boundedInteger(process.env.ANALYTICS_CITY_MIN_ZONE_PHARMACIES, 2, 2, 10),
  });
}

export async function measuredPharmacyAnalytics(ownerId, requestedMonth) {
  const month = normalizeReportMonth(requestedMonth);
  const currentMonth = normalizeReportMonth();
  if (month > currentMonth) throw Object.assign(new Error('Analytics are not available for a future month.'), { status: 400 });
  const firstMonth = shiftReportMonth(month, -11);
  const db = await pharmacyDatabase();
  const [orders, inventory, earliestMovement, cityOpportunity] = await Promise.all([
    db.collection('orders').find(analyticsOrderFilter(ownerId, firstMonth, month)).sort({ createdAt: 1, date: 1 }).toArray(),
    db.collection(PRODUCTS_COLLECTION).find({ ownerId }).sort({ name: 1 }).toArray(),
    db.collection('inventoryMovements').findOne({ ownerId }, { sort: { createdAt: 1 }, projection: { createdAt: 1 } }),
    cityOpportunityAnalytics(db, ownerId, month),
  ]);
  const analytics = buildMeasuredAnalytics({ month, orders, inventory, timeZone: ANALYTICS_TIME_ZONE });
  const movementHistoryDays = earliestMovement?.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(earliestMovement.createdAt).getTime()) / 86_400_000))
    : 0;
  analytics.forecast = buildDemandForecast({
    month,
    orders,
    inventory,
    timeZone: ANALYTICS_TIME_ZONE,
    movementHistoryDays,
  });
  analytics.cityOpportunity = cityOpportunity;
  analytics.dataQuality.hasInventoryMovementHistory = Boolean(earliestMovement);
  analytics.dataQuality.inventoryMovementHistoryDays = movementHistoryDays;
  analytics.dataQuality.forecastingReady = analytics.forecast.summary.productsWithDemand > 0;
  analytics.dataQuality.narrativeReady = true;
  if (earliestMovement) {
    analytics.dataQuality.warnings[0] = `Inventory movement history is active (${movementHistoryDays} complete day${movementHistoryDays === 1 ? '' : 's'} recorded).`;
  }
  analytics.dataQuality.warnings[1] = analytics.dataQuality.forecastingReady
    ? 'Demand forecasts use delivered sales and a weekly replenishment assumption; low-confidence rows require owner review.'
    : 'A demand forecast will appear after delivered product sales are available.';
  return analytics;
}

export async function createClosedMonthSnapshot(ownerId, requestedMonth) {
  const month = normalizeReportMonth(requestedMonth);
  const currentMonth = normalizeReportMonth();
  if (month >= currentMonth) {
    throw Object.assign(new Error('Only a completed calendar month can be finalized.'), { status: 400 });
  }
  const db = await pharmacyDatabase();
  const analytics = await measuredPharmacyAnalytics(ownerId, month);
  const now = new Date();
  const snapshotId = randomUUID();
  const result = await db.collection('analyticsMonthlySnapshots').findOneAndUpdate(
    { ownerId, month, calculationVersion: analytics.meta.calculationVersion },
    {
      $set: {
        analytics,
        status: 'measured',
        finalizedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        snapshotId,
        ownerId,
        month,
        calculationVersion: analytics.meta.calculationVersion,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  return { ...result, _id: String(result._id) };
}

export async function listAnalyticsSnapshots(ownerId) {
  const db = await pharmacyDatabase();
  return (await db.collection('analyticsMonthlySnapshots')
    .find({ ownerId }, { projection: { analytics: 0 } })
    .sort({ month: -1 })
    .limit(36)
    .toArray())
    .map((snapshot) => ({ ...snapshot, _id: String(snapshot._id) }));
}
