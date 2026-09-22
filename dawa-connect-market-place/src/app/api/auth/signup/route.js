import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "@/lib/mongodb";
import User from "@/models/User";

const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export async function POST(req) {
  try {
    const { name, email, password, phone, city } = await req.json();

    if (!name || !email || !password || !phone || !city) {
      return NextResponse.json({ message: "Please fill in all fields" }, { status: 400 });
    }

    if (!STRONG_PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        {
          message:
            "Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character",
        },
        { status: 400 }
      );
    }

    const trimmedPhone = phone.trim();
    const trimmedCity = city.trim();
    if (!trimmedPhone || !trimmedCity) {
      return NextResponse.json({ message: "Phone number and city are required" }, { status: 400 });
    }

    await connectToDatabase();

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json({ message: "User already exists with this email" }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      status: "active",
      phone: trimmedPhone,
      city: trimmedCity,
    });

    await newUser.save();
    // Ensures status exists even during dev hot-reload schema cache edge cases.
    await User.collection.updateOne(
      { _id: newUser._id, status: { $exists: false } },
      { $set: { status: "active" } }
    );

    return NextResponse.json({ message: "User registered successfully" }, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ message: "An error occurred during registration" }, { status: 500 });
  }
}
