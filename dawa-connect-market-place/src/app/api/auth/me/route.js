import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/mongodb";
import { marketplaceUserView } from "@/lib/authSession";
import User from "@/models/User";

const JWT_SECRET = process.env.JWT_SECRET;
const key = new TextEncoder().encode(JWT_SECRET);

export async function GET(req) {
  try {
    const token = req.cookies.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, key);
    await connectToDatabase();
    const userDoc = await User.findById(payload.userId).select(
      "name email status phone city picture emailVerifiedAt addresses"
    );
    if (!userDoc) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    if (!userDoc.status) {
      userDoc.status = "active";
      await userDoc.save();
    }

    const normalizedStatus = String(userDoc.status || "active").toLowerCase();
    if (normalizedStatus === "suspended") {
      const response = NextResponse.json(
        { message: "Your account is suspended. Please contact support." },
        { status: 403 }
      );
      response.cookies.set({
        name: "auth_token",
        value: "",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
      return response;
    }

    return NextResponse.json({ user: marketplaceUserView(userDoc) }, { status: 200 });

  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
}
