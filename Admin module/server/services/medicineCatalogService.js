import mongoose from 'mongoose';
import pharmacyDb from '../db/pharmacyConnection.js';
import {
  buildCatalogImageRemovalUpdate, buildCatalogSearchPlan, catalogPublicView, DEFAULT_MEDICINE_CATEGORIES,
  DEFAULT_MEDICINE_UNITS, normalizeCatalogText, prepareCatalogRecord, rankCatalogRecord,
} from './medicineCatalogCore.js';
import {
  deleteMedicineCatalogImage, importMedicineCatalogImageFromUrl, uploadMedicineCatalogImage,
} from './medicineCatalogImageService.js';
import { parseMedicineCatalogCsv } from './medicineCatalogCsvCore.js';

const { ObjectId } = mongoose.Types;
const COLLECTION = 'medicineCatalog';
const PRODUCTS_COLLECTION = process.env.PHARMACY_PRODUCTS_COLLECTION || 'products';

async function catalogDatabase() {
  if (pharmacyDb.readyState !== 1) await pharmacyDb.asPromise();
  return pharmacyDb.db;
}

function apiError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function objectId(value) {
  if (!ObjectId.isValid(String(value))) throw apiError('Invalid catalogue medicine id.');
  return new ObjectId(String(value));
}

function catalogAdminView(record) {
  return {
    ...catalogPublicView(record),
    status: record.status || 'active',
    aliases: Array.isArray(record.aliases) ? record.aliases : [],
    source: record.source || null,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

export async function findCatalogMedicine(id, { activeOnly = true } = {}) {
  if (!id) throw apiError('Select a medicine from the DawaConnect catalogue first.');
  const db = await catalogDatabase();
  return db.collection(COLLECTION).findOne({
    _id: objectId(id),
    ...(activeOnly ? { status: 'active' } : {}),
  });
}

export async function searchMedicineCatalog(query, limit = 12, { imagesOnly = false } = {}) {
  const db = await catalogDatabase();
  const { normalized, safeLimit, filter } = buildCatalogSearchPlan(query, limit, { imagesOnly });
  if (!filter) return [];
  const rows = await db.collection(COLLECTION).find(filter)
    .limit(Math.max(50, safeLimit * 5)).toArray();
  return rows
    .map((row) => ({ row, score: rankCatalogRecord(row, normalized) }))
    .sort((left, right) => right.score - left.score || left.row.displayName.localeCompare(right.row.displayName))
    .slice(0, safeLimit)
    .map(({ row }) => catalogPublicView(row));
}

export async function listMedicineCatalog({ query = '', status = '', page = 1, limit = 50 } = {}) {
  const db = await catalogDatabase();
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const filter = {};
  const normalized = normalizeCatalogText(query);
  if (normalized) filter.searchText = { $regex: normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (['active', 'draft', 'retired'].includes(status)) filter.status = status;
  const [items, total] = await Promise.all([
    db.collection(COLLECTION).find(filter).sort({ displayName: 1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).toArray(),
    db.collection(COLLECTION).countDocuments(filter),
  ]);
  return { items: items.map(catalogAdminView), total, page: safePage, limit: safeLimit };
}

export async function upsertMedicineCatalogRecord(input, { id = null, actor = null } = {}) {
  const db = await catalogDatabase();
  const existing = id ? await db.collection(COLLECTION).findOne({ _id: objectId(id) }) : null;
  if (id && !existing) throw apiError('Catalogue medicine not found.', 404);
  const prepared = prepareCatalogRecord(input, { existing });
  const source = {
    name: String(input?.source?.name || existing?.source?.name || '').trim().slice(0, 120),
    url: String(input?.source?.url || existing?.source?.url || '').trim().slice(0, 500),
    notes: String(input?.source?.notes || existing?.source?.notes || '').trim().slice(0, 500),
    reviewedAt: input?.source?.reviewedAt ? new Date(input.source.reviewedAt) : existing?.source?.reviewedAt || null,
  };
  const now = new Date();
  if (existing) {
    await db.collection(COLLECTION).updateOne({ _id: existing._id }, { $set: { ...prepared, source, updatedAt: now, updatedBy: actor } });
    return catalogAdminView({ ...existing, ...prepared, source, updatedAt: now, updatedBy: actor });
  }
  const duplicate = await db.collection(COLLECTION).findOne({ catalogKey: prepared.catalogKey });
  if (duplicate) throw apiError('A catalogue medicine with this identity already exists.', 409);
  const document = { ...prepared, source, createdAt: now, updatedAt: now, createdBy: actor, updatedBy: actor };
  const result = await db.collection(COLLECTION).insertOne(document);
  return catalogAdminView({ ...document, _id: result.insertedId });
}

export async function importMedicineCatalogCsv(csvText, { actor = null, database = null } = {}) {
  const rows = parseMedicineCatalogCsv(csvText);
  const db = database || await catalogDatabase();
  const errors = [];
  const preparedByKey = new Map();

  for (const row of rows) {
    try {
      const missing = ['displayName', 'brandName', 'genericName', 'category', 'unit']
        .filter((field) => !String(row[field] || '').trim());
      if (missing.length) throw apiError(`Required values are empty: ${missing.join(', ')}.`);
      if (!DEFAULT_MEDICINE_CATEGORIES.includes(row.category)) {
        throw apiError(`Unknown category "${row.category}". Use one of the categories from the CSV template or use Other.`);
      }
      if (!DEFAULT_MEDICINE_UNITS.includes(row.unit)) {
        throw apiError(`Unknown unit "${row.unit}". Use one of the units from the CSV template or use Other.`);
      }
      if (row.status && !['active', 'draft', 'retired'].includes(row.status)) {
        throw apiError('Status must be active, draft or retired.');
      }
      const prepared = prepareCatalogRecord(row);
      if (preparedByKey.has(prepared.catalogKey)) {
        errors.push({ row: row.csvRowNumber, type: 'duplicate', message: 'Duplicate of another row in this CSV.' });
        continue;
      }
      preparedByKey.set(prepared.catalogKey, {
        prepared,
        row,
      });
    } catch (error) {
      errors.push({ row: row.csvRowNumber, type: 'invalid', message: error.message });
    }
  }

  const keys = [...preparedByKey.keys()];
  const existingKeys = keys.length
    ? new Set((await db.collection(COLLECTION).find({ catalogKey: { $in: keys } }, { projection: { catalogKey: 1 } }).toArray())
      .map((record) => record.catalogKey))
    : new Set();
  const now = new Date();
  const documents = [];
  for (const [catalogKey, { prepared, row }] of preparedByKey) {
    if (existingKeys.has(catalogKey)) {
      errors.push({ row: row.csvRowNumber, type: 'duplicate', message: 'This catalogue medicine already exists and was not changed.' });
      continue;
    }
    documents.push({
      ...prepared,
      source: {
        name: String(row.sourceName || 'CSV import').slice(0, 120),
        url: String(row.sourceUrl || '').slice(0, 500),
        notes: String(row.sourceNotes || '').slice(0, 500),
        reviewedAt: null,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      updatedBy: actor,
    });
  }

  let imported = 0;
  if (documents.length) {
    try {
      const result = await db.collection(COLLECTION).insertMany(documents, { ordered: false });
      imported = Number(result.insertedCount || 0);
    } catch (error) {
      imported = Number(error?.result?.insertedCount || error?.insertedCount || 0);
      const duplicateWriteErrors = Array.isArray(error?.writeErrors)
        ? error.writeErrors.filter((writeError) => writeError?.code === 11000).length
        : 0;
      if (duplicateWriteErrors !== (error?.writeErrors?.length || 0)) throw error;
      errors.push({ row: null, type: 'duplicate', message: `${duplicateWriteErrors} row(s) became duplicates during import and were skipped.` });
    }
  }

  const duplicateCount = errors.filter((error) => error.type === 'duplicate').length;
  const invalidCount = errors.filter((error) => error.type === 'invalid').length;
  return {
    totalRows: rows.length,
    imported,
    skipped: Math.max(0, rows.length - imported),
    duplicateCount,
    invalidCount,
    missingImages: imported,
    errors: errors.slice(0, 100),
    errorsTruncated: errors.length > 100,
  };
}

export async function attachMedicineCatalogImage(id, buffer, { sourceUrl = '', rightsConfirmed = false, actor = null } = {}) {
  const db = await catalogDatabase();
  const medicine = await db.collection(COLLECTION).findOne({ _id: objectId(id) });
  if (!medicine) throw apiError('Catalogue medicine not found.', 404);
  const image = await uploadMedicineCatalogImage({
    catalogKey: medicine.catalogKey,
    displayName: medicine.displayName,
    buffer,
    sourceUrl,
    rightsConfirmed,
  });
  await db.collection(COLLECTION).updateOne({ _id: medicine._id }, { $set: { image, updatedAt: new Date(), updatedBy: actor } });
  return catalogAdminView({ ...medicine, image });
}

export async function attachMedicineCatalogImageFromUrl(id, imageUrl, { rightsConfirmed = false, actor = null } = {}) {
  const db = await catalogDatabase();
  const medicine = await db.collection(COLLECTION).findOne({ _id: objectId(id) });
  if (!medicine) throw apiError('Catalogue medicine not found.', 404);
  const image = await importMedicineCatalogImageFromUrl({
    catalogKey: medicine.catalogKey,
    displayName: medicine.displayName,
    imageUrl,
    rightsConfirmed,
  });
  await db.collection(COLLECTION).updateOne(
    { _id: medicine._id },
    { $set: { image, updatedAt: new Date(), updatedBy: actor } },
  );
  return catalogAdminView({ ...medicine, image });
}

export async function removeMedicineCatalogImage(id, actor = null) {
  const db = await catalogDatabase();
  const medicine = await db.collection(COLLECTION).findOne({ _id: objectId(id) });
  if (!medicine) throw apiError('Catalogue medicine not found.', 404);
  const now = new Date();
  const session = pharmacyDb.getClient().startSession();
  let affectedProducts = 0;
  try {
    await session.withTransaction(async () => {
      const products = await db.collection(PRODUCTS_COLLECTION).updateMany(
        { catalogImageId: String(medicine._id) },
        buildCatalogImageRemovalUpdate(now),
        { session },
      );
      affectedProducts = Number(products.modifiedCount || 0);
      await db.collection(COLLECTION).updateOne(
        { _id: medicine._id },
        { $unset: { image: '' }, $set: { updatedAt: now, updatedBy: actor } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  let cleanupPending = false;
  try {
    await deleteMedicineCatalogImage(medicine.image?.publicId);
  } catch (error) {
    cleanupPending = true;
    console.error('Medicine catalogue Cloudinary cleanup is pending:', error?.message || error);
  }
  return { ok: true, affectedProducts, cleanupPending };
}
