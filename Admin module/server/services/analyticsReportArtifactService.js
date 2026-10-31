import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { normalizeReportMonth } from './analyticsCore.js';
import { createClosedMonthSnapshot } from './analyticsService.js';
import {
  buildAnalyticsReportDataFromSnapshot,
  createAnalyticsPdf,
} from './analyticsReportService.js';
import { pharmacyDatabase } from './pharmacyService.js';

const ARTIFACTS_COLLECTION = 'analyticsReportArtifacts';
const FILES_BUCKET = 'analyticsReportFiles';
const PDF_CONTENT_TYPE = 'application/pdf';

function safeFilenamePart(value) {
  return String(value || 'pharmacy')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'pharmacy';
}

function publicArtifact(document) {
  if (!document) return null;
  return {
    artifactId: document.artifactId,
    ownerId: document.ownerId,
    month: document.month,
    snapshotId: document.snapshotId,
    narrativeReportId: document.narrativeReportId,
    calculationVersion: document.calculationVersion,
    promptVersion: document.promptVersion,
    provider: document.provider,
    model: document.model,
    generationMethod: document.generationMethod,
    filename: document.filename,
    contentType: document.contentType,
    byteLength: document.byteLength,
    pdfSha256: document.pdfSha256,
    generatedAt: document.generatedAt,
  };
}

function artifactIdentity(ownerId, snapshot, narrative) {
  return {
    ownerId,
    month: snapshot.month,
    snapshotId: snapshot.snapshotId,
    calculationVersion: snapshot.calculationVersion,
    promptVersion: narrative.promptVersion,
  };
}

function gridFsBucket(db) {
  return new mongoose.mongo.GridFSBucket(db, { bucketName: FILES_BUCKET });
}

function uploadPdf(bucket, filename, buffer, metadata) {
  return new Promise((resolve, reject) => {
    const stream = bucket.openUploadStream(filename, {
      contentType: PDF_CONTENT_TYPE,
      metadata,
    });
    stream.once('error', reject);
    stream.once('finish', () => resolve(stream.id));
    stream.end(buffer);
  });
}

function downloadPdf(bucket, fileId) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = bucket.openDownloadStream(fileId);
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.once('error', reject);
    stream.once('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function deletePdf(bucket, fileId) {
  try {
    await bucket.delete(fileId);
  } catch (error) {
    if (!/not found|does not exist/i.test(String(error?.message || ''))) throw error;
  }
}

export async function getOrCreateMonthlyReportArtifact(ownerId, requestedMonth) {
  const month = normalizeReportMonth(requestedMonth);
  const currentMonth = normalizeReportMonth();
  if (month >= currentMonth) {
    throw Object.assign(new Error('Only a completed calendar month can be finalized for email delivery.'), { status: 400 });
  }

  const db = await pharmacyDatabase();
  const snapshot = await createClosedMonthSnapshot(ownerId, month);
  const generatedAt = new Date();
  const data = await buildAnalyticsReportDataFromSnapshot(ownerId, snapshot, {
    exportedAt: generatedAt.toISOString(),
  });
  const identity = artifactIdentity(ownerId, snapshot, data.narrative);
  const existing = await db.collection(ARTIFACTS_COLLECTION).findOne(identity);
  if (existing) return publicArtifact(existing);

  const buffer = await createAnalyticsPdf(data);
  const artifactId = randomUUID();
  const filename = `DawaConnect-${safeFilenamePart(data.pharmacy.name)}-${month}.pdf`;
  const pdfSha256 = createHash('sha256').update(buffer).digest('hex');
  const bucket = gridFsBucket(db);
  const fileId = await uploadPdf(bucket, filename, buffer, {
    artifactId,
    ownerId,
    month,
    snapshotId: snapshot.snapshotId,
    pdfSha256,
  });

  const document = {
    artifactId,
    ...identity,
    narrativeReportId: data.narrative.id,
    provider: data.narrative.provider,
    model: data.narrative.model,
    generationMethod: data.narrative.generationMethod,
    fileId,
    filename,
    contentType: PDF_CONTENT_TYPE,
    byteLength: buffer.length,
    pdfSha256,
    generatedAt,
    createdAt: generatedAt,
  };

  try {
    await db.collection(ARTIFACTS_COLLECTION).insertOne(document);
    return publicArtifact(document);
  } catch (error) {
    await deletePdf(bucket, fileId).catch(() => undefined);
    if (error?.code !== 11000) throw error;
    const winner = await db.collection(ARTIFACTS_COLLECTION).findOne(identity);
    if (!winner) throw error;
    return publicArtifact(winner);
  }
}

export async function readMonthlyReportArtifact(artifactIdValue) {
  const artifactId = String(artifactIdValue || '').trim();
  if (!artifactId) throw Object.assign(new Error('Report artifact id is required.'), { status: 400 });
  const db = await pharmacyDatabase();
  const artifact = await db.collection(ARTIFACTS_COLLECTION).findOne({ artifactId });
  if (!artifact) throw Object.assign(new Error('The finalized monthly report was not found.'), { status: 404 });
  let buffer;
  try {
    buffer = await downloadPdf(gridFsBucket(db), artifact.fileId);
  } catch (error) {
    if (/not found|does not exist/i.test(String(error?.message || ''))) {
      throw Object.assign(new Error('The finalized monthly report file is unavailable.'), { status: 409 });
    }
    throw error;
  }
  const digest = createHash('sha256').update(buffer).digest('hex');
  if (digest !== artifact.pdfSha256 || buffer.length !== artifact.byteLength) {
    throw Object.assign(new Error('The finalized monthly report failed its integrity check.'), { status: 409 });
  }
  return {
    ...publicArtifact(artifact),
    buffer,
  };
}

export async function getMonthlyReportArtifact(ownerId, requestedMonth) {
  const month = normalizeReportMonth(requestedMonth);
  const db = await pharmacyDatabase();
  const artifact = await db.collection(ARTIFACTS_COLLECTION).findOne(
    { ownerId, month },
    { sort: { generatedAt: -1 } },
  );
  return publicArtifact(artifact);
}

