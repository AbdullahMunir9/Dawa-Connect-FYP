import mongoose from 'mongoose';
import dotenv from 'dotenv';
import pharmacyDb from '../db/pharmacyConnection.js';

dotenv.config();

const productsCollection = process.env.PHARMACY_PRODUCTS_COLLECTION || 'products';

const productSchema = new mongoose.Schema(
  {
    name: { type: String },
    category: { type: String },
    price: { type: Number },
    stock: { type: Number },
    ownerId: { type: mongoose.Schema.Types.Mixed },
  },
  { strict: false, timestamps: true, collection: productsCollection }
);

const PharmacyProduct =
  pharmacyDb.models.PharmacyProduct || pharmacyDb.model('PharmacyProduct', productSchema);

export default PharmacyProduct;
