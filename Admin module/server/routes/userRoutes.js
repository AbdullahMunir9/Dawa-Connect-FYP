import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Complaint from '../models/Complaint.js';
import Admin from '../models/Admin.js';
import AuditLog, { recordAudit } from '../models/AuditLog.js';
import PharmacyUser from '../models/PharmacyUser.js';
import PharmacyProduct from '../models/PharmacyProduct.js';
import PharmacyProfile from '../models/PharmacyProfile.js';
import PharmacyOrder from '../models/PharmacyOrder.js';
import { PharmacyReview, PharmacyReturn, PharmacyNotification } from '../models/PharmacyGeneric.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

const isObjectId = (value) => mongoose.isValidObjectId(value);
const DAY = 24 * 60 * 60 * 1000;

/* ----------------------------- helpers ----------------------------- */

function ownerIdVariants(id) {
  const variants = [String(id)];
  if (isObjectId(id)) variants.push(new mongoose.Types.ObjectId(String(id)));
  return variants;
}

// Derives one canonical lifecycle state from the two legacy status fields.
export function pharmacyState(doc) {
  const status = String(doc?.status || '').toLowerCase();
  const approval = String(doc?.approvalStatus || '').toLowerCase();
  if (status === 'suspended') return 'suspended';
  if (status === 'rejected') return 'rejected';
  if (approval === 'approved' || (!approval && status === 'approved')) return 'approved';
  return 'pending';
}

function pharmacyView(doc, extra = {}) {
  const id = String(doc._id);
  return {
    ...doc,
    _id: id,
    id,
    name: doc.pharmacyName || doc.name || 'Unnamed pharmacy',
    license: doc.licenseNumber || doc.license || '',
    state: pharmacyState(doc),
    ...extra,
  };
}

