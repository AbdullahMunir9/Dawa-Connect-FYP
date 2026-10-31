import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { getOrCreateMonthlyReportArtifact, readMonthlyReportArtifact } from './analyticsReportArtifactService.js';
import {
  boundedInteger,
  emailTestConfiguration,
  hashLeaseToken,
  isEligiblePharmacyAccount,
  leaseTokenMatches,
  normalizeClosedReportMonth,
  normalizeFailure,
  reportIdempotencyKey,
  retryDecision,
  verifiedRecipient,
} from './monthlyReportAutomationCore.js';
import { pharmacyDatabase } from './pharmacyService.js';

const DELIVERIES_COLLECTION = 'monthlyReportDeliveries';
const { ObjectId } = mongoose.Types;

function activeChannel() {
  return emailTestConfiguration().enabled ? 'email_test' : 'email';
}

function maximumAttempts() {
  return boundedInteger(process.env.REPORT_AUTOMATION_MAX_ATTEMPTS, 5, 1, 20);
}

function leaseMinutes() {
  return boundedInteger(process.env.REPORT_AUTOMATION_LEASE_MINUTES, 20, 5, 120);
}

function batchLimit(value) {
  const configured = boundedInteger(process.env.REPORT_AUTOMATION_BATCH_SIZE, 5, 1, 25);
  return boundedInteger(value, configured, 1, 25);
}

function pharmacyName(account, profile) {
  return String(account?.pharmacyName || profile?.name || 'DawaConnect Pharmacy').trim().slice(0, 160);
}

function reportMonthLabel(month) {
  const [year, monthNumber] = String(month).split('-').map(Number);
  return new Intl.DateTimeFormat('en-PK', {
    month: 'long', year: 'numeric', timeZone: 'Asia/Karachi',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 15)));
}

function reportSender() {
  const value = String(process.env.REPORT_EMAIL_FROM || 'DawaConnect Reports <reports@dawaconnect.store>').trim();
  if (!value.includes('@') || value.length > 254) {
    throw Object.assign(new Error('REPORT_EMAIL_FROM is not configured correctly.'), { status: 503 });
  }
  return value;
}

function effectiveRecipient(account) {
  const verifiedEmail = verifiedRecipient(account?.email);
  const test = emailTestConfiguration();
  return {
    recipientEmail: test.enabled ? test.recipient : verifiedEmail,
    verifiedEmail,
    testMode: test.enabled,
  };
}

function deliverySummary(document) {
  return {
    deliveryId: document.deliveryId,
    month: document.month,
    channel: document.channel,
    pharmacyName: document.pharmacyName,
    status: document.status,
    attempts: document.attempts,
    artifactId: document.artifactId || null,
    resendEmailId: document.resendEmailId || null,
    acceptedAt: document.acceptedAt || null,
    deliveredAt: document.deliveredAt || null,
  };
}

async function eligibleAccounts(db) {
  const candidates = await db.collection('users').find({
    $or: [
      { status: /^approved$/i },
      { approvalStatus: /^approved$/i },
    ],
  }, {
    projection: {
      pharmacyName: 1,
      email: 1,
      emailVerifiedAt: 1,
      status: 1,
      approvalStatus: 1,
    },
  }).toArray();
  return {
    candidates,
    eligible: candidates.filter(isEligiblePharmacyAccount),
  };
}

