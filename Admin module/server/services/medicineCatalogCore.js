import { createHash } from 'node:crypto';

export const DEFAULT_MEDICINE_CATEGORIES = Object.freeze([
  'Analgesic', 'Antibiotic', 'Antidiabetic', 'Antacid', 'Antihistamine',
  'Anti-inflammatory', 'Cardiovascular', 'Supplement', 'Antiviral',
  'Dermatology', 'Respiratory', 'Gastrointestinal', 'Neurology',
  'Eye & Ear Care', 'First Aid', 'Personal Care', 'Baby Care', 'Hygiene', 'Other',
]);

export const DEFAULT_MEDICINE_UNITS = Object.freeze([
  'Tablets', 'Capsules', 'Syrup (ml)', 'Suspension (ml)', 'Injection',
  'Drops', 'Cream (g)', 'Ointment (g)', 'Gel (g)', 'Inhaler',
  'Sachets', 'Powder', 'Solution (ml)', 'Device', 'Pack', 'Other',
]);

export function normalizeCatalogText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function text(value, max, fallback = '') {
  const result = String(value ?? '').trim().replace(/\s+/g, ' ');
  return (result || fallback).slice(0, max);
}

function optionalNumber(value, label) {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw Object.assign(new Error(`${label} must be zero or a positive number.`), { status: 400 });
  return number;
}

export function buildCatalogKey(record) {
  const registration = normalizeCatalogText(record?.drapRegistrationNumber);
  if (registration) return `drap:${registration.replace(/\s/g, '-')}`;
  const identity = [
    record?.brandName || record?.displayName,
    record?.genericName,
    record?.strength,
    record?.dosageForm,
    record?.manufacturer,
    record?.packSize,
  ].map(normalizeCatalogText).filter(Boolean).join('|');
  if (!identity) throw Object.assign(new Error('A catalogue medicine needs a name.'), { status: 400 });
  return `medicine:${createHash('sha256').update(identity).digest('hex').slice(0, 24)}`;
}

export function prepareCatalogRecord(input, { existing = null } = {}) {
  const displayName = text(input?.displayName || input?.brandName, 160, existing?.displayName);
  if (displayName.length < 2) throw Object.assign(new Error('Medicine display name must contain at least 2 characters.'), { status: 400 });
  const brandName = text(input?.brandName, 120, existing?.brandName || displayName);
  const genericName = text(input?.genericName, 180, existing?.genericName);
  const category = text(input?.category, 80, existing?.category || 'Other');
  const unit = text(input?.unit, 80, existing?.unit || 'Other');
  const aliases = [...new Set([
    ...(Array.isArray(existing?.aliases) ? existing.aliases : []),
    ...(Array.isArray(input?.aliases) ? input.aliases : String(input?.aliases || '').split(',')),
  ].map((item) => text(item, 120)).filter(Boolean))].slice(0, 30);
  const record = {
    displayName,
    brandName,
    genericName,
    category,
    unit,
    strength: text(input?.strength, 80, existing?.strength),
    dosageForm: text(input?.dosageForm, 80, existing?.dosageForm),
    packSize: text(input?.packSize, 80, existing?.packSize),
    manufacturer: text(input?.manufacturer, 160, existing?.manufacturer),
    drapRegistrationNumber: text(input?.drapRegistrationNumber, 100, existing?.drapRegistrationNumber),
    aliases,
    status: ['active', 'draft', 'retired'].includes(String(input?.status || existing?.status))
      ? String(input?.status || existing?.status)
      : 'active',
  };
  record.catalogKey = text(input?.catalogKey, 100, existing?.catalogKey) || buildCatalogKey(record);
  record.searchText = [
    record.displayName, record.brandName, record.genericName, record.strength,
    record.dosageForm, record.manufacturer, record.drapRegistrationNumber,
    record.category, record.unit, ...record.aliases,
  ].map(normalizeCatalogText).filter(Boolean).join(' ');
  return record;
}

export function rankCatalogRecord(record, query) {
  const normalized = normalizeCatalogText(query);
  if (!normalized) return 0;
  const display = normalizeCatalogText(record.displayName);
  const brand = normalizeCatalogText(record.brandName);
  const generic = normalizeCatalogText(record.genericName);
  if (display === normalized || brand === normalized) return 100;
  if (display.startsWith(normalized) || brand.startsWith(normalized)) return 80;
  if (generic.startsWith(normalized)) return 65;
  if (record.searchText?.includes(normalized)) return 40;
  return 0;
}

