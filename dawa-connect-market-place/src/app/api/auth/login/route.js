import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "@/lib/mongodb";
import { createMarketplaceToken, marketplaceUserView, setMarketplaceSession } from "@/lib/authSession";
import User from "@/models/User";

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Please provide email and password" }, { status: 400 });
    }

    await connectToDatabase();

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    if (!user.status) {
      user.status = "active";
      await user.save();
    }

    const normalizedStatus = String(user.status || "active").toLowerCase();
    if (normalizedStatus === "suspended") {
      return NextResponse.json(
        { message: "Your account is suspended. Please contact support." },
        { status: 403 }
      );
    }

    if (!user.password) {
      return NextResponse.json(
        { message: "This account uses Continue with Google. Sign in with Google below." },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const token = await createMarketplaceToken(user);

    const response = NextResponse.json({ 
      message: "Login successful",
      user: marketplaceUserView(user),
    }, { status: 200 });

    return setMarketplaceSession(response, token);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "An error occurred during login" }, { status: 500 });
  }
}
