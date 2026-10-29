import express from 'express';
import { pharmacyView, requirePharmacyAuth } from '../middleware/pharmacyAuth.js';
import {
  confirmPharmacyLocation, createComplaint, createEntity, createProduct, deleteEntity, deleteProduct,
  getProfile, listComplaints, listEntity, listProducts, locationConfigured, loginPharmacy, logoutPharmacy,
  registrationAvailability, registerPharmacy, resendRegistrationOtp, replyComplaint, requestPasswordReset, resetPassword,
  searchPharmacyLocation, updateComplaintStatus, updateEntity, updateProduct, updateProfile, markAllNotificationsRead,
  verifyPharmacyRegistration,
} from '../services/pharmacyService.js';
import { removeProfilePhoto, uploadProfilePhoto, uploadRegistrationPhoto } from '../services/pharmacyPhotoService.js';
import { createClosedMonthSnapshot, listAnalyticsSnapshots, measuredPharmacyAnalytics } from '../services/analyticsService.js';
import { generateAnalyticsNarrative, getAnalyticsNarrative } from '../services/analyticsNarrativeService.js';
import { createAnalyticsReportFile } from '../services/analyticsReportService.js';

const router = express.Router();
const pharmacyPhotoBody = express.raw({
  type: ['image/jpeg', 'image/png', 'image/webp'],
  limit: '5mb',
});

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      const result = await handler(req, res);
      if (!res.headersSent) res.json(result);
    } catch (error) {
      const status = Number(error?.status) || (/not found/i.test(error?.message || '') ? 404 : 400);
      if (status >= 500) console.error('Pharmacy API error:', error?.message || error);
      res.status(status).json({ message: status >= 500 ? 'The pharmacy service is temporarily unavailable.' : error.message });
    }
  };
}

router.get('/location/config', (_req, res) => res.json({ configured: locationConfigured() }));
router.post('/location/search', asyncRoute(async (req) => searchPharmacyLocation(req.body?.text)));
router.post('/location/confirm', asyncRoute(async (req) => confirmPharmacyLocation(req.body?.sessionId, req.body)));
router.post('/auth/availability', asyncRoute(async (req) => registrationAvailability(req.body)));
router.post('/auth/register', asyncRoute(async (req) => registerPharmacy(req.body)));
router.post('/auth/register/verify', asyncRoute(async (req) => verifyPharmacyRegistration(req.body)));
router.post('/auth/register/resend', asyncRoute(async (req) => resendRegistrationOtp(req.body?.challengeId)));
router.post('/auth/register/photos/:slot', pharmacyPhotoBody, asyncRoute(async (req) => uploadRegistrationPhoto(
  req.get('x-registration-photo-token'), req.params.slot, req.body,
)));
router.post('/auth/login', asyncRoute(async (req) => loginPharmacy(req.body)));
router.post('/auth/forgot-password', asyncRoute(async (req) => requestPasswordReset(req.body?.email)));
router.post('/auth/reset-password', asyncRoute(async (req) => resetPassword(req.body)));

router.use(requirePharmacyAuth);
router.get('/auth/me', (req, res) => res.json(pharmacyView(req.pharmacyAuth.pharmacy)));
router.post('/auth/logout', asyncRoute(async (req) => logoutPharmacy(req.pharmacyAuth.token)));

router.get('/products', asyncRoute(async (req) => listProducts(req.pharmacyAuth.ownerId)));
router.post('/products', asyncRoute(async (req) => createProduct(req.pharmacyAuth.ownerId, req.body)));
router.patch('/products/:id', asyncRoute(async (req) => updateProduct(req.pharmacyAuth.ownerId, req.params.id, req.body)));
router.delete('/products/:id', asyncRoute(async (req) => deleteProduct(req.pharmacyAuth.ownerId, req.params.id)));

router.get('/analytics', asyncRoute(async (req) => measuredPharmacyAnalytics(
  req.pharmacyAuth.ownerId,
  req.query?.month,
)));
router.get('/analytics/narrative', asyncRoute(async (req) => getAnalyticsNarrative(
  req.pharmacyAuth.ownerId,
  req.query?.month,
)));
router.post('/analytics/narrative', asyncRoute(async (req) => generateAnalyticsNarrative(
  req.pharmacyAuth.ownerId,
  req.body?.month,
  { force: req.body?.force === true },
)));
router.get('/analytics/export/:format', asyncRoute(async (req, res) => {
  const report = await createAnalyticsReportFile(
    req.pharmacyAuth.ownerId,
    req.query?.month,
    req.params.format,
  );
  res.set({
    'Content-Type': report.contentType,
    'Content-Disposition': `attachment; filename="${report.filename}"`,
    'Content-Length': String(report.buffer.length),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.status(200).send(report.buffer);
}));
router.get('/analytics/snapshots', asyncRoute(async (req) => listAnalyticsSnapshots(req.pharmacyAuth.ownerId)));
router.post('/analytics/snapshots/:month', asyncRoute(async (req) => createClosedMonthSnapshot(
  req.pharmacyAuth.ownerId,
  req.params.month,
)));

router.get('/entities/:entity', asyncRoute(async (req) => listEntity(req.pharmacyAuth.ownerId, req.params.entity)));
router.post('/entities/:entity', asyncRoute(async (req) => createEntity(req.pharmacyAuth.ownerId, req.params.entity, req.body)));
router.patch('/entities/:entity/:id', asyncRoute(async (req) => updateEntity(req.pharmacyAuth.ownerId, req.params.entity, req.params.id, req.body)));
router.delete('/entities/:entity/:id', asyncRoute(async (req) => deleteEntity(req.pharmacyAuth.ownerId, req.params.entity, req.params.id)));
router.patch('/notifications/read-all', asyncRoute(async (req) => markAllNotificationsRead(req.pharmacyAuth.ownerId)));

router.get('/profile', asyncRoute(async (req) => getProfile(req.pharmacyAuth.ownerId)));
router.put('/profile', asyncRoute(async (req) => updateProfile(req.pharmacyAuth.ownerId, req.body)));
router.post('/profile/photos/:slot', pharmacyPhotoBody, asyncRoute(async (req) => uploadProfilePhoto(
  req.pharmacyAuth.ownerId, req.params.slot, req.body,
)));
router.delete('/profile/photos/:slot', asyncRoute(async (req) => removeProfilePhoto(req.pharmacyAuth.ownerId, req.params.slot)));

router.get('/complaints', asyncRoute(async (req) => listComplaints(req.pharmacyAuth.ownerId)));
router.post('/complaints', asyncRoute(async (req) => createComplaint(req.pharmacyAuth.ownerId, req.body)));
router.post('/complaints/:id/replies', asyncRoute(async (req) => replyComplaint(req.pharmacyAuth.ownerId, req.params.id, req.body?.text)));
router.patch('/complaints/:id/status', asyncRoute(async (req) => updateComplaintStatus(req.pharmacyAuth.ownerId, req.params.id, req.body?.status, req.body?.note)));

export default router;

