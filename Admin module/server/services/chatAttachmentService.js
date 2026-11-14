import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import ChatMediaCleanup from '../models/ChatMediaCleanup.js';
import ChatMessage from '../models/ChatMessage.js';

export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const CHAT_IMAGE_MAX_COUNT = 2;
export const CHAT_IMAGE_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const PENDING_UPLOAD_LIFETIME_MS = 24 * 60 * 60 * 1000;

function chatMediaError(message, status = 400, code = 'CHAT_MEDIA_ERROR') {
  return Object.assign(new Error(message), { status, code });
}

function cloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || '').trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw chatMediaError('Chat image storage is not configured.', 503, 'CHAT_MEDIA_NOT_CONFIGURED');
  }
  return { cloudName, apiKey, apiSecret };
}

function cloudinarySignature(params, secret) {
  const value = Object.entries(params)
    .filter(([, item]) => item !== undefined && item !== null && item !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${key}=${item}`)
    .join('&');
  return createHash('sha1').update(`${value}${secret}`).digest('hex');
}

function safeSignatureMatch(received, expected) {
  const left = Buffer.from(String(received || ''), 'utf8');
  const right = Buffer.from(String(expected || ''), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function encodedPublicId(publicId) {
  return publicId.split('/').map(encodeURIComponent).join('/');
}

export function chatUploadIdentity(identity) {
  if (['customer', 'guest'].includes(identity?.role) && identity.orderId) {
    return `${identity.role}-order:${String(identity.orderId)}`;
  }
  return `${identity.role}:${identity.sub}`;
}

export function normalizeChatAttachmentPayload(input, { conversationId, cloudName, apiSecret }) {
  if (!Array.isArray(input)) throw chatMediaError('Chat images must be sent as a list.');
  if (input.length > CHAT_IMAGE_MAX_COUNT) {
    throw chatMediaError(`You can attach at most ${CHAT_IMAGE_MAX_COUNT} images to one message.`);
  }

  const prefix = `dawaconnect/live-chat/${conversationId}/`;
  return input.map((item) => {
    const publicId = String(item?.publicId || '').trim();
    const format = String(item?.format || '').trim().toLowerCase();
    const version = Number(item?.version);
    const bytes = Number(item?.bytes);
    const width = Number(item?.width);
    const height = Number(item?.height);
    const uploadSignature = String(item?.uploadSignature || '').trim();

    if (!publicId.startsWith(prefix) || publicId.length > 300) {
      throw chatMediaError('This image does not belong to the current conversation.');
    }
    if (!CHAT_IMAGE_FORMATS.has(format)) {
      throw chatMediaError('Only JPEG, PNG, and WebP chat images are supported.', 415, 'UNSUPPORTED_CHAT_IMAGE');
    }
    if (!Number.isSafeInteger(version) || version <= 0) throw chatMediaError('The image upload version is invalid.');
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > CHAT_IMAGE_MAX_BYTES) {
      throw chatMediaError('Each chat image must be 5 MB or smaller.', 413, 'CHAT_IMAGE_TOO_LARGE');
    }
    if (!Number.isFinite(width) || width < 1 || !Number.isFinite(height) || height < 1) {
      throw chatMediaError('The image dimensions are invalid.');
    }

    const expectedSignature = cloudinarySignature({ public_id: publicId, version }, apiSecret);
    if (!safeSignatureMatch(uploadSignature, expectedSignature)) {
      throw chatMediaError('The image upload could not be verified.', 400, 'INVALID_CHAT_IMAGE_SIGNATURE');
    }

    const assetPath = `${encodedPublicId(publicId)}.${format}`;
    const baseUrl = `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload`;
    return {
      type: 'image',
      publicId,
      url: `${baseUrl}/v${version}/${assetPath}`,
      thumbnailUrl: `${baseUrl}/c_fill,w_480,h_360,q_auto,f_auto/v${version}/${assetPath}`,
      format,
      width: Math.round(width),
      height: Math.round(height),
      bytes: Math.round(bytes),
    };
  });
}

export async function createChatUploadGrant(identity, conversation) {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const conversationId = String(conversation._id || conversation.id);
  const publicId = `dawaconnect/live-chat/${conversationId}/${randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const uploadParams = { overwrite: 'false', public_id: publicId, timestamp };

  await ChatMediaCleanup.create({
    conversationId,
    publicId,
    uploadedBy: chatUploadIdentity(identity),
    deleteAfter: new Date(Date.now() + PENDING_UPLOAD_LIFETIME_MS),
    reason: 'pending_upload',
  });

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
    cloudName,
    apiKey,
    signature: cloudinarySignature(uploadParams, apiSecret),
    timestamp,
    publicId,
    overwrite: false,
    maxBytes: CHAT_IMAGE_MAX_BYTES,
    allowedFormats: [...CHAT_IMAGE_FORMATS],
  };
}

export async function authorizeChatAttachments(identity, conversation, input) {
  if (input === undefined || input === null || (Array.isArray(input) && input.length === 0)) return [];
  const attachments = normalizeChatAttachmentPayload(input || [], {
    conversationId: String(conversation._id),
    ...cloudinaryConfig(),
  });
  const publicIds = attachments.map((item) => item.publicId);
  const grants = await ChatMediaCleanup.find({
    conversationId: conversation._id,
    publicId: { $in: publicIds },
    uploadedBy: chatUploadIdentity(identity),
  }).select('publicId').lean();
  const authorized = new Set(grants.map((item) => item.publicId));
  if (authorized.size !== publicIds.length || publicIds.some((publicId) => !authorized.has(publicId))) {
    throw chatMediaError('One or more image upload grants are invalid or expired.', 403, 'INVALID_CHAT_UPLOAD_GRANT');
  }
  return attachments;
}

export async function commitChatAttachments(conversation, attachments) {
  if (!attachments.length) return;
  const publicIds = attachments.map((item) => item.publicId);
  if (conversation.expiresAt) {
    await ChatMediaCleanup.updateMany(
      { publicId: { $in: publicIds } },
      { $set: { deleteAfter: conversation.expiresAt, reason: 'guest_retention', attempts: 0, lastError: '' } },
    );
  } else {
    await ChatMediaCleanup.deleteMany({ publicId: { $in: publicIds } });
  }
}

async function destroyCloudinaryImage(publicId) {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: 'true', public_id: publicId, timestamp };
  const body = new URLSearchParams({
    ...params,
    api_key: apiKey,
    signature: cloudinarySignature(params, apiSecret),
  });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !['ok', 'not found'].includes(String(result.result || '').toLowerCase())) {
    throw new Error(result?.error?.message || 'Cloudinary image deletion failed.');
  }
}

