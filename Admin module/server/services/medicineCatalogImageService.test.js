import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  deleteMedicineCatalogImage, medicineCatalogCloudinaryConfig,
  uploadMedicineCatalogImage, validateMedicineCatalogImage,
} from './medicineCatalogImageService.js';

test('recognizes supported catalogue image signatures', () => {
  assert.equal(validateMedicineCatalogImage(Buffer.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg');
  assert.equal(validateMedicineCatalogImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(validateMedicineCatalogImage(Buffer.from('RIFF0000WEBP')), 'image/webp');
});

test('rejects empty, unsupported, and oversized catalogue images', () => {
  assert.throws(() => validateMedicineCatalogImage(Buffer.alloc(0)), /Select a medicine image/);
  assert.throws(() => validateMedicineCatalogImage(Buffer.from('not-an-image')), /Only JPEG, PNG, and WebP/);
  assert.throws(() => validateMedicineCatalogImage(Buffer.alloc(5 * 1024 * 1024 + 1)), /5 MB or smaller/);
});

test('requires image usage rights before contacting Cloudinary', async () => {
  await assert.rejects(
    uploadMedicineCatalogImage({ displayName: 'Panadol', buffer: Buffer.from([0xff, 0xd8, 0xff]), rightsConfirmed: false }),
    /Confirm that DawaConnect has permission/,
  );
});

test('accepts the dedicated product catalogue Cloudinary environment names', () => {
  const previous = {
    cloud: process.env.PRODUCT_CATALOG_CLOUDINARY_CLOUD_NAME,
    key: process.env.PRODUCT_CATALOG_CLOUDINARY_API_KEY,
    secret: process.env.PRODUCT_CATALOG_CLOUDINARY_API_SECRET,
    folder: process.env.PRODUCT_CATALOG_CLOUDINARY_FOLDER,
  };
  process.env.PRODUCT_CATALOG_CLOUDINARY_CLOUD_NAME = 'catalog-cloud';
  process.env.PRODUCT_CATALOG_CLOUDINARY_API_KEY = 'catalog-key';
  process.env.PRODUCT_CATALOG_CLOUDINARY_API_SECRET = 'catalog-secret';
  process.env.PRODUCT_CATALOG_CLOUDINARY_FOLDER = '/catalog/images/';
  try {
    assert.deepEqual(medicineCatalogCloudinaryConfig(), {
      cloudName: 'catalog-cloud', apiKey: 'catalog-key', apiSecret: 'catalog-secret', folder: 'catalog/images',
    });
  } finally {
    if (previous.cloud === undefined) delete process.env.PRODUCT_CATALOG_CLOUDINARY_CLOUD_NAME; else process.env.PRODUCT_CATALOG_CLOUDINARY_CLOUD_NAME = previous.cloud;
    if (previous.key === undefined) delete process.env.PRODUCT_CATALOG_CLOUDINARY_API_KEY; else process.env.PRODUCT_CATALOG_CLOUDINARY_API_KEY = previous.key;
    if (previous.secret === undefined) delete process.env.PRODUCT_CATALOG_CLOUDINARY_API_SECRET; else process.env.PRODUCT_CATALOG_CLOUDINARY_API_SECRET = previous.secret;
    if (previous.folder === undefined) delete process.env.PRODUCT_CATALOG_CLOUDINARY_FOLDER; else process.env.PRODUCT_CATALOG_CLOUDINARY_FOLDER = previous.folder;
  }
});

test('accepts Cloudinary catalogue URL configuration without using the general media account', () => {
  const previousUrl = process.env.MEDICINE_CATALOG_CLOUDINARY_URL;
  const previousFolder = process.env.MEDICINE_CATALOG_CLOUDINARY_FOLDER;
  process.env.MEDICINE_CATALOG_CLOUDINARY_URL = 'cloudinary://catalog-key:catalog-secret@catalog-cloud';
  process.env.MEDICINE_CATALOG_CLOUDINARY_FOLDER = '/catalog/images/';
  try {
    assert.deepEqual(medicineCatalogCloudinaryConfig(), {
      cloudName: 'catalog-cloud', apiKey: 'catalog-key', apiSecret: 'catalog-secret', folder: 'catalog/images',
    });
  } finally {
    if (previousUrl === undefined) delete process.env.MEDICINE_CATALOG_CLOUDINARY_URL; else process.env.MEDICINE_CATALOG_CLOUDINARY_URL = previousUrl;
    if (previousFolder === undefined) delete process.env.MEDICINE_CATALOG_CLOUDINARY_FOLDER; else process.env.MEDICINE_CATALOG_CLOUDINARY_FOLDER = previousFolder;
  }
});

test('uploads an image with Cloudinary-signable parameters and excludes resource_type from the signature', async () => {
  const previous = {
    cloud: process.env.MEDICINE_CATALOG_CLOUDINARY_CLOUD_NAME,
    key: process.env.MEDICINE_CATALOG_CLOUDINARY_API_KEY,
    secret: process.env.MEDICINE_CATALOG_CLOUDINARY_API_SECRET,
    folder: process.env.MEDICINE_CATALOG_CLOUDINARY_FOLDER,
    fetch: globalThis.fetch,
  };
  process.env.MEDICINE_CATALOG_CLOUDINARY_CLOUD_NAME = 'catalog-cloud';
  process.env.MEDICINE_CATALOG_CLOUDINARY_API_KEY = 'catalog-key';
  process.env.MEDICINE_CATALOG_CLOUDINARY_API_SECRET = 'catalog-secret';
  process.env.MEDICINE_CATALOG_CLOUDINARY_FOLDER = 'catalog/images';
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({
      secure_url: 'https://res.cloudinary.com/catalog-cloud/image/upload/catalog/images/panadol.png',
      public_id: 'catalog/images/medicine-panadol', width: 1, height: 1, format: 'png', bytes: 68,
    }) };
  };
  try {
    const image = await uploadMedicineCatalogImage({
      catalogKey: 'medicine:panadol', displayName: 'Panadol',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), rightsConfirmed: true,
    });
    assert.equal(request.url, 'https://api.cloudinary.com/v1_1/catalog-cloud/image/upload');
    const body = request.options.body;
    assert.equal(body.get('resource_type'), null);
    assert.equal(body.get('api_key'), 'catalog-key');
    assert.equal(body.get('public_id'), 'catalog/images/medicine-panadol');
    const timestamp = body.get('timestamp');
    const signedValue = `invalidate=true&overwrite=true&public_id=catalog/images/medicine-panadol&timestamp=${timestamp}catalog-secret`;
    assert.equal(body.get('signature'), createHash('sha1').update(signedValue).digest('hex'));
    assert.equal(image.secureUrl, 'https://res.cloudinary.com/catalog-cloud/image/upload/catalog/images/panadol.png');
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.cloud === undefined) delete process.env.MEDICINE_CATALOG_CLOUDINARY_CLOUD_NAME; else process.env.MEDICINE_CATALOG_CLOUDINARY_CLOUD_NAME = previous.cloud;
    if (previous.key === undefined) delete process.env.MEDICINE_CATALOG_CLOUDINARY_API_KEY; else process.env.MEDICINE_CATALOG_CLOUDINARY_API_KEY = previous.key;
    if (previous.secret === undefined) delete process.env.MEDICINE_CATALOG_CLOUDINARY_API_SECRET; else process.env.MEDICINE_CATALOG_CLOUDINARY_API_SECRET = previous.secret;
    if (previous.folder === undefined) delete process.env.MEDICINE_CATALOG_CLOUDINARY_FOLDER; else process.env.MEDICINE_CATALOG_CLOUDINARY_FOLDER = previous.folder;
  }
});

test('does not contact Cloudinary when there is no image to delete', async () => {
  await assert.doesNotReject(deleteMedicineCatalogImage(''));
});
