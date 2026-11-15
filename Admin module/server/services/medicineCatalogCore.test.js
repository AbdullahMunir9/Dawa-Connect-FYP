import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCatalogImageRemovalUpdate, buildCatalogKey, buildCatalogSearchPlan, catalogPublicView, normalizeCatalogText, prepareCatalogRecord,
  prepareInventoryProduct, rankCatalogRecord, validateResolvedProductCatalogs,
} from './medicineCatalogCore.js';

test('normalizes medicine search terms consistently', () => {
  assert.equal(normalizeCatalogText('  Panadol® 500-MG  '), 'panadol 500 mg');
});

test('uses a DRAP registration number as the most stable catalogue key', () => {
  assert.equal(buildCatalogKey({ drapRegistrationNumber: 'DRAP 123 / 45' }), 'drap:drap-123-45');
});

test('prepares searchable catalogue metadata', () => {
  const record = prepareCatalogRecord({
    displayName: 'Panadol 500mg Tablets', brandName: 'Panadol', genericName: 'Paracetamol',
    category: 'Analgesic', unit: 'Tablets', strength: '500 mg', aliases: ['Acetaminophen'],
  });
  assert.match(record.searchText, /paracetamol/);
  assert.match(record.searchText, /acetaminophen/);
  assert.equal(record.status, 'active');
  assert.ok(record.catalogKey.startsWith('medicine:'));
});

test('ranks exact brand matches above generic contains matches', () => {
  const exact = prepareCatalogRecord({ displayName: 'Panadol', genericName: 'Paracetamol' });
  const generic = prepareCatalogRecord({ displayName: 'Other Brand', genericName: 'Panadol Substitute' });
  assert.ok(rankCatalogRecord(exact, 'panadol') > rankCatalogRecord(generic, 'panadol'));
});

test('builds a safe multi-token search filter and clamps the result limit', () => {
  const plan = buildCatalogSearchPlan('Panadol (500mg)', 500, { imagesOnly: true });
  assert.equal(plan.normalized, 'panadol 500mg');
  assert.equal(plan.safeLimit, 30);
  assert.deepEqual(plan.filter.$and, [
    { searchText: { $regex: 'panadol', $options: 'i' } },
    { searchText: { $regex: '500mg', $options: 'i' } },
  ]);
  assert.deepEqual(plan.filter['image.secureUrl'], { $type: 'string', $ne: '' });
});

test('does not query the database for one-character catalogue searches', () => {
  const plan = buildCatalogSearchPlan('p', 0);
  assert.equal(plan.safeLimit, 12);
  assert.equal(plan.filter, null);
});

test('rejects stale catalogue product and image selections instead of silently dropping them', () => {
  assert.throws(
    () => validateResolvedProductCatalogs({ catalogId: '507f1f77bcf86cd799439011', catalog: null }),
    /selected catalogue product is unavailable/,
  );
  assert.throws(
    () => validateResolvedProductCatalogs({ imageId: '507f1f77bcf86cd799439012', imageCatalog: null }),
    /selected catalogue image is unavailable/,
  );
});

test('rejects an image catalogue record that has no reusable image', () => {
  assert.throws(
    () => validateResolvedProductCatalogs({ imageId: '507f1f77bcf86cd799439012', imageCatalog: { displayName: 'No image' } }),
    /does not have an image/,
  );
});

test('clears every stored image reference when a shared catalogue image is removed', () => {
  const now = new Date('2026-11-15T00:00:00.000Z');
  assert.deepEqual(buildCatalogImageRemovalUpdate(now), {
    $set: {
      catalogImageId: null,
      catalogImageKey: null,
      image: null,
      imageUrl: '',
      updatedAt: now,
    },
    $unset: {
      'catalogSnapshot.image': '',
      'imageCatalogSnapshot.image': '',
    },
  });
});

test('creates a pharmacy product that reuses the shared catalogue image', () => {
  const catalog = {
    _id: '507f1f77bcf86cd799439011', catalogKey: 'medicine:panadol',
    displayName: 'Panadol 500mg Tablets', brandName: 'Panadol', genericName: 'Paracetamol',
    category: 'Analgesic', unit: 'Tablets', strength: '500 mg', dosageForm: 'Tablet',
    image: { secureUrl: 'https://res.cloudinary.com/demo/image/upload/panadol.webp', publicId: 'catalog/panadol', width: 600, height: 600 },
  };
  const product = prepareInventoryProduct({
    name: 'Panadol 500mg - 20 Tablets', category: 'Pain Relief', unit: 'Pack',
    price: '', stock: '', threshold: '', expiry: '',
  }, catalog);
  assert.equal(product.name, 'Panadol 500mg - 20 Tablets');
  assert.equal(product.price, 0);
  assert.equal(product.stock, 0);
  assert.equal(product.imageUrl, catalog.image.secureUrl);
  assert.equal(product.catalogSnapshot.genericName, 'Paracetamol');
});

test('allows a completely custom pharmacy product without a catalogue reference or image', () => {
  const product = prepareInventoryProduct({
    name: 'Pampers Baby Dry', genericName: '', category: 'Baby Care', unit: 'Pack',
    price: 1500, stock: 4, threshold: 1,
  }, null, null);
  assert.equal(product.catalogMedicineId, null);
  assert.equal(product.catalogImageId, null);
  assert.equal(product.name, 'Pampers Baby Dry');
  assert.equal(product.category, 'Baby Care');
  assert.equal(product.unit, 'Pack');
  assert.equal(product.imageUrl, '');
  assert.equal(product.catalogSnapshot, null);
});

