import mongoose from 'mongoose';

// Shared contract with the Marketplace (customers) and Pharmacy app.
// Collection: MarketPlace.complaints. Keep field names in sync across modules.
export const COMPLAINT_CATEGORIES = ['order', 'delivery', 'product', 'payment', 'service', 'platform', 'account', 'other'];
export const COMPLAINT_STATUSES = ['open', 'in_review', 'resolved', 'dismissed'];
export const COMPLAINT_PRIORITIES = ['low', 'medium', 'high'];

const partySchema = new mongoose.Schema({
  id: { type: String, default: '' },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  role: { type: String, enum: ['customer', 'pharmacy', 'admin'], required: true },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  by: { type: partySchema, required: true },
  text: { type: String, required: true, maxlength: 2000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const complaintSchema = new mongoose.Schema({
  complaintId: { type: String, required: true, unique: true },
  source: { type: String, enum: ['customer', 'pharmacy'], required: true, index: true },
  target: { type: String, enum: ['pharmacy', 'admin'], required: true, index: true },
  reporter: { type: partySchema, required: true },
  pharmacyId: { type: String, default: null, index: true },
  pharmacyName: { type: String, default: '' },
  orderId: { type: String, default: '' },
  category: { type: String, enum: COMPLAINT_CATEGORIES, default: 'other' },
  subject: { type: String, required: true, maxlength: 120 },
  description: { type: String, required: true, maxlength: 2000 },
  priority: { type: String, enum: COMPLAINT_PRIORITIES, default: 'medium' },
  status: { type: String, enum: COMPLAINT_STATUSES, default: 'open', index: true },
  messages: { type: [messageSchema], default: [] },
  resolution: {
    type: new mongoose.Schema({ note: String, by: partySchema, at: Date }, { _id: false }),
    default: null,
  },
  lastActivityAt: { type: Date, default: Date.now },
}, { timestamps: true, collection: 'complaints' });

complaintSchema.index({ target: 1, status: 1, createdAt: -1 });
complaintSchema.index({ 'reporter.id': 1, createdAt: -1 });

export default mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema);
