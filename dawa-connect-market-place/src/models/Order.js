import mongoose from "mongoose";

const AddressSchema = new mongoose.Schema({
  label: String,
  fullName: String,
  phone: String,
  line1: String,
  line2: String,
  city: String,
  province: String,
  postalCode: String,
}, { _id: false });

const OrderItemSchema = new mongoose.Schema({
  productId: String,
  pharmacyId: String,
  pharmacyName: String,
  name: String,
  category: String,
  unit: String,
  quantity: Number,
  price: Number,
  lineTotal: Number,
}, { _id: false });

const FulfillmentSchema = new mongoose.Schema({
  pharmacyId: String,
  pharmacyName: String,
  pharmacyOrderId: String,
  status: String,
  itemCount: Number,
  subtotal: Number,
  tax: Number,
  deliveryFee: Number,
  total: Number,
  updatedAt: Date,
}, { _id: false });

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    guestSessionHash: { type: String, default: "", index: true, select: false },
    orderId: { type: String, required: true, unique: true },
    pharmacyId: { type: String, default: "", index: true },
    pharmacyName: { type: String, default: "" },
    pharmacyOrderId: { type: String, default: "", index: true },
    items: [OrderItemSchema],
    fulfillments: [FulfillmentSchema],
    subtotal: { type: Number, required: true, default: 0 },
    tax: { type: Number, required: true, default: 0 },
    deliveryFee: { type: Number, required: true, default: 0 },
    processingFee: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Processing", "Confirmed", "Packed", "Dispatched", "Delivered", "Partially Delivered", "Cancelled"],
      default: "Processing",
      index: true,
    },
    paymentMethod: { type: String, enum: ["cash", "card"], default: "cash" },
    paymentStatus: { type: String, default: "Due on delivery" },
    deliveryAddress: AddressSchema,
    estimatedDelivery: Date,
  },
  { timestamps: true },
);

export default mongoose.models.Order || mongoose.model("Order", OrderSchema);
