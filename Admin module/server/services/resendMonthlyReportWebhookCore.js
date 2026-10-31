const EVENT_STATUS = new Map([
  ['email.sent', 'sent'],
  ['email.delivery_delayed', 'delivery_delayed'],
  ['email.delivered', 'delivered'],
  ['email.bounced', 'bounced'],
  ['email.complained', 'complained'],
  ['email.suppressed', 'suppressed'],
]);

export function normalizeResendMonthlyReportEvent(event) {
  const eventType = String(event?.type || '').trim();
  const status = EVENT_STATUS.get(eventType);
  if (!status) return null;
  const resendEmailId = String(event?.data?.email_id || '').trim();
  if (!/^[a-zA-Z0-9_-]{6,200}$/.test(resendEmailId)) {
    throw Object.assign(new Error('The Resend event does not contain a valid email id.'), { status: 400 });
  }
  const eventAt = new Date(event?.created_at || event?.data?.created_at || '');
  if (Number.isNaN(eventAt.getTime())) {
    throw Object.assign(new Error('The Resend event does not contain a valid timestamp.'), { status: 400 });
  }
  const timestampField = {
    delivered: 'deliveredAt',
    bounced: 'bouncedAt',
    complained: 'complainedAt',
    suppressed: 'suppressedAt',
    delivery_delayed: 'deliveryDelayedAt',
    sent: 'sentAt',
  }[status];
  return { eventType, status, resendEmailId, eventAt, timestampField };
}

export function resendEventIsNewer(lastEventAt, incomingEventAt) {
  if (!lastEventAt) return true;
  return new Date(incomingEventAt).getTime() >= new Date(lastEventAt).getTime();
}

