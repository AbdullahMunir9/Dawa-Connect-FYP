import { timingSafeEqual } from 'node:crypto';

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 120;
const requestsByAddress = new Map();

function secretMatches(actualValue, expectedValue) {
  const actual = Buffer.from(String(actualValue || ''), 'utf8');
  const expected = Buffer.from(String(expectedValue || ''), 'utf8');
  return actual.length === expected.length && actual.length > 0 && timingSafeEqual(actual, expected);
}

export function automationBearerToken(headerValue) {
  const header = String(headerValue || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export function automationSecretIsValid(headerValue, configuredSecret) {
  const secret = String(configuredSecret || '').trim();
  if (secret.length < 32) return false;
  return secretMatches(automationBearerToken(headerValue), secret);
}

function rateLimitAllows(address, now = Date.now()) {
  const key = String(address || 'unknown').slice(0, 100);
  const current = requestsByAddress.get(key);
  if (!current || current.resetAt <= now) {
    requestsByAddress.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  current.count += 1;
  return current.count <= RATE_LIMIT;
}

export function requireReportAutomationAuth(req, res, next) {
  const secret = String(process.env.REPORT_AUTOMATION_SECRET || '').trim();
  if (secret.length < 32) {
    return res.status(503).json({ message: 'Report automation is not configured.' });
  }
  if (!rateLimitAllows(req.ip || req.socket?.remoteAddress)) {
    return res.status(429).json({ message: 'Too many report automation requests.' });
  }
  if (!automationSecretIsValid(req.headers.authorization, secret)) {
    return res.status(401).json({ message: 'Report automation authentication failed.' });
  }
  return next();
}

