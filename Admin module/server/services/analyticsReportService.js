import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { normalizeReportMonth } from './analyticsCore.js';

const EXPORT_FORMATS = new Set(['pdf', 'xlsx']);
const COLORS = {
  navy: '#0f172a',
  slate: '#475569',
  muted: '#64748b',
  border: '#cbd5e1',
  soft: '#f1f5f9',
  teal: '#0f766e',
  tealSoft: '#ccfbf1',
  blue: '#1d4ed8',
  amber: '#b45309',
  red: '#be123c',
  white: '#ffffff',
};

function text(value, fallback = '') {
  return [...String(value ?? fallback)]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code >= 32;
    })
    .join('')
    .trim();
}

function safeFilenamePart(value) {
  return text(value, 'pharmacy')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'pharmacy';
}

function money(value) {
  return `PKR ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

function percentage(value) {
  return value === null || value === undefined ? 'Not comparable' : `${Number(value)}%`;
}

function dateTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi',
  }).format(parsed);
}

function evidenceMap(narrative) {
  return new Map((narrative?.evidence || []).map((fact) => [fact.key, fact]));
}

function evidenceText(keys, facts) {
  return (keys || []).map((key) => {
    const fact = facts.get(key);
    return fact ? `${text(fact.label, key)}: ${text(fact.display, fact.value)}` : '';
  }).filter(Boolean).join(' | ');
}

async function pharmacyReportIdentity(ownerId) {
  const { pharmacyDatabase } = await import('./pharmacyService.js');
  const db = await pharmacyDatabase();
  const profile = await db.collection('profiles').findOne(
    { ownerId },
    { projection: { name: 1, address: 1, email: 1, phone: 1 } },
  );
  return {
    name: text(profile?.name, 'DawaConnect Pharmacy'),
    address: text(profile?.address),
    email: text(profile?.email),
    phone: text(profile?.phone),
  };
}

async function currentNarrative(ownerId, month) {
  const { generateAnalyticsNarrative, getAnalyticsNarrative } = await import('./analyticsNarrativeService.js');
  const existing = await getAnalyticsNarrative(ownerId, month);
  if (existing.available && existing.report) return existing.report;
  const generated = await generateAnalyticsNarrative(ownerId, month, { force: false });
  return generated.report;
}

export async function buildAnalyticsReportData(ownerId, requestedMonth) {
  const { measuredPharmacyAnalytics } = await import('./analyticsService.js');
  const month = normalizeReportMonth(requestedMonth);
  const [analytics, narrative, pharmacy] = await Promise.all([
    measuredPharmacyAnalytics(ownerId, month),
    currentNarrative(ownerId, month),
    pharmacyReportIdentity(ownerId),
  ]);
  if (!narrative?.report || !Array.isArray(narrative.evidence)) {
    throw Object.assign(new Error('Generate the recommendation report before exporting.'), { status: 409 });
  }
  return {
    analytics,
    narrative,
    pharmacy,
    exportedAt: new Date().toISOString(),
  };
}

function ensurePdfSpace(doc, height = 80) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function pdfSectionTitle(doc, title) {
  ensurePdfSpace(doc, 48);
  doc.moveDown(0.55);
  doc.fillColor(COLORS.teal).font('Helvetica-Bold').fontSize(14).text(text(title));
  doc.moveTo(doc.page.margins.left, doc.y + 4)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 4)
    .strokeColor(COLORS.tealSoft).lineWidth(2).stroke();
  doc.moveDown(0.65);
}

function pdfKeyValue(doc, label, value, x, y, width) {
  doc.roundedRect(x, y, width, 53, 7).fillAndStroke(COLORS.soft, COLORS.border);
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8.5).text(text(label), x + 10, y + 9, { width: width - 20 });
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(13).text(text(value), x + 10, y + 25, { width: width - 20 });
}

function pdfNarrativeItem(doc, item, facts, executive = false) {
  const evidence = evidenceText(item.factKeys, facts);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const narrativeText = text(item.overview || item.explanation);
  doc.font('Helvetica').fontSize(9.3);
  const narrativeHeight = doc.heightOfString(narrativeText, { width: pageWidth - 24, lineGap: 2 });
  doc.font('Helvetica-Bold').fontSize(7.6);
  const evidenceHeight = evidence ? doc.heightOfString(`EVIDENCE  ${evidence}`, { width: pageWidth - 24 }) : 0;
  const estimated = Math.max(executive ? 125 : 115, 54 + narrativeHeight + evidenceHeight + 25);
  ensurePdfSpace(doc, estimated);
  const startY = doc.y;
  doc.roundedRect(doc.page.margins.left, startY, pageWidth, estimated - 10, 7)
    .fillAndStroke(COLORS.white, COLORS.border);
  const priority = executive ? '' : text(item.priority).toUpperCase();
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(11.5)
    .text(text(item.headline || item.title), doc.page.margins.left + 12, startY + 11, { width: pageWidth - 24 });
  if (priority) {
    const color = priority === 'HIGH' ? COLORS.red : priority === 'MEDIUM' ? COLORS.amber : COLORS.teal;
    doc.fillColor(color).font('Helvetica-Bold').fontSize(8).text(priority, doc.page.width - doc.page.margins.right - 60, startY + 12, { width: 48, align: 'right' });
  }
  doc.fillColor(COLORS.slate).font('Helvetica').fontSize(9.3)
    .text(narrativeText, doc.page.margins.left + 12, startY + 34, { width: pageWidth - 24, lineGap: 2 });
  if (evidence) {
    doc.fillColor(COLORS.teal).font('Helvetica-Bold').fontSize(7.6)
      .text(`EVIDENCE  ${evidence}`, doc.page.margins.left + 12, startY + estimated - 31, { width: pageWidth - 24 });
  }
  doc.y = startY + estimated;
}

function pdfTable(doc, headers, rows, widths) {
  const left = doc.page.margins.left;
  const headerHeight = 25;
  const rowHeight = 34;
  const drawRow = (values, y, header = false) => {
    let x = left;
    values.forEach((value, index) => {
      doc.rect(x, y, widths[index], header ? headerHeight : rowHeight)
        .fillAndStroke(header ? COLORS.navy : COLORS.white, COLORS.border);
      doc.fillColor(header ? COLORS.white : COLORS.slate)
        .font(header ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(header ? 8 : 7.8)
        .text(text(value), x + 5, y + (header ? 8 : 7), { width: widths[index] - 10, height: (header ? headerHeight : rowHeight) - 10 });
      x += widths[index];
    });
  };
  ensurePdfSpace(doc, headerHeight + rowHeight);
  drawRow(headers, doc.y, true);
  doc.y += headerHeight;
  for (const row of rows) {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawRow(headers, doc.y, true);
      doc.y += headerHeight;
    }
    drawRow(row, doc.y);
    doc.y += rowHeight;
  }
}

function collectPdf(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export async function createAnalyticsPdf(data) {
  const { analytics, narrative, pharmacy, exportedAt } = data;
  const doc = new PDFDocument({ size: 'A4', margin: 46, bufferPages: true, info: {
    Title: `${analytics.meta.monthLabel} Pharmacy Performance and Recommendation Report`,
    Author: 'DawaConnect',
    Subject: 'Measured pharmacy analytics, forecasts and validated recommendations',
  } });
  const completed = collectPdf(doc);
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.roundedRect(0, 0, doc.page.width, 130, 0).fill(COLORS.navy);
  doc.fillColor(COLORS.tealSoft).font('Helvetica-Bold').fontSize(11).text('DAWACONNECT', 46, 35);
  doc.fillColor(COLORS.white).font('Helvetica-Bold').fontSize(23)
    .text('Pharmacy Performance and Recommendation Report', 46, 55, { width: usableWidth });
  doc.fillColor('#cbd5e1').font('Helvetica').fontSize(10)
    .text(`${pharmacy.name}  |  ${analytics.meta.monthLabel}`, 46, 93, { width: usableWidth });
  doc.y = 150;
  doc.fillColor(COLORS.slate).font('Helvetica').fontSize(8.5)
    .text(`Generated ${dateTime(exportedAt)} | Measured calculations: ${analytics.meta.calculationVersion} | Narrative: ${narrative.promptVersion}`);

  pdfSectionTitle(doc, 'Measured performance overview');
  const cardGap = 8;
  const cardWidth = (usableWidth - (cardGap * 3)) / 4;
  const cardY = doc.y;
  [
    ['Product revenue', money(analytics.summary.productRevenue)],
    ['Delivered orders', analytics.summary.deliveredOrders],
    ['Average order value', money(analytics.summary.averageOrderValue)],
    ['Units sold', analytics.summary.unitsSold],
  ].forEach(([label, value], index) => pdfKeyValue(doc, label, value, 46 + (index * (cardWidth + cardGap)), cardY, cardWidth));
  doc.y = cardY + 67;

  const facts = evidenceMap(narrative);
  pdfSectionTitle(doc, 'Executive summary');
  pdfNarrativeItem(doc, narrative.report.executiveSummary, facts, true);

  const narrativeSections = [
    ['Sales insights', narrative.report.salesInsights],
    ['Inventory actions', narrative.report.inventoryActions],
    ['Delivery opportunities', narrative.report.deliveryOpportunities],
    ['Risks and limitations', narrative.report.risksAndLimitations],
    ['Next-month action plan', narrative.report.nextMonthActionPlan],
  ];
  for (const [title, items] of narrativeSections) {
    pdfSectionTitle(doc, title);
    items.forEach((item) => pdfNarrativeItem(doc, item, facts));
  }

  pdfSectionTitle(doc, 'Delivered product performance');
  if (analytics.products.length) {
    pdfTable(doc,
      ['Product', 'Units', 'Revenue', 'Orders', 'Stock'],
      analytics.products.slice(0, 20).map((product) => [
        product.name, product.unitsSold, money(product.revenue), product.orderCount,
        product.currentStock === null ? 'Unavailable' : `${product.currentStock} (${product.stockStatus})`,
      ]),
      [190, 50, 90, 55, 118],
    );
  } else {
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10).text('No delivered-product data exists for this month.');
  }

  pdfSectionTitle(doc, `Weekly restock plan for ${analytics.forecast.forecastMonthLabel}`);
  const forecastRows = analytics.forecast.products.filter((product) => product.forecastUnits > 0).slice(0, 20);
  if (forecastRows.length) {
    pdfTable(doc,
      ['Product', 'Forecast', 'Weekly target', 'Stock', 'Reorder', 'Confidence'],
      forecastRows.map((product) => [
        product.name, product.forecastUnits, product.recommendedWeeklyTarget, product.currentStock,
        product.suggestedReorderQuantity, product.confidence,
      ]),
      [168, 62, 78, 50, 62, 83],
    );
  } else {
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(10)
      .text('No delivered demand is available for a product-level forecast yet.');
  }

  pdfSectionTitle(doc, 'City delivery opportunity');
  doc.fillColor(COLORS.slate).font('Helvetica').fontSize(9.5).text(
    `${text(analytics.cityOpportunity.recommendation)} Status: ${text(analytics.cityOpportunity.status)}. ` +
    `Current radius: ${analytics.cityOpportunity.currentRadiusKm} km. ` +
    `Published privacy-safe zones: ${analytics.cityOpportunity.summary.publishedZones}.`,
    { lineGap: 3 },
  );

  pdfSectionTitle(doc, 'Data quality and use');
  for (const warning of analytics.dataQuality.warnings || []) {
    doc.fillColor(COLORS.slate).font('Helvetica').fontSize(9).text(`- ${text(warning)}`, { lineGap: 2 });
  }
  doc.moveDown(0.5);
  doc.fillColor(COLORS.red).font('Helvetica-Bold').fontSize(8.5).text(text(narrative.disclaimer), { lineGap: 2 });

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5)
      .text(`DawaConnect | ${pharmacy.name} | ${analytics.meta.monthLabel} | Page ${index + 1} of ${range.count}`,
        46, doc.page.height - 28, { width: usableWidth, align: 'center', lineBreak: false });
  }
  doc.end();
  return completed;
}

function styleSheet(sheet, widths = []) {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  if (sheet.columnCount > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  }
  sheet.getRow(1).height = 24;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => {
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } } };
    });
  });
}

function addTableSheet(workbook, name, columns, rows, widths) {
  const sheet = workbook.addWorksheet(name, { properties: { defaultRowHeight: 18 } });
  sheet.addRow(columns);
  rows.forEach((row) => sheet.addRow(row));
  styleSheet(sheet, widths);
  return sheet;
}

function narrativeRows(narrative) {
  const facts = evidenceMap(narrative);
  const rows = [[
    'Executive summary', narrative.report.executiveSummary.headline,
    narrative.report.executiveSummary.overview, '',
    evidenceText(narrative.report.executiveSummary.factKeys, facts),
  ]];
  const sections = [
    ['Sales insight', narrative.report.salesInsights],
    ['Inventory action', narrative.report.inventoryActions],
    ['Delivery opportunity', narrative.report.deliveryOpportunities],
    ['Risk or limitation', narrative.report.risksAndLimitations],
    ['Next-month action', narrative.report.nextMonthActionPlan],
  ];
  for (const [section, items] of sections) {
    for (const item of items) rows.push([
      section, item.title, item.explanation, item.priority, evidenceText(item.factKeys, facts),
    ]);
  }
  return rows;
}

export async function createAnalyticsExcel(data) {
  const { analytics, narrative, pharmacy, exportedAt } = data;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DawaConnect';
  workbook.lastModifiedBy = 'DawaConnect';
  workbook.created = new Date(exportedAt);
  workbook.modified = new Date(exportedAt);
  workbook.title = `${analytics.meta.monthLabel} Pharmacy Performance and Recommendation Report`;
  workbook.subject = 'Measured pharmacy analytics, forecasts and validated recommendations';
  workbook.company = 'DawaConnect';

  addTableSheet(workbook, 'Overview', ['Metric', 'Value', 'Type or note'], [
    ['Pharmacy', pharmacy.name, 'Authenticated pharmacy'],
    ['Report month', analytics.meta.monthLabel, analytics.meta.month],
    ['Exported at', dateTime(exportedAt), 'Asia/Karachi'],
    ['Orders placed', analytics.summary.ordersPlaced, 'Measured'],
    ['Delivered orders', analytics.summary.deliveredOrders, 'Measured'],
    ['Cancelled orders', analytics.summary.cancelledOrders, 'Measured'],
    ['Cancellation rate', analytics.summary.cancellationRate / 100, 'Measured'],
    ['Product revenue', analytics.summary.productRevenue, 'PKR; measured'],
    ['Delivery fees', analytics.summary.deliveryFees, 'PKR; measured'],
    ['Tax', analytics.summary.tax, 'PKR; measured'],
    ['Gross collected', analytics.summary.grossCollected, 'PKR; measured'],
    ['Average order value', analytics.summary.averageOrderValue, 'PKR; measured'],
    ['Units sold', analytics.summary.unitsSold, 'Measured'],
    ['Revenue change', percentage(analytics.comparisons.productRevenuePercent), 'Compared with previous month'],
    ['Forecast units', analytics.forecast.summary.forecastUnits, 'Calculated forecast'],
    ['Products to reorder', analytics.forecast.summary.productsToReorder, 'Owner review required'],
    ['Suggested reorder units', analytics.forecast.summary.suggestedReorderUnits, 'Owner review required'],
    ['City opportunity status', analytics.cityOpportunity.status, 'Privacy-qualified aggregate'],
    ['Narrative method', narrative.generationMethod, `${narrative.provider} / ${narrative.model}`],
    ['Narrative generated at', dateTime(narrative.generatedAt), narrative.promptVersion],
    ['Disclaimer', narrative.disclaimer, 'Planning support only'],
  ], [28, 42, 48]);

  const overview = workbook.getWorksheet('Overview');
  overview.getCell('B8').numFmt = '0.0%';
  for (const rowNumber of [9, 10, 11, 12, 13]) overview.getCell(`B${rowNumber}`).numFmt = '"PKR "#,##0.00';

  addTableSheet(workbook, 'Daily Sales',
    ['Date', 'Orders placed', 'Delivered orders', 'Product revenue'],
    analytics.daily.map((row) => [row.date, row.orders, row.deliveredOrders, row.productRevenue]),
    [16, 18, 20, 22]);
  workbook.getWorksheet('Daily Sales').getColumn(4).numFmt = '"PKR "#,##0.00';

  addTableSheet(workbook, 'Products',
    ['Product', 'Category', 'Units sold', 'Revenue', 'Delivered orders', 'Current stock', 'Threshold', 'Stock status'],
    analytics.products.map((product) => [
      product.name, product.category, product.unitsSold, product.revenue, product.orderCount,
      product.currentStock, product.threshold, product.stockStatus,
    ]),
    [32, 20, 14, 18, 18, 16, 14, 18]);
  workbook.getWorksheet('Products').getColumn(4).numFmt = '"PKR "#,##0.00';

  addTableSheet(workbook, 'Forecast', [
    'Product', 'Category', 'Current stock', 'Forecast units', 'Estimated revenue', 'Weekly demand',
    'Safety stock', 'Weekly target', 'Suggested reorder', 'Weeks of cover', 'Confidence', 'Action',
  ], analytics.forecast.products.map((product) => [
    product.name, product.category, product.currentStock, product.forecastUnits, product.estimatedProductRevenue,
    product.expectedWeeklyDemand, product.safetyStock, product.recommendedWeeklyTarget,
    product.suggestedReorderQuantity, product.weeksOfCover, product.confidence, product.action,
  ]), [32, 20, 15, 16, 20, 16, 14, 15, 18, 16, 14, 18]);
  workbook.getWorksheet('Forecast').getColumn(5).numFmt = '"PKR "#,##0.00';

  addTableSheet(workbook, 'City Opportunity',
    ['Record type', 'Label or radius', 'Distance or reach (km)', 'Orders', 'Units', 'Inside current radius', 'Confidence'],
    [
      ...analytics.cityOpportunity.zones.map((zone) => [
        'Privacy-safe zone', zone.label, zone.distanceKm, zone.orders, zone.units, zone.insideCurrentRadius, '',
      ]),
      ...analytics.cityOpportunity.scenarios.map((scenario) => [
        'Radius scenario', scenario.radiusKm, scenario.additionalReachKm, scenario.opportunityOrders,
        scenario.opportunityUnits, '', scenario.confidence,
      ]),
    ],
    [22, 28, 24, 14, 14, 24, 16]);

  addTableSheet(workbook, 'Narrative',
    ['Section', 'Title', 'Explanation', 'Priority', 'Verified evidence'],
    narrativeRows(narrative),
    [24, 38, 80, 14, 72]);

  addTableSheet(workbook, 'Evidence',
    ['Fact key', 'Label', 'Display value', 'Raw value', 'Format', 'Category'],
    narrative.evidence.map((fact) => [fact.key, fact.label, fact.display, fact.value, fact.format, fact.category]),
    [42, 36, 24, 24, 14, 22]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function createAnalyticsReportFile(ownerId, requestedMonth, requestedFormat) {
  const format = text(requestedFormat).toLowerCase();
  if (!EXPORT_FORMATS.has(format)) {
    throw Object.assign(new Error('Report format must be pdf or xlsx.'), { status: 400 });
  }
  const data = await buildAnalyticsReportData(ownerId, requestedMonth);
  const buffer = format === 'pdf' ? await createAnalyticsPdf(data) : await createAnalyticsExcel(data);
  const base = `DawaConnect-${safeFilenamePart(data.pharmacy.name)}-${data.analytics.meta.month}`;
  return {
    buffer,
    filename: `${base}.${format}`,
    contentType: format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
