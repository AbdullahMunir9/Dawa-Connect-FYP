import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Order from "@/models/Order";
import User from "@/models/User";
import {
  GUEST_ORDER_ACCESS_DAYS,
  isGuestAccessExpired,
  resolveGuestAccessExpiresAt,
} from "@/lib/guestOrderAccess.mjs";

const GUEST_ORDER_COOKIE = "guest_order_token";

function secretKey(value, name) {
  const secret = String(value || "");
  if (secret.length < 32) throw new Error(`${name} must be configured with at least 32 characters.`);
  return new TextEncoder().encode(secret);
}

function guestHash(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

async function marketplaceIdentities(req) {
  const jwtKey = secretKey(process.env.JWT_SECRET, "JWT_SECRET");
  const candidates = req.cookies.getAll?.("auth_token") || [];
  const tokens = candidates.length
    ? candidates.map((cookie) => cookie.value)
    : [req.cookies.get("auth_token")?.value].filter(Boolean);
  const identities = [];
  for (const token of new Set(tokens)) {
    try {
      const { payload } = await jwtVerify(token, jwtKey);
      if (payload.userId && mongoose.isValidObjectId(payload.userId)) {
        identities.push(String(payload.userId));
      }
    } catch {
      // A stale duplicate cookie must not override a current valid session.
    }
  }
  return [...new Set(identities)];
}

export async function POST(req) {
  try {
    const { orderId } = await req.json();
    const normalizedOrderId = String(orderId || "").trim().slice(0, 80);
    if (!normalizedOrderId) return NextResponse.json({ message: "Order ID is required." }, { status: 400 });

    const chatKey = secretKey(process.env.CHAT_TOKEN_SECRET, "CHAT_TOKEN_SECRET");
    const serviceUrl = String(process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || process.env.CHAT_SERVICE_URL || "").replace(/\/$/, "");
    if (!serviceUrl) return NextResponse.json({ message: "Live chat service is not configured." }, { status: 503 });

    await connectToDatabase();
    // `guestSessionHash` is the only field excluded by the schema. Using an
    // inclusive projection here would silently omit `userId` and make every
    // registered order look like a guest order.
    const order = await Order.findOne({ orderId: normalizedOrderId }).select("+guestSessionHash");
    if (!order) return NextResponse.json({ message: "Order not found." }, { status: 404 });
    const marketplaceUserIds = await marketplaceIdentities(req);
    const orderOwnerId = String(order.userId || "");
    const userId = marketplaceUserIds.find((candidate) => candidate === orderOwnerId) || null;

    let subject;
    let role;
    let guestHistoryExpiresAt = null;
    if (orderOwnerId) {
      if (!userId) {
        return NextResponse.json(
          {
            message: marketplaceUserIds.length
              ? "This order belongs to a different marketplace account."
              : "Your marketplace session could not be verified. Sign out and sign in again.",
            code: marketplaceUserIds.length ? "ORDER_ACCOUNT_MISMATCH" : "CHAT_SESSION_REQUIRED",
          },
          { status: 403 },
        );
      }
      const user = await User.findById(userId).select("status").lean();
      if (!user || String(user.status || "active").toLowerCase() === "suspended") {
        return NextResponse.json({ message: "This account cannot use live chat." }, { status: 403 });
      }
      subject = userId;
      role = "customer";
    } else {
      const guestToken = req.cookies.get(GUEST_ORDER_COOKIE)?.value;
      const matchesGuest = !order.userId
        && guestToken
        && order.guestSessionHash
        && guestHash(guestToken) === order.guestSessionHash;
      if (!matchesGuest) {
        return NextResponse.json(
          { message: "This browser cannot access this guest order chat.", code: "GUEST_ORDER_ACCESS_REQUIRED" },
          { status: 403 },
        );
      }
      if (isGuestAccessExpired(order)) {
        return NextResponse.json(
          { message: "This guest order chat expired after 15 days. Sign in before placing future orders to keep permanent chat history." },
          { status: 410 },
        );
      }
      // Use the public order reference as the stable guest subject. Access is
      // still protected by the HttpOnly guest cookie above and the signed,
      // order-scoped JWT, without coupling two deployments to MongoDB's _id.
      subject = `guest:${String(order.orderId)}`;
      role = "guest";
      guestHistoryExpiresAt = resolveGuestAccessExpiresAt(order).toISOString();
    }

    const chatToken = await new SignJWT({ role, orderId: String(order.orderId), tokenVersion: 2 })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(subject)
      .setAudience("dawaconnect-chat")
      .setIssuer("dawaconnect-marketplace")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(chatKey);

    return NextResponse.json(
      {
        token: chatToken,
        serviceUrl,
        expiresInSeconds: 900,
        role,
        guestHistoryExpiresAt,
        guestHistoryRetentionDays: role === "guest" ? GUEST_ORDER_ACCESS_DAYS : null,
        accessVersion: "order-capability-v2",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Create chat token error:", error);
    const configurationError = /must be configured/.test(error?.message || "");
    return NextResponse.json(
      { message: configurationError ? error.message : "Live chat could not be started." },
      { status: configurationError ? 503 : 500 },
    );
  }
}
