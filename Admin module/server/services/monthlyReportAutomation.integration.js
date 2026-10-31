// Explicit integration check for the configured Pharmacy database.
// This script never calls Resend. It uses the separate email_test channel and
// deliberately completes the claimed delivery as permanent_failed.

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : '';
}

const email = argument('email').toLowerCase();
const month = argument('month');
if (!email || !month) {
  console.error('Usage: node server/services/monthlyReportAutomation.integration.js --email owner@example.com --month YYYY-MM');
  process.exit(1);
}

process.env.REPORT_EMAIL_TEST_MODE = 'true';
process.env.REPORT_EMAIL_TEST_RECIPIENT = email;
process.env.REPORT_EMAIL_FROM ||= 'DawaConnect Reports <reports@dawaconnect.store>';

await import('../env.js');
const { default: pharmacyDb } = await import('../db/pharmacyConnection.js');
const { default: PharmacyUser } = await import('../models/PharmacyUser.js');
const automation = await import('./monthlyReportAutomationService.js');

try {
  await pharmacyDb.asPromise();
  const first = await automation.initializeMonthlyReportDeliveries(month);
  const second = await automation.initializeMonthlyReportDeliveries(month);
  const user = await PharmacyUser.findOne({ email }).lean();
  if (!user) throw new Error('The integration pharmacy was not found.');
  const ownerId = String(user._id);

  await pharmacyDb.db.collection('monthlyReportDeliveries').updateOne(
    { ownerId, month, channel: 'email_test' },
    {
      $set: {
        status: 'pending',
        attempts: 0,
        createdAt: new Date('2000-01-01T00:00:00.000Z'),
      },
      $unset: {
        leaseTokenHash: '',
        leaseUntil: '',
        nextAttemptAt: '',
        failedAt: '',
      },
    },
  );

  const batch = await automation.claimMonthlyReportDeliveries(month, 1);
  if (batch.claimed.length !== 1) throw new Error('The integration delivery could not be claimed.');
  const job = batch.claimed[0];
  const prepared = await automation.prepareMonthlyReportDelivery(job.deliveryId, job.leaseToken);
  const pdf = await automation.downloadMonthlyReportDelivery(job.deliveryId, job.leaseToken);
  const failed = await automation.failMonthlyReportDelivery(job.deliveryId, job.leaseToken, {
    code: 'integration_test_complete',
    message: 'Intentional integration completion without sending email.',
    retryable: false,
  });
  const cleanup = await pharmacyDb.db.collection('monthlyReportDeliveries').updateMany(
    {
      month,
      channel: 'email_test',
      ownerId: { $ne: ownerId },
      status: 'pending',
    },
    {
      $set: {
        status: 'permanent_failed',
        lastErrorCode: 'integration_seed_not_selected',
        lastErrorMessage: 'Closed after the no-email integration test without contacting Resend.',
        failedAt: new Date(),
        updatedAt: new Date(),
      },
    },
  );

  console.log({
    first,
    second,
    claimed: batch.claimed.length,
    prepared: {
      testMode: prepared.testMode,
      month: prepared.month,
      artifactId: prepared.artifactId,
      recipientIsOverride: prepared.recipientEmail === email,
    },
    pdf: {
      bytes: pdf.buffer.length,
      header: pdf.buffer.subarray(0, 5).toString('ascii'),
    },
    finalStatus: failed.status,
    closedUnselectedTestRecords: cleanup.modifiedCount,
  });
} finally {
  await pharmacyDb.close();
}

