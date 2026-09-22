import mongoose from 'mongoose';
import pharmacyDb from '../db/pharmacyConnection.js';

// Read-only view of Pharmacy.profiles (owner-editable storefront settings).
const profileSchema = new mongoose.Schema({
  ownerId: { type: String },
  name: String, address: String, phone: String, email: String, license: String, hours: String,
  status: String, approvalStatus: String, logo: String,
  deliveryCharge: Number, deliveryRadius: Number, deliveryType: String, taxRate: Number,
  bankName: String, accountNo: String, latitude: Number, longitude: Number,
}, { timestamps: true, strict: false, collection: 'profiles' });

export default pharmacyDb.models.PharmacyProfile || pharmacyDb.model('PharmacyProfile', profileSchema);
