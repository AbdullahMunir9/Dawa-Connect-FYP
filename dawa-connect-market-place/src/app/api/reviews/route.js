import { createHash } from "crypto";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import {
  ReviewValidationError,
  buildReviewOrderAccessFilter,
  isDeliveredOrder,
  marketplaceReviewKey,
  normalizeReviewInput,
  reviewTargetFromOrder,
} from "@/lib/reviewPolicy.mjs";
import { GUEST_ORDER_ACCESS_MS } from "@/lib/guestOrderAccess.mjs";
import Order from "@/models/Order";
import User from "@/models/User";

const GUEST_ORDER_COOKIE = "guest_order_token";
const PHARMACY_DB_NAME = process.env.PHARMACY_DB_NAME || "Pharmacy";
const jwtKey = process.env.JWT_SECRET
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;

function hashGuestToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function requestIdentity(request) {
  let userId = null;
  const authToken = request.cookies.get("auth_token")?.value;
  if (authToken && jwtKey) {
    try {
      const { payload } = await jwtVerify(authToken, jwtKey);
      userId = payload.userId ? String(payload.userId) : null;
    } catch {
      userId = null;
    }
  }

  const guestToken = request.cookies.get(GUEST_ORDER_COOKIE)?.value;
  return {
    userId,
    guestSessionHash: guestToken ? hashGuestToken(guestToken) : null,
  };
}

function accessibleOrderFilter(identity) {
  return buildReviewOrderAccessFilter(identity, { guestAccessMs: GUEST_ORDER_ACCESS_MS });
}

