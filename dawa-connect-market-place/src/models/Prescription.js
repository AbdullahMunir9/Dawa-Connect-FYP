import mongoose from "mongoose";

const PrescriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    status: { 
      type: String, 
      enum: ["Pending", "Approved", "Rejected"], 
      default: "Pending" 
    },
    notes: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.Prescription || mongoose.model("Prescription", PrescriptionSchema);
