import express from 'express';
import mongoose from 'mongoose';
import Complaint, { COMPLAINT_PRIORITIES, COMPLAINT_STATUSES } from '../models/Complaint.js';
import { PharmacyNotification } from '../models/PharmacyGeneric.js';
import { recordAudit } from '../models/AuditLog.js';
import { requireAuth } from '../middleware/auth.js';
import { applyResolutionAction, canAdminManageComplaint, complaintView, normalizeComplaintMessages, reopenForConversation } from '../services/complaintWorkflow.js';

const router = express.Router();
router.use(requireAuth);

const CLOSED = ['resolved', 'dismissed'];
const escapeRegex = (value) => String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function adminParty(req) {
  return { id: req.admin.id, name: req.admin.name, email: req.admin.email, role: 'admin' };
}

async function findComplaint(id) {
  if (mongoose.isValidObjectId(id)) {
    const byId = await Complaint.findById(id);
    if (byId) return byId;
  }
  return Complaint.findOne({ complaintId: id });
}

// Pharmacies learn about admin activity through their in-app notifications.
async function notifyPharmacyOwner(ownerId, message, complaint) {
  if (!ownerId) return;
  try {
    const now = new Date();
    await PharmacyNotification.collection.insertOne({
      ownerId: String(ownerId), type: 'complaint', message, complaintId: complaint.complaintId,
      read: false, color: '#f59e0b', createdAt: now, updatedAt: now,
    });
  } catch (error) {
    console.error('Complaint notification failed:', error.message);
  }
}

function pharmacyToNotify(complaint) {
  if (complaint.source === 'pharmacy') return complaint.reporter?.id;
  if (complaint.target === 'pharmacy') return complaint.pharmacyId;
  return null;
}

// scope=inbox → complaints addressed to DAWA Connect (from pharmacies and customers).
// scope=oversight → customer complaints addressed to pharmacies (visible for moderation).
router.get('/', async (req, res) => {
  try {
    const { scope = 'inbox', status, source, priority, category, q, pharmacyId, limit } = req.query;
    const filter = {};
    if (scope === 'inbox') filter.target = 'admin';
    else if (scope === 'oversight') filter.target = 'pharmacy';
    if (status && COMPLAINT_STATUSES.includes(status)) filter.status = status;
    if (source && ['customer', 'pharmacy'].includes(source)) filter.source = source;
    if (priority && COMPLAINT_PRIORITIES.includes(priority)) filter.priority = priority;
    if (category) filter.category = String(category);
    if (pharmacyId) filter.pharmacyId = String(pharmacyId);
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ complaintId: rx }, { subject: rx }, { description: rx }, { 'reporter.name': rx }, { 'reporter.email': rx }, { pharmacyName: rx }, { orderId: rx }];
    }
    const complaints = await Complaint.find(filter).sort({ lastActivityAt: -1, createdAt: -1 }).limit(Math.min(1000, Number(limit) || 500)).lean();
    const [inboxOpen, oversightOpen] = await Promise.all([
      Complaint.countDocuments({ target: 'admin', status: { $nin: CLOSED } }),
      Complaint.countDocuments({ target: 'pharmacy', status: { $nin: CLOSED } }),
    ]);
    res.json({ complaints: complaints.map(complaintView), counts: { inboxOpen, oversightOpen } });
  } catch (error) {
    res.status(500).json({ message: 'Could not load complaints.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const complaint = await findComplaint(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    res.json({ complaint: complaintView(complaint) });
  } catch (error) {
    res.status(500).json({ message: 'Could not load this complaint.' });
  }
});

