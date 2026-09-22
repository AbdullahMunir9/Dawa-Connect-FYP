import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const PHARMACY_MONGODB_URI = process.env.PHARMACY_MONGODB_URI;

if (!PHARMACY_MONGODB_URI) {
  throw new Error('PHARMACY_MONGODB_URI is not set in environment variables.');
}

// autoIndex is off: the Pharmacy desktop app owns every index on this database, and a
// mongoose-created index with a conflicting spec would make that app fail on start-up.
const pharmacyDb = mongoose.createConnection(PHARMACY_MONGODB_URI, {
  autoIndex: false,
  autoCreate: false,
});

export default pharmacyDb;
