import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import { getCatalogProductById } from "@/lib/pharmacyCatalog";
import SavedItem from "@/models/SavedItem";

const JWT_SECRET = process.env.JWT_SECRET;
const key = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;

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

export async function GET(req) {
  try {
    const userId = await getUserFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    await connectToDatabase();
    const records = await SavedItem.find({ userId, productId: { $exists: true, $ne: "" } }).sort({ createdAt: -1 }).lean();
    const resolved = await Promise.all(records.map(async (record) => {
      const product = await getCatalogProductById(record.productId);
      return product ? { ...product, _id: String(record._id), savedAt: record.createdAt } : null;
    }));
    return NextResponse.json({ savedItems: resolved.filter(Boolean) }, { status: 200 });
  } catch (error) {
    console.error("Fetch saved items error:", error);
    return NextResponse.json({ message: "Unable to load saved items" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const userId = await getUserFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const { productId } = await req.json();
    const product = await getCatalogProductById(productId);
    if (!product) return NextResponse.json({ message: "Product is unavailable" }, { status: 404 });
    await connectToDatabase();
    const savedItem = await SavedItem.findOneAndUpdate(
      { userId, productId: product.id, pharmacyId: product.pharmacyId },
      {
        $set: {
          name: product.name,
          price: product.price,
          category: product.category,
        },
        $setOnInsert: { userId, productId: product.id, pharmacyId: product.pharmacyId },
      },
      { upsert: true, new: true },
    );
    return NextResponse.json({ message: "Item saved", savedItem }, { status: 201 });
  } catch (error) {
    console.error("Save item error:", error);
    return NextResponse.json({ message: "Unable to save item" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const userId = await getUserFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const id = new URL(req.url).searchParams.get("id");
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ message: "Invalid saved item" }, { status: 400 });
    await connectToDatabase();
    await SavedItem.deleteOne({ _id: id, userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete saved item error:", error);
    return NextResponse.json({ message: "Unable to remove saved item" }, { status: 500 });
  }
}
