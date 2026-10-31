import { createHash, timingSafeEqual } from 'node:crypto';
import { normalizeReportMonth } from './analyticsCore.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export function normalizeClosedReportMonth(value, now = new Date()) {
  const month = normalizeReportMonth(value, now);
  const currentMonth = normalizeReportMonth(undefined, now);
  if (month >= currentMonth) {
    throw Object.assign(new Error('Only a completed calendar month can be processed.'), { status: 400 });
  }
  return month;
}

export function verifiedRecipient(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : '';
}

export function isEligiblePharmacyAccount(account) {
  if (!account?.emailVerifiedAt || !verifiedRecipient(account.email)) return false;
  const status = String(account.status || '').trim().toLowerCase();
  const approval = String(account.approvalStatus || '').trim().toLowerCase();
  if (status === 'suspended' || status === 'rejected') return false;
  return status === 'approved' || approval === 'approved';
}

export function reportIdempotencyKey(ownerId, month, channel = 'email') {
  return `monthly-report/${String(channel)}/${String(ownerId)}/${String(month)}`.slice(0, 256);
}

export function hashLeaseToken(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

export function leaseTokenMatches(value, expectedHash) {
  const actual = Buffer.from(hashLeaseToken(value), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function normalizeFailure({ code, message, retryable } = {}) {
  const safeCode = String(code || 'delivery_failed')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .slice(0, 80) || 'delivery_failed';
  const safeMessage = String(message || 'The report delivery failed.')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  return {
    code: safeCode,
    message: safeMessage || 'The report delivery failed.',
    retryable: retryable === true,
  };
}

export function retryDecision(attempts, retryable, now = new Date(), maximumAttempts = 5) {
  const attemptCount = boundedInteger(attempts, 1, 1, 100);
  const maximum = boundedInteger(maximumAttempts, 5, 1, 20);
  if (!retryable || attemptCount >= maximum) {
    return { status: 'permanent_failed', nextAttemptAt: null };
  }
  const delaysMinutes = [15, 60, 360, 1440];
  const delayMinutes = delaysMinutes[Math.min(attemptCount - 1, delaysMinutes.length - 1)];
  return {
    status: 'retryable_failed',
    nextAttemptAt: new Date(now.getTime() + (delayMinutes * 60_000)),
  };
}

export function emailTestConfiguration(env = process.env) {
  const mode = String(env.REPORT_EMAIL_TEST_MODE || '').trim().toLowerCase();
  if (mode && mode !== 'true' && mode !== 'false') {
    throw Object.assign(new Error('REPORT_EMAIL_TEST_MODE must be true or false.'), { status: 503 });
  }
  const enabled = mode !== 'false';
  const recipient = verifiedRecipient(env.REPORT_EMAIL_TEST_RECIPIENT);
  if (enabled && !recipient) {
    throw Object.assign(new Error('REPORT_EMAIL_TEST_RECIPIENT must be valid while report email test mode is enabled.'), { status: 503 });
  }
  return { enabled, recipient };
}

