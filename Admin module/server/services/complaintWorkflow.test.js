import assert from 'node:assert/strict';
import test from 'node:test';
import Complaint from '../models/Complaint.js';
import {
  applyResolutionAction, canAdminManageComplaint, complaintView, confirmedResolutionRoles, normalizeComplaintMessage,
  normalizeComplaintMessages, reopenForConversation, requiredResolutionRoles,
} from './complaintWorkflow.js';

const customer = { id: 'customer-1', name: 'Customer', role: 'customer' };
const pharmacy = { id: 'pharmacy-1', name: 'Pharmacy', role: 'pharmacy' };
const admin = { id: 'admin-1', name: 'Admin', role: 'admin' };

function customerComplaint(target = 'pharmacy') {
  return {
    source: 'customer', target, reporter: customer, pharmacyId: pharmacy.id, pharmacyName: pharmacy.name,
    status: 'in_review', messages: [], resolution: null,
  };
}

test('normalizes legacy pharmacy replies for every client', () => {
  const result = normalizeComplaintMessage({ id: 'legacy-message-id', sender: 'pharmacy', senderName: 'Al-Shifa', text: 'Please share the order id.', at: '2026-11-16T12:00:00Z', createdAt: '2026-11-15T12:00:00Z' }, customerComplaint());
  assert.equal(result.by.role, 'pharmacy');
  assert.equal(result.by.name, 'Al-Shifa');
  assert.equal(result.by.id, pharmacy.id);
  assert.equal(result.text, 'Please share the order id.');
  assert.equal(new Date(result.at).toISOString(), '2026-11-15T12:00:00.000Z');
});

test('admin can manage only complaints addressed to DawaConnect', () => {
  assert.equal(canAdminManageComplaint(customerComplaint('admin')), true);
  assert.equal(canAdminManageComplaint(customerComplaint('pharmacy')), false);
});

test('a non-participant cannot resolve a customer and pharmacy complaint', () => {
  const complaint = customerComplaint('pharmacy');
  assert.throws(
    () => applyResolutionAction(complaint, { action: 'propose', actor: admin, note: 'I should not control this.' }),
    /not a participant/i,
  );
  assert.equal(complaint.status, 'in_review');
});

test('customer and pharmacy must both confirm before a complaint resolves', () => {
  const complaint = customerComplaint();
  const proposed = applyResolutionAction(complaint, { action: 'propose', actor: pharmacy, note: 'Replacement delivered.' });
  assert.equal(proposed.completed, false);
  assert.equal(complaint.status, 'resolution_pending');
  assert.deepEqual(confirmedResolutionRoles(complaint), ['pharmacy']);
  const confirmed = applyResolutionAction(complaint, { action: 'confirm', actor: customer });
  assert.equal(confirmed.completed, true);
  assert.equal(complaint.status, 'resolved');
  assert.deepEqual(new Set(confirmedResolutionRoles(complaint)), new Set(['pharmacy', 'customer']));
});

test('a complaint addressed to DawaConnect requires reporter and admin approval', () => {
  const complaint = customerComplaint('admin');
  assert.deepEqual(requiredResolutionRoles(complaint), ['customer', 'admin']);
  applyResolutionAction(complaint, { action: 'propose', actor: customer, note: 'The refund arrived.' });
  assert.equal(complaint.status, 'resolution_pending');
  applyResolutionAction(complaint, { action: 'confirm', actor: admin });
  assert.equal(complaint.status, 'resolved');
});

test('rejecting a proposal returns the complaint to discussion', () => {
  const complaint = customerComplaint();
  applyResolutionAction(complaint, { action: 'propose', actor: pharmacy, note: 'A replacement was offered.' });
  const result = applyResolutionAction(complaint, { action: 'reject', actor: customer, note: 'It has not arrived.' });
  assert.equal(result.completed, false);
  assert.equal(complaint.status, 'in_review');
  assert.equal(complaint.resolution, null);
});

test('replying while resolution is pending resumes the discussion', () => {
  const complaint = customerComplaint();
  applyResolutionAction(complaint, { action: 'propose', actor: pharmacy, note: 'Refund was issued.' });
  assert.equal(reopenForConversation(complaint), true);
  assert.equal(complaint.status, 'in_review');
  assert.equal(complaint.resolution, null);
});

