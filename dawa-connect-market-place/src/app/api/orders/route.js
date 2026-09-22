import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createHash, randomBytes } from "crypto";
import connectToDatabase from "@/lib/mongodb";
import { CommerceError, createCommerceOrder } from "@/lib/commerce";
import Order from "@/models/Order";

const JWT_SECRET = process.env.JWT_SECRET;
const key = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;
const GUEST_ORDER_COOKIE = "guest_order_token";

async function getUserFromReq(req) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload.userId;
  } catch {
    return null;
  }
}

function hashGuestToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET(req) {
  try {
    const userId = await getUserFromReq(req);
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");
    if (orderId) {
      const guestToken = req.cookies.get(GUEST_ORDER_COOKIE)?.value;
      const permittedOwners = [];
      if (userId) permittedOwners.push({ userId });
      if (guestToken) permittedOwners.push({ guestSessionHash: hashGuestToken(guestToken) });
      if (!permittedOwners.length) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }
      const ownerFilter = permittedOwners.length === 1
        ? permittedOwners[0]
        : { $or: permittedOwners };

      const order = await Order.findOne({ ...ownerFilter, orderId });
      if (!order) return NextResponse.json({ message: "Order not found" }, { status: 404 });
      return NextResponse.json({ order }, { status: 200 });
    }

    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    return NextResponse.json({ orders }, { status: 200 });
  } catch (error) {
    console.error("Fetch orders error:", error);
    return NextResponse.json({ message: "Unable to load orders" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const userId = await getUserFromReq(req);
    let body;
    try {
      body = await req.json();
    } catch {
      throw new CommerceError("Invalid checkout request", 400, "INVALID_REQUEST");
    }
    const existingGuestToken = req.cookies.get(GUEST_ORDER_COOKIE)?.value;
    const guestToken = userId
      ? null
      : existingGuestToken || randomBytes(32).toString("hex");
    const order = await createCommerceOrder({
      userId,
      guestSessionHash: guestToken ? hashGuestToken(guestToken) : null,
      items: body.items,
      addressId: body.addressId,
      deliveryAddress: body.deliveryAddress,
      saveAddress: Boolean(body.saveAddress),
      paymentMethod: body.paymentMethod,
    });
    const response = NextResponse.json(
      { message: "Order placed and sent to the pharmacy", order },
      { status: 201 }
    );
    if (guestToken) {
      response.cookies.set({
        name: GUEST_ORDER_COOKIE,
        value: guestToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }
    return response;
  } catch (error) {
    console.error("Create order error:", error);
    const status = error instanceof CommerceError ? error.status : 500;
    return NextResponse.json({
      message: error instanceof CommerceError ? error.message : "The order could not be completed",
      code: error instanceof CommerceError ? error.code : "ORDER_FAILED",
    }, { status });
  }
}