function publicReview(review) {
  if (!review) return null;
  return {
    id: String(review._id),
    orderId: review.orderId,
    pharmacyId: review.ownerId,
    pharmacyName: review.pharmacyName,
    pharmacyOrderId: review.pharmacyOrderId || "",
    rating: Number(review.rating),
    comment: review.comment || "",
    status: review.status || "Published",
    verifiedPurchase: review.verifiedPurchase === true,
    customer: review.customer || "Verified customer",
    date: review.date,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

async function reviewCollection() {
  const connection = await connectToDatabase();
  const collection = connection.connection.getClient().db(PHARMACY_DB_NAME).collection("reviews");

  if (!globalThis.dawaConnectReviewIndexes) {
    globalThis.dawaConnectReviewIndexes = Promise.all([
      collection.createIndex({ reviewKey: 1 }, { unique: true, sparse: true }),
      collection.createIndex({ ownerId: 1, date: -1 }),
      collection.createIndex({ orderId: 1, source: 1 }),
    ]).catch((error) => {
      globalThis.dawaConnectReviewIndexes = null;
      throw error;
    });
  }
  await globalThis.dawaConnectReviewIndexes;
  return collection;
}

async function accessibleOrder(request, orderId) {
  const identity = await requestIdentity(request);
  const ownership = accessibleOrderFilter(identity);
  if (!ownership) return { identity, order: null, unauthenticated: true };
  const order = await Order.findOne({ orderId, ...ownership }).lean();
  return { identity, order, unauthenticated: false };
}

async function reviewDocumentForOrder(order, reviewInput) {
  const now = new Date();
  const target = reviewTargetFromOrder(order);
  let customer = order.deliveryAddress?.fullName || "Verified customer";
  let customerUserId = "";
  let reviewerType = "guest";

  if (order.userId) {
    const user = await User.findById(order.userId).select("name").lean();
    customer = user?.name || customer;
    customerUserId = String(order.userId);
    reviewerType = "registered";
  }

  return {
    reviewKey: marketplaceReviewKey(order.orderId, target.pharmacyId),
    ownerId: target.pharmacyId,
    pharmacyId: target.pharmacyId,
    pharmacyName: target.pharmacyName,
    pharmacyOrderId: target.pharmacyOrderId,
    marketplaceOrderId: String(order._id),
    orderId: order.orderId,
    customerUserId,
    customer,
    reviewerType,
    rating: reviewInput.rating,
    comment: reviewInput.comment,
    source: "marketplace",
    status: "Published",
    verifiedPurchase: true,
    date: now.toISOString().slice(0, 10),
    createdAt: now,
    updatedAt: now,
  };
}

function errorResponse(error) {
  if (error instanceof ReviewValidationError) {
    return NextResponse.json({ message: error.message, code: error.code }, { status: 400 });
  }
  console.error("Marketplace review error:", error);
  return NextResponse.json({ message: "The review service is temporarily unavailable." }, { status: 500 });
}

async function readReviewRequest(request) {
  try {
    return await request.json();
  } catch {
    throw new ReviewValidationError("The review request is not valid JSON.", "INVALID_REQUEST");
  }
}

export async function GET(request) {
  try {
    const identity = await requestIdentity(request);
    const ownership = accessibleOrderFilter(identity);
    if (!ownership) return NextResponse.json({ reviews: [] });

    await connectToDatabase();
    const orderId = new URL(request.url).searchParams.get("orderId")?.trim();
    const orderFilter = orderId ? { orderId, ...ownership } : ownership;
    const orders = await Order.find(orderFilter).select("orderId pharmacyId fulfillments").lean();
    if (!orders.length) return NextResponse.json({ reviews: [] });

    const reviewKeys = orders.map((order) => {
      const target = reviewTargetFromOrder(order);
      return marketplaceReviewKey(order.orderId, target.pharmacyId);
    });
    const reviews = await (await reviewCollection())
      .find({ reviewKey: { $in: reviewKeys }, source: "marketplace" })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ reviews: reviews.map(publicReview) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const body = await readReviewRequest(request);
    const orderId = String(body?.orderId || "").trim();
    if (!orderId) {
      throw new ReviewValidationError("An order is required before leaving a review.", "ORDER_REQUIRED");
    }

    await connectToDatabase();
    const { order, unauthenticated } = await accessibleOrder(request, orderId);
    if (unauthenticated) {
      return NextResponse.json({ message: "Sign in or use the browser that placed this order." }, { status: 401 });
    }
    if (!order) {
      return NextResponse.json({ message: "This order was not found or is not available in this browser." }, { status: 404 });
    }
    if (!isDeliveredOrder(order)) {
      return NextResponse.json({ message: "You can review the pharmacy after this order is delivered." }, { status: 409 });
    }

    const input = normalizeReviewInput(body);
    const document = await reviewDocumentForOrder(order, input);
    const collection = await reviewCollection();
    const existing = await collection.findOne({ reviewKey: document.reviewKey });
    if (existing) {
      return NextResponse.json({
        message: "You have already reviewed this pharmacy order. You can edit your existing review.",
        review: publicReview(existing),
      }, { status: 409 });
    }

    try {
      const result = await collection.insertOne(document);
      return NextResponse.json({ review: publicReview({ ...document, _id: result.insertedId }) }, { status: 201 });
    } catch (error) {
      if (error?.code === 11000) {
        const duplicate = await collection.findOne({ reviewKey: document.reviewKey });
        return NextResponse.json({
          message: "You have already reviewed this pharmacy order. You can edit your existing review.",
          review: publicReview(duplicate),
        }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request) {
  try {
    const body = await readReviewRequest(request);
    const orderId = String(body?.orderId || "").trim();
    if (!orderId) {
      throw new ReviewValidationError("An order is required before editing a review.", "ORDER_REQUIRED");
    }

    await connectToDatabase();
    const { order, unauthenticated } = await accessibleOrder(request, orderId);
    if (unauthenticated) {
      return NextResponse.json({ message: "Sign in or use the browser that placed this order." }, { status: 401 });
    }
    if (!order) {
      return NextResponse.json({ message: "This order was not found or is not available in this browser." }, { status: 404 });
    }
    if (!isDeliveredOrder(order)) {
      return NextResponse.json({ message: "You can edit the review after this order is delivered." }, { status: 409 });
    }

    const input = normalizeReviewInput(body);
    const target = reviewTargetFromOrder(order);
    const reviewKey = marketplaceReviewKey(order.orderId, target.pharmacyId);
    const collection = await reviewCollection();
    const result = await collection.findOneAndUpdate(
      { reviewKey, source: "marketplace" },
      { $set: { ...input, status: "Published", updatedAt: new Date() } },
      { returnDocument: "after" },
    );

    if (!result) {
      return NextResponse.json({ message: "Review not found. Submit a review first." }, { status: 404 });
    }
    return NextResponse.json({ review: publicReview(result) });
  } catch (error) {
    return errorResponse(error);
  }
}
