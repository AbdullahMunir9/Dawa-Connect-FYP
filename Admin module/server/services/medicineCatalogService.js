import mongoose from 'mongoose';
import pharmacyDb from '../db/pharmacyConnection.js';
import {
  buildCatalogImageRemovalUpdate, buildCatalogSearchPlan, catalogPublicView, normalizeCatalogText, prepareCatalogRecord, rankCatalogRecord,
} from './medicineCatalogCore.js';
import { deleteMedicineCatalogImage, uploadMedicineCatalogImage } from './medicineCatalogImageService.js';

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