export async function processDueChatMediaCleanup({ limit = 50 } = {}) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return 0;
  const due = await ChatMediaCleanup.find({ deleteAfter: { $lte: new Date() } })
    .sort({ deleteAfter: 1 }).limit(Math.min(100, Math.max(1, Number(limit) || 50)));
  let removed = 0;
  for (const item of due) {
    try {
      const message = await ChatMessage.findOne({ 'attachments.publicId': item.publicId })
        .select('expiresAt').lean();
      if (message && !message.expiresAt) {
        await item.deleteOne();
        continue;
      }
      if (message?.expiresAt && new Date(message.expiresAt).getTime() > Date.now()) {
        item.deleteAfter = message.expiresAt;
        item.reason = 'guest_retention';
        item.attempts = 0;
        item.lastError = '';
        await item.save();
        continue;
      }
      await destroyCloudinaryImage(item.publicId);
      await item.deleteOne();
      removed += 1;
    } catch (error) {
      item.attempts += 1;
      item.lastError = String(error.message || error).slice(0, 500);
      item.deleteAfter = new Date(Date.now() + Math.min(24, item.attempts) * 60 * 60 * 1000);
      await item.save();
    }
  }
  return removed;
}

export async function initializeChatMediaCleanup() {
  await ChatMediaCleanup.init();
  const removed = await processDueChatMediaCleanup();
  if (removed) console.log(`Removed ${removed} expired or abandoned chat image(s).`);
  const timer = setInterval(() => {
    processDueChatMediaCleanup().catch((error) => console.error('Chat media cleanup error:', error.message));
  }, 15 * 60 * 1000);
  timer.unref?.();
  return () => clearInterval(timer);
}
