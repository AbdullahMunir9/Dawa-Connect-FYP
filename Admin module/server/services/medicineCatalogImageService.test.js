import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  deleteMedicineCatalogImage, medicineCatalogCloudinaryConfig,
  importMedicineCatalogImageFromUrl, uploadMedicineCatalogImage,
  validateMedicineCatalogImage, validateMedicineCatalogImageUrl,
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
  await assert.rejects(
    importMedicineCatalogImageFromUrl({
      displayName: 'Panadol', imageUrl: 'https://manufacturer.example/panadol.png', rightsConfirmed: false,
    }),
    /Confirm that DawaConnect has permission/,
  );
});

test('accepts public HTTPS image URLs and removes URL fragments', () => {
  assert.equal(
    validateMedicineCatalogImageUrl(' https://manufacturer.example/images/panadol.png?size=large#preview '),
    'https://manufacturer.example/images/panadol.png?size=large',
  );
});

test('rejects unsafe medicine catalogue image URLs', () => {
  const unsafeUrls = [
    '',
    'not-a-url',
    'http://manufacturer.example/panadol.png',
    'https://user:password@manufacturer.example/panadol.png',
    'https://localhost/panadol.png',
    'https://127.0.0.1/panadol.png',
    'https://10.0.0.5/panadol.png',
    'https://172.20.1.5/panadol.png',
    'https://192.168.1.5/panadol.png',
    'https://169.254.1.5/panadol.png',
    'https://catalog.internal/panadol.png',
  ];
  unsafeUrls.forEach((url) => assert.throws(() => validateMedicineCatalogImageUrl(url)));
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

test('imports a public image URL into Cloudinary and stores the managed Cloudinary URL', async () => {
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
      secure_url: 'https://res.cloudinary.com/catalog-cloud/image/upload/catalog/images/panadol.webp',
      public_id: 'catalog/images/medicine-panadol', width: 800, height: 800, format: 'webp', bytes: 4096,
    }) };
  };
  try {
    const sourceUrl = 'https://manufacturer.example/products/panadol.webp';
    const image = await importMedicineCatalogImageFromUrl({
      catalogKey: 'medicine:panadol', displayName: 'Panadol', imageUrl: sourceUrl, rightsConfirmed: true,
    });
    assert.equal(request.url, 'https://api.cloudinary.com/v1_1/catalog-cloud/image/upload');
    const body = request.options.body;
    assert.equal(body.get('file'), sourceUrl);
    assert.equal(body.get('resource_type'), null);
    assert.equal(body.get('api_key'), 'catalog-key');
    assert.equal(body.get('public_id'), 'catalog/images/medicine-panadol');
    const timestamp = body.get('timestamp');
    const signedValue = `invalidate=true&overwrite=true&public_id=catalog/images/medicine-panadol&timestamp=${timestamp}catalog-secret`;
    assert.equal(body.get('signature'), createHash('sha1').update(signedValue).digest('hex'));
    assert.equal(image.secureUrl, 'https://res.cloudinary.com/catalog-cloud/image/upload/catalog/images/panadol.webp');
    assert.equal(image.sourceUrl, sourceUrl);
    assert.equal(image.bytes, 4096);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.cloud === undefined) delete process.env.MEDICINE_CATALOG_CLOUDINARY_CLOUD_NAME; else process.env.MEDICINE_CATALOG_CLOUDINARY_CLOUD_NAME = previous.cloud;
    if (previous.key === undefined) delete process.env.MEDICINE_CATALOG_CLOUDINARY_API_KEY; else process.env.MEDICINE_CATALOG_CLOUDINARY_API_KEY = previous.key;
    if (previous.secret === undefined) delete process.env.MEDICINE_CATALOG_CLOUDINARY_API_SECRET; else process.env.MEDICINE_CATALOG_CLOUDINARY_API_SECRET = previous.secret;
    if (previous.folder === undefined) delete process.env.MEDICINE_CATALOG_CLOUDINARY_FOLDER; else process.env.MEDICINE_CATALOG_CLOUDINARY_FOLDER = previous.folder;
  }
});

test('removes a remote image when Cloudinary reports it exceeds the catalogue size limit', async () => {
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
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/upload')) {
      return { ok: true, json: async () => ({
        secure_url: 'https://res.cloudinary.com/catalog-cloud/image/upload/catalog/images/large.png',
        public_id: 'catalog/images/medicine-large', bytes: 5 * 1024 * 1024 + 1,
      }) };
    }
    return { ok: true, json: async () => ({ result: 'ok' }) };
  };
  try {
    await assert.rejects(
      importMedicineCatalogImageFromUrl({
        catalogKey: 'medicine:large', displayName: 'Large image',
        imageUrl: 'https://manufacturer.example/large.png', rightsConfirmed: true,
      }),
      /5 MB or smaller/,
    );
    assert.equal(requests.length, 2);
    assert.equal(requests[0].options.body.get('file'), 'https://manufacturer.example/large.png');
    assert.equal(requests[1].url, 'https://api.cloudinary.com/v1_1/catalog-cloud/image/destroy');
    assert.equal(requests[1].options.body.get('public_id'), 'catalog/images/medicine-large');
    assert.equal(requests[1].options.body.get('file'), null);
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
