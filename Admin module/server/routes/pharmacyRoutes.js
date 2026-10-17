import express from 'express';
import { pharmacyView, requirePharmacyAuth } from '../middleware/pharmacyAuth.js';
import {
  confirmPharmacyLocation, createComplaint, createEntity, createProduct, deleteEntity, deleteProduct,
  getProfile, listComplaints, listEntity, listProducts, locationConfigured, loginPharmacy, logoutPharmacy,
  registrationAvailability, registerPharmacy, replyComplaint, requestPasswordReset, resetPassword,
  searchPharmacyLocation, updateComplaintStatus, updateEntity, updateProduct, updateProfile,
} from '../services/pharmacyService.js';

const router = express.Router();

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

router.get('/entities/:entity', asyncRoute(async (req) => listEntity(req.pharmacyAuth.ownerId, req.params.entity)));
router.post('/entities/:entity', asyncRoute(async (req) => createEntity(req.pharmacyAuth.ownerId, req.params.entity, req.body)));
router.patch('/entities/:entity/:id', asyncRoute(async (req) => updateEntity(req.pharmacyAuth.ownerId, req.params.entity, req.params.id, req.body)));
router.delete('/entities/:entity/:id', asyncRoute(async (req) => deleteEntity(req.pharmacyAuth.ownerId, req.params.entity, req.params.id)));

router.get('/profile', asyncRoute(async (req) => getProfile(req.pharmacyAuth.ownerId)));
router.put('/profile', asyncRoute(async (req) => updateProfile(req.pharmacyAuth.ownerId, req.body)));

router.get('/complaints', asyncRoute(async (req) => listComplaints(req.pharmacyAuth.ownerId)));
router.post('/complaints', asyncRoute(async (req) => createComplaint(req.pharmacyAuth.ownerId, req.body)));
router.post('/complaints/:id/replies', asyncRoute(async (req) => replyComplaint(req.pharmacyAuth.ownerId, req.params.id, req.body?.text)));
router.patch('/complaints/:id/status', asyncRoute(async (req) => updateComplaintStatus(req.pharmacyAuth.ownerId, req.params.id, req.body?.status, req.body?.note)));

export default router;

