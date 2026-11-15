import test from 'node:test';
import assert from 'node:assert/strict';
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

test('does not contact Cloudinary when there is no image to delete', async () => {
  await assert.doesNotReject(deleteMedicineCatalogImage(''));
});
