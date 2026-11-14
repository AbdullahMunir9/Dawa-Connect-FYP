import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { signPharmacyChatToken, verifyChatToken } from './chatAuth.js';

const TEST_SECRET = 'test-only-chat-secret-that-is-longer-than-thirty-two-characters';

test.before(() => {
  process.env.CHAT_TOKEN_SECRET = TEST_SECRET;
});

test('accepts a pharmacy token issued by the shared chat service', () => {
  const token = signPharmacyChatToken('pharmacy-123');
  assert.deepEqual(verifyChatToken(token), {
    sub: 'pharmacy-123', role: 'pharmacy', orderId: '', issuer: 'dawaconnect-chat-service',
  });
});

test('accepts an order-scoped customer capability from the marketplace issuer', () => {
  const token = jwt.sign(
    { role: 'customer', orderId: 'DC-1000' },
    TEST_SECRET,
    { algorithm: 'HS256', audience: 'dawaconnect-chat', issuer: 'dawaconnect-marketplace', subject: 'customer-1', expiresIn: '15m' },
  );
  assert.deepEqual(verifyChatToken(token), {
    sub: 'customer-1', role: 'customer', orderId: 'DC-1000', issuer: 'dawaconnect-marketplace',
  });
});

test('accepts an order-scoped guest token from the marketplace issuer', () => {
  const token = jwt.sign(
    { role: 'guest', orderId: 'DC-1001' },
    TEST_SECRET,
    { algorithm: 'HS256', audience: 'dawaconnect-chat', issuer: 'dawaconnect-marketplace', subject: 'guest:order-object-id', expiresIn: '15m' },
  );
  assert.deepEqual(verifyChatToken(token), {
    sub: 'guest:order-object-id', role: 'guest', orderId: 'DC-1001', issuer: 'dawaconnect-marketplace',
  });
});

test('rejects tokens with the wrong audience, issuer-role pair, or missing order scope', () => {
  const wrongAudience = jwt.sign(
    { role: 'customer' },
    TEST_SECRET,
    { audience: 'another-service', issuer: 'dawaconnect-marketplace', subject: 'customer-1' },
  );
  assert.throws(() => verifyChatToken(wrongAudience));

  const unscopedGuest = jwt.sign(
    { role: 'guest' },
    TEST_SECRET,
    { audience: 'dawaconnect-chat', issuer: 'dawaconnect-marketplace', subject: 'guest:1' },
  );
  assert.throws(() => verifyChatToken(unscopedGuest));

  const unscopedCustomer = jwt.sign(
    { role: 'customer' },
    TEST_SECRET,
    { audience: 'dawaconnect-chat', issuer: 'dawaconnect-marketplace', subject: 'customer-1' },
  );
  assert.throws(() => verifyChatToken(unscopedCustomer));

  const marketplacePharmacy = jwt.sign(
    { role: 'pharmacy', orderId: 'DC-1001' },
    TEST_SECRET,
    { audience: 'dawaconnect-chat', issuer: 'dawaconnect-marketplace', subject: 'pharmacy-1' },
  );
  assert.throws(() => verifyChatToken(marketplacePharmacy));
});
