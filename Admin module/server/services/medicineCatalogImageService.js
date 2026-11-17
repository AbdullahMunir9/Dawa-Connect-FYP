import { createHash } from 'node:crypto';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REMOTE_URL_LENGTH = 2048;

function apiError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function firstConfigured(names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

function parseCloudinaryUrl(value) {
  const raw = String(value || '').trim().replace(/^CLOUDINARY_URL\s*=\s*/i, '');
  if (!raw) return {};
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'cloudinary:' || !parsed.hostname || !parsed.username || !parsed.password) return {};
    return {
      cloudName: decodeURIComponent(parsed.hostname),
      apiKey: decodeURIComponent(parsed.username),
      apiSecret: decodeURIComponent(parsed.password),
    };
  } catch {
    return {};
  }
}

export function medicineCatalogCloudinaryConfig() {
  const urlConfig = parseCloudinaryUrl(firstConfigured([
    'MEDICINE_CATALOG_CLOUDINARY_URL',
    'PRODUCT_CATALOG_CLOUDINARY_URL',
    'PRODUCT_CLOUDINARY_URL',
    'CATALOG_CLOUDINARY_URL',
  ]));
  const cloudName = firstConfigured([
    'MEDICINE_CATALOG_CLOUDINARY_CLOUD_NAME',
    'PRODUCT_CATALOG_CLOUDINARY_CLOUD_NAME',
    'PRODUCT_CLOUDINARY_CLOUD_NAME',
    'CATALOG_CLOUDINARY_CLOUD_NAME',
  ]) || urlConfig.cloudName || '';
  const apiKey = firstConfigured([
    'MEDICINE_CATALOG_CLOUDINARY_API_KEY',
    'PRODUCT_CATALOG_CLOUDINARY_API_KEY',
    'PRODUCT_CLOUDINARY_API_KEY',
    'CATALOG_CLOUDINARY_API_KEY',
  ]) || urlConfig.apiKey || '';
  const apiSecret = firstConfigured([
    'MEDICINE_CATALOG_CLOUDINARY_API_SECRET',
    'PRODUCT_CATALOG_CLOUDINARY_API_SECRET',
    'PRODUCT_CLOUDINARY_API_SECRET',
    'CATALOG_CLOUDINARY_API_SECRET',
  ]) || urlConfig.apiSecret || '';
  const folder = (firstConfigured([
    'MEDICINE_CATALOG_CLOUDINARY_FOLDER',
    'PRODUCT_CATALOG_CLOUDINARY_FOLDER',
    'PRODUCT_CLOUDINARY_FOLDER',
    'CATALOG_CLOUDINARY_FOLDER',
  ]) || 'dawaconnect/medicine-catalog').replace(/^\/+|\/+$/g, '');
  if (!cloudName || !apiKey || !apiSecret) {
    const missing = [
      !cloudName && 'cloud name',
      !apiKey && 'API key',
      !apiSecret && 'API secret',
    ].filter(Boolean).join(', ');
    throw apiError(`The dedicated medicine catalogue image storage is missing: ${missing}.`, 503);
  }
  return { cloudName, apiKey, apiSecret, folder };
}

function detectedMimeType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return '';
}

export function validateMedicineCatalogImage(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw apiError('Select a medicine image to upload.');
  if (buffer.length > MAX_IMAGE_BYTES) throw apiError('Medicine images must be 5 MB or smaller.', 413);
  const mimeType = detectedMimeType(buffer);
  if (!mimeType) throw apiError('Only JPEG, PNG, and WebP medicine images are supported.', 415);
  return mimeType;
}

export function validateMedicineCatalogImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) throw apiError('Enter a direct image URL to import.');
  if (raw.length > MAX_REMOTE_URL_LENGTH) throw apiError('The image URL is too long.');
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw apiError('Enter a valid HTTPS image URL.');
  }
  if (parsed.protocol !== 'https:') throw apiError('Only HTTPS image URLs can be imported.');
  if (parsed.username || parsed.password) throw apiError('Image URLs containing credentials are not supported.');
  if (!parsed.hostname) throw apiError('Enter a valid HTTPS image URL.');
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname === '0.0.0.0'
    || hostname === '127.0.0.1'
    || hostname === '::'
    || hostname === '::1'
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^169\.254\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    throw apiError('Private or local image URLs cannot be imported.');
  }
  parsed.hash = '';
  return parsed.toString();
}

