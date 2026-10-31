import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
import {
  automationBearerToken,
  automationSecretIsValid,
} from '../middleware/reportAutomationAuth.js';

const NOW = new Date('2026-10-31T08:00:00.000Z');

test('automation accepts only completed calendar months', () => {
  assert.equal(normalizeClosedReportMonth('2026-09', NOW), '2026-09');
  assert.throws(() => normalizeClosedReportMonth('2026-10', NOW), /completed calendar month/i);
  assert.throws(() => normalizeClosedReportMonth('2026-11', NOW), /completed calendar month/i);
});

test('eligible pharmacy requires approval, verified email and a non-suspended state', () => {
  const base = {
    email: 'Owner@Example.com',
    emailVerifiedAt: NOW,
    status: 'approved',
    approvalStatus: 'approved',
  };
  assert.equal(isEligiblePharmacyAccount(base), true);
  assert.equal(isEligiblePharmacyAccount({ ...base, emailVerifiedAt: null }), false);
  assert.equal(isEligiblePharmacyAccount({ ...base, email: 'not-an-email' }), false);
  assert.equal(isEligiblePharmacyAccount({ ...base, status: 'suspended' }), false);
  assert.equal(isEligiblePharmacyAccount({ ...base, status: 'rejected' }), false);
  assert.equal(isEligiblePharmacyAccount({ ...base, status: 'unapproved', approvalStatus: 'unapproved' }), false);
});

test('recipient normalization is strict and lowercases verified addresses', () => {
  assert.equal(verifiedRecipient(' Owner@Example.COM '), 'owner@example.com');
  assert.equal(verifiedRecipient('missing-domain@'), '');
  assert.equal(verifiedRecipient('spaces are@example.com'), '');
});

test('test and production deliveries use separate idempotency identities', () => {
  const production = reportIdempotencyKey('owner-1', '2026-09', 'email');
  const testMode = reportIdempotencyKey('owner-1', '2026-09', 'email_test');
  assert.notEqual(production, testMode);
  assert.match(production, /^monthly-report\/email\//);
  assert.ok(production.length <= 256);
});

test('lease tokens are stored as hashes and compared safely', () => {
  const token = 'a'.repeat(48);
  const hash = hashLeaseToken(token);
  assert.equal(hash.length, 64);
  assert.equal(leaseTokenMatches(token, hash), true);
  assert.equal(leaseTokenMatches('b'.repeat(48), hash), false);
  assert.equal(leaseTokenMatches('', hash), false);
});

test('failure details are bounded and retry schedule becomes permanent at the limit', () => {
  const failure = normalizeFailure({
    code: 'Resend 500 / TEMPORARY',
    message: 'First line\nSecond line\t secret-looking noise',
    retryable: true,
  });
  assert.equal(failure.code, 'resend_500_temporary');
  assert.equal(failure.message.includes('\n'), false);
  assert.equal(failure.retryable, true);

  const first = retryDecision(1, true, NOW, 5);
  assert.equal(first.status, 'retryable_failed');
  assert.equal(first.nextAttemptAt.toISOString(), '2026-10-31T08:15:00.000Z');
  const final = retryDecision(5, true, NOW, 5);
  assert.deepEqual(final, { status: 'permanent_failed', nextAttemptAt: null });
  assert.equal(retryDecision(1, false, NOW, 5).status, 'permanent_failed');
});

test('test mode refuses to start without a valid override recipient', () => {
  assert.deepEqual(emailTestConfiguration({ REPORT_EMAIL_TEST_MODE: 'false' }), {
    enabled: false,
    recipient: '',
  });
  assert.throws(() => emailTestConfiguration({
    REPORT_EMAIL_TEST_MODE: 'true',
    REPORT_EMAIL_TEST_RECIPIENT: 'invalid',
  }), /must be valid/i);
  assert.throws(() => emailTestConfiguration({}), /must be valid/i);
  assert.throws(() => emailTestConfiguration({
    REPORT_EMAIL_TEST_MODE: 'yes',
    REPORT_EMAIL_TEST_RECIPIENT: 'test@example.com',
  }), /must be true or false/i);
  assert.deepEqual(emailTestConfiguration({
    REPORT_EMAIL_TEST_MODE: 'true',
    REPORT_EMAIL_TEST_RECIPIENT: 'Test@Example.com',
  }), {
    enabled: true,
    recipient: 'test@example.com',
  });
});

test('automation bearer authentication requires the exact strong configured secret', () => {
  const secret = 's'.repeat(48);
  assert.equal(automationBearerToken(`Bearer ${secret}`), secret);
  assert.equal(automationSecretIsValid(`Bearer ${secret}`, secret), true);
  assert.equal(automationSecretIsValid(`Bearer ${'x'.repeat(48)}`, secret), false);
  assert.equal(automationSecretIsValid(`Bearer ${secret}`, 'short'), false);
  assert.equal(automationSecretIsValid(`Basic ${secret}`, secret), false);
});

