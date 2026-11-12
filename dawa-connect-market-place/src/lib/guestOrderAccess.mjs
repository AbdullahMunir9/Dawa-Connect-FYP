export const GUEST_ORDER_ACCESS_DAYS = 15;
export const GUEST_ORDER_ACCESS_MS = GUEST_ORDER_ACCESS_DAYS * 24 * 60 * 60 * 1000;

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function calculateGuestAccessExpiresAt(baseDate = new Date()) {
  const base = validDate(baseDate);
  if (!base) throw new TypeError("A valid guest-order date is required.");
  return new Date(base.getTime() + GUEST_ORDER_ACCESS_MS);
}

export function resolveGuestAccessExpiresAt(order) {
  const explicit = validDate(order?.guestAccessExpiresAt);
  if (explicit) return explicit;
  return calculateGuestAccessExpiresAt(order?.createdAt);
}

export function isGuestAccessExpired(order, now = new Date()) {
  const current = validDate(now);
  if (!current) throw new TypeError("A valid current date is required.");
  return resolveGuestAccessExpiresAt(order).getTime() <= current.getTime();
}
