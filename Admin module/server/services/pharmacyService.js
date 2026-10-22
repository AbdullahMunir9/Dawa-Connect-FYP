import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import pharmacyDb from '../db/pharmacyConnection.js';
import { pharmacyView } from '../middleware/pharmacyAuth.js';

const { ObjectId } = mongoose.Types;
const MARKETPLACE_DB_NAME = process.env.MARKETPLACE_DB_NAME || 'MarketPlace';
const PRODUCTS_COLLECTION = process.env.PHARMACY_PRODUCTS_COLLECTION || 'products';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_RECORD_TTL_MS = 60 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_OTP_SENDS = 5;
const LOCATION_TTL_MS = 60 * 60 * 1000;
const ENTITY_POLICIES = {
  orders: new Set(['read', 'update']),
  staff: new Set(['read', 'create', 'delete']),
  reviews: new Set(['read']),
  returns: new Set(['read', 'update']),
  notifications: new Set(['read', 'create', 'update']),
};
const ORDER_TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Packed', 'Cancelled'],
  Packed: ['Dispatched', 'Cancelled'],
  Dispatched: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};
const COMPLAINT_CATEGORIES = ['order', 'delivery', 'product', 'payment', 'service', 'platform', 'account', 'other'];
const COMPLAINT_CLOSED = ['resolved', 'dismissed'];
const locationSessions = new Map();
let indexesReady;

export async function pharmacyDatabase() {
  if (pharmacyDb.readyState !== 1) await pharmacyDb.asPromise();
  if (!indexesReady) {
    indexesReady = Promise.all([
      pharmacyDb.collection('users').createIndex({ email: 1 }, { unique: true }),
      pharmacyDb.collection('users').createIndex({ phoneNormalized: 1 }, { unique: true, sparse: true }),
      pharmacyDb.collection('users').createIndex({ location: '2dsphere' }),
      pharmacyDb.collection(PRODUCTS_COLLECTION).createIndex({ ownerId: 1, name: 1 }),
      pharmacyDb.collection('orders').createIndex({ ownerId: 1, date: -1 }),
      pharmacyDb.collection('orders').createIndex({ marketplaceOrderId: 1, ownerId: 1 }),
      pharmacyDb.collection('staff').createIndex({ ownerId: 1, email: 1 }),
      pharmacyDb.collection('reviews').createIndex({ ownerId: 1, date: -1 }),
      pharmacyDb.collection('returns').createIndex({ ownerId: 1, date: -1 }),
      pharmacyDb.collection('notifications').createIndex({ ownerId: 1, createdAt: -1 }),
      pharmacyDb.collection('profiles').createIndex({ ownerId: 1 }, { unique: true }),
      pharmacyDb.collection('profiles').createIndex({ location: '2dsphere' }),
      pharmacyDb.collection('sessions').createIndex({ token: 1 }, { unique: true }),
      pharmacyDb.collection('sessions').createIndex({ userId: 1, revokedAt: 1, expiresAt: 1 }),
      pharmacyDb.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      pharmacyDb.collection('pendingRegistrations').createIndex({ challengeId: 1 }, { unique: true }),
      pharmacyDb.collection('pendingRegistrations').createIndex({ email: 1 }, { unique: true }),
      pharmacyDb.collection('pendingRegistrations').createIndex({ deleteAt: 1 }, { expireAfterSeconds: 0 }),
      pharmacyDb.collection('verificationRateLimits').createIndex({ deleteAt: 1 }, { expireAfterSeconds: 0 }),
      pharmacyDb.collection('registrationPhotoUploads').createIndex({ tokenHash: 1 }, { unique: true }),
      pharmacyDb.collection('registrationPhotoUploads').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]).catch((error) => {
      indexesReady = null;
      throw error;
    });
  }
  await indexesReady;
  return pharmacyDb.db;
}

function marketplaceDatabase() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) throw new Error('Marketplace database is unavailable.');
  return mongoose.connection.db;
}

function mapDoc(doc) {
  if (!doc) return null;
  return { ...doc, _id: String(doc._id), id: doc.id || String(doc._id) };
}

function objectId(value, label = 'record') {
  if (!ObjectId.isValid(String(value))) throw Object.assign(new Error(`Invalid ${label} id.`), { status: 400 });
  return new ObjectId(String(value));
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11);
}

function assertStrongPassword(password) {
  if (typeof password !== 'string' || password.length < 8) throw new Error('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(password)) throw new Error('Password must include at least one uppercase letter.');
  if (!/\d/.test(password)) throw new Error('Password must include at least one number.');
  if (!/[^A-Za-z0-9]/.test(password)) throw new Error('Password must include at least one special character.');
}

function normalizedCoordinates(payload) {
  const latitude = Number(payload?.latitude);
  const longitude = Number(payload?.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('Select a valid pharmacy latitude.');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Select a valid pharmacy longitude.');
  return { latitude, longitude, location: { type: 'Point', coordinates: [longitude, latitude] } };
}

function cleanObject(value, denied = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const block = new Set(['_id', 'ownerId', 'createdAt', 'updatedAt', ...denied]);
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => !block.has(key) && item !== undefined));
}

async function isPhoneTaken(db, phoneDigits) {
  if (phoneDigits.length !== 11) return false;
  const indexed = await db.collection('users').findOne({
    $or: [{ phoneNormalized: phoneDigits }, { phone: phoneDigits }],
  });
  if (indexed) return true;
  const legacy = await db.collection('users').find(
    { phoneNormalized: { $exists: false } },
    { projection: { phone: 1 } },
  ).toArray();
  return legacy.some((user) => normalizePhoneDigits(user.phone) === phoneDigits);
}

