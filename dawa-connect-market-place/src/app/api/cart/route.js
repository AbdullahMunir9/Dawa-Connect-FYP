import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import User from "@/models/User";

const JWT_SECRET = process.env.JWT_SECRET;
const key = new TextEncoder().encode(JWT_SECRET);

async function getUserIdFromReq(req) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload.userId;
  } catch {
    return null;
  }
}

function sanitizeCartItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .filter((item) => item?.cartItemId)
    .map((item) => ({
      cartItemId: String(item.cartItemId),
      id: String(item.id || item.productId || ""),
      productId: String(item.productId || item.id || ""),
      name: String(item.name || ""),
      category: String(item.category || ""),
      image: String(item.image || ""),
      pharmacyId: String(item.pharmacyId || ""),
      pharmacyName: String(item.pharmacyName || ""),
      timing: String(item.timing || ""),
      deliveryCharge: Math.max(0, Number(item.deliveryCharge) || 0),
      taxRate: Math.max(0, Number(item.taxRate) || 0),
      deliveryType: String(item.deliveryType || ""),
      price: Number(item.price) || 0,
      quantity: Math.max(1, Number(item.quantity) || 1),
    }));
}

export async function GET(req) {
  try {
    const userId = await getUserIdFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.collection.findOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { projection: { cartItems: 1 } }
    );
    return NextResponse.json({ items: user?.cartItems || [] }, { status: 200 });
  } catch (error) {
    console.error("Fetch cart error:", error);
    return NextResponse.json({ message: "An error occurred" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const userId = await getUserIdFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const nextItems = sanitizeCartItems(body?.items);

    await connectToDatabase();
    const result = await User.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: { cartItems: nextItems } }
    );
    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ items: nextItems }, { status: 200 });
  } catch (error) {
    console.error("Update cart error:", error);
    return NextResponse.json({ message: "An error occurred" }, { status: 500 });
  }
}