function customerView(doc, extra = {}) {
  const id = String(doc._id);
  return { ...doc, _id: id, id, status: String(doc.status || 'active').toLowerCase(), ...extra };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function notifyPharmacy(ownerId, message, extra = {}) {
  try {
    const now = new Date();
    await PharmacyNotification.collection.insertOne({
      ownerId: String(ownerId), type: extra.type || 'account', message, read: false,
      color: extra.color || '#0d9488', createdAt: now, updatedAt: now, ...extra.fields,
    });
  } catch (error) {
    console.error('Pharmacy notification failed:', error.message);
  }
}

async function loadPharmacy(id) {
  if (!isObjectId(id)) return null;
  return PharmacyUser.findById(id).lean();
}

/* ----------------------------- sidebar badges ----------------------------- */

router.get('/badges', async (req, res) => {
  try {
    const [pharmacies, openComplaints, oversightComplaints, pendingAdmins] = await Promise.all([
      PharmacyUser.find().select('status approvalStatus').lean(),
      Complaint.countDocuments({ target: 'admin', status: { $in: ['open', 'in_review'] } }),
      Complaint.countDocuments({ target: 'pharmacy', status: { $in: ['open', 'in_review'] } }),
      req.admin.role === 'superadmin' ? Admin.countDocuments({ status: 'pending' }) : Promise.resolve(0),
    ]);
    res.json({
      pendingPharmacies: pharmacies.filter((p) => pharmacyState(p) === 'pending').length,
      openComplaints, oversightComplaints, pendingAdmins,
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load counters.' });
  }
});

/* ----------------------------- dashboard ----------------------------- */

router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * DAY);
    const since60 = new Date(now.getTime() - 60 * DAY);
    const since7 = new Date(now.getTime() - 7 * DAY);

    const [customers, pharmacies, orders, complaints, pendingAdmins, recentAudit] = await Promise.all([
      User.find().select('status createdAt').lean(),
      PharmacyUser.find().select('pharmacyName status approvalStatus city createdAt').lean(),
      Order.find().select('orderId total status createdAt deliveryAddress.city fulfillments userId items paymentMethod').sort({ createdAt: -1 }).lean(),
      Complaint.find().select('status target source priority createdAt').lean(),
      Admin.countDocuments({ status: 'pending' }),
      AuditLog.find().sort({ createdAt: -1 }).limit(8).lean(),
    ]);

    const isRevenue = (order) => !['Cancelled'].includes(order.status);
    const inRange = (date, from, to) => { const d = parseDate(date); return d && d >= from && (!to || d < to); };

    const orders30 = orders.filter((o) => inRange(o.createdAt, since30));
    const ordersPrev30 = orders.filter((o) => inRange(o.createdAt, since60, since30));
    const revenue = (list) => list.filter(isRevenue).reduce((sum, o) => sum + toNumber(o.total), 0);
    const deliveredRevenue = orders.filter((o) => o.status === 'Delivered').reduce((sum, o) => sum + toNumber(o.total), 0);

    const series = [];
    for (let i = 29; i >= 0; i -= 1) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(dayStart.getTime() + DAY);
      const dayOrders = orders.filter((o) => inRange(o.createdAt, dayStart, dayEnd));
      series.push({ date: dayStart.toISOString().slice(0, 10), orders: dayOrders.length, revenue: revenue(dayOrders) });
    }

    const statusCounts = {};
    for (const order of orders) statusCounts[order.status || 'Unknown'] = (statusCounts[order.status || 'Unknown'] || 0) + 1;

    const cityCounts = {};
    for (const order of orders) {
      const city = (order.deliveryAddress?.city || 'Unknown').trim() || 'Unknown';
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    }
    const cities = Object.entries(cityCounts).map(([city, count]) => ({ city, orders: count })).sort((a, b) => b.orders - a.orders).slice(0, 8);

    const pharmacyTotals = new Map();
    for (const order of orders) {
      for (const f of order.fulfillments || []) {
        if (!f?.pharmacyId) continue;
        const entry = pharmacyTotals.get(f.pharmacyId) || { pharmacyId: f.pharmacyId, name: f.pharmacyName || 'Pharmacy', orders: 0, revenue: 0, delivered: 0, cancelled: 0 };
        entry.orders += 1;
        if (f.status === 'Delivered') { entry.delivered += 1; entry.revenue += toNumber(f.total); }
        else if (f.status === 'Cancelled') entry.cancelled += 1;
        else entry.revenue += toNumber(f.total);
        pharmacyTotals.set(f.pharmacyId, entry);
      }
    }
    const topPharmacies = [...pharmacyTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);

    const pharmacyStates = { pending: 0, approved: 0, suspended: 0, rejected: 0 };
    for (const p of pharmacies) pharmacyStates[pharmacyState(p)] += 1;

    const adminComplaints = complaints.filter((c) => c.target === 'admin');
    const complaintStats = {
      open: adminComplaints.filter((c) => c.status === 'open').length,
      inReview: adminComplaints.filter((c) => c.status === 'in_review').length,
      highPriority: adminComplaints.filter((c) => c.priority === 'high' && !['resolved', 'dismissed'].includes(c.status)).length,
      resolved30: adminComplaints.filter((c) => c.status === 'resolved' && inRange(c.createdAt, since30)).length,
      oversightOpen: complaints.filter((c) => c.target === 'pharmacy' && !['resolved', 'dismissed'].includes(c.status)).length,
    };

    const userIds = orders.slice(0, 8).map((o) => o.userId).filter(Boolean);
    const recentUsers = userIds.length ? await User.find({ _id: { $in: userIds } }).select('name email').lean() : [];
    const userById = new Map(recentUsers.map((u) => [String(u._id), u]));

    res.json({
      generatedAt: now,
      customers: {
        total: customers.length,
        suspended: customers.filter((c) => String(c.status || '').toLowerCase() === 'suspended').length,
        new30: customers.filter((c) => inRange(c.createdAt, since30)).length,
        new7: customers.filter((c) => inRange(c.createdAt, since7)).length,
      },
      pharmacies: { total: pharmacies.length, ...pharmacyStates, new30: pharmacies.filter((p) => inRange(p.createdAt, since30)).length },
      orders: {
        total: orders.length,
        last30: orders30.length,
        prev30: ordersPrev30.length,
        revenue30: revenue(orders30),
        revenuePrev30: revenue(ordersPrev30),
        revenueDelivered: deliveredRevenue,
        averageOrderValue: orders.length ? revenue(orders) / Math.max(1, orders.filter(isRevenue).length) : 0,
        byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
        series,
        cities,
        active: orders.filter((o) => ['Processing', 'Confirmed', 'Packed', 'Dispatched'].includes(o.status)).length,
      },
      topPharmacies,
      complaints: complaintStats,
      pendingAdmins,
      recentOrders: orders.slice(0, 8).map((o) => ({
        _id: String(o._id), orderId: o.orderId, total: o.total, status: o.status, createdAt: o.createdAt,
        customer: userById.get(String(o.userId))?.name || 'Guest', pharmacies: (o.fulfillments || []).map((f) => f.pharmacyName).filter(Boolean),
        city: o.deliveryAddress?.city || '',
      })),
      recentAudit,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Could not build the dashboard.' });
  }
});

