import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeResendMonthlyReportEvent,
  resendEventIsNewer,
} from './resendMonthlyReportWebhookCore.js';

test('Resend delivery events map to safe monthly delivery statuses', () => {
  const delivered = normalizeResendMonthlyReportEvent({
    type: 'email.delivered',
    created_at: '2026-11-02T06:00:00.000Z',
    data: { email_id: 'email_123456789' },
  });
  assert.deepEqual(delivered, {
    eventType: 'email.delivered',
    status: 'delivered',
    resendEmailId: 'email_123456789',
    eventAt: new Date('2026-11-02T06:00:00.000Z'),
    timestampField: 'deliveredAt',
  });
  assert.equal(normalizeResendMonthlyReportEvent({ type: 'email.opened', data: {} }), null);
});

test('Resend events require a valid email id and timestamp', () => {
  assert.throws(() => normalizeResendMonthlyReportEvent({
    type: 'email.bounced', created_at: 'invalid', data: { email_id: 'email_123456' },
  }), /timestamp/i);
  assert.throws(() => normalizeResendMonthlyReportEvent({
    type: 'email.bounced', created_at: '2026-11-02T06:00:00.000Z', data: { email_id: '' },
  }), /email id/i);
});

test('an older replay cannot replace a newer delivery event', () => {
  assert.equal(resendEventIsNewer(null, new Date('2026-11-02T06:00:00Z')), true);
  assert.equal(resendEventIsNewer(
    new Date('2026-11-02T06:00:00Z'),
    new Date('2026-11-02T05:59:59Z'),
  ), false);
  assert.equal(resendEventIsNewer(
    new Date('2026-11-02T06:00:00Z'),
    new Date('2026-11-02T06:00:00Z'),
  ), true);
});

