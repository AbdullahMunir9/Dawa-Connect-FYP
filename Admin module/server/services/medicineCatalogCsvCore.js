const HEADER_ALIASES = new Map([
  ['displayname', 'displayName'],
  ['displayproductname', 'displayName'],
  ['productname', 'displayName'],
  ['brandproductname', 'displayName'],
  ['brandname', 'brandName'],
  ['brand', 'brandName'],
  ['genericname', 'genericName'],
  ['generic', 'genericName'],
  ['category', 'category'],
  ['unit', 'unit'],
  ['strength', 'strength'],
  ['dosageform', 'dosageForm'],
  ['packsize', 'packSize'],
  ['manufacturer', 'manufacturer'],
  ['drapregistrationnumber', 'drapRegistrationNumber'],
  ['drapnumber', 'drapRegistrationNumber'],
  ['aliases', 'aliases'],
  ['status', 'status'],
  ['sourcename', 'sourceName'],
  ['sourceurl', 'sourceUrl'],
  ['sourcenotes', 'sourceNotes'],
]);

export const CATALOG_CSV_HEADERS = Object.freeze([
  'displayName', 'brandName', 'genericName', 'category', 'unit', 'strength',
  'dosageForm', 'packSize', 'manufacturer', 'drapRegistrationNumber',
  'aliases', 'status', 'sourceName', 'sourceUrl', 'sourceNotes',
]);

export const CATALOG_CSV_REQUIRED_HEADERS = Object.freeze([
  'displayName', 'brandName', 'genericName', 'category', 'unit',
]);

function apiError(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function normalizedHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseCsvRows(csvText) {
  const text = String(csvText || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  let rowStart = 1;
  let line = 1;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        if (character === '\n') line += 1;
        value += character;
      }
      continue;
    }
    if (character === '"') {
      if (value.length) throw apiError(`Invalid quote in CSV row ${line}.`);
      quoted = true;
    } else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n') {
      row.push(value.replace(/\r$/, ''));
      rows.push({ values: row, rowNumber: rowStart });
      row = [];
      value = '';
      line += 1;
      rowStart = line;
    } else {
      value += character;
    }
  }
  if (quoted) throw apiError(`Unclosed quoted value in CSV row ${rowStart}.`);
  if (value.length || row.length) {
    row.push(value.replace(/\r$/, ''));
    rows.push({ values: row, rowNumber: rowStart });
  }
  return rows.filter(({ values }) => values.some((cell) => String(cell).trim()));
}

export function parseMedicineCatalogCsv(csvText, { maxRows = 2000 } = {}) {
  const parsedRows = parseCsvRows(csvText);
  if (parsedRows.length < 2) throw apiError('The CSV must include a header row and at least one medicine row.');

  const headerRow = parsedRows[0];
  const mappedHeaders = headerRow.values.map((header) => HEADER_ALIASES.get(normalizedHeader(header)) || null);
  const duplicates = mappedHeaders.filter((header, index) => header && mappedHeaders.indexOf(header) !== index);
  if (duplicates.length) throw apiError(`The CSV contains duplicate columns: ${[...new Set(duplicates)].join(', ')}.`);
  const missing = CATALOG_CSV_REQUIRED_HEADERS.filter((required) => !mappedHeaders.includes(required));
  if (missing.length) throw apiError(`Missing required CSV columns: ${missing.join(', ')}.`);

  const dataRows = parsedRows.slice(1);
  if (dataRows.length > maxRows) throw apiError(`A single CSV can contain at most ${maxRows} medicine rows.`);

  return dataRows.map(({ values, rowNumber }) => {
    const record = { csvRowNumber: rowNumber };
    mappedHeaders.forEach((header, index) => {
      if (header) record[header] = String(values[index] ?? '').trim();
    });
    return record;
  });
}

