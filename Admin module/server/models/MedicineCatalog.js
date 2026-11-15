import mongoose from 'mongoose';
import pharmacyDb from '../db/pharmacyConnection.js';

const imageSchema = new mongoose.Schema({
  secureUrl: String,
  publicId: String,
  width: Number,
  height: Number,
  format: String,
  bytes: Number,
  alt: String,
  sourceUrl: String,
  rightsConfirmed: Boolean,
  uploadedAt: Date,
}, { _id: false });

const medicineCatalogSchema = new mongoose.Schema({
  catalogKey: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  brandName: String,
  genericName: String,
  category: String,
  unit: String,
  strength: String,
  dosageForm: String,
  packSize: String,
  manufacturer: String,
  drapRegistrationNumber: String,
  aliases: [String],
  searchText: { type: String, index: true },
  status: { type: String, enum: ['active', 'draft', 'retired'], default: 'active', index: true },
  source: {
    name: String,
    url: String,
    reviewedAt: Date,
    notes: String,
  },
  image: imageSchema,
}, { timestamps: true, collection: 'medicineCatalog' });

const MedicineCatalog = pharmacyDb.models.MedicineCatalog
  || pharmacyDb.model('MedicineCatalog', medicineCatalogSchema);

export default MedicineCatalog;
