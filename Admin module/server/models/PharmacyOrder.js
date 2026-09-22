import mongoose from 'mongoose';
import pharmacyDb from '../db/pharmacyConnection.js';

// Read-only view of Pharmacy.orders (per-pharmacy fulfillment orders).
const pharmacyOrderSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.Mixed },
  id: String,
  source: String,
  marketplaceOrderId: String,
  customer: String,
  phone: String,
  items: Array,
  total: Number,
  status: String,
  date: mongoose.Schema.Types.Mixed,
}, { timestamps: true, strict: false, collection: 'orders' });

export default pharmacyDb.models.PharmacyOrder || pharmacyDb.model('PharmacyOrder', pharmacyOrderSchema);
