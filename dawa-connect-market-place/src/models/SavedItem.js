import mongoose from "mongoose";

const SavedItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: String, required: true, index: true },
    pharmacyId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.SavedItem || mongoose.model("SavedItem", SavedItemSchema);