test('complaint view converts old messages without changing complaint identity', () => {
  const result = complaintView({ _id: 'abc', ...customerComplaint(), messages: [{ sender: 'pharmacy', senderName: 'Care Pharmacy', text: 'Done', createdAt: new Date() }] });
  assert.equal(result._id, 'abc');
  assert.equal(result.messages[0].by.name, 'Care Pharmacy');
});

test('a hydrated legacy pharmacy thread can accept and validate a customer reply', async () => {
  const complaint = Complaint.hydrate({
    _id: '507f1f77bcf86cd799439011', complaintId: 'CMP-LEGACY', ...customerComplaint(),
    subject: 'Legacy complaint', description: 'A complaint created before the shared message schema.',
    messages: [{ id: 'message-1', sender: 'pharmacy', senderName: 'Care Pharmacy', text: 'Please share the order id.', createdAt: new Date('2026-11-15T12:00:00Z') }],
    createdAt: new Date('2026-11-15T11:00:00Z'), updatedAt: new Date('2026-11-15T12:00:00Z'),
  });
  normalizeComplaintMessages(complaint);
  complaint.messages.push({ by: customer, text: 'The order id is DC-123.', at: new Date('2026-11-15T12:05:00Z') });
  await complaint.validate();
  assert.equal(complaint.messages.length, 2);
  assert.equal(complaint.messages[0].by.id, pharmacy.id);
  assert.equal(complaint.messages[0].at.toISOString(), '2026-11-15T12:00:00.000Z');
  assert.equal(complaint.messages[1].by.role, 'customer');
});

test('a customer proposal stays pending until the pharmacy confirms it', () => {
  const complaint = customerComplaint('pharmacy');
  applyResolutionAction(complaint, { action: 'propose', actor: customer, note: 'The replacement arrived safely.' });
  assert.equal(complaint.status, 'resolution_pending');
  assert.deepEqual(confirmedResolutionRoles(complaint), ['customer']);

  applyResolutionAction(complaint, { action: 'confirm', actor: pharmacy });
  assert.equal(complaint.status, 'resolved');
  assert.deepEqual(new Set(confirmedResolutionRoles(complaint)), new Set(['customer', 'pharmacy']));
});

test('the proposing role cannot resolve a complaint by confirming twice', () => {
  const complaint = customerComplaint('pharmacy');
  applyResolutionAction(complaint, { action: 'propose', actor: pharmacy, note: 'The delivery fee was refunded.' });
  const secondAction = applyResolutionAction(complaint, { action: 'confirm', actor: pharmacy });
  assert.equal(secondAction.completed, false);
  assert.equal(complaint.status, 'resolution_pending');
  assert.deepEqual(confirmedResolutionRoles(complaint), ['pharmacy']);
});

test('pharmacy complaints to DawaConnect require pharmacy and admin approval', () => {
  const complaint = {
    source: 'pharmacy', target: 'admin', reporter: pharmacy, pharmacyId: pharmacy.id,
    pharmacyName: pharmacy.name, status: 'in_review', messages: [], resolution: null,
  };
  assert.deepEqual(requiredResolutionRoles(complaint), ['pharmacy', 'admin']);
  applyResolutionAction(complaint, { action: 'propose', actor: admin, note: 'The catalogue request was completed.' });
  assert.equal(complaint.status, 'resolution_pending');
  applyResolutionAction(complaint, { action: 'confirm', actor: pharmacy });
  assert.equal(complaint.status, 'resolved');
});

test('a resolved complaint remains serializable as previous complaint history', () => {
  const resolvedAt = new Date('2026-11-16T12:30:00Z');
  const complaint = customerComplaint('pharmacy');
  complaint.status = 'resolved';
  complaint.resolution = {
    note: 'Refund completed.', by: pharmacy, at: resolvedAt,
    confirmations: [{ by: customer, at: resolvedAt }, { by: pharmacy, at: resolvedAt }],
    completedAt: resolvedAt,
  };
  const view = complaintView(complaint);
  assert.equal(view.status, 'resolved');
  assert.equal(view.resolution.note, 'Refund completed.');
  assert.equal(view.resolution.confirmations.length, 2);
});

