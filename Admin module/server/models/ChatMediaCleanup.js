import mongoose from 'mongoose';

const chatMediaCleanupSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatConversation', required: true, index: true },
  publicId: { type: String, required: true, unique: true, maxlength: 300 },
  uploadedBy: { type: String, required: true, maxlength: 300 },
  deleteAfter: { type: Date, required: true, index: true },
  reason: { type: String, enum: ['pending_upload', 'guest_retention'], default: 'pending_upload' },
  attempts: { type: Number, default: 0, min: 0 },
  lastError: { type: String, default: '', maxlength: 500 },
}, { timestamps: true, collection: 'chat_media_cleanup' });

export default mongoose.models.ChatMediaCleanup
  || mongoose.model('ChatMediaCleanup', chatMediaCleanupSchema);
