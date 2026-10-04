import { verifyChatToken } from '../middleware/chatAuth.js';
import {
  listConversations,
  listMessages,
  markConversationRead,
  openOrderConversation,
  getConversation,
  sendMessage,
} from '../services/chatService.js';

const conversationRoom = (id) => `conversation:${id}`;
const participantRoom = (identity) => `${identity.role}:${identity.sub}`;

function reply(ack, action) {
  Promise.resolve()
    .then(action)
    .then((data) => ack?.({ ok: true, data }))
    .catch((error) => ack?.({
      ok: false,
      error: error.message || 'Chat request failed.',
      code: error.code || 'CHAT_REQUEST_FAILED',
      status: Number(error.status) || 500,
    }));
}

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

    socket.on('conversation:list', (ack) => reply(ack, () => listConversations(identity)));

    socket.on('conversation:open', ({ orderId } = {}, ack) => reply(ack, async () => {
      const conversation = await openOrderConversation(identity, orderId);
      await socket.join(conversationRoom(conversation.id));
      return conversation;
    }));

    socket.on('conversation:join', ({ conversationId } = {}, ack) => reply(ack, async () => {
      const conversation = await getConversation(identity, conversationId);
      await socket.join(conversationRoom(conversation._id));
      return { conversationId: String(conversation._id) };
    }));

    socket.on('message:history', ({ conversationId, before, limit } = {}, ack) => {
      reply(ack, () => listMessages(identity, conversationId, { before, limit }));
    });

    socket.on('message:send', ({ conversationId, text, clientMessageId } = {}, ack) => reply(ack, async () => {
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

    socket.on('message:read', ({ conversationId } = {}, ack) => reply(ack, async () => {
      const conversation = await markConversationRead(identity, conversationId);
      io.to(conversationRoom(conversationId)).emit('conversation:updated', conversation);
      return conversation;
    }));
  });
}
