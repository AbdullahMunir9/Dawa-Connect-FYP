import mongoose from 'mongoose';

// Read-only mirror of the Marketplace master order. The Marketplace owns writes.
const addressSchema = new mongoose.Schema({
  label: String, fullName: String, phone: String, line1: String, line2: String,
  city: String, province: String, postalCode: String,
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  productId: String, pharmacyId: String, pharmacyName: String, name: String, category: String,
  unit: String, quantity: Number, price: Number, lineTotal: Number,
}, { _id: false });

const fulfillmentSchema = new mongoose.Schema({
  pharmacyId: String, pharmacyName: String, pharmacyOrderId: String, status: String,
  itemCount: Number, subtotal: Number, tax: Number, deliveryFee: Number, total: Number, updatedAt: Date,
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  guestSessionHash: { type: String, select: false },
  items: { type: [orderItemSchema], default: [] },
  fulfillments: { type: [fulfillmentSchema], default: [] },
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  deliveryFee: { type: Number, default: 0 },
  processingFee: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  status: { type: String, default: 'Processing' },
  paymentMethod: { type: String, default: 'cash' },
  paymentStatus: { type: String, default: '' },
  deliveryAddress: addressSchema,
  estimatedDelivery: { type: Date },
}, { timestamps: true, strict: false });

export default mongoose.models.Order || mongoose.model('Order', orderSchema);
