import test from "node:test";
import assert from "node:assert/strict";
import {
  GUEST_ORDER_ACCESS_DAYS,
  calculateGuestAccessExpiresAt,
  isGuestAccessExpired,
  resolveGuestAccessExpiresAt,
} from "./guestOrderAccess.mjs";

test("guest order access expires fifteen days after order creation", () => {
  const createdAt = new Date("2026-11-01T10:00:00.000Z");
  assert.equal(GUEST_ORDER_ACCESS_DAYS, 15);
  assert.equal(calculateGuestAccessExpiresAt(createdAt).toISOString(), "2026-11-16T10:00:00.000Z");
  assert.equal(resolveGuestAccessExpiresAt({ createdAt }).toISOString(), "2026-11-16T10:00:00.000Z");
  assert.equal(isGuestAccessExpired({ createdAt }, "2026-11-16T09:59:59.999Z"), false);
  assert.equal(isGuestAccessExpired({ createdAt }, "2026-11-16T10:00:00.000Z"), true);
});

test("an explicit stored expiry takes precedence for new orders", () => {
  const order = {
    createdAt: "2026-11-01T10:00:00.000Z",
    guestAccessExpiresAt: "2026-11-20T10:00:00.000Z",
  };
  assert.equal(resolveGuestAccessExpiresAt(order).toISOString(), "2026-11-20T10:00:00.000Z");
});
