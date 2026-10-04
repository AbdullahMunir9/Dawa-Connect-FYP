import mongoose from "mongoose";

const PendingRegistrationSchema = new mongoose.Schema(
  {
    challengeId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    passwordHash: { type: String, required: true, select: false },
    otpHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true, index: true },
    deleteAt: { type: Date, required: true, index: { expires: 0 } },
    resendAvailableAt: { type: Date, required: true },
    attempts: { type: Number, default: 0, min: 0 },
    sendCount: { type: Number, default: 1, min: 1 },
    sendWindowStartedAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    lastEmailId: { type: String, trim: true, default: "", index: true },
    deliveryStatus: {
      type: String,
      enum: ["queued", "sent", "delivered", "delayed", "bounced", "failed"],
      default: "queued",
    },
    deliveryFailure: { type: String, trim: true, default: "", maxlength: 500 },
  },
  { timestamps: true }
);

export default mongoose.models.PendingRegistration
  || mongoose.model("PendingRegistration", PendingRegistrationSchema);
