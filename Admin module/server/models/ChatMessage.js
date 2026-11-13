import mongoose from 'mongoose';

const chatAttachmentSchema = new mongoose.Schema({
  type: { type: String, enum: ['image'], default: 'image', required: true },
  publicId: { type: String, required: true, maxlength: 300 },
  url: { type: String, required: true, maxlength: 1000 },
  thumbnailUrl: { type: String, required: true, maxlength: 1000 },
  format: { type: String, enum: ['jpg', 'jpeg', 'png', 'webp'], required: true },
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 },
  bytes: { type: Number, required: true, min: 1 },
}, { _id: false });

const chatMessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatConversation', required: true, index: true },
  senderId: { type: String, required: true },
  senderType: { type: String, enum: ['customer', 'guest', 'pharmacy'], required: true },
  clientMessageId: { type: String, required: true, maxlength: 100 },
  text: { type: String, default: '', maxlength: 2000 },
  attachments: {
    type: [chatAttachmentSchema],
    default: [],
    validate: {
      validator: (items) => Array.isArray(items) && items.length <= 2,
      message: 'A chat message can contain at most two images.',
    },
  },
  // Mirrors the parent guest conversation expiry so TTL cleanup does not leave orphan messages.
  expiresAt: { type: Date, default: null },
}, { timestamps: true, collection: 'order_messages' });

chatMessageSchema.index({ conversationId: 1, createdAt: -1 });
chatMessageSchema.index({ conversationId: 1, clientMessageId: 1 }, { unique: true });
chatMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);
