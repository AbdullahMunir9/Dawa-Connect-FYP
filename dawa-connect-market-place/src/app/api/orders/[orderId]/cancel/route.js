import { createHash } from "crypto";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { cancelPendingCommerceOrder, CommerceError } from "@/lib/commerce";

const key = process.env.JWT_SECRET
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;

async function authenticatedUserId(req) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload.userId || null;
  } catch {
    return null;
  }
}

function guestSessionHash(req) {
  const token = req.cookies.get("guest_order_token")?.value;
  return token ? createHash("sha256").update(token).digest("hex") : null;
}

export async function POST(req, context) {
  try {
    const { orderId } = await context.params;
    const userId = await authenticatedUserId(req);
    let body = {};
    try {
      body = await req.json();
    } catch {
      // A cancellation reason is optional, so an empty request body is valid.
    }

    const order = await cancelPendingCommerceOrder({
      userId,
      guestSessionHash: guestSessionHash(req),
      orderId,
      reason: body?.reason,
    });
    return NextResponse.json(
      { message: "Order cancelled. The reserved stock has been returned to the pharmacy inventory.", order },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof CommerceError ? error.status : 500;
    console.error("Cancel marketplace order error:", error);
    return NextResponse.json({
      message: error instanceof CommerceError ? error.message : "The order could not be cancelled",
      code: error instanceof CommerceError ? error.code : "CANCELLATION_FAILED",
    }, { status });
  }
}
