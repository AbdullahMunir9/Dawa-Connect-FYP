export const REVIEW_COMMENT_MAX_LENGTH = 1000;

export class ReviewValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ReviewValidationError";
    this.code = code;
  }
}

export function isDeliveredOrder(order) {
  return String(order?.status || "").trim().toLowerCase() === "delivered";
}

export function reviewTargetFromOrder(order) {
  const fulfillment = (order?.fulfillments || []).find((entry) => (
    String(entry?.status || "").trim().toLowerCase() === "delivered"
  )) || order?.fulfillments?.[0];

  const pharmacyId = String(order?.pharmacyId || fulfillment?.pharmacyId || "").trim();
  const pharmacyName = String(order?.pharmacyName || fulfillment?.pharmacyName || "Registered Pharmacy").trim();
  const pharmacyOrderId = String(order?.pharmacyOrderId || fulfillment?.pharmacyOrderId || "").trim();

  if (!pharmacyId) {
    throw new ReviewValidationError("This order is not connected to a pharmacy.", "PHARMACY_NOT_FOUND");
  }

  return { pharmacyId, pharmacyName, pharmacyOrderId };
}

export function normalizeReviewInput(value = {}) {
  const rating = Number(value.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewValidationError("Choose a rating from 1 to 5 stars.", "INVALID_RATING");
  }

  const comment = typeof value.comment === "string" ? value.comment.trim() : "";
  if (comment.length > REVIEW_COMMENT_MAX_LENGTH) {
    throw new ReviewValidationError(
      `Your review must be ${REVIEW_COMMENT_MAX_LENGTH} characters or fewer.`,
      "COMMENT_TOO_LONG",
    );
  }

  return { rating, comment };
}

export function marketplaceReviewKey(orderId, pharmacyId) {
  const safeOrderId = String(orderId || "").trim();
  const safePharmacyId = String(pharmacyId || "").trim();
  if (!safeOrderId || !safePharmacyId) {
    throw new ReviewValidationError("Order and pharmacy details are required.", "INVALID_REVIEW_KEY");
  }
  return `marketplace:${safeOrderId}:${safePharmacyId}`;
}

export function buildReviewOrderAccessFilter(identity = {}, { now = new Date(), guestAccessMs } = {}) {
  const identities = [];
  if (identity.userId) identities.push({ userId: String(identity.userId) });
  if (identity.guestSessionHash) {
    const currentTime = now instanceof Date ? now : new Date(now);
    const accessWindow = Number(guestAccessMs);
    if (!Number.isFinite(currentTime.getTime()) || !Number.isFinite(accessWindow) || accessWindow <= 0) {
      throw new ReviewValidationError("Guest review access could not be validated.", "INVALID_ACCESS_WINDOW");
    }
    const legacyCutoff = new Date(currentTime.getTime() - accessWindow);
    identities.push({
      guestSessionHash: String(identity.guestSessionHash),
      $or: [
        { guestAccessExpiresAt: { $gt: currentTime } },
        { guestAccessExpiresAt: { $exists: false }, createdAt: { $gt: legacyCutoff } },
        { guestAccessExpiresAt: null, createdAt: { $gt: legacyCutoff } },
      ],
    });
  }
  if (!identities.length) return null;
  return identities.length === 1 ? identities[0] : { $or: identities };
}
