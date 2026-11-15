import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';

const CATEGORIES = ['Analgesic','Antibiotic','Antidiabetic','Antacid','Antihistamine','Anti-inflammatory','Cardiovascular','Supplement','Antiviral','Dermatology','Respiratory','Gastrointestinal','Neurology','Eye & Ear Care','First Aid','Personal Care','Baby Care','Hygiene','Other'];
const UNITS = ['Tablets','Capsules','Syrup (ml)','Suspension (ml)','Injection','Drops','Cream (g)','Ointment (g)','Gel (g)','Inhaler','Sachets','Powder','Solution (ml)','Device','Pack','Other'];

const emptyForm = () => ({
  catalogMedicineId: '', catalogImageId: '', useGenericImage: true,
  name: '', genericName: '', category: '', price: '', stock: '', threshold: '', expiry: '', unit: '',
});

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
  const [form, setForm] = useState(emptyForm);
  const [catalogSelection, setCatalogSelection] = useState(null);
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [imageSelection, setImageSelection] = useState(null);
  const [imageSearch, setImageSearch] = useState('');
  const [imageResults, setImageResults] = useState([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imageOpen, setImageOpen] = useState(false);
  const approvalStatus = String(user?.approvalStatus || user?.status || pharmacyProfile?.approvalStatus || 'unapproved').toLowerCase();
  const accountStatus = String(user?.accountStatus || pharmacyProfile?.accountStatus || user?.status || '').toLowerCase();
  const isSuspended = accountStatus === 'suspended' || approvalStatus === 'suspended';
  const isRejected = !isSuspended && accountStatus === 'rejected';
  const isUnapproved = !isSuspended && approvalStatus === 'unapproved';
  const adminReason = isSuspended ? (user?.suspensionReason || pharmacyProfile?.suspensionReason) : isRejected ? (user?.rejectionReason || pharmacyProfile?.rejectionReason) : '';

  const filtered = useMemo(() => inventory.filter(i => {
    const needle = search.toLowerCase();
    const matchSearch = String(i.name || '').toLowerCase().includes(needle)
      || String(i.genericName || i.catalogSnapshot?.genericName || '').toLowerCase().includes(needle)
      || String(i.category || '').toLowerCase().includes(needle);
    const matchCat = categoryFilter === 'All' || i.category === categoryFilter;
    const matchStock = stockFilter === 'All' || (stockFilter === 'Low' && i.stock <= i.threshold) || (stockFilter === 'Ok' && i.stock > i.threshold);
    return matchSearch && matchCat && matchStock;
  }), [inventory, search, categoryFilter, stockFilter]);

  const openAdd = () => {
    setEditItem(null);
    setForm(emptyForm());
    setCatalogSelection(null);
    setCatalogResults([]);
    setCatalogError('');
    setImageSelection(null);
    setImageSearch('');
    setImageResults([]);
    setImageError('');
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    const selected = item.catalogMedicineId ? {
      id: item.catalogMedicineId,
      catalogKey: item.catalogKey,
      displayName: item.catalogSnapshot?.displayName || item.name,
      brandName: item.catalogSnapshot?.brandName || '',
      genericName: item.catalogSnapshot?.genericName || '',
      category: item.catalogSnapshot?.category || item.category,
      unit: item.catalogSnapshot?.unit || item.unit,
      strength: item.catalogSnapshot?.strength || '',
      dosageForm: item.catalogSnapshot?.dosageForm || '',
      manufacturer: item.catalogSnapshot?.manufacturer || '',
      image: item.catalogSnapshot?.image || item.image || null,
    } : null;
    const selectedImage = item.imageUrl ? {
      id: item.catalogImageId || item.catalogMedicineId || '',
      displayName: item.imageCatalogSnapshot?.displayName || item.catalogSnapshot?.displayName || item.name,
      genericName: item.imageCatalogSnapshot?.genericName || item.catalogSnapshot?.genericName || item.genericName || '',
      image: item.imageCatalogSnapshot?.image || item.catalogSnapshot?.image || item.image || { secureUrl: item.imageUrl },
    } : null;
    setCatalogSelection(selected);
    setImageSelection(selectedImage);
    setForm({
      catalogMedicineId: item.catalogMedicineId || '',
      catalogImageId: item.catalogImageId || (item.imageUrl ? item.catalogMedicineId || '' : ''),
      useGenericImage: !item.imageUrl,
      name: item.name || '',
      genericName: item.genericName || item.catalogSnapshot?.genericName || '',
      category: item.category || '',
      price: item.price ?? '',
      stock: item.stock ?? '',
      threshold: item.threshold ?? '',
      expiry: toDateInputValue(item.expiry),
      unit: item.unit || ''
    });
    setCatalogResults([]);
    setCatalogError('');
    setImageSearch('');
    setImageResults([]);
    setImageError('');
    setShowModal(true);
  };

  useEffect(() => {
    if (!showModal || editItem || catalogSelection || form.name.trim().length < 2) {
      setCatalogResults([]);
      setCatalogLoading(false);
      return undefined;
    }
    let active = true;
    const timeout = setTimeout(async () => {
      setCatalogLoading(true);
      setCatalogError('');
      const result = await window.electronAPI.products.searchCatalog({ search: form.name.trim(), limit: 12 });
      if (!active) return;
      setCatalogLoading(false);
      if (result.ok) {
        setCatalogResults(Array.isArray(result.data) ? result.data : []);
        setCatalogOpen(true);
      } else {
        setCatalogResults([]);
        setCatalogError(result.error || 'Could not search the medicine catalogue.');
      }
    }, 280);
    return () => { active = false; clearTimeout(timeout); };
  }, [showModal, editItem, catalogSelection, form.name]);

  const chooseCatalogMedicine = (medicine) => {
    setCatalogSelection(medicine);
    if (medicine.image?.secureUrl) {
      setImageSelection(medicine);
    }
    setForm((current) => ({
      ...current,
      catalogMedicineId: medicine.id,
      catalogImageId: medicine.image?.secureUrl ? medicine.id : current.catalogImageId,
      useGenericImage: medicine.image?.secureUrl ? false : current.useGenericImage,
      name: medicine.displayName,
      genericName: medicine.genericName || '',
      category: medicine.category || current.category || 'Other',
      unit: medicine.unit || current.unit || 'Other',
    }));
    setCatalogOpen(false);
    setCatalogResults([]);
  };

  const changeCatalogMedicine = () => {
    setCatalogSelection(null);
    setForm((current) => ({ ...current, catalogMedicineId: '' }));
    setCatalogResults([]);
    setCatalogOpen(false);
  };

  useEffect(() => {
    if (!showModal || imageSearch.trim().length < 2) {
      setImageResults([]);
      setImageLoading(false);
      return undefined;
    }
    let active = true;
    const timeout = setTimeout(async () => {
      setImageLoading(true);
      setImageError('');
      const result = await window.electronAPI.products.searchCatalog({ search: imageSearch.trim(), limit: 18, imagesOnly: true });
      if (!active) return;
      setImageLoading(false);
      if (result.ok) {
        setImageResults(Array.isArray(result.data) ? result.data : []);
        setImageOpen(true);
      } else {
        setImageResults([]);
        setImageError(result.error || 'Could not search catalogue images.');
      }
    }, 280);
    return () => { active = false; clearTimeout(timeout); };
  }, [showModal, imageSearch]);

  const chooseCatalogImage = (medicine) => {
    setImageSelection(medicine);
    setForm((current) => ({ ...current, catalogImageId: medicine.id, useGenericImage: false }));
    setImageSearch('');
    setImageResults([]);
    setImageOpen(false);
  };

  const useGenericProductImage = () => {
    setImageSelection(null);
    setForm((current) => ({ ...current, catalogImageId: '', useGenericImage: true }));
    setImageSearch('');
    setImageResults([]);
    setImageOpen(false);
  };

  const buildProductPayload = () => ({
    catalogMedicineId: form.catalogMedicineId,
    catalogImageId: form.catalogImageId,
    useGenericImage: form.useGenericImage,
    name: form.name.trim(),
    genericName: form.genericName.trim(),
    category: form.category.trim() || 'Other',
    price: form.price === '' ? 0 : Number(form.price),
    stock: form.stock === '' ? 0 : Number(form.stock),
    threshold: Number(form.threshold) || 0,
    expiry: form.expiry || null,
    unit: form.unit.trim() || 'Other'
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
    if (!expiry) return { label: 'Not set', cls: 'badge-warning' };
    const days = Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return { label: 'Expired', cls: 'badge-danger' };
    if (days <= 30) return { label: `${days}d`, cls: 'badge-danger' };
    if (days <= 60) return { label: `${days}d`, cls: 'badge-warning' };
    return { label: expiry, cls: 'badge-success' };
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const lowCount = inventory.filter(i => i.stock <= i.threshold).length;
  const expiredCount = inventory.filter(i => i.expiry && new Date(i.expiry) <= new Date()).length;

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
            <input placeholder="Search medicine or generic name..." value={search} onChange={e => setSearch(e.target.value)} />
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
                <th>Medicine</th><th>Category</th><th>Price (PKR)</th><th>Stock</th><th>Threshold</th><th>Expiry</th><th>Unit</th><th>Status</th><th>Actions</th>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', overflow: 'hidden', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                          {item.imageUrl || item.image?.secureUrl
                            ? <img src={item.imageUrl || item.image?.secureUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            : <span style={{ fontSize: 21 }}>💊</span>}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13.5 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.genericName || item.catalogSnapshot?.genericName || (item.catalogMedicineId ? 'Catalogue product' : 'Custom product')}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-teal">{item.category}</span></td>
                    <td style={{ fontWeight: 600, color: '#0f766e' }}>{Number(item.price || 0).toLocaleString()}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: isLow ? '#f43f5e' : '#1e293b' }}>{item.stock}</span>
                      {isLow && <span style={{ marginLeft: 6, fontSize: 11, color: '#f43f5e' }}>⚠️ Low</span>}
                    </td>
                    <td style={{ color: '#64748b' }}>{item.threshold}</td>
                    <td><span className={`badge ${expStatus.cls}`}>{expStatus.label}</span></td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>{item.unit || 'Other'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <div style={{ width: 56, height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                          <div style={{ width: `${item.threshold > 0 ? Math.min(100, (item.stock / (item.threshold * 3)) * 100) : (item.stock > 0 ? 100 : 0)}%`, height: '100%', background: isLow ? '#f43f5e' : '#10b981', borderRadius: 99 }} />
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
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label className="form-label">Brand / Product Name *</label>
                    <input className="form-control" required autoComplete="off" value={form.name}
                      onFocus={() => !catalogSelection && setCatalogOpen(true)}
                      onChange={e => set('name', e.target.value)}
                      placeholder="Type a product name or choose a catalogue suggestion" />
                    {!catalogSelection && catalogOpen && form.name.trim().length >= 2 && (
                      <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 5px)', zIndex: 30, maxHeight: 310, overflowY: 'auto', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 12, boxShadow: '0 16px 35px rgba(15,23,42,.18)' }}>
                        {catalogLoading && <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>Searching the DawaConnect medicine catalogue…</div>}
                        {!catalogLoading && catalogResults.map((medicine) => (
                          <button key={medicine.id} type="button" onClick={() => chooseCatalogMedicine(medicine)} style={{ width: '100%', border: 0, borderBottom: '1px solid #f1f5f9', background: '#fff', padding: '11px 13px', display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}>
                            <div style={{ width: 46, height: 46, borderRadius: 9, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'grid', placeItems: 'center', overflow: 'hidden', flex: '0 0 auto' }}>
                              {medicine.image?.secureUrl ? <img src={medicine.image.secureUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 22 }}>💊</span>}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 750, color: '#0f172a', fontSize: 13.5 }}>{medicine.displayName}</div>
                              <div style={{ color: '#64748b', fontSize: 11.5, marginTop: 2 }}>{[medicine.genericName, medicine.strength, medicine.dosageForm].filter(Boolean).join(' · ') || 'Standard catalogue item'}</div>
                              <div style={{ color: '#0f766e', fontSize: 11, marginTop: 3 }}>{[medicine.manufacturer, medicine.packSize].filter(Boolean).join(' · ')}</div>
                            </div>
                          </button>
                        ))}
                        {!catalogLoading && !catalogResults.length && !catalogError && <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>No catalogue match. You can still add this as your own product.</div>}
                        {catalogError && <div style={{ padding: 16, color: '#dc2626', fontSize: 13 }}>{catalogError}</div>}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Generic Name <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span></label>
                    <input className="form-control" value={form.genericName} onChange={e => set('genericName', e.target.value)} placeholder="e.g. Paracetamol or leave blank" />
                  </div>
                </div>
                {catalogSelection && (
                  <div style={{ marginBottom: 18, padding: 14, borderRadius: 12, border: '1px solid #99f6e4', background: '#f0fdfa', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 66, height: 66, borderRadius: 11, border: '1px solid #ccfbf1', background: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden', flex: '0 0 auto' }}>
                      {catalogSelection.image?.secureUrl ? <img src={catalogSelection.image.secureUrl} alt={catalogSelection.image.alt || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 30 }}>💊</span>}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: '#0f766e', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .7 }}>Catalogue details selected</div>
                      <div style={{ marginTop: 3, color: '#0f172a', fontWeight: 800 }}>{catalogSelection.displayName}</div>
                      <div style={{ marginTop: 3, color: '#475569', fontSize: 12 }}>{[catalogSelection.genericName, catalogSelection.strength, catalogSelection.dosageForm].filter(Boolean).join(' · ') || 'DawaConnect catalogue medicine'}</div>
                      <div style={{ marginTop: 5, color: '#64748b', fontSize: 11.5 }}>Brand, generic name, category and unit were filled for you. All editable fields remain under your control.</div>
                    </div>
                    <button type="button" className="btn btn-secondary btn-xs" onClick={changeCatalogMedicine}>Use custom details</button>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select className="form-control" required value={form.category} onChange={e => set('category', e.target.value)}>
                      <option value="">Select category</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit *</label>
                    <select className="form-control" required value={form.unit} onChange={e => set('unit', e.target.value)}>
                      <option value="">Select unit</option>
                      {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Product Image <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr)', gap: 14, alignItems: 'center', padding: 14, border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc' }}>
                    <div style={{ width: 78, height: 78, borderRadius: 12, background: '#fff', border: '1px solid #e2e8f0', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                      {imageSelection?.image?.secureUrl
                        ? <img src={imageSelection.image.secureUrl} alt={imageSelection.image.alt || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        : <span style={{ fontSize: 32 }}>💊</span>}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 750, color: '#0f172a', fontSize: 13.5 }}>{imageSelection ? imageSelection.displayName : 'Generic product image'}</div>
                      <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{imageSelection ? 'One shared catalogue image will be reused.' : 'No separate image will be uploaded for this product.'}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap' }}>
                        {imageSelection && <button type="button" className="btn btn-secondary btn-xs" onClick={useGenericProductImage}>Use generic image</button>}
                      </div>
                    </div>
                  </div>
                  <input className="form-control" style={{ marginTop: 9 }} value={imageSearch}
                    onFocus={() => setImageOpen(true)} onChange={(e) => setImageSearch(e.target.value)}
                    placeholder="Search the shared image catalogue by brand or generic name" />
                  {imageOpen && imageSearch.trim().length >= 2 && (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 5px)', zIndex: 35, maxHeight: 320, overflowY: 'auto', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 12, boxShadow: '0 16px 35px rgba(15,23,42,.18)' }}>
                      {imageLoading && <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>Searching shared images…</div>}
                      {!imageLoading && imageResults.map((medicine) => (
                        <button key={medicine.id} type="button" onClick={() => chooseCatalogImage(medicine)} style={{ width: '100%', border: 0, borderBottom: '1px solid #f1f5f9', background: '#fff', padding: '10px 13px', display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}>
                          <div style={{ width: 52, height: 52, borderRadius: 9, border: '1px solid #e2e8f0', overflow: 'hidden', flex: '0 0 auto' }}><img src={medicine.image.secureUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
                          <div><div style={{ fontWeight: 750, color: '#0f172a', fontSize: 13.5 }}>{medicine.displayName}</div><div style={{ color: '#64748b', fontSize: 11.5 }}>{medicine.genericName || 'Catalogue product image'}</div></div>
                        </button>
                      ))}
                      {!imageLoading && !imageResults.length && !imageError && <div style={{ padding: 16, color: '#64748b', fontSize: 13 }}>No matching image. Keep the generic image and request a new one from Complaints.</div>}
                      {imageError && <div style={{ padding: 16, color: '#dc2626', fontSize: 13 }}>{imageError}</div>}
                    </div>
                  )}
                  <div style={{ marginTop: 7, color: '#64748b', fontSize: 11.5 }}>Missing catalogue information or an image? Use Complaints → Contact DawaConnect and select the appropriate catalogue request.</div>
                </div>
                <div className="form-row-3">
                  <div className="form-group"><label className="form-label">Price (PKR) <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span></label><input className="form-control" type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} placeholder="Defaults to 0" /></div>
                  <div className="form-group"><label className="form-label">Stock Qty <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span></label><input className="form-control" type="number" min="0" step="1" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="Defaults to 0" /></div>
                  <div className="form-group"><label className="form-label">Low Stock Alert <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span></label><input className="form-control" type="number" min="0" step="1" value={form.threshold} onChange={e => set('threshold', e.target.value)} placeholder="Defaults to 0" /></div>
                </div>
                <div className="form-group"><label className="form-label">Expiry Date <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span></label><input className="form-control" type="date" value={form.expiry} onChange={e => set('expiry', e.target.value)} /></div>
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
