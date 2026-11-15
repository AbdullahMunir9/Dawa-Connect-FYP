export const CHAT_ACTIVE_ORDER_STATUSES = new Set([
  'Processing',
  'Pending',
  'Confirmed',
  'Packed',
  'Dispatched',
]);

export const GUEST_CHAT_RETENTION_DAYS = 15;
export const GUEST_CHAT_RETENTION_MS = GUEST_CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const CANCELLATION_REQUEST_ORDER_STATUSES = new Set(['Confirmed', 'Packed']);

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function withoutUnsafeControlCharacters(value) {
  return Array.from(String(value || ''))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code >= 32 && code !== 127;
    })
    .join('');
}

export function resolveGuestChatExpiresAt(order) {
  const explicit = validDate(order?.guestAccessExpiresAt);
  if (explicit) return explicit;
  const createdAt = validDate(order?.createdAt);
  if (!createdAt) throw Object.assign(new Error('Guest chat expiry could not be determined.'), { status: 500 });
  return new Date(createdAt.getTime() + GUEST_CHAT_RETENTION_MS);
}

export function isGuestChatExpired(order, now = new Date()) {
  const current = validDate(now);
  if (!current) throw new TypeError('A valid current date is required.');
  return resolveGuestChatExpiresAt(order).getTime() <= current.getTime();
}

export function isChatWritableStatus(status) {
  return CHAT_ACTIVE_ORDER_STATUSES.has(String(status || ''));
}

export function canRequestOrderCancellation(status) {
  return CANCELLATION_REQUEST_ORDER_STATUSES.has(String(status || ''));
}

export function normalizeCancellationReason(value) {
  const reason = withoutUnsafeControlCharacters(value)
    .replace(/\r\n?/g, '\n')
    .trim();
  if (reason.length < 3) {
    throw Object.assign(new Error('Briefly explain why you want to cancel this order.'), { status: 400 });
  }
  if (reason.length > 500) {
    throw Object.assign(new Error('The cancellation reason cannot exceed 500 characters.'), { status: 400 });
  }
  return reason;
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
  const text = withoutUnsafeControlCharacters(value)
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!text) throw Object.assign(new Error('Write a message before sending.'), { status: 400 });
  if (text.length > 2000) throw Object.assign(new Error('Messages cannot exceed 2,000 characters.'), { status: 400 });
  return text;
}

export function identityCanAccessConversation(identity, conversation) {
  if (!identity || !conversation) return false;
  if (identity.role === 'pharmacy') return String(conversation.pharmacyId) === String(identity.sub);
  if (identity.role === 'customer') {
    return Boolean(conversation.customerId)
      && String(conversation.orderId) === String(identity.orderId);
  }
  if (identity.role === 'guest') {
    // A guest token is issued only after the Marketplace verifies that
    // browser's guest-order cookie. The signed orderId is therefore the
    // stable authorization boundary. Do not couple access to MongoDB's
    // internal ObjectId: doing so makes otherwise valid guest tokens fail
    // when two deployed services resolve different document identities.
    return !conversation.customerId
      && String(conversation.orderId) === String(identity.orderId);
  }
  return false;
}
