import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import Prescription from "@/models/Prescription";
import { destroyPrescription } from "@/lib/prescriptionCloudinary";

const key = process.env.JWT_SECRET ? new TextEncoder().encode(process.env.JWT_SECRET) : null;
async function userId(req) { const token = req.cookies.get("auth_token")?.value; if (!token || !key) return null; try { return (await jwtVerify(token, key)).payload.userId || null; } catch { return null; } }

export async function DELETE(req, { params }) {
  try {
    const owner = await userId(req);
    if (!owner) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ message: "Invalid prescription" }, { status: 400 });
    await connectToDatabase();
    const record = await Prescription.findOne({ _id: id, userId: owner }).select("+cloudinaryPublicId");
    if (!record) return NextResponse.json({ message: "Prescription not found" }, { status: 404 });
    if (record.cloudinaryPublicId) await destroyPrescription(record.cloudinaryPublicId);
    await record.deleteOne();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete prescription error:", error);
    return NextResponse.json({ message: error.message || "Prescription could not be deleted." }, { status: 500 });
  }
}
