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

function normalizeLocation(value) {
  const hasLatitude = value?.latitude !== undefined && value?.latitude !== null && value?.latitude !== "";
  const hasLongitude = value?.longitude !== undefined && value?.longitude !== null && value?.longitude !== "";
  if (!hasLatitude || !hasLongitude) return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
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
    const location = normalizeLocation(body);
    if (!location) return NextResponse.json({
      message: "Search and select a delivery point for this address",
    }, { status: 400 });

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
      area: String(body.area || "").trim().slice(0, 100),
      city: body.city,
      province: body.province || "",
      postalCode: body.postalCode || "",
      latitude: location.latitude,
      longitude: location.longitude,
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

    const { addressId, action, location: suppliedLocation } = await req.json();
    if (!addressId || !["set-default", "set-location"].includes(action)) {
      return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (!Array.isArray(user.addresses)) user.addresses = [];

    const selectedAddress = user.addresses.find((address) => String(address._id) === String(addressId));
    if (!selectedAddress) return NextResponse.json({ message: "Address not found" }, { status: 404 });

    if (action === "set-default") {
      user.addresses.forEach((address) => {
        address.isDefault = String(address._id) === String(addressId);
      });
    } else {
      const location = normalizeLocation(suppliedLocation);
      if (!location) return NextResponse.json({ message: "Choose a valid delivery point" }, { status: 400 });
      selectedAddress.latitude = location.latitude;
      selectedAddress.longitude = location.longitude;
      selectedAddress.area = String(suppliedLocation?.area || selectedAddress.area || "").trim().slice(0, 100);
      selectedAddress.city = String(suppliedLocation?.city || selectedAddress.city || "").trim().slice(0, 100);
      selectedAddress.province = String(suppliedLocation?.province || selectedAddress.province || "").trim().slice(0, 100);
      selectedAddress.postalCode = String(suppliedLocation?.postalCode || selectedAddress.postalCode || "").trim().slice(0, 30);
    }
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