export async function registrationAvailability({ email, phone } = {}) {
  const db = await pharmacyDatabase();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPhone = normalizePhoneDigits(phone);
  return {
    emailTaken: normalizedEmail.includes('@') ? Boolean(await db.collection('users').findOne({ email: normalizedEmail })) : false,
    phoneTaken: normalizedPhone.length === 11 ? await isPhoneTaken(db, normalizedPhone) : false,
  };
}

function pruneLocationSessions() {
  const now = Date.now();
  for (const [id, value] of locationSessions) if (value.expiresAt <= now) locationSessions.delete(id);
}

async function geoapify(endpoint, params) {
  const key = String(process.env.GEOAPIFY_API_KEY || '').trim();
  if (!key) throw Object.assign(new Error('Address search is not configured on the server.'), { status: 503 });
  const url = new URL(`https://api.geoapify.com/v1/geocode/${endpoint}`);
  url.search = new URLSearchParams({ ...params, format: 'json', lang: 'en', apiKey: key }).toString();
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  } catch {
    throw Object.assign(new Error('The map address service could not be reached.'), { status: 502 });
  }
  if (!response.ok) {
    if (response.status === 429) throw Object.assign(new Error('The map address service limit was reached.'), { status: 429 });
    throw Object.assign(new Error('The map address service is unavailable.'), { status: 502 });
  }
  const body = await response.json().catch(() => null);
  if (!Array.isArray(body?.results)) throw Object.assign(new Error('The map address service returned invalid data.'), { status: 502 });
  return body.results;
}

export function locationConfigured() {
  return Boolean(String(process.env.GEOAPIFY_API_KEY || '').trim());
}

export async function searchPharmacyLocation(text) {
  const query = String(text || '').trim();
  if (query.length < 3 || query.length > 300) throw Object.assign(new Error('Enter an address or nearby landmark (3–300 characters).'), { status: 400 });
  const results = await geoapify('search', { text: query, filter: 'countrycode:pk', limit: '5' });
  const places = results.filter((item) => item.country_code === 'pk' && Number.isFinite(item.lat) && Number.isFinite(item.lon))
    .map((item) => ({ label: item.formatted || item.address_line1, latitude: item.lat, longitude: item.lon }))
    .filter((item) => item.label);
  const sessionId = randomBytes(24).toString('base64url');
  pruneLocationSessions();
  locationSessions.set(sessionId, { searched: places.length > 0, confirmed: null, expiresAt: Date.now() + LOCATION_TTL_MS });
  return { sessionId, places };
}

export async function confirmPharmacyLocation(sessionId, point) {
  pruneLocationSessions();
  const session = locationSessions.get(String(sessionId || ''));
  if (!session?.searched) throw Object.assign(new Error('Search for your pharmacy address first.'), { status: 400 });
  const coordinates = normalizedCoordinates(point);
  const results = await geoapify('reverse', { lat: String(coordinates.latitude), lon: String(coordinates.longitude), limit: '1' });
  const result = results[0];
  if (!result || result.country_code !== 'pk') throw Object.assign(new Error('Select a pharmacy location in Pakistan.'), { status: 400 });
  const addressLine1 = result.formatted || result.address_line1 || '';
  if (!addressLine1) throw Object.assign(new Error('No address was found at this point.'), { status: 400 });
  const data = {
    addressLine1,
    area: result.suburb || result.quarter || result.neighbourhood || result.district || '',
    city: result.city || result.town || result.village || result.municipality || '',
    province: result.state || '',
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    locationConfirmation: randomBytes(32).toString('base64url'),
  };
  session.confirmed = data;
  session.expiresAt = Date.now() + LOCATION_TTL_MS;
  return data;
}

function consumeConfirmedLocation(payload) {
  const confirmation = String(payload?.locationConfirmation || '');
  const entry = [...locationSessions.entries()].find(([, value]) => value.confirmed?.locationConfirmation === confirmation);
  if (!entry) throw new Error('Go back to Step 2 and confirm the pharmacy location again.');
  const [sessionId, session] = entry;
  if (session.expiresAt <= Date.now()) {
    locationSessions.delete(sessionId);
    throw new Error('The location confirmation expired. Confirm the pharmacy location again.');
  }
  locationSessions.delete(sessionId);
  return { ...payload, ...session.confirmed, locationConfirmation: undefined };
}

async function seedInitialData(db, ownerId, payload, session = null) {
  const now = new Date();
  const coordinates = normalizedCoordinates(payload);
  await db.collection('profiles').updateOne(
    { ownerId },
    { $set: {
      ownerId, name: payload.pharmacyName, address: payload.addressLine1, phone: payload.phone,
      email: payload.email, license: payload.licenseNumber,
      hours: `${payload.openingTime || '08:00'} - ${payload.closingTime || '22:00'}`,
      deliveryCharge: Number(payload.deliveryCharge || 50), deliveryRadius: Number(payload.serviceRadiusKm || 10),
      ...coordinates, status: 'Open', approvalStatus: 'unapproved', logo: '💊', taxRate: 5, photos: {},
      bankName: 'HBL', accountNo: '', createdAt: now, updatedAt: now,
    } },
    { upsert: true, ...(session ? { session } : {}) },
  );
  await db.collection('notifications').insertOne({
    ownerId, type: 'order', message: 'Welcome! Your pharmacy registration is awaiting approval.',
    read: false, color: '#14b8a6', createdAt: now, updatedAt: now,
  }, session ? { session } : {});
}

