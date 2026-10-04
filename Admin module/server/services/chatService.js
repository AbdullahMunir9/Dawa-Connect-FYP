import mongoose from 'mongoose';
import ChatConversation from '../models/ChatConversation.js';
import ChatMessage from '../models/ChatMessage.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import {
  deriveOrderChatDetails,
  identityCanAccessConversation,
  isChatWritableStatus,
  normalizeChatText,
} from './chatPolicy.js';

export class ChatError extends Error {
  constructor(message, status = 400, code = 'CHAT_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function asChatError(error) {
  if (error instanceof ChatError) return error;
  return new ChatError(error.message || 'Chat request failed.', Number(error.status) || 400);
}

function messageView(message) {
  const doc = message?.toObject ? message.toObject() : message;
  return {
    id: String(doc._id),
    conversationId: String(doc.conversationId),
    senderId: String(doc.senderId),
    senderType: doc.senderType,
    clientMessageId: doc.clientMessageId,
    text: doc.text,
    createdAt: doc.createdAt,
  };
}

function conversationView(conversation) {
  const doc = conversation?.toObject ? conversation.toObject() : conversation;
  return {
    id: String(doc._id),
    orderId: doc.orderId,
    pharmacyOrderId: doc.pharmacyOrderId,
    pharmacyId: doc.pharmacyId,
    pharmacyName: doc.pharmacyName,
    customerName: doc.customerName,
    orderStatus: doc.orderStatus,
    status: doc.status,
    canSend: doc.status === 'active' && isChatWritableStatus(doc.orderStatus),
    closedReason: doc.closedReason || '',
    lastMessageAt: doc.lastMessageAt,
    lastMessagePreview: doc.lastMessagePreview || '',
    customerUnreadCount: Number(doc.customerUnreadCount || 0),
    pharmacyUnreadCount: Number(doc.pharmacyUnreadCount || 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function assertOrderOwnership(identity, orderId) {
  const order = await Order.findOne({ orderId: String(orderId || '').trim() });
  if (!order) throw new ChatError('Order not found.', 404, 'ORDER_NOT_FOUND');

  if (identity.role === 'customer') {
    if (String(order.userId || '') !== identity.sub) throw new ChatError('You cannot access this order chat.', 403, 'FORBIDDEN');
    const customer = mongoose.isValidObjectId(identity.sub)
      ? await User.findById(identity.sub).select('name status').lean()
      : null;
    if (!customer || String(customer.status || 'active').toLowerCase() === 'suspended') {
      throw new ChatError('This customer account cannot use chat.', 403, 'CUSTOMER_UNAVAILABLE');
    }
    return { order, customerName: customer.name || order.deliveryAddress?.fullName || 'Customer' };
  }

  if (identity.role === 'guest') {
    const expectedSubject = `guest:${String(order._id)}`;
    if (identity.orderId !== String(order.orderId) || identity.sub !== expectedSubject || order.userId) {
      throw new ChatError('You cannot access this guest order chat.', 403, 'FORBIDDEN');
    }
    return { order, customerName: order.deliveryAddress?.fullName || 'Guest customer' };
  }

  throw new ChatError('Only the customer can create an order conversation.', 403, 'FORBIDDEN');
}

async function syncConversationState(conversation) {
  const order = await Order.findById(conversation.marketplaceOrderId).select('status fulfillments pharmacyId pharmacyName pharmacyOrderId');
  if (!order) return conversation;
  const details = deriveOrderChatDetails(order);
  const writable = isChatWritableStatus(details.orderStatus);
  const nextStatus = writable ? 'active' : 'read_only';
  if (conversation.orderStatus !== details.orderStatus || conversation.status !== nextStatus) {
    conversation.orderStatus = details.orderStatus;
    conversation.status = nextStatus;
    conversation.closedReason = writable ? '' : details.orderStatus.toLowerCase().replace(/\s+/g, '_');
    conversation.closedAt = writable ? null : (conversation.closedAt || new Date());
    await conversation.save();
  }
  return conversation;
}

export async function openOrderConversation(identity, orderId) {
  try {
    const { order, customerName } = await assertOrderOwnership(identity, orderId);
    const details = deriveOrderChatDetails(order);
    const writable = isChatWritableStatus(details.orderStatus);
    const insert = {
      marketplaceOrderId: order._id,
      orderId: order.orderId,
      pharmacyOrderId: details.pharmacyOrderId,
      pharmacyId: details.pharmacyId,
      pharmacyName: details.pharmacyName,
      customerId: identity.role === 'customer' ? new mongoose.Types.ObjectId(identity.sub) : null,
      guestParticipantId: identity.role === 'guest' ? identity.sub : '',
      customerName,
    };
    const conversation = await ChatConversation.findOneAndUpdate(
      { marketplaceOrderId: order._id },
      {
        $setOnInsert: insert,
        $set: {
          orderStatus: details.orderStatus,
          status: writable ? 'active' : 'read_only',
          closedReason: writable ? '' : details.orderStatus.toLowerCase().replace(/\s+/g, '_'),
          closedAt: writable ? null : new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (!identityCanAccessConversation(identity, conversation)) throw new ChatError('You cannot access this conversation.', 403, 'FORBIDDEN');
    return conversationView(conversation);
  } catch (error) {
    throw asChatError(error);
  }
}

export async function listConversations(identity) {
  let filter;
  if (identity.role === 'pharmacy') filter = { pharmacyId: identity.sub };
  else if (identity.role === 'customer' && mongoose.isValidObjectId(identity.sub)) filter = { customerId: new mongoose.Types.ObjectId(identity.sub) };
  else if (identity.role === 'guest') filter = { guestParticipantId: identity.sub, orderId: identity.orderId };
  else throw new ChatError('Invalid chat identity.', 401, 'UNAUTHORIZED');

  const conversations = await ChatConversation.find(filter).sort({ lastMessageAt: -1, createdAt: -1 }).limit(200);
  const synced = await Promise.all(conversations.map((conversation) => syncConversationState(conversation)));
  return synced.map(conversationView);
}

export async function getConversation(identity, conversationId) {
  if (!mongoose.isValidObjectId(conversationId)) throw new ChatError('Conversation not found.', 404, 'NOT_FOUND');
  const conversation = await ChatConversation.findById(conversationId);
  if (!conversation) throw new ChatError('Conversation not found.', 404, 'NOT_FOUND');
  if (!identityCanAccessConversation(identity, conversation)) throw new ChatError('You cannot access this conversation.', 403, 'FORBIDDEN');
  return syncConversationState(conversation);
}

export async function listMessages(identity, conversationId, { before, limit = 50 } = {}) {
  const conversation = await getConversation(identity, conversationId);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const filter = { conversationId: conversation._id };
  if (before && mongoose.isValidObjectId(before)) filter._id = { $lt: new mongoose.Types.ObjectId(before) };
  const messages = await ChatMessage.find(filter).sort({ _id: -1 }).limit(safeLimit + 1).lean();
  const hasMore = messages.length > safeLimit;
  const page = messages.slice(0, safeLimit).reverse();
  return { messages: page.map(messageView), hasMore, nextCursor: hasMore ? String(page[0]?._id || '') : null };
}

export async function sendMessage(identity, conversationId, { text, clientMessageId } = {}) {
  const conversation = await getConversation(identity, conversationId);
  if (conversation.status !== 'active' || !isChatWritableStatus(conversation.orderStatus)) {
    throw new ChatError('This order is complete. The conversation is now read-only.', 409, 'CHAT_READ_ONLY');
  }
  const normalizedText = normalizeChatText(text);
  const idempotencyKey = String(clientMessageId || '').trim();
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) throw new ChatError('A valid client message ID is required.', 400, 'INVALID_MESSAGE_ID');

  let message;
  let created = false;
  try {
    message = await ChatMessage.create({
      conversationId: conversation._id,
      senderId: identity.sub,
      senderType: identity.role,
      clientMessageId: idempotencyKey,
      text: normalizedText,
    });
    created = true;
  } catch (error) {
    if (error?.code !== 11000) throw error;
    message = await ChatMessage.findOne({ conversationId: conversation._id, clientMessageId: idempotencyKey });
  }

  if (created) {
    const recipientIncrement = identity.role === 'pharmacy'
      ? { customerUnreadCount: 1 }
      : { pharmacyUnreadCount: 1 };
    await ChatConversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessageAt: message.createdAt,
          lastMessagePreview: normalizedText.slice(0, 160),
        },
        $inc: recipientIncrement,
      },
    );
  }

  const updatedConversation = await ChatConversation.findById(conversation._id);
  return { message: messageView(message), conversation: conversationView(updatedConversation), created };
}

export async function markConversationRead(identity, conversationId) {
  const conversation = await getConversation(identity, conversationId);
  const now = new Date();
  const update = identity.role === 'pharmacy'
    ? { pharmacyUnreadCount: 0, pharmacyLastReadAt: now }
    : { customerUnreadCount: 0, customerLastReadAt: now };
  const updated = await ChatConversation.findByIdAndUpdate(conversation._id, { $set: update }, { new: true });
  return conversationView(updated);
}
