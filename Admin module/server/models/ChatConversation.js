import mongoose from 'mongoose';

const chatConversationSchema = new mongoose.Schema({
  marketplaceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
  orderId: { type: String, required: true, unique: true, index: true },
  pharmacyOrderId: { type: String, required: true, unique: true, index: true },
  pharmacyId: { type: String, required: true, index: true },
  pharmacyName: { type: String, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  guestParticipantId: { type: String, default: '', index: true },
  customerName: { type: String, default: 'Customer' },
  orderStatus: { type: String, default: 'Processing' },
  status: { type: String, enum: ['active', 'read_only'], default: 'active', index: true },
  closedReason: { type: String, default: '' },
  closedAt: { type: Date, default: null },
  lastMessageAt: { type: Date, default: null, index: true },
  lastMessagePreview: { type: String, default: '' },
  customerUnreadCount: { type: Number, default: 0, min: 0 },
  pharmacyUnreadCount: { type: Number, default: 0, min: 0 },
  customerLastReadAt: { type: Date, default: null },
  pharmacyLastReadAt: { type: Date, default: null },
}, { timestamps: true, collection: 'order_conversations' });

chatConversationSchema.index({ customerId: 1, lastMessageAt: -1 });
chatConversationSchema.index({ pharmacyId: 1, lastMessageAt: -1 });

export default mongoose.models.ChatConversation || mongoose.model('ChatConversation', chatConversationSchema);
