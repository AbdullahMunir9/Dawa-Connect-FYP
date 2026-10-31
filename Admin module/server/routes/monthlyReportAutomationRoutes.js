import express from 'express';
import { requireReportAutomationAuth } from '../middleware/reportAutomationAuth.js';
import {
  acceptMonthlyReportDelivery,
  claimMonthlyReportDeliveries,
  downloadMonthlyReportDelivery,
  failMonthlyReportDelivery,
  initializeMonthlyReportDeliveries,
  prepareMonthlyReportDelivery,
} from '../services/monthlyReportAutomationService.js';

const router = express.Router();

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      const result = await handler(req, res);
      if (!res.headersSent) res.json(result);
    } catch (error) {
      const status = Number(error?.status) || 500;
      if (status >= 500) console.error('Monthly report automation error:', error?.message || error);
      res.status(status).json({
        message: status >= 500 ? 'Monthly report automation is temporarily unavailable.' : error.message,
      });
    }
  };
}

router.use(requireReportAutomationAuth);

router.post('/initialize', asyncRoute(async (req) => (
  initializeMonthlyReportDeliveries(req.body?.month)
)));

router.post('/claim', asyncRoute(async (req) => (
  claimMonthlyReportDeliveries(req.body?.month, req.body?.limit)
)));

router.post('/:deliveryId/prepare', asyncRoute(async (req) => (
  prepareMonthlyReportDelivery(req.params.deliveryId, req.body?.leaseToken)
)));

router.get('/:deliveryId/pdf', asyncRoute(async (req, res) => {
  const report = await downloadMonthlyReportDelivery(
    req.params.deliveryId,
    req.get('x-dawa-delivery-lease'),
  );
  res.set({
    'Content-Type': report.contentType,
    'Content-Disposition': `attachment; filename="${report.filename}"`,
    'Content-Length': String(report.buffer.length),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Dawa-Report-Sha256': report.pdfSha256,
  });
  res.status(200).send(report.buffer);
}));

router.post('/:deliveryId/accepted', asyncRoute(async (req) => (
  acceptMonthlyReportDelivery(
    req.params.deliveryId,
    req.body?.leaseToken,
    req.body?.resendEmailId,
  )
)));

router.post('/:deliveryId/failed', asyncRoute(async (req) => (
  failMonthlyReportDelivery(req.params.deliveryId, req.body?.leaseToken, {
    code: req.body?.code,
    message: req.body?.message,
    retryable: req.body?.retryable,
  })
)));

export default router;

