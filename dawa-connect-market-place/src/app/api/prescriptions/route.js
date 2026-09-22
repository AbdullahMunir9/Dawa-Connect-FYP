import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import connectToDatabase from "@/lib/mongodb";
import Prescription from "@/models/Prescription";
import { promises as fs } from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET;
const key = new TextEncoder().encode(JWT_SECRET);

async function getUserFromReq(req) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload.userId;
  } catch (error) {
    return null;
  }
}

export async function GET(req) {
  try {
    const userId = await getUserFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    const prescriptions = await Prescription.find({ userId }).sort({ createdAt: -1 });

    return NextResponse.json({ prescriptions }, { status: 200 });
  } catch (error) {
    console.error("Fetch prescriptions error:", error);
    return NextResponse.json({ message: "An error occurred" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const userId = await getUserFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file");
    const title = formData.get("title");
    const notes = formData.get("notes") || "";

    if (!file || !title) {
      return NextResponse.json({ message: "Title and file are required" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save file locally to public/uploads
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    
    // Ensure directory exists
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `${uniqueSuffix}-${file.name.replace(/\s+/g, '_')}`;
    const filePath = path.join(uploadDir, fileName);

    await fs.writeFile(filePath, buffer);
    const fileUrl = `/uploads/${fileName}`;

    await connectToDatabase();

    const newPrescription = new Prescription({
      userId,
      title,
      fileName: file.name,
      fileUrl,
      notes,
      status: "Pending"
    });

    await newPrescription.save();

    return NextResponse.json({ message: "Prescription uploaded successfully", prescription: newPrescription }, { status: 201 });
  } catch (error) {
    console.error("Upload prescription error:", error);
    return NextResponse.json({ message: "An error occurred" }, { status: 500 });
  }
}
