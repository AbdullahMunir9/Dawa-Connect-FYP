import jwt from 'jsonwebtoken';

const CHAT_AUDIENCE = 'dawaconnect-chat';
const ALLOWED_ISSUERS = ['dawaconnect-marketplace', 'dawaconnect-chat-service'];

function chatSecret() {
  const secret = String(process.env.CHAT_TOKEN_SECRET || '');
  if (secret.length < 32) {
    throw Object.assign(new Error('CHAT_TOKEN_SECRET must be configured with at least 32 characters.'), { status: 503 });
  }
  return secret;
}

export function signPharmacyChatToken(pharmacyId) {
  return jwt.sign(
    { role: 'pharmacy' },
    chatSecret(),
    {
      algorithm: 'HS256',
      audience: CHAT_AUDIENCE,
      issuer: 'dawaconnect-chat-service',
      subject: String(pharmacyId),
      expiresIn: '15m',
    },
  );
}

export function verifyChatToken(token) {
  const payload = jwt.verify(String(token || ''), chatSecret(), {
    algorithms: ['HS256'],
    audience: CHAT_AUDIENCE,
    issuer: ALLOWED_ISSUERS,
  });
  const role = String(payload.role || '');
  const sub = String(payload.sub || '');
  if (!['customer', 'guest', 'pharmacy'].includes(role) || !sub) throw new Error('Invalid chat identity.');
  if (role === 'guest' && !payload.orderId) throw new Error('Guest chat access must be scoped to an order.');
  return { sub, role, orderId: payload.orderId ? String(payload.orderId) : '' };
}

export function requireChatAuth(req, res, next) {
  try {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ message: 'Chat authentication is required.' });
    req.chatIdentity = verifyChatToken(token);
    return next();
  } catch (error) {
    return res.status(error?.status || 401).json({ message: error?.status === 503 ? error.message : 'Your chat session is invalid or expired.' });
  }
}
