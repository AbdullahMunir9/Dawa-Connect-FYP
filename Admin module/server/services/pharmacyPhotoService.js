import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { pharmacyDatabase } from './pharmacyService.js';

const PUBLIC_PHOTO_SLOTS = new Set(['inside', 'outside']);
const REGISTRATION_PHOTO_SLOTS = new Set([...PUBLIC_PHOTO_SLOTS, 'licenseDocument']);
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function apiError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function cloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
  if (!cloudName || !apiKey || !apiSecret) throw apiError('Pharmacy photo storage is not configured.', 503);
  return { cloudName, apiKey, apiSecret };
}

function normalizedSlot(value) {
  const slot = String(value || '').trim().toLowerCase();
  if (slot === 'licensedocument') return 'licenseDocument';
  return slot;
}

function validPublicSlot(value) {
  const slot = normalizedSlot(value);
  if (!PUBLIC_PHOTO_SLOTS.has(slot)) throw apiError('Photo type must be inside or outside.');
  return slot;
}

function validRegistrationSlot(value) {
  const slot = normalizedSlot(value);
  if (!REGISTRATION_PHOTO_SLOTS.has(slot)) throw apiError('Registration image type is invalid.');
  return slot;
}

function detectedMimeType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return '';
}

function validatedPhoto(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw apiError('Select a pharmacy photo to upload.');
  if (buffer.length > MAX_PHOTO_BYTES) throw apiError('Each pharmacy photo must be 5 MB or smaller.', 413);
  const mimeType = detectedMimeType(buffer);
  if (!mimeType) throw apiError('Only JPEG, PNG, and WebP pharmacy photos are supported.', 415);
  return mimeType;
}

function cloudinarySignature(params, secret) {
  const value = Object.entries(params)
    .filter(([, item]) => item !== undefined && item !== null && item !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${key}=${item}`)
    .join('&');
  return createHash('sha1').update(`${value}${secret}`).digest('hex');
}

async function cloudinaryRequest(path, fields, file) {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = { ...fields, timestamp };
  const body = new FormData();
  for (const [key, value] of Object.entries(signed)) body.append(key, String(value));
  body.append('api_key', apiKey);
  body.append('signature', cloudinarySignature(signed, apiSecret));
  if (file) body.append('file', new Blob([file.buffer], { type: file.mimeType }), 'pharmacy-photo');

  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/${path}`, {
      method: 'POST', body, signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw apiError('Cloudinary could not be reached. Please try again.', 502);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Cloudinary pharmacy photo error:', result?.error?.message || response.status);
    throw apiError('The pharmacy photo could not be stored. Please try again.', 502);
  }
  return result;
}

async function uploadToCloudinary(ownerId, slot, buffer, publicIdOverride = '') {
  const mimeType = validatedPhoto(buffer);
  const publicId = publicIdOverride || `dawaconnect/pharmacies/${ownerId}/${slot}`;
  const result = await cloudinaryRequest('upload', {
    public_id: publicId, overwrite: 'true', invalidate: 'true',
  }, { buffer, mimeType });
  if (!result?.secure_url || !result?.public_id) throw apiError('Cloudinary returned an invalid upload result.', 502);
  return {
    url: result.secure_url, publicId: result.public_id,
    width: Number(result.width || 0), height: Number(result.height || 0),
    format: String(result.format || ''), bytes: Number(result.bytes || buffer.length), updatedAt: new Date(),
  };
}

async function destroyOnCloudinary(publicId) {
  if (publicId) await cloudinaryRequest('destroy', { public_id: publicId, invalidate: 'true' });
}

async function savePhoto(ownerId, slotValue, buffer) {
  const slot = validPublicSlot(slotValue);
  const db = await pharmacyDatabase();
  const profile = await db.collection('profiles').findOne({ ownerId: String(ownerId) });
  if (!profile) throw apiError('Pharmacy profile not found.', 404);
  const photo = await uploadToCloudinary(String(ownerId), slot, buffer);
  await db.collection('profiles').updateOne(
    { _id: profile._id, ownerId: String(ownerId) },
    { $set: { [`photos.${slot}`]: photo, updatedAt: new Date() } },
  );
  return { slot, photo };
}

async function saveLicenseDocument(ownerId, buffer) {
  if (!mongoose.isValidObjectId(ownerId)) throw apiError('Pharmacy registration not found.', 404);
  const db = await pharmacyDatabase();
  const userId = new mongoose.Types.ObjectId(String(ownerId));
  const user = await db.collection('users').findOne({ _id: userId }, { projection: { licenseDocument: 1 } });
  if (!user) throw apiError('Pharmacy registration not found.', 404);

  // A random identifier prevents the verification document from having a predictable public URL.
  const publicId = `dawaconnect/pharmacies/${ownerId}/verification/drug-sale-license-${randomBytes(18).toString('hex')}`;
  const photo = await uploadToCloudinary(String(ownerId), 'licenseDocument', buffer, publicId);
  try {
    await db.collection('users').updateOne(
      { _id: userId },
      { $set: { licenseDocument: photo, updatedAt: new Date() } },
    );
  } catch (error) {
    await destroyOnCloudinary(photo.publicId).catch(() => {});
    throw error;
  }
  if (user.licenseDocument?.publicId) {
    await destroyOnCloudinary(user.licenseDocument.publicId).catch((error) => {
      console.error('Old drug sale licence cleanup failed:', error.message);
    });
  }
  return { slot: 'licenseDocument', photo };
}

function registrationTokenHash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

export async function uploadRegistrationPhoto(token, slot, buffer) {
  const rawToken = String(token || '').trim();
  if (rawToken.length < 40) throw apiError('The registration photo upload session is invalid.', 401);
  const db = await pharmacyDatabase();
  const grant = await db.collection('registrationPhotoUploads').findOne({
    tokenHash: registrationTokenHash(rawToken), expiresAt: { $gt: new Date() },
  });
  if (!grant) throw apiError('The registration photo upload session has expired.', 401);
  const registrationSlot = validRegistrationSlot(slot);
  const result = registrationSlot === 'licenseDocument'
    ? await saveLicenseDocument(grant.ownerId, buffer)
    : await savePhoto(grant.ownerId, registrationSlot, buffer);
  await db.collection('registrationPhotoUploads').updateOne(
    { _id: grant._id },
    { $addToSet: { uploadedSlots: result.slot }, $set: { updatedAt: new Date() } },
  );
  return result;
}

export function uploadProfilePhoto(ownerId, slot, buffer) {
  return savePhoto(ownerId, slot, buffer);
}

export async function removeProfilePhoto(ownerId, slotValue) {
  const slot = validPublicSlot(slotValue);
  const db = await pharmacyDatabase();
  const profile = await db.collection('profiles').findOne({ ownerId: String(ownerId) });
  if (!profile) throw apiError('Pharmacy profile not found.', 404);
  const current = profile.photos?.[slot];
  if (!current) return { slot, removed: false };
  await destroyOnCloudinary(current.publicId);
  await db.collection('profiles').updateOne(
    { _id: profile._id, ownerId: String(ownerId) },
    { $unset: { [`photos.${slot}`]: '' }, $set: { updatedAt: new Date() } },
  );
  return { slot, removed: true };
}
