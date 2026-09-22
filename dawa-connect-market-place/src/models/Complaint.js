import mongoose from "mongoose";

// Shared complaints contract (MarketPlace.complaints). The Admin module and the
// Pharmacy desktop app read/write the same documents – keep field names in sync.
export const COMPLAINT_CATEGORIES = ["order", "delivery", "product", "payment", "service", "platform", "account", "other"];
export const COMPLAINT_STATUSES = ["open", "in_review", "resolved", "dismissed"];
export const COMPLAINT_PRIORITIES = ["low", "medium", "high"];

const PartySchema = new mongoose.Schema({
  id: { type: String, default: "" },
  name: { type: String, default: "" },
  email: { type: String, default: "" },
  role: { type: String, enum: ["customer", "pharmacy", "admin"], required: true },
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  by: { type: PartySchema, required: true },
  text: { type: String, required: true, maxlength: 2000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const ComplaintSchema = new mongoose.Schema({
  complaintId: { type: String, required: true, unique: true },
  source: { type: String, enum: ["customer", "pharmacy"], required: true, index: true },
  target: { type: String, enum: ["pharmacy", "admin"], required: true, index: true },
  reporter: { type: PartySchema, required: true },
  pharmacyId: { type: String, default: null, index: true },
  pharmacyName: { type: String, default: "" },
  orderId: { type: String, default: "" },
  category: { type: String, enum: COMPLAINT_CATEGORIES, default: "other" },
  subject: { type: String, required: true, maxlength: 120 },
  description: { type: String, required: true, maxlength: 2000 },
  priority: { type: String, enum: COMPLAINT_PRIORITIES, default: "medium" },
  status: { type: String, enum: COMPLAINT_STATUSES, default: "open", index: true },
  messages: { type: [MessageSchema], default: [] },
  resolution: { type: new mongoose.Schema({ note: String, by: PartySchema, at: Date }, { _id: false }), default: null },
  lastActivityAt: { type: Date, default: Date.now },
}, { timestamps: true, collection: "complaints" });

ComplaintSchema.index({ "reporter.id": 1, createdAt: -1 });
ComplaintSchema.index({ target: 1, status: 1, createdAt: -1 });

export function generateComplaintId() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const random = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `CMP-${stamp}${random}`;
}

export default mongoose.models.Complaint || mongoose.model("Complaint", ComplaintSchema);
