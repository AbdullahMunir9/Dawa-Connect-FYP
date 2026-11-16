import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCatalogRecord } from './medicineCatalogCore.js';
import { importMedicineCatalogCsv } from './medicineCatalogService.js';

const header = 'displayName,brandName,genericName,category,unit,strength,dosageForm,packSize,manufacturer,drapRegistrationNumber,aliases,status';

function fakeDatabase(existingKeys = []) {
  const inserted = [];
  return {
    inserted,
    collection(name) {
      assert.equal(name, 'medicineCatalog');
      return {
        find(query) {
          const requested = new Set(query.catalogKey.$in);
          return {
            async toArray() {
              return existingKeys.filter((key) => requested.has(key)).map((catalogKey) => ({ catalogKey }));
            },
          };
        },
        async insertMany(documents) {
          inserted.push(...documents);
          return { insertedCount: documents.length };
        },
      };
    },
  };
}

test('bulk importer adds valid rows without images and reports invalid and duplicate rows', async () => {
  const existing = prepareCatalogRecord({
    displayName: 'Brufen 400mg Tablets', brandName: 'Brufen', genericName: 'Ibuprofen',
    category: 'Analgesic', unit: 'Tablets', strength: '400 mg', dosageForm: 'Tablet',
    packSize: '20 tablets', manufacturer: 'Abbott',
  });
  const database = fakeDatabase([existing.catalogKey]);
  const csv = [
    header,
    'Panadol 500mg Tablets,Panadol,Paracetamol,Analgesic,Tablets,500 mg,Tablet,20 tablets,GSK,,"Acetaminophen, PCM",active',
    'Panadol 500mg Tablets,Panadol,Paracetamol,Analgesic,Tablets,500 mg,Tablet,20 tablets,GSK,,PCM,active',
    'Brufen 400mg Tablets,Brufen,Ibuprofen,Analgesic,Tablets,400 mg,Tablet,20 tablets,Abbott,,,active',
    'Invalid Item,Invalid,Test,Not A Category,Tablets,,,,,,,active',
  ].join('\n');

  const result = await importMedicineCatalogCsv(csv, { actor: 'admin-1', database });

  assert.deepEqual({
    totalRows: result.totalRows,
    imported: result.imported,
    skipped: result.skipped,
    duplicateCount: result.duplicateCount,
    invalidCount: result.invalidCount,
    missingImages: result.missingImages,
  }, {
    totalRows: 4,
    imported: 1,
    skipped: 3,
    duplicateCount: 2,
    invalidCount: 1,
    missingImages: 1,
  });
  assert.equal(database.inserted.length, 1);
  assert.equal(database.inserted[0].displayName, 'Panadol 500mg Tablets');
  assert.equal(database.inserted[0].createdBy, 'admin-1');
  assert.equal(database.inserted[0].status, 'active');
  assert.match(database.inserted[0].searchText, /panadol/);
  assert.match(database.inserted[0].searchText, /paracetamol/);
  assert.equal(Object.hasOwn(database.inserted[0], 'image'), false);
});

test('bulk importer accepts a full 1,000-row catalogue file', async () => {
  const database = fakeDatabase();
  const rows = Array.from({ length: 1000 }, (_, index) => (
    `Catalogue Product ${index},Brand ${index},Generic ${index},Other,Other,,,,,,,active`
  ));
  const result = await importMedicineCatalogCsv([header, ...rows].join('\n'), { actor: 'admin-1', database });

  assert.equal(result.totalRows, 1000);
  assert.equal(result.imported, 1000);
  assert.equal(result.skipped, 0);
  assert.equal(result.missingImages, 1000);
  assert.equal(database.inserted.length, 1000);
  assert.ok(database.inserted.every((record) => !Object.hasOwn(record, 'image')));
});

