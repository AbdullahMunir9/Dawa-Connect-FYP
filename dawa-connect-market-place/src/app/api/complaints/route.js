import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb";
import { getCommerceDatabases } from "@/lib/pharmacyCatalog";
import Complaint, { COMPLAINT_CATEGORIES, generateComplaintId } from "@/models/Complaint";
import Order from "@/models/Order";
import User from "@/models/User";

const JWT_SECRET = process.env.JWT_SECRET;
const key = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;
const DAILY_LIMIT = 10;

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

function text(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

// Pharmacies and orders this customer can reference when filing a complaint.
async function complaintOptions(userId) {
  const orders = await Order.find({ userId }).select("orderId status createdAt fulfillments").sort({ createdAt: -1 }).limit(50).lean();
  const pharmacies = new Map();
  for (const order of orders) {
    for (const f of order.fulfillments || []) {
      if (f.pharmacyId && !pharmacies.has(f.pharmacyId)) pharmacies.set(f.pharmacyId, { id: f.pharmacyId, name: f.pharmacyName || "Pharmacy" });
    }
  }
  return {
    orders: orders.map((o) => ({ orderId: o.orderId, status: o.status, createdAt: o.createdAt, pharmacies: (o.fulfillments || []).map((f) => ({ id: f.pharmacyId, name: f.pharmacyName })) })),
    pharmacies: [...pharmacies.values()],
  };
}

export async function GET(req) {
  try {
    const userId = await getUserFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    await connectToDatabase();
    const [complaints, options] = await Promise.all([
      Complaint.find({ "reporter.id": String(userId), source: "customer" }).sort({ lastActivityAt: -1 }).lean(),
      complaintOptions(userId),
    ]);
    return NextResponse.json({ complaints, ...options });
  } catch (error) {
    console.error("List complaints error:", error);
    return NextResponse.json({ message: "Could not load your complaints." }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const userId = await getUserFromReq(req);
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    await connectToDatabase();

    const user = await User.findById(userId).select("name email status").lean();
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (String(user.status || "active").toLowerCase() === "suspended") {
      return NextResponse.json({ message: "Your account is suspended." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const target = body.target === "pharmacy" ? "pharmacy" : body.target === "admin" ? "admin" : null;
    const category = COMPLAINT_CATEGORIES.includes(body.category) ? body.category : "other";
    const subject = text(body.subject, 120);
    const description = text(body.description, 2000);
    const orderId = text(body.orderId, 60);
    const pharmacyId = text(body.pharmacyId, 40);

    if (!target) return NextResponse.json({ message: "Choose who the complaint is for." }, { status: 400 });
    if (subject.length < 5) return NextResponse.json({ message: "Give your complaint a short subject (at least 5 characters)." }, { status: 400 });
    if (description.length < 20) return NextResponse.json({ message: "Describe the problem in at least 20 characters." }, { status: 400 });

    const recent = await Complaint.countDocuments({ "reporter.id": String(userId), createdAt: { $gte: new Date(Date.now() - 86400000) } });
    if (recent >= DAILY_LIMIT) return NextResponse.json({ message: "You have reached the daily complaint limit. Please try again tomorrow." }, { status: 429 });

    let pharmacyName = "";
    if (target === "pharmacy") {
      if (!mongoose.isValidObjectId(pharmacyId)) return NextResponse.json({ message: "Select the pharmacy this complaint is about." }, { status: 400 });
      const { pharmacyDb } = await getCommerceDatabases();
      const pharmacy = await pharmacyDb.collection("users").findOne({ _id: new mongoose.Types.ObjectId(pharmacyId) }, { projection: { pharmacyName: 1, name: 1 } });
      if (!pharmacy) return NextResponse.json({ message: "That pharmacy could not be found." }, { status: 404 });
      pharmacyName = pharmacy.pharmacyName || pharmacy.name || "Pharmacy";
    }

    if (orderId) {
      const order = await Order.findOne({ userId, orderId }).select("orderId fulfillments").lean();
      if (!order) return NextResponse.json({ message: "That order does not belong to your account." }, { status: 400 });
      if (target === "pharmacy" && !(order.fulfillments || []).some((f) => f.pharmacyId === pharmacyId)) {
        return NextResponse.json({ message: "That order was not fulfilled by the selected pharmacy." }, { status: 400 });
      }
    }

    const now = new Date();
    let complaint = null;
    for (let attempt = 0; attempt < 3 && !complaint; attempt += 1) {
      try {
        complaint = await Complaint.create({
          complaintId: generateComplaintId(), source: "customer", target,
          reporter: { id: String(user._id), name: user.name, email: user.email, role: "customer" },
          pharmacyId: target === "pharmacy" ? pharmacyId : null, pharmacyName, orderId, category, subject, description,
          priority: "medium", status: "open", messages: [], resolution: null, lastActivityAt: now,
        });
      } catch (error) {
        if (error?.code !== 11000) throw error; // retry only on a complaintId collision
      }
    }
    if (!complaint) throw new Error("Could not allocate a complaint id");

    if (target === "pharmacy") {
      // Tell the pharmacy inside its desktop app.
      try {
        const { pharmacyDb } = await getCommerceDatabases();
        await pharmacyDb.collection("notifications").insertOne({
          ownerId: pharmacyId, type: "complaint", message: `New complaint from ${user.name}: ${subject}`, complaintId: complaint.complaintId,
          read: false, color: "#f59e0b", createdAt: now, updatedAt: now,
        });
      } catch (error) {
        console.error("Complaint notification failed:", error.message);
      }
    }

    return NextResponse.json({ complaint }, { status: 201 });
  } catch (error) {
    console.error("Create complaint error:", error);
    return NextResponse.json({ message: "Could not submit your complaint. Please try again." }, { status: 500 });
  }
}
