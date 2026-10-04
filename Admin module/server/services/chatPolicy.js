export const CHAT_ACTIVE_ORDER_STATUSES = new Set([
  'Processing',
  'Pending',
  'Confirmed',
  'Packed',
  'Dispatched',
]);

export function isChatWritableStatus(status) {
  return CHAT_ACTIVE_ORDER_STATUSES.has(String(status || ''));
}

export function deriveOrderChatDetails(order) {
  const fulfillment = Array.isArray(order?.fulfillments) && order.fulfillments.length === 1
    ? order.fulfillments[0]
    : null;
  const pharmacyId = String(order?.pharmacyId || fulfillment?.pharmacyId || '').trim();
  const pharmacyName = String(order?.pharmacyName || fulfillment?.pharmacyName || 'Registered Pharmacy').trim();
  const pharmacyOrderId = String(order?.pharmacyOrderId || fulfillment?.pharmacyOrderId || '').trim();

  if (!pharmacyId || !pharmacyOrderId) {
    throw Object.assign(new Error('Live chat is unavailable for this legacy multi-pharmacy order.'), { status: 409 });
  }

  return {
    pharmacyId,
    pharmacyName,
    pharmacyOrderId,
    orderStatus: String(order.status || fulfillment?.status || 'Processing'),
  };
}

export function normalizeChatText(value) {
  const text = String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  if (!text) throw Object.assign(new Error('Write a message before sending.'), { status: 400 });
  if (text.length > 2000) throw Object.assign(new Error('Messages cannot exceed 2,000 characters.'), { status: 400 });
  return text;
}

export function identityCanAccessConversation(identity, conversation) {
  if (!identity || !conversation) return false;
  if (identity.role === 'pharmacy') return String(conversation.pharmacyId) === String(identity.sub);
  if (identity.role === 'customer') return String(conversation.customerId || '') === String(identity.sub);
  if (identity.role === 'guest') {
    return String(conversation.guestParticipantId || '') === String(identity.sub)
      && String(conversation.orderId) === String(identity.orderId);
  }
  return false;
}
