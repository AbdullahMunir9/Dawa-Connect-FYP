const CLOSED_STATUSES = new Set(['resolved', 'dismissed']);

function cleanParty(value = {}, fallback = {}) {
  const role = ['customer', 'pharmacy', 'admin'].includes(value?.role)
    ? value.role
    : fallback.role;
  return {
    id: String(value?.id || fallback.id || ''),
    name: String(value?.name || fallback.name || role || 'Participant'),
    email: String(value?.email || fallback.email || ''),
    role,
  };
}

export function normalizeComplaintMessage(message = {}, complaint = {}) {
  const text = String(message.text || message.message || message.content || '').trim().slice(0, 2000);
  if (message.by?.role) {
    return {
      by: cleanParty(message.by),
      text,
      at: message.at || message.createdAt || new Date(),
    };
  }

  const sender = String(message.sender || '').toLowerCase();
  const role = ['customer', 'pharmacy', 'admin'].includes(sender) ? sender : 'pharmacy';
  const fallback = role === 'customer'
    ? complaint.reporter
    : role === 'pharmacy'
      ? { id: complaint.pharmacyId, name: complaint.pharmacyName || message.senderName, role: 'pharmacy' }
      : { name: message.senderName || 'DawaConnect', role: 'admin' };
  return {
    // The legacy `id` identifies the message, not the participant. Let the
    // complaint-level participant provide the author id when senderId is absent.
    by: cleanParty({ id: message.senderId, name: message.senderName, role }, fallback),
    text,
    // Mongoose may add a default `at` while hydrating a legacy subdocument.
    // Prefer its real legacy timestamp in this branch.
    at: message.createdAt || message.at || new Date(),
  };
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

export function canAdminManageComplaint(complaint) {
  return complaint?.target === 'admin';
}

export function confirmedResolutionRoles(complaint) {
  return [...new Set(Array.from(complaint?.resolution?.confirmations || [])
    .map((confirmation) => confirmation?.by?.role)
    .filter(Boolean))];
}

export function applyResolutionAction(complaint, { action, actor, note = '', now = new Date() }) {
  const requiredRoles = requiredResolutionRoles(complaint);
  if (!requiredRoles.includes(actor?.role)) {
    throw Object.assign(new Error('You are not a participant in this complaint.'), { status: 403 });
  }

  if (action === 'reject') {
    if (complaint.status !== 'resolution_pending') {
      throw Object.assign(new Error('There is no pending resolution to reject.'), { status: 409 });
    }
    complaint.status = 'in_review';
    complaint.resolution = null;
    return { completed: false, eventText: `Resolution not accepted${note.trim() ? `: ${note.trim().slice(0, 1000)}` : '.'}` };
  }

  if (!['propose', 'confirm'].includes(action)) {
    throw Object.assign(new Error('Invalid resolution action.'), { status: 400 });
  }

  const existingPending = complaint.status === 'resolution_pending' && complaint.resolution;
  if (!existingPending && note.trim().length < 5) {
    throw Object.assign(new Error('Explain the proposed resolution in at least 5 characters.'), { status: 400 });
  }

  const existing = existingPending
    ? (complaint.resolution.toObject ? complaint.resolution.toObject() : complaint.resolution)
    : null;
  const confirmations = Array.from(existing?.confirmations || []).map((confirmation) => ({
    by: cleanParty(confirmation.by),
    at: confirmation.at || now,
  }));
  if (!confirmations.some((confirmation) => confirmation.by.role === actor.role)) {
    confirmations.push({ by: cleanParty(actor), at: now });
  }

  const resolution = {
    note: String(existing?.note || note).trim().slice(0, 1000),
    proposedBy: cleanParty(existing?.proposedBy || actor),
    proposedAt: existing?.proposedAt || now,
    confirmations,
    completedAt: null,
    by: null,
    at: null,
  };
  const confirmedRoles = new Set(confirmations.map((confirmation) => confirmation.by.role));
  const completed = requiredRoles.every((role) => confirmedRoles.has(role));
  if (completed) {
    complaint.status = 'resolved';
    resolution.completedAt = now;
    resolution.by = cleanParty(actor);
    resolution.at = now;
  } else {
    complaint.status = 'resolution_pending';
  }
  complaint.resolution = resolution;
  return {
    completed,
    eventText: completed
      ? 'Confirmed the resolution. This complaint is now resolved.'
      : existingPending
        ? 'Confirmed the proposed resolution. Waiting for the other party.'
        : `Proposed resolution: ${resolution.note}`,
  };
}

export function reopenForConversation(complaint) {
  if (complaint?.status === 'resolution_pending') {
    complaint.status = 'in_review';
    complaint.resolution = null;
    return true;
  }
  if (CLOSED_STATUSES.has(complaint?.status)) {
    complaint.status = 'open';
    complaint.resolution = null;
    return true;
  }
  return false;
}

