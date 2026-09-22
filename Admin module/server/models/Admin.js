import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'admin'], default: 'admin' },
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
}, { timestamps: true });

export default mongoose.model('Admin', adminSchema);
