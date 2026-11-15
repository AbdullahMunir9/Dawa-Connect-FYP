import express from 'express';
import { requireAuth, requireSuperadmin } from '../middleware/auth.js';
import {
  attachMedicineCatalogImage, listMedicineCatalog, removeMedicineCatalogImage,
  upsertMedicineCatalogRecord,
} from '../services/medicineCatalogService.js';

const router = express.Router();
const imageBody = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' });

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      const result = await handler(req, res);
      if (!res.headersSent) res.json(result);
    } catch (error) {
      const status = Number(error?.status) || 400;
      if (status >= 500) console.error('Medicine catalogue API error:', error?.message || error);
      res.status(status).json({ message: status >= 500 ? 'The medicine catalogue service is temporarily unavailable.' : error.message });
    }
  };
}

router.use(requireAuth);
router.get('/', asyncRoute(async (req) => listMedicineCatalog(req.query)));
router.post('/', requireSuperadmin, asyncRoute(async (req) => upsertMedicineCatalogRecord(req.body, { actor: req.admin.id })));
router.patch('/:id', requireSuperadmin, asyncRoute(async (req) => upsertMedicineCatalogRecord(req.body, { id: req.params.id, actor: req.admin.id })));
router.post('/:id/image', requireSuperadmin, imageBody, asyncRoute(async (req) => attachMedicineCatalogImage(
  req.params.id,
  req.body,
  {
    sourceUrl: req.get('x-image-source-url') || '',
    rightsConfirmed: String(req.get('x-image-rights-confirmed') || '').toLowerCase() === 'true',
    actor: req.admin.id,
  },
)));
router.delete('/:id/image', requireSuperadmin, asyncRoute(async (req) => removeMedicineCatalogImage(req.params.id, req.admin.id)));

export default router;
