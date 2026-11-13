import mongoose from "mongoose";

const PrescriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String },
    mimeType: { type: String },
    format: { type: String },
    bytes: { type: Number },
    cloudinaryPublicId: { type: String, select: false },
    cloudinaryAssetId: { type: String, select: false },
    cloudinarySecureUrl: { type: String, select: false },
    cloudinaryPreviewUrl: { type: String, select: false },
    resourceType: { type: String, default: "image" },
    deliveryType: { type: String, default: "authenticated" },
  },
  { timestamps: true }
);

PrescriptionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.models.Prescription || mongoose.model("Prescription", PrescriptionSchema);
