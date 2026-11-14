import assert from "node:assert/strict";
import test from "node:test";
import {
  REVIEW_COMMENT_MAX_LENGTH,
  ReviewValidationError,
  buildReviewOrderAccessFilter,
  isDeliveredOrder,
  marketplaceReviewKey,
  normalizeReviewInput,
  reviewTargetFromOrder,
} from "./reviewPolicy.mjs";

test("only delivered orders are reviewable", () => {
  assert.equal(isDeliveredOrder({ status: "Delivered" }), true);
  assert.equal(isDeliveredOrder({ status: " delivered " }), true);
  assert.equal(isDeliveredOrder({ status: "Dispatched" }), false);
});

test("review target uses the order's single-pharmacy identity", () => {
  assert.deepEqual(reviewTargetFromOrder({
    pharmacyId: "pharmacy-1",
    pharmacyName: "Care Pharmacy",
    pharmacyOrderId: "PO-1",
  }), {
    pharmacyId: "pharmacy-1",
    pharmacyName: "Care Pharmacy",
    pharmacyOrderId: "PO-1",
  });
});

test("review target supports legacy fulfillment data", () => {
  assert.deepEqual(reviewTargetFromOrder({
    fulfillments: [{
      pharmacyId: "pharmacy-2",
      pharmacyName: "Health Pharmacy",
      pharmacyOrderId: "PO-2",
      status: "Delivered",
    }],
  }), {
    pharmacyId: "pharmacy-2",
    pharmacyName: "Health Pharmacy",
    pharmacyOrderId: "PO-2",
  });
});

test("review input accepts an integer rating and trims an optional comment", () => {
  assert.deepEqual(normalizeReviewInput({ rating: "5", comment: "  Excellent service  " }), {
    rating: 5,
    comment: "Excellent service",
  });
});

test("review input rejects invalid ratings and oversized comments", () => {
  for (const rating of [0, 6, 2.5, "bad", null]) {
    assert.throws(() => normalizeReviewInput({ rating }), ReviewValidationError);
  }
  assert.throws(
    () => normalizeReviewInput({ rating: 4, comment: "x".repeat(REVIEW_COMMENT_MAX_LENGTH + 1) }),
    /1000 characters or fewer/,
  );
});

test("review keys are stable per marketplace order and pharmacy", () => {
  assert.equal(
    marketplaceReviewKey("DC-123", "pharmacy-1"),
    "marketplace:DC-123:pharmacy-1",
  );
});

test("review access supports signed-in, guest, and combined browser identities", () => {
  assert.deepEqual(buildReviewOrderAccessFilter({ userId: "user-1" }, { guestAccessMs: 1000 }), {
    userId: "user-1",
  });

  const now = new Date("2026-11-14T12:00:00.000Z");
  const guest = buildReviewOrderAccessFilter(
    { guestSessionHash: "guest-hash" },
    { now, guestAccessMs: 15 * 24 * 60 * 60 * 1000 },
  );
  assert.equal(guest.guestSessionHash, "guest-hash");
  assert.deepEqual(guest.$or[0], { guestAccessExpiresAt: { $gt: now } });
  assert.equal(guest.$or[1].createdAt.$gt.toISOString(), "2026-10-30T12:00:00.000Z");

  const combined = buildReviewOrderAccessFilter(
    { userId: "user-1", guestSessionHash: "guest-hash" },
    { now, guestAccessMs: 1000 },
  );
  assert.equal(combined.$or.length, 2);
  assert.deepEqual(combined.$or[0], { userId: "user-1" });
  assert.equal(combined.$or[1].guestSessionHash, "guest-hash");
});
