import express from 'express';
import AuditLog from '../models/AuditLog.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const escapeRegex = (value) => String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', async (req, res) => {
  try {
    const { action, targetType, targetId, actorId, q, from, to, limit } = req.query;
    const filter = {};
    if (action) filter.action = String(action);
    if (targetType) filter.targetType = String(targetType);
    if (targetId) filter.targetId = String(targetId);
    if (actorId) filter['actor.id'] = String(actorId);
    if (from || to) {
      filter.createdAt = {};
      if (from && !Number.isNaN(Date.parse(from))) filter.createdAt.$gte = new Date(from);
      if (to && !Number.isNaN(Date.parse(to))) filter.createdAt.$lte = new Date(to);
    }
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ summary: rx }, { targetLabel: rx }, { 'actor.name': rx }, { 'actor.email': rx }, { action: rx }];
    }
    const entries = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(Math.min(1000, Number(limit) || 300)).lean();
    const actions = await AuditLog.distinct('action');
    res.json({ entries, actions: actions.sort() });
  } catch (error) {
    res.status(500).json({ message: 'Could not load the audit log.' });
  }
});

export default router;
