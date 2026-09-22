import mongoose from 'mongoose';

// Immutable record of every admin action that changes platform state.
const auditLogSchema = new mongoose.Schema({
  actor: {
    id: { type: String, required: true },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    role: { type: String, default: 'admin' },
  },
  action: { type: String, required: true, index: true },
  targetType: { type: String, required: true, index: true }, // customer | pharmacy | admin | complaint | order
  targetId: { type: String, default: '', index: true },
  targetLabel: { type: String, default: '' },
  summary: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'auditlogs' });

auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

export async function recordAudit(req, { action, targetType, targetId = '', targetLabel = '', summary = '', meta = {} }) {
  try {
    await AuditLog.create({
      actor: { id: req.admin?.id || 'unknown', name: req.admin?.name || '', email: req.admin?.email || '', role: req.admin?.role || 'admin' },
      action, targetType, targetId: String(targetId || ''), targetLabel, summary, meta,
      ip: req.ip || '',
    });
  } catch (error) {
    // Auditing must never break the action that already succeeded.
    console.error('Audit log write failed:', error.message);
  }
}

export default AuditLog;