function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return email;
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(2, Math.min(6, local.length - 2)))}@${domain}`;
}

function registrationOtpHash(challengeId, email, otp) {
  return createHmac('sha256', otpPepper()).update(`${challengeId}:${email}:${otp}`).digest('hex');
}

function otpMatches(actualHash, expectedHash) {
  const actual = Buffer.from(String(actualHash || ''), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length > 0 && actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function consumeRegistrationEmailLimit(db, email) {
  const now = new Date();
  const windowMs = 60 * 60 * 1000;
  const windowCutoff = new Date(now.getTime() - windowMs);
  const key = `pharmacy-signup:${createHash('sha256').update(email).digest('hex')}`;
  const updated = await db.collection('verificationRateLimits').findOneAndUpdate(
    { _id: key },
    [{ $set: {
      allowed: {
        $or: [
          { $lte: [{ $ifNull: ['$windowStartedAt', new Date(0)] }, windowCutoff] },
          { $lt: [{ $ifNull: ['$count', 0] }, MAX_OTP_SENDS] },
        ],
      },
      count: {
        $cond: [
          { $lte: [{ $ifNull: ['$windowStartedAt', new Date(0)] }, windowCutoff] },
          1,
          { $cond: [{ $lt: [{ $ifNull: ['$count', 0] }, MAX_OTP_SENDS] }, { $add: [{ $ifNull: ['$count', 0] }, 1] }, '$count'] },
        ],
      },
      windowStartedAt: {
        $cond: [
          { $lte: [{ $ifNull: ['$windowStartedAt', new Date(0)] }, windowCutoff] }, now, '$windowStartedAt',
        ],
      },
      updatedAt: now,
      deleteAt: new Date(now.getTime() + windowMs),
    } }],
    { upsert: true, returnDocument: 'after' },
  );
  if (!updated?.allowed) {
    const retryAfter = Math.max(1, Math.ceil((new Date(updated?.windowStartedAt || now).getTime() + windowMs - now.getTime()) / 1000));
    throw Object.assign(new Error('Too many verification emails were requested. Please try again later.'), { status: 429, retryAfter });
  }
}

async function sendResendEmail(message, failureMessage) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || 'DawaConnect <noreply@dawaconnect.store>').trim();
  if (!apiKey.startsWith('re_') || !from) {
    throw Object.assign(new Error('Pharmacy email verification is not configured.'), { status: 503 });
  }
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, ...message }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw Object.assign(new Error(failureMessage), { status: 502 });
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.id) throw Object.assign(new Error(failureMessage), { status: 502 });
  return result.id;
}

async function sendRegistrationEmail(email, name, otp) {
  const safeName = String(name || 'Pharmacy owner').replace(/[<>&"]/g, '');
  return sendResendEmail({
    to: [email],
    subject: 'Verify your DawaConnect pharmacy email',
    text: `Hello ${name || 'Pharmacy owner'}, your DawaConnect pharmacy verification code is ${otp}. It expires in 5 minutes.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><div style="padding:24px;border-radius:18px;background:#f0fdfa;border:1px solid #99f6e4"><h2 style="margin:0 0 12px;color:#0f766e">Verify your pharmacy email</h2><p>Hello ${safeName},</p><p>Enter this code in the DawaConnect Pharmacy application to finish registration:</p><div style="margin:24px 0;padding:18px;text-align:center;border-radius:12px;background:#fff;font-size:30px;font-weight:800;letter-spacing:8px">${otp}</div><p style="color:#475569">This code expires in 5 minutes. Never share it with anyone.</p></div></div>`,
    tags: [{ name: 'category', value: 'pharmacy_signup_otp' }],
  }, 'The verification email could not be sent. Check the address and try again.');
}

async function prepareRegistration(db, rawPayload) {
  const payload = consumeConfirmedLocation(rawPayload);
  const email = String(payload.email || '').trim().toLowerCase();
  const phone = normalizePhoneDigits(payload.phone);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (!String(payload.pharmacyName || '').trim() || !String(payload.ownerName || '').trim()) throw new Error('Pharmacy and owner names are required.');
  if (phone.length !== 11) throw new Error('Phone number must be exactly 11 digits.');
  if (await db.collection('users').findOne({ email })) throw new Error('Email is already registered.');
  if (await isPhoneTaken(db, phone)) throw new Error('Phone number is already registered.');
  assertStrongPassword(payload.password);
  if (String(payload.cnic || '').replace(/\D/g, '').length !== 13) throw new Error('Owner CNIC must be 13 digits.');
  if (!String(payload.licenseNumber || '').trim()) throw new Error('Drug license number is required.');
  const passwordHash = await bcrypt.hash(payload.password, 12);
  const coordinates = normalizedCoordinates(payload);
  const registration = {
    ...cleanObject(payload, ['password', 'confirmPassword', 'locationConfirmation']), ...coordinates,
    email, phone, phoneNormalized: phone,
  };
  return { registration, passwordHash };
}

export async function registerPharmacy(rawPayload = {}) {
  otpPepper();
  const db = await pharmacyDatabase();
  const { registration, passwordHash } = await prepareRegistration(db, rawPayload);
  await consumeRegistrationEmailLimit(db, registration.email);
  const now = new Date();
  const challengeId = randomBytes(32).toString('base64url');
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  const resendAvailableAt = new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS);
  const pending = {
    challengeId,
    email: registration.email,
    phoneNormalized: registration.phoneNormalized,
    registration,
    passwordHash,
    otpHash: registrationOtpHash(challengeId, registration.email, otp),
    attempts: 0,
    sendCount: 1,
    expiresAt,
    resendAvailableAt,
    deleteAt: new Date(now.getTime() + OTP_RECORD_TTL_MS),
    consumedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection('pendingRegistrations').findOneAndReplace(
    { email: registration.email }, pending, { upsert: true },
  );
  try {
    const emailId = await sendRegistrationEmail(registration.email, registration.ownerName, otp);
    await db.collection('pendingRegistrations').updateOne({ challengeId }, { $set: { emailId, updatedAt: new Date() } });
  } catch (error) {
    await db.collection('pendingRegistrations').deleteOne({ challengeId });
    throw error;
  }
  return {
    message: 'Verification code sent.', challengeId, maskedEmail: maskEmail(registration.email),
    expiresAt: expiresAt.toISOString(), resendAvailableAt: resendAvailableAt.toISOString(),
  };
}

export async function resendRegistrationOtp(challengeIdValue) {
  otpPepper();
  const db = await pharmacyDatabase();
  const challengeId = String(challengeIdValue || '');
  const pending = await db.collection('pendingRegistrations').findOne({ challengeId, consumedAt: null });
  if (!pending) throw new Error('This verification request is invalid or has already been used.');
  const now = new Date();
  if (new Date(pending.resendAvailableAt).getTime() > now.getTime()) {
    const retryAfter = Math.max(1, Math.ceil((new Date(pending.resendAvailableAt).getTime() - now.getTime()) / 1000));
    throw Object.assign(new Error(`You can request another code in ${retryAfter} seconds.`), { status: 429 });
  }
  if (Number(pending.sendCount || 0) >= MAX_OTP_SENDS) {
    throw Object.assign(new Error('Too many codes were sent. Start registration again later.'), { status: 429 });
  }
  await consumeRegistrationEmailLimit(db, pending.email);
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  const resendAvailableAt = new Date(now.getTime() + OTP_RESEND_COOLDOWN_MS);
  const nextHash = registrationOtpHash(challengeId, pending.email, otp);
  const updated = await db.collection('pendingRegistrations').findOneAndUpdate(
    { _id: pending._id, consumedAt: null, resendAvailableAt: { $lte: now } },
    { $set: { otpHash: nextHash, attempts: 0, expiresAt, resendAvailableAt, updatedAt: now }, $inc: { sendCount: 1 } },
    { returnDocument: 'after' },
  );
  if (!updated) throw Object.assign(new Error('A new code is already being requested. Please wait.'), { status: 409 });
  try {
    const emailId = await sendRegistrationEmail(pending.email, pending.registration?.ownerName, otp);
    await db.collection('pendingRegistrations').updateOne({ _id: pending._id, otpHash: nextHash }, { $set: { emailId, updatedAt: new Date() } });
  } catch (error) {
    await db.collection('pendingRegistrations').updateOne({ _id: pending._id, otpHash: nextHash }, { $set: {
      otpHash: pending.otpHash, attempts: pending.attempts, expiresAt: pending.expiresAt,
      resendAvailableAt: pending.resendAvailableAt, sendCount: pending.sendCount, updatedAt: pending.updatedAt,
    } });
    throw error;
  }
  return { message: 'A new verification code was sent.', expiresAt: expiresAt.toISOString(), resendAvailableAt: resendAvailableAt.toISOString() };
}

export async function verifyPharmacyRegistration({ challengeId: challengeIdValue, otp } = {}) {
  otpPepper();
  const db = await pharmacyDatabase();
  const challengeId = String(challengeIdValue || '');
  if (challengeId.length < 30 || !/^\d{6}$/.test(String(otp || ''))) throw new Error('Enter the six-digit verification code.');
  const pending = await db.collection('pendingRegistrations').findOne({ challengeId, consumedAt: null });
  if (!pending) throw new Error('This verification request is invalid or has already been used.');
  if (new Date(pending.expiresAt).getTime() <= Date.now()) throw Object.assign(new Error('This verification code has expired. Request a new code.'), { status: 410 });
  if (Number(pending.attempts || 0) >= MAX_OTP_ATTEMPTS) throw Object.assign(new Error('Too many incorrect attempts. Request a new code.'), { status: 429 });
  const receivedHash = registrationOtpHash(challengeId, pending.email, String(otp));
  if (!otpMatches(receivedHash, pending.otpHash)) {
    const updated = await db.collection('pendingRegistrations').findOneAndUpdate(
      { _id: pending._id, consumedAt: null, attempts: { $lt: MAX_OTP_ATTEMPTS } },
      { $inc: { attempts: 1 }, $set: { updatedAt: new Date() } }, { returnDocument: 'after' },
    );
    const attemptsRemaining = Math.max(0, MAX_OTP_ATTEMPTS - Number(updated?.attempts || MAX_OTP_ATTEMPTS));
    throw Object.assign(new Error(attemptsRemaining
      ? `Incorrect verification code. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`
      : 'Too many incorrect attempts. Request a new code.'), { status: attemptsRemaining ? 400 : 429 });
  }
  if (await db.collection('users').findOne({ email: pending.email })) {
    await db.collection('pendingRegistrations').deleteOne({ _id: pending._id });
    throw Object.assign(new Error('This email is already registered. Sign in instead.'), { status: 409 });
  }
  if (await isPhoneTaken(db, pending.phoneNormalized)) {
    await db.collection('pendingRegistrations').deleteOne({ _id: pending._id });
    throw Object.assign(new Error('This phone number is already registered.'), { status: 409 });
  }
  const verifiedAt = new Date();
  const claimed = await db.collection('pendingRegistrations').findOneAndUpdate(
    { _id: pending._id, consumedAt: null, expiresAt: { $gt: verifiedAt }, attempts: { $lt: MAX_OTP_ATTEMPTS } },
    { $set: { consumedAt: verifiedAt, updatedAt: verifiedAt } }, { returnDocument: 'after' },
  );
  if (!claimed) throw Object.assign(new Error('This verification request is no longer available.'), { status: 409 });
  const doc = {
    ...claimed.registration,
    passwordHash: claimed.passwordHash,
    emailVerifiedAt: verifiedAt,
    status: 'unapproved', approvalStatus: 'unapproved', createdAt: verifiedAt, updatedAt: verifiedAt,
  };
  const photoUploadToken = randomBytes(32).toString('base64url');
  const photoUploadExpiresAt = new Date(verifiedAt.getTime() + 15 * 60 * 1000);
  let result;
  const session = pharmacyDb.getClient().startSession();
  try {
    await session.withTransaction(async () => {
      result = await db.collection('users').insertOne(doc, { session });
      await seedInitialData(db, String(result.insertedId), doc, session);
      await db.collection('registrationPhotoUploads').insertOne({
        tokenHash: createHash('sha256').update(photoUploadToken).digest('hex'),
        ownerId: String(result.insertedId), uploadedSlots: [],
        expiresAt: photoUploadExpiresAt, createdAt: verifiedAt, updatedAt: verifiedAt,
      }, { session });
      await db.collection('pendingRegistrations').deleteOne({ _id: claimed._id }, { session });
    });
  } catch (error) {
    await db.collection('pendingRegistrations').updateOne(
      { _id: claimed._id, expiresAt: { $gt: new Date() } }, { $set: { consumedAt: null, updatedAt: new Date() } },
    ).catch(() => {});
    if (error?.code === 11000) throw Object.assign(new Error('This email or phone number is already registered.'), { status: 409 });
    throw error;
  } finally {
    await session.endSession();
  }
  return {
    message: 'Email verified and pharmacy registration submitted.',
    pharmacy: pharmacyView({ ...doc, _id: result.insertedId }),
    photoUploadToken,
    photoUploadExpiresAt: photoUploadExpiresAt.toISOString(),
  };
}

async function createSession(db, ownerId) {
  const now = new Date();
  const token = randomBytes(48).toString('hex');
  await db.collection('sessions').insertOne({
    token, userId: String(ownerId), createdAt: now, updatedAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS), revokedAt: null,
  });
  return token;
}

export async function loginPharmacy({ email, password } = {}) {
  const db = await pharmacyDatabase();
  const user = await db.collection('users').findOne({ email: String(email || '').trim().toLowerCase() });
  if (!user || !(await bcrypt.compare(String(password || ''), String(user.passwordHash || user.password || '')))) {
    throw Object.assign(new Error('Invalid email or password.'), { status: 401 });
  }
  const sessionToken = await createSession(db, user._id);
  return { ...pharmacyView(user), sessionToken };
}

export async function logoutPharmacy(token) {
  const db = await pharmacyDatabase();
  await db.collection('sessions').updateOne(
    { token, revokedAt: null },
    { $set: { revokedAt: new Date(), updatedAt: new Date() } },
  );
  return { ok: true };
}

function otpPepper() {
  const value = String(process.env.PHARMACY_OTP_PEPPER || '');
  if (value.length < 32) throw Object.assign(new Error('Pharmacy email verification is not configured.'), { status: 503 });
  return value;
}

function otpHash(email, otp) {
  return createHmac('sha256', otpPepper()).update(`${email}:${otp}`).digest('hex');
}

async function sendResetEmail(email, name, otp) {
  return sendResendEmail({
      to: [email], subject: 'Reset your DawaConnect pharmacy password',
      text: `Your DawaConnect verification code is ${otp}. It expires in 5 minutes.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto"><h2>DawaConnect Pharmacy</h2><p>Hello ${String(name || 'Pharmacy owner').replace(/[<>&"]/g, '')},</p><p>Your password reset code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p><p>This code expires in 5 minutes. If you did not request it, ignore this email.</p></div>`,
      tags: [{ name: 'category', value: 'pharmacy_password_reset' }],
    }, 'The password-reset email could not be sent.');
}

export async function requestPasswordReset(emailValue) {
  const db = await pharmacyDatabase();
  const email = String(emailValue || '').trim().toLowerCase();
  const user = await db.collection('users').findOne({ email });
  if (!user) return { ok: true };
  const lastSent = new Date(user.resetOtpCreatedAt || 0).getTime();
  if (Date.now() - lastSent < 60_000) throw Object.assign(new Error('Wait one minute before requesting another code.'), { status: 429 });
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const now = new Date();
  await db.collection('users').updateOne({ _id: user._id }, { $set: {
    resetOtpHash: otpHash(email, otp), resetOtpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
    resetOtpAttempts: 0, resetOtpCreatedAt: now, updatedAt: now,
  }, $unset: { resetOtpCode: '' } });
  try {
    await sendResetEmail(email, user.ownerName, otp);
  } catch (error) {
    await db.collection('users').updateOne({ _id: user._id }, { $unset: {
      resetOtpHash: '', resetOtpExpiresAt: '', resetOtpAttempts: '', resetOtpCreatedAt: '',
    } });
    throw error;
  }
  return { ok: true };
}

export async function resetPassword({ email: emailValue, otp, newPassword } = {}) {
  assertStrongPassword(newPassword);
  const db = await pharmacyDatabase();
  const email = String(emailValue || '').trim().toLowerCase();
  const user = await db.collection('users').findOne({ email });
  if (!user?.resetOtpHash || !user?.resetOtpExpiresAt) throw new Error('A valid reset code has not been requested.');
  if (new Date(user.resetOtpExpiresAt).getTime() <= Date.now()) throw new Error('The reset code has expired.');
  if (Number(user.resetOtpAttempts || 0) >= 5) throw Object.assign(new Error('Too many attempts. Request another code.'), { status: 429 });
  const received = Buffer.from(otpHash(email, String(otp || '')));
  const expected = Buffer.from(String(user.resetOtpHash));
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    await db.collection('users').updateOne({ _id: user._id }, { $inc: { resetOtpAttempts: 1 } });
    throw new Error('Invalid reset code.');
  }
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.collection('users').updateOne({ _id: user._id }, {
    $set: { passwordHash, updatedAt: new Date() },
    $unset: { resetOtpHash: '', resetOtpExpiresAt: '', resetOtpAttempts: '', resetOtpCreatedAt: '', resetOtpCode: '' },
  });
  await db.collection('sessions').updateMany({ userId: String(user._id), revokedAt: null }, { $set: { revokedAt: new Date() } });
  return { ok: true };
}

export async function listProducts(ownerId) {
  const db = await pharmacyDatabase();
  return (await db.collection(PRODUCTS_COLLECTION).find({ ownerId }).sort({ createdAt: -1 }).toArray()).map(mapDoc);
}

export async function createProduct(ownerId, value) {
  const db = await pharmacyDatabase();
  const now = new Date();
  const doc = { ...cleanObject(value), ownerId, createdAt: now, updatedAt: now };
  const result = await db.collection(PRODUCTS_COLLECTION).insertOne(doc);
  return mapDoc({ ...doc, _id: result.insertedId });
}

export async function updateProduct(ownerId, id, value) {
  const db = await pharmacyDatabase();
  const _id = objectId(id, 'product');
  const updates = cleanObject(value, ['id']);
  const result = await db.collection(PRODUCTS_COLLECTION).findOneAndUpdate(
    { _id, ownerId }, { $set: { ...updates, updatedAt: new Date() } }, { returnDocument: 'after' },
  );
  if (!result) throw Object.assign(new Error('Product not found.'), { status: 404 });
  return mapDoc(result);
}

export async function deleteProduct(ownerId, id) {
  const db = await pharmacyDatabase();
  const result = await db.collection(PRODUCTS_COLLECTION).deleteOne({ _id: objectId(id, 'product'), ownerId });
  if (!result.deletedCount) throw Object.assign(new Error('Product not found.'), { status: 404 });
  return { ok: true };
}

function assertEntity(entity, action) {
  if (!ENTITY_POLICIES[entity]?.has(action)) throw Object.assign(new Error('This pharmacy operation is not allowed.'), { status: 403 });
}

function entityFilter(ownerId, id) {
  return ObjectId.isValid(String(id)) ? { _id: new ObjectId(String(id)), ownerId } : { id: String(id), ownerId };
}

export async function listEntity(ownerId, entity) {
  assertEntity(entity, 'read');
  const db = await pharmacyDatabase();
  return (await db.collection(entity).find({ ownerId }).sort({ createdAt: -1 }).toArray()).map(mapDoc);
}

export async function createEntity(ownerId, entity, item) {
  assertEntity(entity, 'create');
  const db = await pharmacyDatabase();
  const now = new Date();
  const doc = { ...cleanObject(item), ownerId, createdAt: now, updatedAt: now };
  const result = await db.collection(entity).insertOne(doc);
  return mapDoc({ ...doc, _id: result.insertedId });
}

function marketplaceOrderStatus(fulfillments) {
  const statuses = fulfillments.map((item) => item.status);
  if (!statuses.length) return 'Processing';
  if (statuses.every((status) => status === 'Cancelled')) return 'Cancelled';
  if (statuses.every((status) => status === 'Delivered')) return 'Delivered';
  if (statuses.every((status) => ['Delivered', 'Cancelled'].includes(status))) return 'Partially Delivered';
  if (statuses.some((status) => ['Dispatched', 'Delivered'].includes(status))) return 'Dispatched';
  if (statuses.some((status) => status === 'Packed')) return 'Packed';
  if (statuses.every((status) => status === 'Confirmed')) return 'Confirmed';
  return 'Processing';
}

async function updateOrderStatus(ownerId, id, nextStatus) {
  const db = await pharmacyDatabase();
  const orders = db.collection('orders');
  const filter = entityFilter(ownerId, id);
  const session = pharmacyDb.getClient().startSession();
  let mapped;
  try {
    await session.withTransaction(async () => {
      const order = await orders.findOne(filter, { session });
      if (!order) throw Object.assign(new Error('Order not found.'), { status: 404 });
      if (order.status === nextStatus) { mapped = mapDoc(order); return; }
      if (!(ORDER_TRANSITIONS[order.status] || []).includes(nextStatus)) throw new Error(`Order cannot move from ${order.status} to ${nextStatus}.`);
      const now = new Date();
      const patch = { status: nextStatus, updatedAt: now };
      if (nextStatus === 'Cancelled' && order.inventoryReserved && !order.inventoryRestocked) {
        for (const item of order.items || []) {
          if (!ObjectId.isValid(String(item.productId))) continue;
          await db.collection(PRODUCTS_COLLECTION).updateOne(
            { _id: new ObjectId(String(item.productId)), ownerId },
            { $inc: { stock: Number(item.qty ?? item.quantity ?? 0) }, $set: { updatedAt: now } },
            { session },
          );
        }
        patch.inventoryRestocked = true;
        patch.inventoryRestockedAt = now;
      }
      await orders.updateOne(filter, { $set: patch }, { session });
      mapped = mapDoc(await orders.findOne(filter, { session }));
      if (order.source === 'marketplace' && ObjectId.isValid(String(order.marketplaceOrderId))) {
        const marketplaceOrders = pharmacyDb.getClient().db(MARKETPLACE_DB_NAME).collection('orders');
        const marketplaceId = new ObjectId(String(order.marketplaceOrderId));
        await marketplaceOrders.updateOne(
          { _id: marketplaceId },
          { $set: {
            'fulfillments.$[fulfillment].status': nextStatus,
            'fulfillments.$[fulfillment].updatedAt': now,
            status: nextStatus,
            updatedAt: now,
          } },
          { arrayFilters: [{ 'fulfillment.pharmacyOrderId': order.id }], session },
        );
        const marketplaceOrder = await marketplaceOrders.findOne({ _id: marketplaceId }, { session });
        if (marketplaceOrder?.fulfillments?.length > 1) {
          await marketplaceOrders.updateOne(
            { _id: marketplaceId },
            { $set: { status: marketplaceOrderStatus(marketplaceOrder.fulfillments), updatedAt: now } },
            { session },
          );
        }
      }
    });
  } finally {
    await session.endSession();
  }
  return mapped;
}

export async function updateEntity(ownerId, entity, id, changes) {
  assertEntity(entity, 'update');
  if (entity === 'orders') {
    const status = String(changes?.status || '');
    if (!status) throw new Error('Order status is required.');
    return updateOrderStatus(ownerId, id, status);
  }
  const allowed = entity === 'notifications' ? ['read'] : entity === 'returns' ? ['status'] : [];
  const patch = Object.fromEntries(allowed.filter((key) => Object.hasOwn(changes || {}, key)).map((key) => [key, changes[key]]));
  if (!Object.keys(patch).length) throw new Error('No supported changes were supplied.');
  const db = await pharmacyDatabase();
  const updated = await db.collection(entity).findOneAndUpdate(
    entityFilter(ownerId, id), { $set: { ...patch, updatedAt: new Date() } }, { returnDocument: 'after' },
  );
  if (!updated) throw Object.assign(new Error('Record not found.'), { status: 404 });
  return mapDoc(updated);
}

export async function markAllNotificationsRead(ownerId) {
  const db = await pharmacyDatabase();
  const now = new Date();
  const result = await db.collection('notifications').updateMany(
    { ownerId: String(ownerId), read: { $ne: true } },
    { $set: { read: true, updatedAt: now } },
  );
  return { modifiedCount: result.modifiedCount, updatedAt: now };
}

export async function deleteEntity(ownerId, entity, id) {
  assertEntity(entity, 'delete');
  const db = await pharmacyDatabase();
  const result = await db.collection(entity).deleteOne(entityFilter(ownerId, id));
  if (!result.deletedCount) throw Object.assign(new Error('Record not found.'), { status: 404 });
  return { ok: true };
}

async function findProfile(db, ownerId) {
  return db.collection('profiles').findOne({ ownerId });
}

export async function getProfile(ownerId) {
  const db = await pharmacyDatabase();
  const user = await db.collection('users').findOne({ _id: objectId(ownerId, 'pharmacy') });
  if (!user) throw Object.assign(new Error('Pharmacy not found.'), { status: 404 });
  const approvalStatus = String(user.approvalStatus || user.status || 'unapproved').toLowerCase();
  let profile = await findProfile(db, ownerId);
  if (!profile) {
    const now = new Date();
    profile = {
      ownerId, name: user.pharmacyName || 'My Pharmacy', address: user.addressLine1 || '', phone: user.phone || '',
      email: user.email || '', license: user.licenseNumber || '', hours: `${user.openingTime || '08:00'} - ${user.closingTime || '22:00'}`,
      deliveryCharge: Number(user.deliveryCharge || 50), deliveryRadius: Number(user.serviceRadiusKm || 10),
      status: 'Open', approvalStatus, logo: '💊', taxRate: 5, bankName: '', accountNo: '',
      latitude: user.latitude, longitude: user.longitude, location: user.location, photos: {}, createdAt: now, updatedAt: now,
    };
    const result = await db.collection('profiles').insertOne(profile);
    profile._id = result.insertedId;
  } else if (String(profile.approvalStatus || '').toLowerCase() !== approvalStatus) {
    await db.collection('profiles').updateOne({ _id: profile._id }, { $set: { approvalStatus, updatedAt: new Date() } });
    profile.approvalStatus = approvalStatus;
  }
  return {
    ...mapDoc(profile), approvalStatus, accountStatus: String(user.status || '').toLowerCase(),
    rejectionReason: user.rejectionReason || '', suspensionReason: user.suspensionReason || '',
  };
}

export async function updateProfile(ownerId, changes) {
  const db = await pharmacyDatabase();
  const existing = await getProfile(ownerId);
  const allowed = ['name', 'address', 'hours', 'status', 'logo', 'deliveryCharge', 'deliveryRadius', 'deliveryType', 'taxRate', 'bankName', 'accountNo'];
  const patch = {};
  for (const key of allowed) {
    if (!Object.hasOwn(changes || {}, key)) continue;
    patch[key] = ['deliveryCharge', 'deliveryRadius', 'taxRate'].includes(key) ? Number(changes[key]) : String(changes[key] ?? '').trim();
  }
  patch.updatedAt = new Date();
  await db.collection('profiles').updateOne({ _id: objectId(existing._id, 'profile'), ownerId }, { $set: patch });
  const userPatch = { updatedAt: new Date() };
  if (Object.hasOwn(patch, 'name')) userPatch.pharmacyName = patch.name;
  if (Object.hasOwn(patch, 'address')) userPatch.addressLine1 = patch.address;
  if (Object.hasOwn(patch, 'deliveryCharge')) userPatch.deliveryCharge = patch.deliveryCharge;
  if (Object.hasOwn(patch, 'deliveryRadius')) userPatch.serviceRadiusKm = patch.deliveryRadius;
  if (Object.hasOwn(patch, 'hours')) {
    const parts = patch.hours.split(/\s*-\s*/);
    if (parts.length >= 2) { userPatch.openingTime = parts[0]; userPatch.closingTime = parts.at(-1); }
  }
  await db.collection('users').updateOne({ _id: objectId(ownerId, 'pharmacy') }, { $set: userPatch });
  return getProfile(ownerId);
}

function complaintsCollection() {
  return marketplaceDatabase().collection('complaints');
}

function generateComplaintId() {
  return `CMP-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.random().toString(36).toUpperCase().slice(2, 5)}`;
}

async function pharmacyParty(ownerId) {
  const db = await pharmacyDatabase();
  const user = await db.collection('users').findOne({ _id: objectId(ownerId, 'pharmacy') });
  return { id: ownerId, name: user?.pharmacyName || 'Pharmacy', email: user?.email || '', role: 'pharmacy' };
}

async function findParticipantComplaint(ownerId, id) {
  const idFilter = ObjectId.isValid(String(id)) ? { $or: [{ _id: new ObjectId(String(id)) }, { complaintId: String(id) }] } : { complaintId: String(id) };
  const doc = await complaintsCollection().findOne({
    $and: [idFilter, { $or: [{ target: 'pharmacy', pharmacyId: ownerId }, { source: 'pharmacy', 'reporter.id': ownerId }] }],
  });
  if (!doc) throw Object.assign(new Error('Complaint not found.'), { status: 404 });
  return doc;
}

export async function listComplaints(ownerId) {
  const [inbox, outbox] = await Promise.all([
    complaintsCollection().find({ target: 'pharmacy', pharmacyId: ownerId }).sort({ lastActivityAt: -1 }).limit(300).toArray(),
    complaintsCollection().find({ source: 'pharmacy', 'reporter.id': ownerId }).sort({ lastActivityAt: -1 }).limit(300).toArray(),
  ]);
  return { inbox: inbox.map(mapDoc), outbox: outbox.map(mapDoc) };
}

export async function createComplaint(ownerId, value = {}) {
  const subject = String(value.subject || '').trim().slice(0, 120);
  const description = String(value.description || '').trim().slice(0, 2000);
  if (subject.length < 5) throw new Error('Give your complaint a subject of at least 5 characters.');
  if (description.length < 20) throw new Error('Describe the problem in at least 20 characters.');
  const reporter = await pharmacyParty(ownerId);
  const now = new Date();
  const doc = {
    complaintId: generateComplaintId(), source: 'pharmacy', target: 'admin', reporter,
    pharmacyId: ownerId, pharmacyName: reporter.name, orderId: String(value.orderId || '').trim().slice(0, 60),
    category: COMPLAINT_CATEGORIES.includes(value.category) ? value.category : 'other',
    subject, description, priority: ['low', 'medium', 'high'].includes(value.priority) ? value.priority : 'medium',
    status: 'open', messages: [], resolution: null, lastActivityAt: now, createdAt: now, updatedAt: now,
  };
  const result = await complaintsCollection().insertOne(doc);
  return mapDoc({ ...doc, _id: result.insertedId });
}

export async function replyComplaint(ownerId, id, text) {
  const message = String(text || '').trim().slice(0, 2000);
  if (!message) throw new Error('Reply cannot be empty.');
  const current = await findParticipantComplaint(ownerId, id);
  const now = new Date();
  const status = COMPLAINT_CLOSED.includes(current.status) ? 'open' : current.status;
  await complaintsCollection().updateOne({ _id: current._id }, {
    $push: { messages: { id: randomUUID(), sender: 'pharmacy', senderName: current.pharmacyName || 'Pharmacy', text: message, createdAt: now } },
    $set: { status, lastActivityAt: now, updatedAt: now },
  });
  return mapDoc(await complaintsCollection().findOne({ _id: current._id }));
}

export async function updateComplaintStatus(ownerId, id, status, note = '') {
  if (!['open', 'in_review', 'resolved', 'dismissed'].includes(status)) throw new Error('Invalid complaint status.');
  const current = await findParticipantComplaint(ownerId, id);
  if (!(current.target === 'pharmacy' && current.pharmacyId === ownerId)) throw Object.assign(new Error('Only received complaints can be updated by a pharmacy.'), { status: 403 });
  const now = new Date();
  const update = { status, lastActivityAt: now, updatedAt: now };
  if (COMPLAINT_CLOSED.includes(status)) update.resolution = { note: String(note || '').trim().slice(0, 1000), resolvedBy: 'pharmacy', resolvedAt: now };
  else update.resolution = null;
  await complaintsCollection().updateOne({ _id: current._id }, { $set: update });
  return mapDoc(await complaintsCollection().findOne({ _id: current._id }));
}

