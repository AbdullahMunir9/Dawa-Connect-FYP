import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';

const CATEGORIES = ['Analgesic','Antibiotic','Antidiabetic','Antacid','Antihistamine','Anti-inflammatory','Cardiovascular','Supplement','Antiviral','Dermatology','Other'];

function toDateInputValue(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export default function Inventory() {
  const { inventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, showToast, pharmacyProfile, user } = useApp();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Analgesic', price: '', stock: '', threshold: '', expiry: '', batch: '', supplier: '', unit: 'Tablets' });
  const approvalStatus = String(user?.approvalStatus || user?.status || pharmacyProfile?.approvalStatus || 'unapproved').toLowerCase();
  const accountStatus = String(user?.accountStatus || pharmacyProfile?.accountStatus || user?.status || '').toLowerCase();
  const isSuspended = accountStatus === 'suspended' || approvalStatus === 'suspended';
  const isRejected = !isSuspended && accountStatus === 'rejected';
  const isUnapproved = !isSuspended && approvalStatus === 'unapproved';
  const adminReason = isSuspended ? (user?.suspensionReason || pharmacyProfile?.suspensionReason) : isRejected ? (user?.rejectionReason || pharmacyProfile?.rejectionReason) : '';

  const filtered = useMemo(() => inventory.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.batch.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'All' || i.category === categoryFilter;
    const matchStock = stockFilter === 'All' || (stockFilter === 'Low' && i.stock <= i.threshold) || (stockFilter === 'Ok' && i.stock > i.threshold);
    return matchSearch && matchCat && matchStock;
  }), [inventory, search, categoryFilter, stockFilter]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ name: '', category: 'Analgesic', price: '', stock: '', threshold: '', expiry: '', batch: '', supplier: '', unit: 'Tablets' });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name || '',
      category: item.category || 'Analgesic',
      price: item.price ?? '',
      stock: item.stock ?? '',
      threshold: item.threshold ?? '',
      expiry: toDateInputValue(item.expiry),
      batch: item.batch || '',
      supplier: item.supplier || '',
      unit: item.unit || 'Tablets'
    });
    setShowModal(true);
  };

  const buildProductPayload = () => ({
    name: form.name.trim(),
    category: form.category,
    price: Number(form.price),
    stock: Number(form.stock),
    threshold: Number(form.threshold) || 0,
    expiry: form.expiry,
    batch: form.batch.trim(),
    supplier: form.supplier.trim(),
    unit: form.unit
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number.isNaN(Number(form.price)) || Number(form.price) < 0) {
      showToast('Enter a valid price.', 'error');
      return;
    }
    if (Number.isNaN(Number(form.stock)) || Number(form.stock) < 0) {
      showToast('Enter a valid stock quantity.', 'error');
      return;
    }
    const payload = buildProductPayload();
    setSaving(true);
    try {
      if (editItem) {
        const r = await updateInventoryItem(editItem.id, payload);
        if (r?.ok) setShowModal(false);
      } else {
        const r = await addInventoryItem(payload);
        if (r?.ok) setShowModal(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Remove this item?')) deleteInventoryItem(id);
  };

  const getExpiryStatus = (expiry) => {
    const days = Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return { label: 'Expired', cls: 'badge-danger' };
    if (days <= 30) return { label: `${days}d`, cls: 'badge-danger' };
    if (days <= 60) return { label: `${days}d`, cls: 'badge-warning' };
    return { label: expiry, cls: 'badge-success' };
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const lowCount = inventory.filter(i => i.stock <= i.threshold).length;
  const expiredCount = inventory.filter(i => new Date(i.expiry) <= new Date()).length;

  if (isSuspended || isRejected || isUnapproved) {
    return (
      <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="card" style={{ maxWidth: 720, width: '100%', border: `1px solid ${isSuspended || isRejected ? '#fecaca' : '#fde68a'}`, background: isSuspended || isRejected ? '#fff1f2' : '#fffbeb' }}>
          <div style={{ padding: '26px 24px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 26, lineHeight: 1 }}>{isSuspended ? '⛔' : isRejected ? '❌' : '⏳'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>
                {isSuspended ? 'Pharmacy Suspended' : isRejected ? 'Registration Not Approved' : 'Pharmacy Not Approved Yet'}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
                {isSuspended
                  ? 'Your pharmacy access is currently suspended by DawaConnect.'
                  : isRejected
                    ? 'DawaConnect reviewed your registration and could not approve it yet.'
                    : 'Your pharmacy is awaiting review by DawaConnect. You will be notified as soon as it is approved.'}
              </div>
              {adminReason && (
                <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0', fontSize: 13.5, color: '#1e293b' }}>
                  <b>Reason from DawaConnect:</b> {adminReason}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 13, color: '#64748b' }}>
                Fix the issue and use <b>Complaints → Contact DawaConnect</b> to ask for another review.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-hero">
        <div>
          <h2>Inventory Workspace</h2>
          <div className="page-subtitle">Manage medicines, low stock, expiry risk, and pricing in one place.</div>
        </div>
        <div className="action-row">
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Medicine</button>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Products', value: inventory.length, color: '#0d9488', bg: '#f0fdfa' },
          { label: 'Low Stock', value: lowCount, color: '#f59e0b', bg: '#fef3c7' },
          { label: 'Expired/Expiring', value: expiredCount, color: '#f43f5e', bg: '#fee2e2' },
          { label: 'Total Value', value: `PKR ${inventory.reduce((s, i) => s + i.price * i.stock, 0).toLocaleString()}`, color: '#10b981', bg: '#dcfce7' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'Sora,sans-serif' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        {/* Toolbar */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ maxWidth: 280 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input placeholder="Search medicine, batch..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-control" style={{ width: 160 }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="form-control" style={{ width: 130 }} value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
            <option value="All">All Stock</option>
            <option value="Low">Low Stock</option>
            <option value="Ok">Sufficient</option>
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }} />
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Medicine</th><th>Category</th><th>Price (PKR)</th><th>Stock</th><th>Threshold</th><th>Expiry</th><th>Batch</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9}><div className="empty-state"><svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p>No medicines found</p></div></td></tr>
              )}
              {filtered.map(item => {
                const expStatus = getExpiryStatus(item.expiry);
                const isLow = item.stock <= item.threshold;
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13.5 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.supplier} · {item.unit}</div>
                    </td>
                    <td><span className="badge badge-teal">{item.category}</span></td>
                    <td style={{ fontWeight: 600, color: '#0f766e' }}>{item.price.toLocaleString()}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: isLow ? '#f43f5e' : '#1e293b' }}>{item.stock}</span>
                      {isLow && <span style={{ marginLeft: 6, fontSize: 11, color: '#f43f5e' }}>⚠️ Low</span>}
                    </td>
                    <td style={{ color: '#64748b' }}>{item.threshold}</td>
                    <td><span className={`badge ${expStatus.cls}`}>{expStatus.label}</span></td>
                    <td style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{item.batch}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <div style={{ width: 56, height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, (item.stock / (item.threshold * 3)) * 100)}%`, height: '100%', background: isLow ? '#f43f5e' : '#10b981', borderRadius: 99 }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => openEdit(item)}>Edit</button>
                        <button className="btn btn-danger btn-xs" onClick={() => handleDelete(item.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 20px', fontSize: 12, color: '#94a3b8', borderTop: '1px solid #f1f5f9' }}>
          Showing {filtered.length} of {inventory.length} items
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem ? 'Edit Medicine' : 'Add New Medicine'}</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Medicine Name *</label><input className="form-control" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Paracetamol 500mg" /></div>
                  <div className="form-group"><label className="form-label">Category *</label><select className="form-control" value={form.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                </div>
                <div className="form-row-3">
                  <div className="form-group"><label className="form-label">Price (PKR) *</label><input className="form-control" type="number" required value={form.price} onChange={e => set('price', e.target.value)} placeholder="0" /></div>
                  <div className="form-group"><label className="form-label">Stock Qty *</label><input className="form-control" type="number" required value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0" /></div>
                  <div className="form-group"><label className="form-label">Low Stock Alert</label><input className="form-control" type="number" value={form.threshold} onChange={e => set('threshold', e.target.value)} placeholder="20" /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Expiry Date *</label><input className="form-control" type="date" required value={form.expiry} onChange={e => set('expiry', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Batch Number *</label><input className="form-control" required value={form.batch} onChange={e => set('batch', e.target.value)} placeholder="B2024-XXX" /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Supplier</label><input className="form-control" value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="Supplier name" /></div>
                  <div className="form-group"><label className="form-label">Unit</label><select className="form-control" value={form.unit} onChange={e => set('unit', e.target.value)}><option>Tablets</option><option>Capsules</option><option>Syrup (ml)</option><option>Injection</option><option>Drops</option><option>Cream (g)</option><option>Sachets</option></select></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editItem ? 'Update Medicine' : 'Add Medicine'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
