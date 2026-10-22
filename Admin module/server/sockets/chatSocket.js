import { verifyChatToken } from '../middleware/chatAuth.js';
import {
  listConversations,
  listMessages,
  markConversationRead,
  openOrderConversation,
  openPharmacyOrderConversation,
  getConversation,
  sendMessage,
} from '../services/chatService.js';
import { recentUnreadOrderNotifications } from '../services/pharmacyNotificationStream.js';

const conversationRoom = (id) => `conversation:${id}`;
const participantRoom = (identity) => `${identity.role}:${identity.sub}`;

function reply(ack, action) {
  const callback = typeof ack === 'function' ? ack : null;
  Promise.resolve()
    .then(action)
    .then((data) => callback?.({ ok: true, data }))
    .catch((error) => {
      if (callback) {
        callback({
          ok: false,
          error: error.message || 'Chat request failed.',
          code: error.code || 'CHAT_REQUEST_FAILED',
          status: Number(error.status) || 500,
        });
      } else {
        console.error('Chat socket request failed without an acknowledgement callback:', error.message || error);
      }
    });
}

const socketPayload = (args) => args.find((value) => value && typeof value === 'object' && typeof value !== 'function') || {};
const socketAck = (args) => args.find((value) => typeof value === 'function');

function enforceMessageRate(socket) {
  const now = Date.now();
  const recent = (socket.data.messageTimes || []).filter((time) => now - time < 10_000);
  if (recent.length >= 10) {
    throw Object.assign(new Error('You are sending messages too quickly. Please wait a moment.'), { status: 429, code: 'CHAT_RATE_LIMIT' });
  }
  recent.push(now);
  socket.data.messageTimes = recent;
}

export function configureChatSocket(io) {
  io.use((socket, next) => {
    try {
      socket.data.identity = verifyChatToken(socket.handshake.auth?.token);
      return next();
    } catch (error) {
      const authError = new Error(error?.status === 503 ? error.message : 'Your chat session is invalid or expired.');
      authError.data = { code: error?.status === 503 ? 'CHAT_NOT_CONFIGURED' : 'CHAT_AUTH_FAILED' };
      return next(authError);
    }
  });

  io.on('connection', (socket) => {
    const identity = socket.data.identity;
    socket.join(participantRoom(identity));

    if (identity.role === 'pharmacy') {
      recentUnreadOrderNotifications(identity.sub)
        .then((notifications) => socket.emit('notification:sync', notifications))
        .catch((error) => console.error('Could not sync pharmacy notifications:', error.message));
    }

    socket.on('conversation:list', (...args) => reply(socketAck(args), () => listConversations(identity)));

    socket.on('conversation:open', (...args) => reply(socketAck(args), async () => {
      const { orderId } = socketPayload(args);
      const conversation = await openOrderConversation(identity, orderId);
      await socket.join(conversationRoom(conversation.id));
      io.to(`pharmacy:${conversation.pharmacyId}`).emit('conversation:updated', conversation);
      return conversation;
    }));

    socket.on('conversation:open-pharmacy', (...args) => reply(socketAck(args), async () => {
      const { orderReference } = socketPayload(args);
      const conversation = await openPharmacyOrderConversation(identity, orderReference);
      await socket.join(conversationRoom(conversation.id));
      io.to(conversationRoom(conversation.id)).emit('conversation:updated', conversation);
      return conversation;
    }));

    socket.on('conversation:join', (...args) => reply(socketAck(args), async () => {
      const { conversationId } = socketPayload(args);
      const conversation = await getConversation(identity, conversationId);
      await socket.join(conversationRoom(conversation._id));
      return { conversationId: String(conversation._id) };
    }));

    socket.on('message:history', (...args) => {
      const { conversationId, before, limit } = socketPayload(args);
      reply(socketAck(args), () => listMessages(identity, conversationId, { before, limit }));
    });

    socket.on('message:send', (...args) => reply(socketAck(args), async () => {
      const { conversationId, text, clientMessageId } = socketPayload(args);
      enforceMessageRate(socket);
      const result = await sendMessage(identity, conversationId, { text, clientMessageId });
      if (result.created) {
        io.to(conversationRoom(conversationId))
          .to(`pharmacy:${result.conversation.pharmacyId}`)
          .emit('message:new', result);
        io.to(conversationRoom(conversationId)).emit('conversation:updated', result.conversation);
      }
      return result;
    }));

    socket.on('message:read', (...args) => reply(socketAck(args), async () => {
      const { conversationId } = socketPayload(args);
      const conversation = await markConversationRead(identity, conversationId);
      io.to(conversationRoom(conversationId)).emit('conversation:updated', conversation);
      return conversation;
    }));
  });
}
