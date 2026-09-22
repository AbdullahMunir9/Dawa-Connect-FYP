import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a name"],
      maxlength: [60, "Name cannot be more than 60 characters"],
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required() {
        return !this.googleSub;
      },
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    googleSub: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      select: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    picture: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2048,
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "",
      maxlength: [100, "City cannot be more than 100 characters"],
    },
    cartItems: [
      {
        cartItemId: { type: String, required: true, trim: true },
        id: { type: String, trim: true, default: "" },
        productId: { type: String, trim: true, default: "" },
        name: { type: String, trim: true, default: "" },
        category: { type: String, trim: true, default: "" },
        image: { type: String, trim: true, default: "" },
        pharmacyId: { type: String, trim: true, default: "" },
        pharmacyName: { type: String, trim: true, default: "" },
        timing: { type: String, trim: true, default: "" },
        deliveryCharge: { type: Number, default: 0 },
        taxRate: { type: Number, default: 0 },
        deliveryType: { type: String, trim: true, default: "" },
        price: { type: Number, default: 0 },
        quantity: { type: Number, min: 1, default: 1 },
      },
    ],
    addresses: [
      {
        label: { type: String, required: true, trim: true },
        fullName: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        line1: { type: String, required: true, trim: true },
        line2: { type: String, trim: true, default: "" },
        city: { type: String, required: true, trim: true },
        province: { type: String, trim: true, default: "" },
        postalCode: { type: String, trim: true, default: "" },
        isDefault: { type: Boolean, default: false },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
