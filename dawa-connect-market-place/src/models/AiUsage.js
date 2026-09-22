import mongoose from "mongoose";

const AiUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    dayKey: { type: String, required: true },
    count: { type: Number, min: 0, default: 0 },
    lastModel: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

AiUsageSchema.index({ userId: 1, dayKey: 1 }, { unique: true });

export default mongoose.models.AiUsage || mongoose.model("AiUsage", AiUsageSchema);