function signature(params, secret) {
  const value = Object.entries(params)
    .filter(([, item]) => item !== undefined && item !== null && item !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${key}=${item}`)
    .join('&');
  return createHash('sha1').update(`${value}${secret}`).digest('hex');
}

async function cloudinaryRequest(path, fields, file) {
  const { cloudName, apiKey, apiSecret } = medicineCatalogCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = { ...fields, timestamp };
  const body = new FormData();
  Object.entries(signed).forEach(([key, value]) => body.append(key, String(value)));
  body.append('api_key', apiKey);
  body.append('signature', signature(signed, apiSecret));
  if (file?.buffer) body.append('file', new Blob([file.buffer], { type: file.mimeType }), 'medicine-image');
  if (file?.remoteUrl) body.append('file', file.remoteUrl);
  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/${path}`, {
      method: 'POST', body, signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw apiError('Cloudinary could not be reached. Please try again.', 502);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Cloudinary medicine catalogue error:', result?.error?.message || response.status);
    throw apiError('The medicine image could not be stored.', 502);
  }
  return result;
}

function safePublicIdPart(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'medicine';
}

function imageRecord(result, { displayName, sourceUrl = '', fallbackBytes = 0 }) {
  if (!result?.secure_url || !result?.public_id) throw apiError('Cloudinary returned an invalid image result.', 502);
  return {
    secureUrl: result.secure_url,
    publicId: result.public_id,
    width: Number(result.width || 0),
    height: Number(result.height || 0),
    format: String(result.format || ''),
    bytes: Number(result.bytes || fallbackBytes),
    alt: `${displayName} medicine image`,
    sourceUrl: String(sourceUrl || '').trim().slice(0, MAX_REMOTE_URL_LENGTH),
    rightsConfirmed: true,
    uploadedAt: new Date(),
  };
}

export async function uploadMedicineCatalogImage({ catalogKey, displayName, buffer, sourceUrl = '', rightsConfirmed = false }) {
  if (rightsConfirmed !== true) throw apiError('Confirm that DawaConnect has permission to use this product image.');
  const mimeType = validateMedicineCatalogImage(buffer);
  const { folder } = medicineCatalogCloudinaryConfig();
  const publicId = `${folder}/${safePublicIdPart(catalogKey || displayName)}`;
  const result = await cloudinaryRequest('upload', {
    public_id: publicId,
    overwrite: 'true',
    invalidate: 'true',
  }, { buffer, mimeType });
  return imageRecord(result, { displayName, sourceUrl, fallbackBytes: buffer.length });
}

export async function importMedicineCatalogImageFromUrl({ catalogKey, displayName, imageUrl, rightsConfirmed = false }) {
  if (rightsConfirmed !== true) throw apiError('Confirm that DawaConnect has permission to use this product image.');
  const remoteUrl = validateMedicineCatalogImageUrl(imageUrl);
  const { folder } = medicineCatalogCloudinaryConfig();
  const publicId = `${folder}/${safePublicIdPart(catalogKey || displayName)}`;
  const result = await cloudinaryRequest('upload', {
    public_id: publicId,
    overwrite: 'true',
    invalidate: 'true',
  }, { remoteUrl });
  if (Number(result?.bytes || 0) > MAX_IMAGE_BYTES) {
    try {
      await deleteMedicineCatalogImage(result.public_id);
    } catch (error) {
      console.error('Oversized medicine catalogue import cleanup is pending:', error?.message || error);
    }
    throw apiError('Medicine images must be 5 MB or smaller.', 413);
  }
  return imageRecord(result, { displayName, sourceUrl: remoteUrl });
}

export async function deleteMedicineCatalogImage(publicId) {
  if (!publicId) return;
  await cloudinaryRequest('destroy', { public_id: publicId, invalidate: 'true' });
}
