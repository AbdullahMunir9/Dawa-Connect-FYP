import ChatConversation from '../models/ChatConversation.js';
import ChatMessage from '../models/ChatMessage.js';
import Order from '../models/Order.js';
import { resolveGuestChatExpiresAt } from './chatPolicy.js';

/**
 * Creates the TTL indexes and migrates pre-retention guest conversations.
 * MongoDB then removes each conversation and its messages when their shared
 * expiresAt timestamp is reached, independently of the Render process.
 */
export async function initializeGuestChatRetention() {
  await Promise.all([ChatConversation.init(), ChatMessage.init()]);

  const now = Date.now();
  let protectedConversations = 0;
  let removedConversations = 0;
  const cursor = ChatConversation.find({ guestParticipantId: { $ne: '' } })
    .select('_id marketplaceOrderId createdAt expiresAt')
    .cursor();

  for await (const conversation of cursor) {
    const order = await Order.findById(conversation.marketplaceOrderId)
      .select('createdAt guestAccessExpiresAt')
      .lean();
    const expiresAt = resolveGuestChatExpiresAt(order || conversation);

    if (expiresAt.getTime() <= now) {
      await Promise.all([
        ChatMessage.deleteMany({ conversationId: conversation._id }),
        ChatConversation.deleteOne({ _id: conversation._id }),
      ]);
      removedConversations += 1;
      continue;
    }

    await Promise.all([
      ChatConversation.updateOne({ _id: conversation._id }, { $set: { expiresAt } }),
      ChatMessage.updateMany({ conversationId: conversation._id }, { $set: { expiresAt } }),
    ]);
    protectedConversations += 1;
  }

  console.log(
    `Guest chat retention initialized (${protectedConversations} active, ${removedConversations} expired removed).`,
  );
}
