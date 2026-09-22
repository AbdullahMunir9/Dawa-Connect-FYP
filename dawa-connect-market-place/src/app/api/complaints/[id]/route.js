import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import { getCommerceDatabases } from "@/lib/pharmacyCatalog";
import Complaint from "@/models/Complaint";
import User from "@/models/User";

const JWT_SECRET = process.env.JWT_SECRET;
const key = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;

async function getUserFromReq(req) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload.userId;
  } catch {
    return null;
  }
}

async function findOwnComplaint(id, userId) {
  const owner = { "reporter.id": String(userId), source: "customer" };
  if (mongoose.isValidObjectId(id)) {
    const byId = await Complaint.findOne({ _id: id, ...owner });
    if (byId) return byId;
  }
  return Complaint.findOne({ complaintId: id, ...owner });
}

export async function GET(req, { params }) {
  try {
    const userId = await getUserFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    await connectToDatabase();
    const { id } = await params;
    const complaint = await findOwnComplaint(id, userId);
    if (!complaint) return NextResponse.json({ message: "Complaint not found" }, { status: 404 });
    return NextResponse.json({ complaint });
  } catch (error) {
    console.error("Get complaint error:", error);
    return NextResponse.json({ message: "Could not load this complaint." }, { status: 500 });
  }
}

// Customer reply. Replying to a closed complaint reopens it.
export async function POST(req, { params }) {
  try {
    const userId = await getUserFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    await connectToDatabase();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const text = String(body.text ?? "").trim().slice(0, 2000);
    if (text.length < 1) return NextResponse.json({ message: "Write a message first." }, { status: 400 });

    const [complaint, user] = await Promise.all([findOwnComplaint(id, userId), User.findById(userId).select("name email").lean()]);
    if (!complaint || !user) return NextResponse.json({ message: "Complaint not found" }, { status: 404 });

    const now = new Date();
    const reopened = ["resolved", "dismissed"].includes(complaint.status);
    complaint.messages.push({ by: { id: String(user._id), name: user.name, email: user.email, role: "customer" }, text, at: now });
    if (reopened) { complaint.status = "open"; complaint.resolution = null; }
    complaint.lastActivityAt = now;
    await complaint.save();

    if (complaint.target === "pharmacy" && complaint.pharmacyId) {
      try {
        const { pharmacyDb } = await getCommerceDatabases();
        await pharmacyDb.collection("notifications").insertOne({
          ownerId: complaint.pharmacyId, type: "complaint", complaintId: complaint.complaintId,
          message: `${user.name} ${reopened ? "reopened" : "replied to"} complaint ${complaint.complaintId}`,
          read: false, color: "#f59e0b", createdAt: now, updatedAt: now,
        });
      } catch (error) {
        console.error("Complaint notification failed:", error.message);
      }
    }
    return NextResponse.json({ complaint });
  } catch (error) {
    console.error("Reply complaint error:", error);
    return NextResponse.json({ message: "Could not send your reply." }, { status: 500 });
  }
}
