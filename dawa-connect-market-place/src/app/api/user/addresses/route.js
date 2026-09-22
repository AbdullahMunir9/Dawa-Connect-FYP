import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
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

export async function GET(req) {
  try {
    const userId = await getUserIdFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const user = await User.findById(userId).select("addresses");
    return NextResponse.json({ addresses: user?.addresses || [] }, { status: 200 });
  } catch (error) {
    console.error("Fetch addresses error:", error);
    return NextResponse.json({ message: "An error occurred" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const userId = await getUserIdFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const required = ["label", "fullName", "phone", "line1", "city"];
    for (const field of required) {
      if (!body[field]) return NextResponse.json({ message: `${field} is required` }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (!Array.isArray(user.addresses)) user.addresses = [];

    const shouldBeDefault = body.isDefault || user.addresses.length === 0;
    if (shouldBeDefault) {
      user.addresses.forEach((address) => {
        address.isDefault = false;
      });
    }

    user.addresses.push({
      label: body.label,
      fullName: body.fullName,
      phone: body.phone,
      line1: body.line1,
      line2: body.line2 || "",
      city: body.city,
      province: body.province || "",
      postalCode: body.postalCode || "",
      isDefault: shouldBeDefault,
    });

    await user.save();
    return NextResponse.json({ addresses: user.addresses }, { status: 201 });
  } catch (error) {
    console.error("Create address error:", error);
    return NextResponse.json({ message: "An error occurred" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const userId = await getUserIdFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { addressId, action } = await req.json();
    if (!addressId || action !== "set-default") {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (!Array.isArray(user.addresses)) user.addresses = [];

    user.addresses.forEach((address) => {
      address.isDefault = String(address._id) === String(addressId);
    });
    await user.save();

    return NextResponse.json({ addresses: user.addresses }, { status: 200 });
  } catch (error) {
    console.error("Update address error:", error);
    return NextResponse.json({ message: "An error occurred" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const userId = await getUserIdFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const addressId = searchParams.get("id");
    if (!addressId) return NextResponse.json({ message: "Address id is required" }, { status: 400 });

    await connectToDatabase();
    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (!Array.isArray(user.addresses)) user.addresses = [];

    const removedAddress = user.addresses.find((address) => String(address._id) === String(addressId));
    user.addresses = user.addresses.filter((address) => String(address._id) !== String(addressId));

    if (removedAddress?.isDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    return NextResponse.json({ addresses: user.addresses }, { status: 200 });
  } catch (error) {
    console.error("Delete address error:", error);
    return NextResponse.json({ message: "An error occurred" }, { status: 500 });
  }
}
