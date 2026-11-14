import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveOrderChatDetails,
  GUEST_CHAT_RETENTION_DAYS,
  identityCanAccessConversation,
  isGuestChatExpired,
  isChatWritableStatus,
  normalizeChatText,
  resolveGuestChatExpiresAt,
} from './chatPolicy.js';

test('derives a single pharmacy from new and compatible order records', () => {
  assert.deepEqual(
    deriveOrderChatDetails({ pharmacyId: 'p1', pharmacyName: 'One', pharmacyOrderId: 'DC-1-01', status: 'Processing' }),
    { pharmacyId: 'p1', pharmacyName: 'One', pharmacyOrderId: 'DC-1-01', orderStatus: 'Processing' },
  );
  assert.equal(deriveOrderChatDetails({ status: 'Confirmed', fulfillments: [{ pharmacyId: 'p2', pharmacyOrderId: 'DC-2-01' }] }).pharmacyId, 'p2');
});

test('guest chat retention ends fifteen days after the order was created', () => {
  const order = { createdAt: new Date('2026-11-01T10:00:00.000Z') };
  assert.equal(GUEST_CHAT_RETENTION_DAYS, 15);
  assert.equal(resolveGuestChatExpiresAt(order).toISOString(), '2026-11-16T10:00:00.000Z');
  assert.equal(isGuestChatExpired(order, new Date('2026-11-16T09:59:59.999Z')), false);
  assert.equal(isGuestChatExpired(order, new Date('2026-11-16T10:00:00.000Z')), true);
});

test('rejects legacy multi-pharmacy orders and terminal message states', () => {
  assert.throws(() => deriveOrderChatDetails({ fulfillments: [{ pharmacyId: 'p1' }, { pharmacyId: 'p2' }] }));
  assert.equal(isChatWritableStatus('Pending'), true);
  assert.equal(isChatWritableStatus('Delivered'), false);
  assert.equal(isChatWritableStatus('Cancelled'), false);
});

test('normalizes text and enforces participant isolation', () => {
  assert.equal(normalizeChatText('  hello\r\nthere  '), 'hello\nthere');
  assert.throws(() => normalizeChatText(''));
  const customerConversation = { pharmacyId: 'p1', customerId: 'c1', orderId: 'DC-1' };
  const guestConversation = { pharmacyId: 'p1', customerId: null, guestParticipantId: 'guest:legacy-object-id', orderId: 'DC-2' };
  assert.equal(identityCanAccessConversation({ role: 'pharmacy', sub: 'p1' }, customerConversation), true);
  assert.equal(identityCanAccessConversation({ role: 'pharmacy', sub: 'p2' }, customerConversation), false);
  assert.equal(identityCanAccessConversation({ role: 'customer', sub: 'c1', orderId: 'DC-1' }, customerConversation), true);
  assert.equal(identityCanAccessConversation({ role: 'customer', sub: 'another-subject', orderId: 'DC-1' }, customerConversation), true);
  assert.equal(identityCanAccessConversation({ role: 'customer', sub: 'c1', orderId: 'DC-2' }, customerConversation), false);
  assert.equal(identityCanAccessConversation({ role: 'guest', sub: 'guest:any-signed-subject', orderId: 'DC-2' }, guestConversation), true);
  assert.equal(identityCanAccessConversation({ role: 'guest', sub: 'guest:any-signed-subject', orderId: 'DC-3' }, guestConversation), false);
  assert.equal(identityCanAccessConversation({ role: 'guest', sub: 'guest:any-signed-subject', orderId: 'DC-1' }, customerConversation), false);
});
