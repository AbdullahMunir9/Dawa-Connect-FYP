import { randomUUID } from 'node:crypto';

const MOVEMENT_TYPES = new Set([
  'opening_balance',
  'manual_adjustment',
  'order_reserved',
  'order_cancelled',
  'stock_received',
  'returned',
  'expired',
  'damaged',
  'product_deleted',
]);

const finiteNumber = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Inventory movement ${label} must be a number.`);
  return number;
};

export function buildInventoryMovement({
  ownerId,
  productId,
  productName,
  type,
  quantityChange,
  stockBefore,
  stockAfter,
  source = 'pharmacy',
  referenceId = '',
  reason = '',
  deduplicationKey = '',
  createdAt = new Date(),
} = {}) {
  const normalizedType = String(type || '').trim();
  if (!MOVEMENT_TYPES.has(normalizedType)) throw new Error('Unsupported inventory movement type.');
  const before = finiteNumber(stockBefore, 'stockBefore');
  const after = finiteNumber(stockAfter, 'stockAfter');
  const change = finiteNumber(quantityChange, 'quantityChange');
  if (Math.abs((before + change) - after) > 0.000001) {
    throw new Error('Inventory movement balance does not match its quantity change.');
  }
  return {
    movementId: randomUUID(),
    ownerId: String(ownerId || ''),
    productId: String(productId || ''),
    productName: String(productName || 'Unknown product').trim().slice(0, 200),
    type: normalizedType,
    quantityChange: change,
    stockBefore: before,
    stockAfter: after,
    source: String(source || 'pharmacy').trim().slice(0, 40),
    referenceId: String(referenceId || '').trim().slice(0, 200),
    reason: String(reason || '').trim().slice(0, 500),
    ...(deduplicationKey ? { deduplicationKey: String(deduplicationKey).slice(0, 300) } : {}),
    createdAt: createdAt instanceof Date ? createdAt : new Date(createdAt),
  };
}

export async function insertInventoryMovement(db, value, { session } = {}) {
  const movement = buildInventoryMovement(value);
  await db.collection('inventoryMovements').insertOne(movement, session ? { session } : undefined);
  return movement;
}
