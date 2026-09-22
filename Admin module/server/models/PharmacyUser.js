import mongoose from 'mongoose';
import pharmacyDb from '../db/pharmacyConnection.js';

// Admin view of Pharmacy.users (registration/auth record written by the Pharmacy app).
const pharmacyUserSchema = new mongoose.Schema({
  pharmacyName: { type: String },
  ownerName: { type: String },
  email: { type: String },
  phone: { type: String },
  cnic: { type: String },
  licenseNumber: { type: String },
  addressLine1: { type: String },
  area: { type: String },
  city: { type: String },
  province: { type: String },
  openingTime: { type: String },
  closingTime: { type: String },
  deliveryCharge: { type: Number },
  serviceRadiusKm: { type: Number },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] },
  },
  passwordHash: { type: String, select: false },
  password: { type: String, select: false },
  resetOtpHash: { type: String, select: false },
  resetOtpExpiresAt: { type: Date, select: false },
  status: { type: String, default: 'unapproved' },          // unapproved | approved | suspended | rejected (legacy title-case tolerated)
  approvalStatus: { type: String, default: 'unapproved' },  // unapproved | approved
  rejectionReason: { type: String, default: '' },
  rejectedAt: { type: Date },
  suspensionReason: { type: String, default: '' },
  suspendedAt: { type: Date },
  approvedAt: { type: Date },
}, { timestamps: true, strict: false });

const PharmacyUser = pharmacyDb.models.PharmacyUser || pharmacyDb.model('PharmacyUser', pharmacyUserSchema, 'users');

export default PharmacyUser;
