import '../server/env.js';
import { readFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, resolve } from 'node:path';
import { prepareCatalogRecord } from '../server/services/medicineCatalogCore.js';
import { uploadMedicineCatalogImage } from '../server/services/medicineCatalogImageService.js';

let pharmacyDb;

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (char !== '\r') cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [headers, ...values] = rows.filter((item) => item.some((value) => value.trim()));
  if (!headers) return [];
  return values.map((valuesRow) => Object.fromEntries(headers.map((header, index) => [header.trim(), valuesRow[index]?.trim() || ''])));
}

function mappedRow(row) {
  return {
    displayName: row.displayName,
    brandName: row.brandName,
    genericName: row.genericName,
    category: row.category,
    unit: row.unit,
    strength: row.strength,
    dosageForm: row.dosageForm,
    packSize: row.packSize,
    manufacturer: row.manufacturer,
    drapRegistrationNumber: row.drapRegistrationNumber,
    aliases: Array.isArray(row.aliases) ? row.aliases : String(row.aliases || '').split('|').filter(Boolean),
    status: row.status || 'active',
    source: row.source || {
      name: row.sourceName || '',
      url: row.sourceUrl || '',
      notes: row.sourceNotes || '',
      reviewedAt: row.sourceReviewedAt || null,
    },
    imageFile: row.imageFile || '',
    imageSourceUrl: row.imageSourceUrl || '',
    imageRightsConfirmed: row.imageRightsConfirmed === true || String(row.imageRightsConfirmed).toLowerCase() === 'true',
  };
}

async function recordsFromFile(filePath) {
  const text = await readFile(filePath, 'utf8');
  if (extname(filePath).toLowerCase() === '.csv') return parseCsv(text).map(mappedRow);
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : parsed.medicines;
  if (!Array.isArray(rows)) throw new Error('The JSON file must be an array or contain a medicines array.');
  return rows.map(mappedRow);
}

function imagePathFor(record, filePath, imagesDirectory) {
  if (!record.imageFile) return '';
  if (isAbsolute(record.imageFile)) return record.imageFile;
  return resolve(imagesDirectory || dirname(filePath), record.imageFile);
}

async function main() {
  const fileValue = argument('--file');
  if (!fileValue) throw new Error('Usage: npm run catalog:import -- --file <catalog.json|catalog.csv> [--images-dir <folder>] [--dry-run]');
  const filePath = resolve(fileValue);
  const imagesDirectory = argument('--images-dir') ? resolve(argument('--images-dir')) : '';
  const dryRun = process.argv.includes('--dry-run');
  const records = await recordsFromFile(filePath);
  if (!records.length) throw new Error('The catalogue file contains no records.');

  const prepared = records.map((record, index) => {
    try { return { input: record, record: prepareCatalogRecord(record) }; }
    catch (error) { throw new Error(`Row ${index + 1}: ${error.message}`); }
  });
  const keys = new Set();
  for (const { record } of prepared) {
    if (keys.has(record.catalogKey)) throw new Error(`Duplicate catalogue identity in import: ${record.displayName}`);
    keys.add(record.catalogKey);
  }
  console.log(`Validated ${prepared.length} medicine catalogue records.`);
  if (dryRun) {
    console.log('Dry run complete. MongoDB and Cloudinary were not changed.');
    return;
  }

  ({ default: pharmacyDb } = await import('../server/db/pharmacyConnection.js'));
  if (pharmacyDb.readyState !== 1) await pharmacyDb.asPromise();
  const collection = pharmacyDb.db.collection('medicineCatalog');
  let created = 0;
  let updated = 0;
  let imagesUploaded = 0;
  for (const { input, record } of prepared) {
    const existing = await collection.findOne({ catalogKey: record.catalogKey });
    const now = new Date();
    const source = {
      name: String(input.source?.name || '').trim().slice(0, 120),
      url: String(input.source?.url || '').trim().slice(0, 500),
      notes: String(input.source?.notes || '').trim().slice(0, 500),
      reviewedAt: input.source?.reviewedAt ? new Date(input.source.reviewedAt) : null,
    };
    let image = existing?.image || null;
    const localImagePath = imagePathFor(input, filePath, imagesDirectory);
    if (localImagePath) {
      if (!input.imageRightsConfirmed) throw new Error(`${record.displayName}: imageRightsConfirmed must be true before an image can be uploaded.`);
      const buffer = await readFile(localImagePath);
      image = await uploadMedicineCatalogImage({
        catalogKey: record.catalogKey,
        displayName: record.displayName,
        buffer,
        sourceUrl: input.imageSourceUrl || source.url,
        rightsConfirmed: true,
      });
      imagesUploaded += 1;
    }
    await collection.updateOne(
      { catalogKey: record.catalogKey },
      {
        $set: { ...record, source, ...(image ? { image } : {}), updatedAt: now, updatedBy: 'catalog-import' },
        $setOnInsert: { createdAt: now, createdBy: 'catalog-import' },
      },
      { upsert: true },
    );
    if (existing) updated += 1; else created += 1;
    if ((created + updated) % 50 === 0) console.log(`Imported ${created + updated}/${prepared.length} records...`);
  }
  console.log(`Import complete: ${created} created, ${updated} updated, ${imagesUploaded} images uploaded.`);
}

main()
  .catch((error) => { console.error(`Medicine catalogue import failed: ${error.message}`); process.exitCode = 1; })
  .finally(async () => { if (pharmacyDb?.readyState) await pharmacyDb.close(); });
