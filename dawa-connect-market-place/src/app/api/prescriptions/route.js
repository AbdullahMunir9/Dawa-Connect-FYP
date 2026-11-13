import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import crypto from "node:crypto";
import connectToDatabase from "@/lib/mongodb";
import Prescription from "@/models/Prescription";
import { MAX_PRESCRIPTIONS, validatePrescriptionFile } from "@/lib/prescriptionFiles.mjs";
import { destroyPrescription, uploadPrescription } from "@/lib/prescriptionCloudinary";

const key = process.env.JWT_SECRET ? new TextEncoder().encode(process.env.JWT_SECRET) : null;
async function getUserFromReq(req) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token || !key) return null;
  try { return (await jwtVerify(token, key)).payload.userId || null; } catch { return null; }
}

function publicPrescription(record) {
  const id = String(record._id);
  return { _id: id, title: record.title, fileName: record.fileName, mimeType: record.mimeType || "application/octet-stream", bytes: record.bytes || null, available: Boolean(record.cloudinaryPublicId), createdAt: record.createdAt, updatedAt: record.updatedAt, viewUrl: `/api/prescriptions/${id}/file`, previewUrl: `/api/prescriptions/${id}/file?preview=1` };
}

export async function GET(req) {
  try {
    const userId = await getUserFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    await connectToDatabase();
    const records = await Prescription.find({ userId }).select("+cloudinaryPublicId").sort({ createdAt: -1 }).lean();
    return NextResponse.json({ prescriptions: records.map(publicPrescription), count: records.length, limit: MAX_PRESCRIPTIONS });
  } catch (error) {
    console.error("Fetch prescriptions error:", error);
    return NextResponse.json({ message: "Prescriptions could not be loaded." }, { status: 500 });
  }
}

export async function POST(req) {
  let uploadedPublicId = "";
  try {
    const userId = await getUserFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    await connectToDatabase();
    if (await Prescription.countDocuments({ userId }) >= MAX_PRESCRIPTIONS) return NextResponse.json({ message: `You can store a maximum of ${MAX_PRESCRIPTIONS} prescriptions. Delete one before adding another.` }, { status: 409 });
    const formData = await req.formData();
    const file = formData.get("file");
    const title = String(formData.get("title") || "").trim();
    if (title.length < 2 || title.length > 80) return NextResponse.json({ message: "Enter a title between 2 and 80 characters." }, { status: 400 });
    if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ message: "Choose a prescription file to upload." }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validatePrescriptionFile({ name: file.name, mimeType: file.type, buffer });
    if (!validation.ok) return NextResponse.json({ message: validation.message }, { status: 400 });
    const uploaded = await uploadPrescription({ buffer, mimeType: file.type, publicId: `dawaconnect/prescriptions/${userId}/${crypto.randomUUID()}` });
    uploadedPublicId = uploaded.publicId;
    const record = await Prescription.create({ userId, title, fileName: file.name, mimeType: file.type, format: uploaded.format, bytes: uploaded.bytes || buffer.length, cloudinaryPublicId: uploaded.publicId, cloudinaryAssetId: uploaded.assetId, cloudinarySecureUrl: uploaded.secureUrl, cloudinaryPreviewUrl: uploaded.previewUrl, resourceType: uploaded.resourceType, deliveryType: uploaded.deliveryType });
    uploadedPublicId = "";
    return NextResponse.json({ message: "Prescription uploaded successfully", prescription: publicPrescription(record) }, { status: 201 });
  } catch (error) {
    if (uploadedPublicId) await destroyPrescription(uploadedPublicId).catch((cleanupError) => console.error("Prescription cleanup error:", cleanupError));
    console.error("Upload prescription error:", error);
    return NextResponse.json({ message: error.message || "Prescription upload failed." }, { status: error.status || 500 });
  }
}