export function buildCatalogSearchPlan(query, limit = 12, { imagesOnly = false } = {}) {
  const normalized = normalizeCatalogText(query);
  const safeLimit = Math.min(30, Math.max(1, Number(limit) || 12));
  if (normalized.length < 2) return { normalized, safeLimit, filter: null };
  const tokens = normalized.split(' ').filter(Boolean).slice(0, 6);
  const filters = tokens.map((token) => ({
    searchText: { $regex: token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
  }));
  return {
    normalized,
    safeLimit,
    filter: {
      status: 'active',
      $and: filters,
      ...(imagesOnly ? { 'image.secureUrl': { $type: 'string', $ne: '' } } : {}),
    },
  };
}

export function validateResolvedProductCatalogs({ catalogId = '', catalog = null, imageId = '', imageCatalog = null } = {}) {
  if (catalogId && !catalog) {
    throw Object.assign(new Error('The selected catalogue product is unavailable. Search for it again or add the product manually.'), { status: 400 });
  }
  if (imageId && !imageCatalog) {
    throw Object.assign(new Error('The selected catalogue image is unavailable. Search for another image or use the generic image.'), { status: 400 });
  }
  if (imageCatalog && !imageCatalog.image?.secureUrl) {
    throw Object.assign(new Error('The selected catalogue item does not have an image.'), { status: 400 });
  }
  return { catalog, imageCatalog };
}

export function buildCatalogImageRemovalUpdate(now = new Date()) {
  return {
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
  };
}

export function prepareInventoryProduct(input, catalog = null, imageCatalog = catalog) {
  const name = text(input?.name, 160, catalog?.displayName);
  if (name.length < 2) throw Object.assign(new Error('Enter a medicine name.'), { status: 400 });
  const genericName = text(input?.genericName, 180, catalog?.genericName);
  const category = text(input?.category, 80, catalog?.category || 'Other');
  const unit = text(input?.unit, 80, catalog?.unit || 'Other');
  const packSize = text(input?.packSize, 80, catalog?.packSize);
  const expiryValue = text(input?.expiry, 30);
  if (expiryValue && Number.isNaN(new Date(expiryValue).getTime())) {
    throw Object.assign(new Error('Enter a valid expiry date or leave it empty.'), { status: 400 });
  }
  const image = imageCatalog?.image?.secureUrl ? {
    secureUrl: String(imageCatalog.image.secureUrl),
    publicId: String(imageCatalog.image.publicId || ''),
    width: Number(imageCatalog.image.width || 0),
    height: Number(imageCatalog.image.height || 0),
    alt: String(imageCatalog.image.alt || `${imageCatalog.displayName} product image`),
  } : null;
  return {
    catalogMedicineId: catalog?._id ? String(catalog._id) : null,
    catalogKey: catalog?.catalogKey || null,
    catalogImageId: imageCatalog?._id ? String(imageCatalog._id) : null,
    catalogImageKey: imageCatalog?.catalogKey || null,
    name,
    genericName,
    category,
    unit,
    packSize,
    price: optionalNumber(input?.price, 'Price'),
    stock: optionalNumber(input?.stock, 'Stock quantity'),
    threshold: optionalNumber(input?.threshold, 'Low-stock alert'),
    expiry: expiryValue || null,
    image,
    imageUrl: image?.secureUrl || '',
    catalogSnapshot: catalog ? {
      displayName: catalog.displayName,
      brandName: catalog.brandName || '',
      genericName: catalog.genericName || '',
      strength: catalog.strength || '',
      dosageForm: catalog.dosageForm || '',
      packSize: catalog.packSize || '',
      manufacturer: catalog.manufacturer || '',
      category: catalog.category || '',
      unit: catalog.unit || '',
      drapRegistrationNumber: catalog.drapRegistrationNumber || '',
      image,
    } : null,
    imageCatalogSnapshot: imageCatalog ? {
      displayName: imageCatalog.displayName,
      brandName: imageCatalog.brandName || '',
      genericName: imageCatalog.genericName || '',
      image,
    } : null,
  };
}

export function catalogPublicView(record) {
  return {
    id: String(record._id),
    catalogKey: record.catalogKey,
    displayName: record.displayName,
    brandName: record.brandName || '',
    genericName: record.genericName || '',
    category: record.category || 'Other',
    unit: record.unit || 'Other',
    strength: record.strength || '',
    dosageForm: record.dosageForm || '',
    packSize: record.packSize || '',
    manufacturer: record.manufacturer || '',
    drapRegistrationNumber: record.drapRegistrationNumber || '',
    image: record.image?.secureUrl ? {
      secureUrl: String(record.image.secureUrl),
      width: Number(record.image.width || 0),
      height: Number(record.image.height || 0),
      alt: String(record.image.alt || `${record.displayName} medicine image`),
    } : null,
  };
}