export async function initializeMonthlyReportDeliveries(requestedMonth) {
  const month = normalizeClosedReportMonth(requestedMonth);
  const db = await pharmacyDatabase();
  const { candidates, eligible } = await eligibleAccounts(db);
  const ownerIds = eligible.map((account) => String(account._id));
  const profiles = ownerIds.length
    ? await db.collection('profiles').find(
      { ownerId: { $in: ownerIds } },
      { projection: { ownerId: 1, name: 1 } },
    ).toArray()
    : [];
  const profilesByOwner = new Map(profiles.map((profile) => [String(profile.ownerId), profile]));
  const channel = activeChannel();
  const now = new Date();
  const operations = eligible.map((account) => {
    const ownerId = String(account._id);
    const recipient = effectiveRecipient(account);
    return {
      updateOne: {
        filter: { ownerId, month, channel },
        update: {
          $setOnInsert: {
            deliveryId: randomUUID(),
            ownerId,
            month,
            channel,
            pharmacyName: pharmacyName(account, profilesByOwner.get(ownerId)),
            recipientEmail: recipient.recipientEmail,
            verifiedRecipientEmail: recipient.verifiedEmail,
            testMode: recipient.testMode,
            status: 'pending',
            attempts: 0,
            idempotencyKey: reportIdempotencyKey(ownerId, month, channel),
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    };
  });
  let result = { upsertedCount: 0 };
  if (operations.length) {
    try {
      result = await db.collection(DELIVERIES_COLLECTION).bulkWrite(operations, { ordered: false });
    } catch (error) {
      const writeErrors = error?.writeErrors || [];
      if (!writeErrors.length || writeErrors.some((item) => item?.code !== 11000)) throw error;
      result = error.result || result;
    }
  }
  const created = Number(result.upsertedCount || 0);
  return {
    month,
    channel,
    testMode: channel === 'email_test',
    candidates: candidates.length,
    eligible: eligible.length,
    excluded: candidates.length - eligible.length,
    created,
    alreadyExisted: eligible.length - created,
  };
}

function claimableFilter(month, channel, now) {
  return {
    month,
    channel,
    attempts: { $lt: maximumAttempts() },
    $or: [
      { status: 'pending' },
      {
        status: 'retryable_failed',
        $or: [
          { nextAttemptAt: { $lte: now } },
          { nextAttemptAt: null },
          { nextAttemptAt: { $exists: false } },
        ],
      },
      { status: 'processing', leaseUntil: { $lte: now } },
    ],
  };
}

export async function claimMonthlyReportDeliveries(requestedMonth, requestedLimit) {
  const month = normalizeClosedReportMonth(requestedMonth);
  const limit = batchLimit(requestedLimit);
  const channel = activeChannel();
  const db = await pharmacyDatabase();
  const claimed = [];

  for (let index = 0; index < limit; index += 1) {
    const now = new Date();
    const leaseToken = randomBytes(32).toString('base64url');
    const leaseUntil = new Date(now.getTime() + (leaseMinutes() * 60_000));
    const document = await db.collection(DELIVERIES_COLLECTION).findOneAndUpdate(
      claimableFilter(month, channel, now),
      {
        $set: {
          status: 'processing',
          leaseTokenHash: hashLeaseToken(leaseToken),
          leaseUntil,
          lastAttemptAt: now,
          updatedAt: now,
        },
        $unset: { nextAttemptAt: '' },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, returnDocument: 'after' },
    );
    if (!document) break;
    claimed.push({
      deliveryId: document.deliveryId,
      month: document.month,
      pharmacyName: document.pharmacyName,
      attempt: document.attempts,
      leaseUntil: document.leaseUntil,
      leaseToken,
    });
  }

  return { month, channel, claimed, remainingInBatch: claimed.length === limit };
}

async function activeDelivery(db, deliveryIdValue, leaseToken) {
  const deliveryId = String(deliveryIdValue || '').trim();
  if (!deliveryId || String(leaseToken || '').length < 32) {
    throw Object.assign(new Error('A valid delivery id and lease token are required.'), { status: 400 });
  }
  const delivery = await db.collection(DELIVERIES_COLLECTION).findOne({ deliveryId });
  if (!delivery) throw Object.assign(new Error('The monthly report delivery was not found.'), { status: 404 });
  if (delivery.status !== 'processing' || !leaseTokenMatches(leaseToken, delivery.leaseTokenHash)) {
    throw Object.assign(new Error('This report delivery is not held by the current workflow execution.'), { status: 409 });
  }
  if (!delivery.leaseUntil || new Date(delivery.leaseUntil).getTime() <= Date.now()) {
    throw Object.assign(new Error('The report delivery lease has expired.'), { status: 409 });
  }
  return delivery;
}

async function permanentlyRejectDelivery(db, delivery, reason) {
  const now = new Date();
  await db.collection(DELIVERIES_COLLECTION).updateOne(
    { _id: delivery._id, status: 'processing', leaseTokenHash: delivery.leaseTokenHash },
    {
      $set: {
        status: 'permanent_failed',
        lastErrorCode: 'pharmacy_not_eligible',
        lastErrorMessage: reason,
        failedAt: now,
        updatedAt: now,
      },
      $unset: { leaseTokenHash: '', leaseUntil: '', nextAttemptAt: '' },
    },
  );
}

export async function prepareMonthlyReportDelivery(deliveryId, leaseToken) {
  const db = await pharmacyDatabase();
  const delivery = await activeDelivery(db, deliveryId, leaseToken);
  const account = ObjectId.isValid(delivery.ownerId)
    ? await db.collection('users').findOne({ _id: new ObjectId(delivery.ownerId) })
    : null;
  if (!isEligiblePharmacyAccount(account)) {
    await permanentlyRejectDelivery(db, delivery, 'The pharmacy is no longer approved with a verified email.');
    throw Object.assign(new Error('The pharmacy is no longer eligible for monthly email delivery.'), { status: 409 });
  }
  const profile = await db.collection('profiles').findOne(
    { ownerId: delivery.ownerId },
    { projection: { name: 1 } },
  );
  const recipient = effectiveRecipient(account);
  const artifact = await getOrCreateMonthlyReportArtifact(delivery.ownerId, delivery.month);
  const now = new Date();
  const name = pharmacyName(account, profile);
  const subjectPrefix = recipient.testMode ? '[TEST] ' : '';
  const monthLabel = reportMonthLabel(delivery.month);
  const subject = `${subjectPrefix}Your DawaConnect monthly report - ${monthLabel}`;
  const updated = await db.collection(DELIVERIES_COLLECTION).findOneAndUpdate(
    { _id: delivery._id, status: 'processing', leaseTokenHash: delivery.leaseTokenHash },
    {
      $set: {
        artifactId: artifact.artifactId,
        snapshotId: artifact.snapshotId,
        narrativeReportId: artifact.narrativeReportId,
        pharmacyName: name,
        recipientEmail: recipient.recipientEmail,
        verifiedRecipientEmail: recipient.verifiedEmail,
        testMode: recipient.testMode,
        subject,
        filename: artifact.filename,
        pdfSha256: artifact.pdfSha256,
        preparedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' },
  );
  if (!updated) throw Object.assign(new Error('The report delivery lease changed while preparing the report.'), { status: 409 });
  return {
    deliveryId: updated.deliveryId,
    month: updated.month,
    monthLabel,
    pharmacyName: updated.pharmacyName,
    recipientEmail: updated.recipientEmail,
    fromEmail: reportSender(),
    testMode: updated.testMode,
    subject: updated.subject,
    filename: updated.filename,
    artifactId: updated.artifactId,
    pdfSha256: updated.pdfSha256,
    idempotencyKey: updated.idempotencyKey,
    reportDownloadPath: `/api/automation/monthly-reports/${updated.deliveryId}/pdf`,
  };
}

export async function downloadMonthlyReportDelivery(deliveryId, leaseToken) {
  const db = await pharmacyDatabase();
  const delivery = await activeDelivery(db, deliveryId, leaseToken);
  if (!delivery.artifactId) {
    throw Object.assign(new Error('Prepare the monthly report before downloading it.'), { status: 409 });
  }
  const artifact = await readMonthlyReportArtifact(delivery.artifactId);
  if (artifact.ownerId !== delivery.ownerId || artifact.month !== delivery.month) {
    throw Object.assign(new Error('The report artifact does not belong to this delivery.'), { status: 409 });
  }
  return artifact;
}

export async function acceptMonthlyReportDelivery(deliveryIdValue, leaseToken, resendEmailIdValue) {
  const deliveryId = String(deliveryIdValue || '').trim();
  const resendEmailId = String(resendEmailIdValue || '').trim();
  if (!/^[a-zA-Z0-9_-]{6,200}$/.test(resendEmailId)) {
    throw Object.assign(new Error('A valid Resend email id is required.'), { status: 400 });
  }
  const db = await pharmacyDatabase();
  const existing = await db.collection(DELIVERIES_COLLECTION).findOne({ deliveryId });
  if (!existing) throw Object.assign(new Error('The monthly report delivery was not found.'), { status: 404 });
  if (['accepted', 'delivered'].includes(existing.status)) {
    if (existing.resendEmailId !== resendEmailId) {
      throw Object.assign(new Error('This delivery was already accepted with a different email id.'), { status: 409 });
    }
    return deliverySummary(existing);
  }
  const delivery = await activeDelivery(db, deliveryId, leaseToken);
  if (!delivery.artifactId) throw Object.assign(new Error('The report must be prepared before acceptance.'), { status: 409 });
  const now = new Date();
  const updated = await db.collection(DELIVERIES_COLLECTION).findOneAndUpdate(
    { _id: delivery._id, status: 'processing', leaseTokenHash: delivery.leaseTokenHash },
    {
      $set: {
        status: 'accepted',
        resendEmailId,
        acceptedAt: now,
        updatedAt: now,
      },
      $unset: { leaseTokenHash: '', leaseUntil: '', nextAttemptAt: '', lastErrorCode: '', lastErrorMessage: '' },
    },
    { returnDocument: 'after' },
  );
  if (!updated) throw Object.assign(new Error('The report delivery state changed before acceptance.'), { status: 409 });
  return deliverySummary(updated);
}

export async function failMonthlyReportDelivery(deliveryId, leaseToken, failureValue) {
  const db = await pharmacyDatabase();
  const delivery = await activeDelivery(db, deliveryId, leaseToken);
  const failure = normalizeFailure(failureValue);
  const now = new Date();
  const decision = retryDecision(delivery.attempts, failure.retryable, now, maximumAttempts());
  const set = {
    status: decision.status,
    lastErrorCode: failure.code,
    lastErrorMessage: failure.message,
    lastFailedAt: now,
    updatedAt: now,
  };
  if (decision.nextAttemptAt) set.nextAttemptAt = decision.nextAttemptAt;
  else set.failedAt = now;
  const unset = { leaseTokenHash: '', leaseUntil: '' };
  if (!decision.nextAttemptAt) unset.nextAttemptAt = '';
  const updated = await db.collection(DELIVERIES_COLLECTION).findOneAndUpdate(
    { _id: delivery._id, status: 'processing', leaseTokenHash: delivery.leaseTokenHash },
    { $set: set, $unset: unset },
    { returnDocument: 'after' },
  );
  if (!updated) throw Object.assign(new Error('The report delivery state changed before failure recording.'), { status: 409 });
  return {
    ...deliverySummary(updated),
    nextAttemptAt: updated.nextAttemptAt || null,
    lastErrorCode: updated.lastErrorCode,
  };
}

