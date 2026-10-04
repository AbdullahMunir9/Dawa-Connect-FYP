import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Order from "@/models/Order";
import User from "@/models/User";

const GUEST_ORDER_COOKIE = "guest_order_token";

function secretKey(value, name) {
  const secret = String(value || "");
  if (secret.length < 32) throw new Error(`${name} must be configured with at least 32 characters.`);
  return new TextEncoder().encode(secret);
}

function guestHash(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

async function marketplaceIdentity(req) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(process.env.JWT_SECRET, "JWT_SECRET"));
    return payload.userId && mongoose.isValidObjectId(payload.userId) ? String(payload.userId) : null;
  } catch {
    return null;
  }
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
    const userId = await marketplaceIdentity(req);
    const order = await Order.findOne({ orderId: normalizedOrderId }).select("+guestSessionHash");
    if (!order) return NextResponse.json({ message: "Order not found." }, { status: 404 });

    let subject;
    let role;
    if (userId && String(order.userId || "") === userId) {
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
      if (!matchesGuest) return NextResponse.json({ message: "You cannot access this order chat." }, { status: 403 });
      subject = `guest:${String(order._id)}`;
      role = "guest";
    }

    const chatToken = await new SignJWT({ role, orderId: String(order.orderId) })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(subject)
      .setAudience("dawaconnect-chat")
      .setIssuer("dawaconnect-marketplace")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(chatKey);

    return NextResponse.json(
      { token: chatToken, serviceUrl, expiresInSeconds: 900 },
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
