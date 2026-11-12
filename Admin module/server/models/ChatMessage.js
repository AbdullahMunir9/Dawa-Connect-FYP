import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatConversation', required: true, index: true },
  senderId: { type: String, required: true },
  senderType: { type: String, enum: ['customer', 'guest', 'pharmacy'], required: true },
  clientMessageId: { type: String, required: true, maxlength: 100 },
  text: { type: String, required: true, maxlength: 2000 },
  // Mirrors the parent guest conversation expiry so TTL cleanup does not leave orphan messages.
  expiresAt: { type: Date, default: null },
}, { timestamps: true, collection: 'order_messages' });

chatMessageSchema.index({ conversationId: 1, createdAt: -1 });
chatMessageSchema.index({ conversationId: 1, clientMessageId: 1 }, { unique: true });
chatMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);
