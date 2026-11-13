import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import Prescription from "@/models/Prescription";

const key = process.env.JWT_SECRET ? new TextEncoder().encode(process.env.JWT_SECRET) : null;
async function userId(req) { const token = req.cookies.get("auth_token")?.value; if (!token || !key) return null; try { return (await jwtVerify(token, key)).payload.userId || null; } catch { return null; } }

export async function GET(req, { params }) {
  try {
    const owner = await userId(req);
    if (!owner) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ message: "Invalid prescription" }, { status: 400 });
    await connectToDatabase();
    const record = await Prescription.findOne({ _id: id, userId: owner }).select("+cloudinarySecureUrl +cloudinaryPreviewUrl").lean();
    if (!record) return NextResponse.json({ message: "Prescription not found" }, { status: 404 });
    const preview = new URL(req.url).searchParams.get("preview") === "1";
    const source = preview ? (record.cloudinaryPreviewUrl || record.cloudinarySecureUrl) : record.cloudinarySecureUrl;
    if (!source) return NextResponse.json({ message: "This legacy prescription file is no longer available. Upload it again to secure storage." }, { status: 410 });
    const upstream = await fetch(source, { cache: "no-store" });
    if (!upstream.ok) return NextResponse.json({ message: "Prescription file could not be retrieved." }, { status: 502 });
    const body = await upstream.arrayBuffer();
    const contentType = preview ? "image/jpeg" : (record.mimeType || upstream.headers.get("content-type") || "application/octet-stream");
    const safeName = String(record.fileName || "prescription").replace(/[^a-zA-Z0-9._-]/g, "_");
    return new NextResponse(body, { headers: { "Content-Type": contentType, "Content-Disposition": `inline; filename="${safeName}"`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("Read prescription file error:", error);
    return NextResponse.json({ message: "Prescription file could not be retrieved." }, { status: 500 });
  }
}
