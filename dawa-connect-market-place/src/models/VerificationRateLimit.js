import mongoose from "mongoose";

const VerificationRateLimitSchema = new mongoose.Schema(
  {
    bucketKey: { type: String, required: true, unique: true, index: true },
    count: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export default mongoose.models.VerificationRateLimit
  || mongoose.model("VerificationRateLimit", VerificationRateLimitSchema);
