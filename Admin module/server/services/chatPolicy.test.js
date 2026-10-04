import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveOrderChatDetails,
  identityCanAccessConversation,
  isChatWritableStatus,
  normalizeChatText,
} from './chatPolicy.js';

test('derives a single pharmacy from new and compatible order records', () => {
  assert.deepEqual(
    deriveOrderChatDetails({ pharmacyId: 'p1', pharmacyName: 'One', pharmacyOrderId: 'DC-1-01', status: 'Processing' }),
    { pharmacyId: 'p1', pharmacyName: 'One', pharmacyOrderId: 'DC-1-01', orderStatus: 'Processing' },
  );
  assert.equal(deriveOrderChatDetails({ status: 'Confirmed', fulfillments: [{ pharmacyId: 'p2', pharmacyOrderId: 'DC-2-01' }] }).pharmacyId, 'p2');
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
  const conversation = { pharmacyId: 'p1', customerId: 'c1', guestParticipantId: 'guest:o1', orderId: 'DC-1' };
  assert.equal(identityCanAccessConversation({ role: 'pharmacy', sub: 'p1' }, conversation), true);
  assert.equal(identityCanAccessConversation({ role: 'pharmacy', sub: 'p2' }, conversation), false);
  assert.equal(identityCanAccessConversation({ role: 'customer', sub: 'c1' }, conversation), true);
  assert.equal(identityCanAccessConversation({ role: 'guest', sub: 'guest:o1', orderId: 'DC-1' }, conversation), true);
});
