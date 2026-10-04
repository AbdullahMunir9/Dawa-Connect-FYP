import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatConversation', required: true, index: true },
  senderId: { type: String, required: true },
  senderType: { type: String, enum: ['customer', 'guest', 'pharmacy'], required: true },
  clientMessageId: { type: String, required: true, maxlength: 100 },
  text: { type: String, required: true, maxlength: 2000 },
}, { timestamps: true, collection: 'order_messages' });

chatMessageSchema.index({ conversationId: 1, createdAt: -1 });
chatMessageSchema.index({ conversationId: 1, clientMessageId: 1 }, { unique: true });

export default mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);
