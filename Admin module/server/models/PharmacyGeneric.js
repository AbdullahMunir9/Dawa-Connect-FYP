import mongoose from 'mongoose';
import pharmacyDb from '../db/pharmacyConnection.js';

// Loose models for owner-scoped operational collections we only read or append to.
function loose(name, collection) {
  const schema = new mongoose.Schema({ ownerId: { type: mongoose.Schema.Types.Mixed } }, { strict: false, timestamps: true, collection });
  return pharmacyDb.models[name] || pharmacyDb.model(name, schema);
}

export const PharmacyReview = loose('PharmacyReview', 'reviews');
export const PharmacyReturn = loose('PharmacyReturn', 'returns');
export const PharmacyNotification = loose('PharmacyNotification', 'notifications');
