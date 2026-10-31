import { pharmacyDatabase } from './pharmacyService.js';
import { normalizeResendMonthlyReportEvent, resendEventIsNewer } from './resendMonthlyReportWebhookCore.js';

const DELIVERIES_COLLECTION = 'monthlyReportDeliveries';
const RECEIPTS_COLLECTION = 'monthlyReportWebhookEvents';
const RECEIPT_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

export async function processResendMonthlyReportEvent(eventIdValue, event) {
  const eventId = String(eventIdValue || '').trim().slice(0, 200);
  if (!eventId) throw Object.assign(new Error('The webhook event id is missing.'), { status: 400 });
  const normalized = normalizeResendMonthlyReportEvent(event);
  if (!normalized) return { received: true, supported: false, matched: false };

  const db = await pharmacyDatabase();
  const previousReceipt = await db.collection(RECEIPTS_COLLECTION).findOne({ eventId });
  if (previousReceipt?.status === 'processed') {
    return {
      received: true,
      supported: true,
      matched: Boolean(previousReceipt.matched),
      duplicate: true,
    };
  }

  const delivery = await db.collection(DELIVERIES_COLLECTION).findOne(
    { resendEmailId: normalized.resendEmailId },
    { projection: { _id: 1, lastResendEventAt: 1 } },
  );
  let matched = false;
  if (delivery && resendEventIsNewer(delivery.lastResendEventAt, normalized.eventAt)) {
    const now = new Date();
    const set = {
      status: normalized.status,
      lastResendEventType: normalized.eventType,
      lastResendEventId: eventId,
      lastResendEventAt: normalized.eventAt,
      updatedAt: now,
    };
    set[normalized.timestampField] = normalized.eventAt;
    const result = await db.collection(DELIVERIES_COLLECTION).updateOne(
      {
        _id: delivery._id,
        $or: [
          { lastResendEventAt: { $lte: normalized.eventAt } },
          { lastResendEventAt: null },
          { lastResendEventAt: { $exists: false } },
        ],
      },
      { $set: set },
    );
    matched = result.modifiedCount === 1;
  } else if (delivery) {
    matched = true;
  }

  const processedAt = new Date();
  await db.collection(RECEIPTS_COLLECTION).updateOne(
    { eventId },
    {
      $set: {
        eventType: normalized.eventType,
        resendEmailId: normalized.resendEmailId,
        eventAt: normalized.eventAt,
        matched,
        status: 'processed',
        processedAt,
        deleteAt: new Date(processedAt.getTime() + RECEIPT_RETENTION_MS),
      },
      $setOnInsert: { createdAt: processedAt },
    },
    { upsert: true },
  );
  return { received: true, supported: true, matched, duplicate: false };
}

