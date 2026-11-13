import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/mongodb";
import { marketplaceUserView } from "@/lib/authSession";
import User from "@/models/User";

async function authenticatedUserId(request) {
  const token = request.cookies.get("auth_token")?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload.userId || null;
  } catch {
    return null;
  }
}

export async function PATCH(request) {
  try {
    const userId = await authenticatedUserId(request);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (name.length < 2 || name.length > 60) {
      return NextResponse.json({ message: "Your full name must be between 2 and 60 characters." }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(userId);
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (String(user.status || "active").toLowerCase() === "suspended") {
      return NextResponse.json({ message: "Your account is suspended." }, { status: 403 });
    }

    user.name = name;
    await user.save();
    return NextResponse.json({ message: "Profile updated", user: marketplaceUserView(user) });
  } catch (error) {
    console.error("Update marketplace profile error:", error);
    return NextResponse.json({ message: "Your profile could not be updated." }, { status: 500 });
  }
}
