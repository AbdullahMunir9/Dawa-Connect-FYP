import express from 'express';
import { Resend } from 'resend';
import { processResendMonthlyReportEvent } from '../services/resendMonthlyReportWebhookService.js';

const router = express.Router();
const rawJson = express.raw({ type: 'application/json', limit: '256kb' });

router.post('/', rawJson, async (req, res) => {
  const webhookSecret = String(process.env.RESEND_REPORT_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret.startsWith('whsec_')) {
    return res.status(503).json({ message: 'Monthly report delivery tracking is not configured.' });
  }
  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({ message: 'A raw JSON webhook body is required.' });
  }
  const headers = {
    id: req.get('svix-id'),
    timestamp: req.get('svix-timestamp'),
    signature: req.get('svix-signature'),
  };
  let event;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY || 're_webhook_verification_only');
    event = await resend.webhooks.verify({
      payload: req.body.toString('utf8'),
      headers,
      webhookSecret,
    });
  } catch {
    return res.status(400).json({ message: 'Invalid Resend webhook.' });
  }
  try {
    const result = await processResendMonthlyReportEvent(headers.id, event);
    return res.status(200).json(result);
  } catch (error) {
    const status = Number(error?.status) || 503;
    if (status >= 500) console.error('Monthly report Resend webhook error:', error?.message || error);
    return res.status(status).json({
      message: status >= 500 ? 'Delivery tracking is temporarily unavailable.' : error.message,
    });
  }
});

export default router;