test('allows a custom product to reuse an independently selected catalogue image', () => {
  const imageCatalog = {
    _id: '507f1f77bcf86cd799439012', catalogKey: 'medicine:shared-image',
    displayName: 'Baby Care Pack', genericName: '',
    image: { secureUrl: 'https://res.cloudinary.com/demo/image/upload/baby-pack.webp', publicId: 'catalog/baby-pack' },
  };
  const product = prepareInventoryProduct({ name: 'My custom baby product', category: 'Baby Care', unit: 'Pack' }, null, imageCatalog);
  assert.equal(product.catalogMedicineId, null);
  assert.equal(product.catalogImageId, imageCatalog._id);
  assert.equal(product.imageUrl, imageCatalog.image.secureUrl);
  assert.equal(product.imageCatalogSnapshot.displayName, 'Baby Care Pack');
});

test('allows catalogue metadata while deliberately using the generic fallback image', () => {
  const catalog = {
    _id: '507f1f77bcf86cd799439011', catalogKey: 'medicine:panadol',
    displayName: 'Panadol 500mg Tablets', brandName: 'Panadol', genericName: 'Paracetamol',
    category: 'Analgesic', unit: 'Tablets',
    image: { secureUrl: 'https://example.test/panadol.webp', publicId: 'catalog/panadol' },
  };
  const product = prepareInventoryProduct({}, catalog, null);
  assert.equal(product.catalogMedicineId, catalog._id);
  assert.equal(product.catalogImageId, null);
  assert.equal(product.name, catalog.displayName);
  assert.equal(product.genericName, catalog.genericName);
  assert.equal(product.image, null);
  assert.equal(product.imageUrl, '');
});

test('keeps selected catalogue metadata separate from a different shared image', () => {
  const catalog = {
    _id: '507f1f77bcf86cd799439011', catalogKey: 'medicine:metadata',
    displayName: 'Custom Panadol Listing', genericName: 'Paracetamol', category: 'Analgesic', unit: 'Tablets',
  };
  const imageCatalog = {
    _id: '507f1f77bcf86cd799439012', catalogKey: 'medicine:image', displayName: 'Panadol Pack Image',
    image: { secureUrl: 'https://example.test/shared.webp', publicId: 'catalog/shared' },
  };
  const product = prepareInventoryProduct({}, catalog, imageCatalog);
  assert.equal(product.catalogMedicineId, catalog._id);
  assert.equal(product.catalogImageId, imageCatalog._id);
  assert.equal(product.catalogSnapshot.displayName, catalog.displayName);
  assert.equal(product.imageCatalogSnapshot.displayName, imageCatalog.displayName);
  assert.equal(product.imageUrl, imageCatalog.image.secureUrl);
});

test('rejects missing names and invalid inventory numbers', () => {
  assert.throws(() => prepareInventoryProduct({}, null, null), /Enter a medicine name/);
  assert.throws(() => prepareInventoryProduct({ name: 'Test', price: -1 }, null, null), /Price must be zero or a positive number/);
  assert.throws(() => prepareInventoryProduct({ name: 'Test', stock: 'not-a-number' }, null, null), /Stock quantity must be zero or a positive number/);
  assert.throws(() => prepareInventoryProduct({ name: 'Test', threshold: -2 }, null, null), /Low-stock alert must be zero or a positive number/);
});

test('rejects invalid expiry values and accepts an omitted expiry', () => {
  assert.throws(() => prepareInventoryProduct({ name: 'Test item', expiry: 'not-a-date' }, null, null), /valid expiry date/);
  assert.equal(prepareInventoryProduct({ name: 'Test item', expiry: '' }, null, null).expiry, null);
});

test('normalizes and bounds catalogue fields and aliases', () => {
  const record = prepareCatalogRecord({
    displayName: `  ${'A'.repeat(200)}  `,
    genericName: '  Paracetamol   USP ',
    aliases: [' PCM ', 'PCM', '', ...Array.from({ length: 40 }, (_, index) => `alias-${index}`)],
    status: 'not-valid',
  });
  assert.equal(record.displayName.length, 160);
  assert.equal(record.genericName, 'Paracetamol USP');
  assert.equal(record.status, 'active');
  assert.equal(record.aliases[0], 'PCM');
  assert.equal(record.aliases.length, 30);
});

test('keeps catalogue identity stable when editing an existing record', () => {
  const existing = prepareCatalogRecord({ displayName: 'Panadol', genericName: 'Paracetamol' });
  const edited = prepareCatalogRecord({ displayName: 'Panadol New Label' }, { existing });
  assert.equal(edited.catalogKey, existing.catalogKey);
  assert.equal(edited.genericName, 'Paracetamol');
});

test('public catalogue responses do not expose Cloudinary public ids or source rights notes', () => {
  const view = catalogPublicView({
    _id: '507f1f77bcf86cd799439011', catalogKey: 'medicine:test', displayName: 'Test Medicine',
    image: { secureUrl: 'https://example.test/image.webp', publicId: 'secret-ish-id', sourceUrl: 'private' },
  });
  assert.equal(view.image.secureUrl, 'https://example.test/image.webp');
  assert.equal(Object.hasOwn(view.image, 'publicId'), false);
  assert.equal(Object.hasOwn(view.image, 'sourceUrl'), false);
});