router.post('/:id/reply', async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (text.length < 1 || text.length > 2000) return res.status(400).json({ message: 'Write a reply between 1 and 2000 characters.' });
    const complaint = await findComplaint(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    if (!canAdminManageComplaint(complaint)) return res.status(403).json({ message: 'Pharmacy-handled complaints are oversight only. The pharmacy and customer must communicate directly.' });
    const now = new Date();
    complaint.messages = normalizeComplaintMessages(complaint);
    reopenForConversation(complaint);
    complaint.messages.push({ by: adminParty(req), text, at: now });
    if (complaint.status === 'open') complaint.status = 'in_review';
    complaint.lastActivityAt = now;
    await complaint.save();
    await notifyPharmacyOwner(pharmacyToNotify(complaint), `DAWA Connect replied to complaint ${complaint.complaintId}: ${complaint.subject}`, complaint);
    await recordAudit(req, { action: 'complaint.reply', targetType: 'complaint', targetId: complaint._id, targetLabel: complaint.complaintId, summary: `Replied to complaint ${complaint.complaintId}` });
    res.json({ complaint: complaintView(complaint) });
  } catch (error) {
    res.status(500).json({ message: 'Could not send the reply.' });
  }
});

// Only complaints addressed to DawaConnect can be actioned by an administrator.
// Closing uses the same two-party confirmation contract as pharmacy complaints.
router.post('/:id/resolution', async (req, res) => {
  try {
    const complaint = await findComplaint(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    if (!canAdminManageComplaint(complaint)) return res.status(403).json({ message: 'This is a pharmacy-handled complaint. Oversight users cannot resolve it.' });
    const now = new Date();
    complaint.messages = normalizeComplaintMessages(complaint);
    let result;
    try {
      result = applyResolutionAction(complaint, {
        action: String(req.body?.action || ''), actor: adminParty(req), note: String(req.body?.note || ''), now,
      });
    } catch (error) {
      return res.status(error.status || 400).json({ message: error.message || 'Could not update the resolution.' });
    }
    complaint.messages.push({ by: adminParty(req), text: result.eventText, at: now });
    complaint.lastActivityAt = now;
    await complaint.save();
    await notifyPharmacyOwner(pharmacyToNotify(complaint), `DawaConnect updated the resolution for complaint ${complaint.complaintId}.`, complaint);
    await recordAudit(req, { action: 'complaint.resolution', targetType: 'complaint', targetId: complaint._id, targetLabel: complaint.complaintId, summary: `Updated resolution for complaint ${complaint.complaintId}`, meta: { action: req.body?.action, completed: result.completed } });
    res.json({ complaint: complaintView(complaint) });
  } catch (error) {
    res.status(500).json({ message: 'Could not update the complaint resolution.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const complaint = await findComplaint(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    if (!canAdminManageComplaint(complaint)) return res.status(403).json({ message: 'Pharmacy-handled complaints are read-only in oversight.' });
    const { status, priority } = req.body || {};
    const changes = [];
    const now = new Date();
    if (priority !== undefined) {
      if (!COMPLAINT_PRIORITIES.includes(priority)) return res.status(400).json({ message: 'Invalid priority.' });
      if (priority !== complaint.priority) { changes.push(`priority ${complaint.priority} → ${priority}`); complaint.priority = priority; }
    }
    if (status !== undefined) {
      if (!['open', 'in_review'].includes(status)) return res.status(400).json({ message: 'Use the two-party resolution controls to close a complaint.' });
      if (status !== complaint.status) {
        changes.push(`status ${complaint.status} → ${status}`);
        complaint.status = status;
        if (status === 'open') complaint.resolution = null;
      }
    }
    if (!changes.length) return res.json({ complaint: complaintView(complaint) });
    complaint.lastActivityAt = now;
    await complaint.save();
    if (status !== undefined) {
      const label = { open: 'was reopened', in_review: 'is now under review' }[complaint.status];
      await notifyPharmacyOwner(pharmacyToNotify(complaint), `Complaint ${complaint.complaintId} ${label} by DAWA Connect.`, complaint);
    }
    await recordAudit(req, { action: 'complaint.update', targetType: 'complaint', targetId: complaint._id, targetLabel: complaint.complaintId, summary: `Updated complaint ${complaint.complaintId}: ${changes.join(', ')}`, meta: { resolutionNote: complaint.resolution?.note || '' } });
    res.json({ complaint: complaintView(complaint) });
  } catch (error) {
    res.status(500).json({ message: 'Could not update the complaint.' });
  }
});

export default router;
