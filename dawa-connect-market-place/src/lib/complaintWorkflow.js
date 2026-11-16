// Shared complaint contract. Keep this behaviour aligned with the Admin module
// so customer, pharmacy and DawaConnect confirmations mean the same thing.
const CLOSED_STATUSES = new Set(['resolved', 'dismissed']);

function cleanParty(value = {}, fallback = {}) {
  const role = ['customer', 'pharmacy', 'admin'].includes(value?.role) ? value.role : fallback.role;
  return {
    id: String(value?.id || fallback.id || ''),
    name: String(value?.name || fallback.name || role || 'Participant'),
    email: String(value?.email || fallback.email || ''),
    role,
  };
}

export function normalizeComplaintMessage(message = {}, complaint = {}) {
  const text = String(message.text || message.message || message.content || '').trim().slice(0, 2000);
  if (message.by?.role) return { by: cleanParty(message.by), text, at: message.at || message.createdAt || new Date() };
  const sender = String(message.sender || '').toLowerCase();
  const role = ['customer', 'pharmacy', 'admin'].includes(sender) ? sender : 'pharmacy';
  const fallback = role === 'customer' ? complaint.reporter : role === 'pharmacy'
    ? { id: complaint.pharmacyId, name: complaint.pharmacyName || message.senderName, role: 'pharmacy' }
    : { name: message.senderName || 'DawaConnect', role: 'admin' };
  // A legacy `id` is the message id, not the participant id. Also preserve
  // createdAt if Mongoose has applied a default value to the newer `at` field.
  return { by: cleanParty({ id: message.senderId, name: message.senderName, role }, fallback), text, at: message.createdAt || message.at || new Date() };
}

export function normalizeComplaintMessages(complaint) {
  const messages = Array.from(complaint?.messages || [])
    .map((message) => normalizeComplaintMessage(message?.toObject ? message.toObject() : message, complaint))
    .filter((message) => message.text.length > 0);
  if (complaint) complaint.messages = messages;
  return messages;
}

export function complaintView(value) {
  const complaint = value?.toObject ? value.toObject() : { ...(value || {}) };
  complaint.messages = Array.from(complaint.messages || []).map((message) => normalizeComplaintMessage(message, complaint));
  return complaint;
}

export function requiredResolutionRoles(complaint) {
  const reporterRole = complaint?.reporter?.role || complaint?.source;
  const handlerRole = complaint?.target === 'pharmacy' ? 'pharmacy' : 'admin';
  return [...new Set([reporterRole, handlerRole].filter((role) => ['customer', 'pharmacy', 'admin'].includes(role)))];
}

export function applyResolutionAction(complaint, { action, actor, note = '', now = new Date() }) {
  const requiredRoles = requiredResolutionRoles(complaint);
  if (!requiredRoles.includes(actor?.role)) throw Object.assign(new Error('You are not a participant in this complaint.'), { status: 403 });
  if (action === 'reject') {
    if (complaint.status !== 'resolution_pending') throw Object.assign(new Error('There is no pending resolution to reject.'), { status: 409 });
    complaint.status = 'in_review'; complaint.resolution = null;
    return { completed: false, eventText: `Resolution not accepted${note.trim() ? `: ${note.trim().slice(0, 1000)}` : '.'}` };
  }
  if (!['propose', 'confirm'].includes(action)) throw Object.assign(new Error('Invalid resolution action.'), { status: 400 });
  const pending = complaint.status === 'resolution_pending' && complaint.resolution;
  if (!pending && note.trim().length < 5) throw Object.assign(new Error('Explain the proposed resolution in at least 5 characters.'), { status: 400 });
  const existing = pending ? (complaint.resolution.toObject ? complaint.resolution.toObject() : complaint.resolution) : null;
  const confirmations = Array.from(existing?.confirmations || []).map((confirmation) => ({ by: cleanParty(confirmation.by), at: confirmation.at || now }));
  if (!confirmations.some((confirmation) => confirmation.by.role === actor.role)) confirmations.push({ by: cleanParty(actor), at: now });
  const resolution = { note: String(existing?.note || note).trim().slice(0, 1000), proposedBy: cleanParty(existing?.proposedBy || actor), proposedAt: existing?.proposedAt || now, confirmations, completedAt: null, by: null, at: null };
  const completed = requiredRoles.every((role) => confirmations.some((confirmation) => confirmation.by.role === role));
  complaint.status = completed ? 'resolved' : 'resolution_pending';
  if (completed) { resolution.completedAt = now; resolution.by = cleanParty(actor); resolution.at = now; }
  complaint.resolution = resolution;
  return { completed, eventText: completed ? 'Confirmed the resolution. This complaint is now resolved.' : pending ? 'Confirmed the proposed resolution. Waiting for the other party.' : `Proposed resolution: ${resolution.note}` };
}

export function reopenForConversation(complaint) {
  if (complaint?.status === 'resolution_pending') { complaint.status = 'in_review'; complaint.resolution = null; return true; }
  if (CLOSED_STATUSES.has(complaint?.status)) { complaint.status = 'open'; complaint.resolution = null; return true; }
  return false;
}
