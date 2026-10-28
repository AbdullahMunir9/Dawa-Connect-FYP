import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInventoryMovement } from './inventoryMovement.js';

test('inventory movement requires a balanced before, change and after value', () => {
  const movement = buildInventoryMovement({
    ownerId: 'owner-1', productId: 'product-1', productName: 'Panadol',
    type: 'manual_adjustment', stockBefore: 10, quantityChange: 5, stockAfter: 15,
  });
  assert.equal(movement.ownerId, 'owner-1');
  assert.equal(movement.stockAfter, 15);
  assert.match(movement.movementId, /^[0-9a-f-]{36}$/);
  assert.throws(() => buildInventoryMovement({
    ownerId: 'owner-1', productId: 'product-1', type: 'manual_adjustment',
    stockBefore: 10, quantityChange: 2, stockAfter: 20,
  }), /does not match/);
});

test('inventory movement rejects unknown event types', () => {
  assert.throws(() => buildInventoryMovement({
    ownerId: 'owner-1', productId: 'product-1', type: 'mystery',
    stockBefore: 10, quantityChange: 0, stockAfter: 10,
  }), /Unsupported/);
});
