import mongoose from "mongoose";

const RecentSearchSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sessionId: { type: String, default: null },
    query: { type: String, required: true, trim: true },
    searchCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

RecentSearchSchema.index({ userId: 1, query: 1 }, { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } });
RecentSearchSchema.index({ sessionId: 1, query: 1 }, { unique: true, partialFilterExpression: { sessionId: { $type: "string" } } });

export default mongoose.models.RecentSearch || mongoose.model("RecentSearch", RecentSearchSchema);
