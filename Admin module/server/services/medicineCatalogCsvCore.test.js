import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMedicineCatalogCsv } from './medicineCatalogCsvCore.js';

const headers = 'displayName,brandName,genericName,category,unit,strength,dosageForm,packSize,manufacturer,drapRegistrationNumber,aliases,status';

test('parses quoted catalogue values and keeps their original spreadsheet row number', () => {
  const rows = parseMedicineCatalogCsv(`${headers}\r\n"Panadol 500mg Tablets",Panadol,Paracetamol,Analgesic,Tablets,500 mg,Tablet,"20 tablets",GSK,,"Acetaminophen, PCM",active`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].csvRowNumber, 2);
  assert.equal(rows[0].displayName, 'Panadol 500mg Tablets');
  assert.equal(rows[0].aliases, 'Acetaminophen, PCM');
});

test('accepts user-friendly column spelling and ignores unsupported columns', () => {
  const rows = parseMedicineCatalogCsv('Brand Product Name,Brand Name,Generic Name,Category,Unit,Price\nPampers Baby Dry,Pampers,Baby diaper,Baby Care,Pack,1500');
  assert.deepEqual(rows[0], {
    csvRowNumber: 2,
    displayName: 'Pampers Baby Dry',
    brandName: 'Pampers',
    genericName: 'Baby diaper',
    category: 'Baby Care',
    unit: 'Pack',
  });
});

test('rejects a CSV that omits a required catalogue column', () => {
  assert.throws(
    () => parseMedicineCatalogCsv('displayName,brandName,category,unit\nPanadol,Panadol,Analgesic,Tablets'),
    /Missing required CSV columns: genericName/,
  );
});

test('rejects duplicate mapped columns and malformed quoted values', () => {
  assert.throws(
    () => parseMedicineCatalogCsv('displayName,productName,brandName,genericName,category,unit\nPanadol,Panadol,Panadol,Paracetamol,Analgesic,Tablets'),
    /duplicate columns: displayName/,
  );
  assert.throws(
    () => parseMedicineCatalogCsv(`${headers}\n"Panadol,Panadol,Paracetamol,Analgesic,Tablets`),
    /Unclosed quoted value/,
  );
});

test('enforces the configured maximum number of catalogue rows', () => {
  assert.throws(
    () => parseMedicineCatalogCsv(`${headers}\nOne,One,One,Other,Other\nTwo,Two,Two,Other,Other`, { maxRows: 1 }),
    /at most 1 medicine rows/,
  );
});

