import mongoose from 'mongoose';

// Admin view of MarketPlace.users. Status values are lowercase to match the Marketplace.
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  phone: { type: String },
  city: { type: String },
  addresses: { type: Array, default: [] },
  cartItems: { type: Array, default: [], select: false },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', lowercase: true, trim: true },
}, { timestamps: true, strict: false });

export default mongoose.models.User || mongoose.model('User', userSchema);