/* ----------------------------- customers ----------------------------- */

router.get('/all-users', async (req, res) => {
  try {
    const [users, orderCounts] = await Promise.all([
      User.find().select('-password -cartItems').sort({ createdAt: -1 }).lean(),
      Order.aggregate([{ $match: { userId: { $ne: null } } }, { $group: { _id: '$userId', count: { $sum: 1 }, spent: { $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, '$total', 0] } }, last: { $max: '$createdAt' } } }]),
    ]);
    const byUser = new Map(orderCounts.map((row) => [String(row._id), row]));
    res.json(users.map((user) => {
      const stats = byUser.get(String(user._id));
      return customerView(user, { orderCount: stats?.count || 0, totalSpent: stats?.spent || 0, lastOrderAt: stats?.last || null });
    }));
  } catch (error) {
    res.status(500).json({ message: 'Could not load customers.' });
  }
});

// Customer 360: profile, addresses and order history. Cart contents and prescriptions are intentionally excluded.
router.get('/customer-360/:id', async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid customer id.' });
    const user = await User.findById(req.params.id).select('-password -cartItems').lean();
    if (!user) return res.status(404).json({ message: 'Customer not found' });
    const [orders, complaints] = await Promise.all([
      Order.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
      Complaint.find({ 'reporter.id': String(user._id) }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    const delivered = orders.filter((o) => o.status === 'Delivered');
    res.json({
      customer: customerView(user),
      orders,
      complaints,
      stats: {
        orders: orders.length,
        delivered: delivered.length,
        cancelled: orders.filter((o) => o.status === 'Cancelled').length,
        totalSpent: delivered.reduce((sum, o) => sum + toNumber(o.total), 0),
        lastOrderAt: orders[0]?.createdAt || null,
        openComplaints: complaints.filter((c) => !['resolved', 'dismissed'].includes(c.status)).length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load this customer.' });
  }
});

router.patch('/toggle-status/:id', async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid customer id.' });
    const user = await User.findById(req.params.id).select('-password -cartItems');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const current = String(user.status || 'active').toLowerCase();
    const requested = String(req.body?.status || '').toLowerCase();
    const next = ['active', 'suspended'].includes(requested) ? requested : (current === 'suspended' ? 'active' : 'suspended');
    user.status = next;
    await user.save();
    await recordAudit(req, {
      action: next === 'suspended' ? 'customer.suspend' : 'customer.reactivate', targetType: 'customer', targetId: user._id, targetLabel: user.email,
      summary: `${next === 'suspended' ? 'Suspended' : 'Reactivated'} customer ${user.name}`, meta: { reason: String(req.body?.reason || '') },
    });
    res.json(customerView(user.toObject()));
  } catch (error) {
    res.status(500).json({ message: 'Could not update customer status.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid customer id.' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await recordAudit(req, { action: 'customer.delete', targetType: 'customer', targetId: user._id, targetLabel: user.email, summary: `Deleted customer ${user.name}`, meta: { reason: String(req.body?.reason || '') } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete customer.' });
  }
});

/* ----------------------------- pharmacies ----------------------------- */

router.get('/pharmacies', async (req, res) => {
  try {
    const [pharmacies, counts, profiles] = await Promise.all([
      PharmacyUser.find().select('-passwordHash -password -resetOtpHash -resetOtpExpiresAt').sort({ createdAt: -1 }).lean(),
      PharmacyProduct.aggregate([{ $group: { _id: '$ownerId', count: { $sum: 1 } } }]),
      PharmacyProfile.find().select('ownerId name status logo deliveryType').lean(),
    ]);
    const countByOwner = new Map();
    for (const row of counts) if (row._id != null) countByOwner.set(String(row._id), row.count);
    const profileByOwner = new Map(profiles.map((p) => [String(p.ownerId), p]));
    res.json(pharmacies.map((p) => {
      const profile = profileByOwner.get(String(p._id));
      return pharmacyView(p, {
        productCount: countByOwner.get(String(p._id)) || 0,
        storefrontStatus: profile?.status || null,
        displayName: profile?.name || p.pharmacyName || '',
        logo: profile?.logo || '',
      });
    }));
  } catch (error) {
    res.status(500).json({ message: 'Could not load pharmacies.' });
  }
});

router.get('/pharmacy-products/:ownerId', async (req, res) => {
  try {
    const products = await PharmacyProduct.find({ ownerId: { $in: ownerIdVariants(req.params.ownerId) } })
      .select('name category price stock threshold expiry batch supplier unit updatedAt createdAt')
      .sort({ name: 1 })
      .lean();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Could not load products.' });
  }
});

// Pharmacy 360: registration, storefront profile, inventory health, fulfillment orders, reviews, returns, complaints.
router.get('/pharmacy-360/:id', async (req, res) => {
  try {
    const pharmacy = await loadPharmacy(req.params.id);
    if (!pharmacy) return res.status(404).json({ message: 'Pharmacy not found' });
    delete pharmacy.passwordHash; delete pharmacy.password; delete pharmacy.resetOtpHash; delete pharmacy.resetOtpExpiresAt;
    const id = String(pharmacy._id);
    const owners = ownerIdVariants(id);
    const [profile, products, orders, reviews, returns, complaints, marketplaceOrders] = await Promise.all([
      PharmacyProfile.findOne({ ownerId: id }).lean(),
      PharmacyProduct.find({ ownerId: { $in: owners } }).select('name category price stock threshold expiry unit batch updatedAt').lean(),
      PharmacyOrder.find({ ownerId: { $in: owners } }).sort({ createdAt: -1, date: -1 }).limit(60).lean(),
      PharmacyReview.find({ ownerId: { $in: owners } }).sort({ createdAt: -1 }).limit(20).lean(),
      PharmacyReturn.find({ ownerId: { $in: owners } }).sort({ createdAt: -1 }).limit(20).lean(),
      Complaint.find({ pharmacyId: id }).sort({ createdAt: -1 }).limit(30).lean(),
      Order.find({ 'fulfillments.pharmacyId': id }).select('orderId status total createdAt fulfillments').sort({ createdAt: -1 }).limit(200).lean(),
    ]);

    const soon = new Date(Date.now() + 30 * DAY);
    const inventory = {
      total: products.length,
      lowStock: products.filter((p) => toNumber(p.stock) > 0 && toNumber(p.stock) <= toNumber(p.threshold)).length,
      outOfStock: products.filter((p) => toNumber(p.stock) <= 0).length,
      expiringSoon: products.filter((p) => { const d = parseDate(p.expiry); return d && d <= soon && d >= new Date(); }).length,
      expired: products.filter((p) => { const d = parseDate(p.expiry); return d && d < new Date(); }).length,
      missingPrice: products.filter((p) => !(toNumber(p.price) > 0)).length,
      stockValue: products.reduce((sum, p) => sum + toNumber(p.price) * Math.max(0, toNumber(p.stock)), 0),
      categories: Object.entries(products.reduce((acc, p) => { const c = p.category || 'Uncategorised'; acc[c] = (acc[c] || 0) + 1; return acc; }, {})).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    };

    const fulfillments = marketplaceOrders.flatMap((o) => (o.fulfillments || []).filter((f) => f.pharmacyId === id).map((f) => ({ ...f, masterOrderId: o.orderId, createdAt: o.createdAt })));
    const fulfillmentStats = {
      total: fulfillments.length,
      delivered: fulfillments.filter((f) => f.status === 'Delivered').length,
      cancelled: fulfillments.filter((f) => f.status === 'Cancelled').length,
      active: fulfillments.filter((f) => !['Delivered', 'Cancelled'].includes(f.status)).length,
      revenue: fulfillments.filter((f) => f.status === 'Delivered').reduce((sum, f) => sum + toNumber(f.total), 0),
    };
    const ratings = reviews.map((r) => toNumber(r.rating)).filter((r) => r > 0);

    res.json({
      pharmacy: pharmacyView(pharmacy),
      profile,
      inventory,
      products: products.slice(0, 500),
      orders,
      fulfillmentStats,
      reviews,
      ratingSummary: { count: ratings.length, average: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null },
      returns,
      complaints,
      complaintStats: {
        received: complaints.filter((c) => c.target === 'pharmacy').length,
        receivedOpen: complaints.filter((c) => c.target === 'pharmacy' && !['resolved', 'dismissed'].includes(c.status)).length,
        filed: complaints.filter((c) => c.source === 'pharmacy').length,
      },
    });
  } catch (error) {
    console.error('Pharmacy 360 error:', error);
    res.status(500).json({ message: 'Could not load this pharmacy.' });
  }
});

async function applyPharmacyState(req, res, id, nextState, reason = '') {
  const pharmacy = await loadPharmacy(id);
  if (!pharmacy) return res.status(404).json({ message: 'Pharmacy not found' });
  const now = new Date();
  const label = pharmacy.pharmacyName || pharmacy.name || 'Pharmacy';
  let update; let action; let summary; let notice;
  switch (nextState) {
    case 'approved':
      update = { status: 'approved', approvalStatus: 'approved', approvedAt: now, rejectionReason: '', suspensionReason: '' };
      action = pharmacyState(pharmacy) === 'suspended' ? 'pharmacy.unsuspend' : 'pharmacy.approve';
      summary = `${action === 'pharmacy.unsuspend' ? 'Reinstated' : 'Approved'} pharmacy ${label}`;
      notice = action === 'pharmacy.unsuspend' ? 'Your pharmacy has been reinstated. Inventory and orders are available again.' : 'Congratulations! Your pharmacy has been approved. Your inventory is now visible on the Marketplace.';
      break;
    case 'rejected':
      update = { status: 'rejected', approvalStatus: 'unapproved', rejectionReason: reason, rejectedAt: now };
      action = 'pharmacy.reject'; summary = `Rejected pharmacy ${label}`;
      notice = `Your registration was not approved. Reason: ${reason}`;
      break;
    case 'suspended':
      // Suspended pharmacies must not remain "approved" (Marketplace eligibility depends on both fields).
      update = { status: 'suspended', approvalStatus: 'unapproved', suspensionReason: reason, suspendedAt: now };
      action = 'pharmacy.suspend'; summary = `Suspended pharmacy ${label}`;
      notice = `Your pharmacy has been suspended by DAWA Connect.${reason ? ` Reason: ${reason}` : ''}`;
      break;
    case 'pending':
      update = { status: 'unapproved', approvalStatus: 'unapproved', rejectionReason: '', suspensionReason: '' };
      action = 'pharmacy.revoke'; summary = `Moved pharmacy ${label} back to pending`;
      notice = 'Your pharmacy approval is under review again.';
      break;
    default:
      return res.status(400).json({ message: 'Invalid status value' });
  }
  const updated = await PharmacyUser.findByIdAndUpdate(id, { $set: update }, { new: true }).select('-passwordHash -password -resetOtpHash -resetOtpExpiresAt').lean();
  await PharmacyProfile.updateOne({ ownerId: String(id) }, { $set: { approvalStatus: update.approvalStatus, updatedAt: now } }).catch(() => {});
  await recordAudit(req, { action, targetType: 'pharmacy', targetId: id, targetLabel: label, summary, meta: { reason, previousState: pharmacyState(pharmacy) } });
  await notifyPharmacy(id, notice, { color: nextState === 'approved' ? '#10b981' : '#f43f5e' });
  return res.json(pharmacyView(updated));
}

router.patch('/approve-pharmacy/:id', (req, res) => applyPharmacyState(req, res, req.params.id, 'approved').catch(() => res.status(500).json({ message: 'Could not approve pharmacy.' })));

router.patch('/reject-pharmacy/:id', async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 5 || reason.length > 500) return res.status(400).json({ message: 'Give the pharmacy a clear rejection reason (5–500 characters).' });
  return applyPharmacyState(req, res, req.params.id, 'rejected', reason).catch(() => res.status(500).json({ message: 'Could not reject pharmacy.' }));
});

router.patch('/pharmacy-status/:id', async (req, res) => {
  const requested = String(req.body?.status || '').toLowerCase();
  const reason = String(req.body?.reason || '').trim().slice(0, 500);
  const map = { approved: 'approved', suspended: 'suspended', unapproved: 'pending', pending: 'pending', rejected: 'rejected' };
  if (!map[requested]) return res.status(400).json({ message: 'Invalid status value' });
  if (map[requested] === 'rejected' && reason.length < 5) return res.status(400).json({ message: 'A rejection reason is required.' });
  return applyPharmacyState(req, res, req.params.id, map[requested], reason).catch(() => res.status(500).json({ message: 'Could not update pharmacy status.' }));
});

/* ----------------------------- orders ----------------------------- */

router.get('/all-orders', async (req, res) => {
  try {
    const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 1000));
    const orders = await Order.find().sort({ createdAt: -1 }).limit(limit).lean();
    const userIds = [...new Set(orders.map((o) => o.userId).filter(Boolean).map(String))];
    const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select('name email phone city').lean() : [];
    const userById = new Map(users.map((u) => [String(u._id), u]));
    res.json(orders.map((o) => {
      const customer = userById.get(String(o.userId));
      return { ...o, _id: String(o._id), customer: customer ? { id: String(customer._id), name: customer.name, email: customer.email, phone: customer.phone } : null };
    }));
  } catch (error) {
    res.status(500).json({ message: 'Could not load orders.' });
  }
});

router.get('/order/:id', async (req, res) => {
  try {
    const order = isObjectId(req.params.id) ? await Order.findById(req.params.id).lean() : await Order.findOne({ orderId: req.params.id }).lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const customer = order.userId ? await User.findById(order.userId).select('name email phone city').lean() : null;
    const pharmacyOrderIds = (order.fulfillments || []).map((f) => f.pharmacyOrderId).filter(Boolean);
    const pharmacyOrders = pharmacyOrderIds.length ? await PharmacyOrder.find({ $or: [{ id: { $in: pharmacyOrderIds } }, { marketplaceOrderId: String(order._id) }] }).lean() : [];
    res.json({ order: { ...order, _id: String(order._id) }, customer, pharmacyOrders });
  } catch (error) {
    res.status(500).json({ message: 'Could not load this order.' });
  }
});

export default router;
