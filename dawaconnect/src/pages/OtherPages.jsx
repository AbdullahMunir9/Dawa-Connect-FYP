import React, { useState, useEffect } from 'react';
import { BadgeCheck, Camera, ImagePlus, MessageSquare, RefreshCw, Star, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

const readOnlyFieldStyle = { background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' };

function buildProfileSavePayload(form) {
  return {
    name: form.name ?? '',
    address: form.address ?? '',
    hours: form.hours ?? '',
    status: form.status ?? 'Open',
    logo: form.logo ?? '💊',
    deliveryCharge: form.deliveryCharge ?? 0,
    deliveryRadius: form.deliveryRadius ?? 10,
    deliveryType: form.deliveryType ?? 'Self Delivery',
    bankName: form.bankName ?? '',
    accountNo: form.accountNo ?? ''
  };
}

function profileToFormState(p) {
  if (!p) return {};
  return {
    name: p.name ?? '',
    address: p.address ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    license: p.license ?? '',
    hours: p.hours ?? '',
    status: p.status ?? 'Open',
    logo: p.logo ?? '💊',
    deliveryCharge: p.deliveryCharge ?? 0,
    deliveryRadius: p.deliveryRadius ?? 10,
    deliveryType: p.deliveryType ?? 'Self Delivery',
    bankName: p.bankName ?? '',
    accountNo: p.accountNo ?? '',
    photos: p.photos ?? {},
    approvalStatus: p.approvalStatus ?? 'unapproved'
  };
}

export function ProfilePage() {
  const { pharmacyProfile, setPharmacyProfile, uploadPharmacyPhoto, removePharmacyPhoto, user } = useApp();
  const [form, setForm] = useState(() => ({ ...pharmacyProfile }));
  const [tab, setTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState('');

  const resolvedApproval = String(
    user?.approvalStatus || user?.status || pharmacyProfile?.approvalStatus || form.approvalStatus || 'unapproved'
  ).toLowerCase();

  useEffect(() => {
    setForm({ ...pharmacyProfile });
  }, [pharmacyProfile]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await setPharmacyProfile(buildProfileSavePayload(form));
      if (result?.ok && result.data) {
        setForm(profileToFormState(result.data));
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (slot) => {
    setPhotoBusy(slot);
    try { await uploadPharmacyPhoto(slot); } finally { setPhotoBusy(''); }
  };

  const handlePhotoRemove = async (slot) => {
    setPhotoBusy(slot);
    try { await removePharmacyPhoto(slot); } finally { setPhotoBusy(''); }
  };

  return (
    <div className="page-shell">
      <div className="page-hero">
        <div>
          <h2>Pharmacy Profile</h2>
          <div className="page-subtitle">Keep your public details, delivery setup, and payment settings accurate.</div>
        </div>
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
      <div>
        {/* Profile Card */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ padding: '30px 24px', textAlign: 'center', background: 'linear-gradient(135deg, #0d9488, #0f766e)', borderRadius: '12px 12px 0 0' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>{form.logo}</div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, fontFamily: 'Sora,sans-serif' }}>{form.name}</div>
            <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, marginTop: 4 }}>{form.address}</div>
            <span style={{ display: 'inline-block', marginTop: 10, padding: '4px 14px', borderRadius: 99, background: form.status === 'Open' ? '#10b981' : '#f43f5e', color: '#fff', fontSize: 12, fontWeight: 700 }}>● {form.status}</span>
            <span style={{ display: 'inline-block', marginTop: 8, marginLeft: 8, padding: '4px 14px', borderRadius: 99, background: resolvedApproval === 'approved' ? '#10b981' : resolvedApproval === 'suspended' ? '#f43f5e' : '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 700 }}>
              {resolvedApproval === 'approved' ? 'Approved' : resolvedApproval === 'suspended' ? 'Suspended' : 'Unapproved'}
            </span>
          </div>
          <div style={{ padding: '16px 24px' }}>
            {[
              ['📞', form.phone],
              ['📧', form.email],
              ['🕐', form.hours],
              ['✅', `Approval: ${resolvedApproval === 'approved' ? 'Approved' : resolvedApproval === 'suspended' ? 'Suspended' : 'Unapproved'}`],
              ['📋', `License: ${form.license}`],
              ['🚚', `Delivery: PKR ${form.deliveryCharge} | ${form.deliveryRadius}km | ${form.deliveryType || 'Self Delivery'}`],
              ['🏦', `${form.bankName} - ${form.accountNo}`],
            ].map(([icon, val], idx) => (
              <div key={`${icon}-${idx}`} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#475569' }}>
                <span>{icon}</span><span>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Edit Profile</span>
        </div>
        <div style={{ padding: '0 24px' }}>
          <div className="tabs" style={{ margin: '16px 0' }}>
            {[['general', 'General'], ['photos', 'Photos'], ['delivery', 'Delivery'], ['payment', 'Payment']].map(([k, l]) => (
              <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
        </div>
        <form onSubmit={handleSave}>
          <div style={{ padding: '0 24px 24px' }}>
            {tab === 'general' && (<>
              <div className="form-group"><label className="form-label">Pharmacy Name</label><input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Address</label><textarea className="form-control" rows={2} value={form.address} onChange={e => set('address', e.target.value)} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Phone</label><input className="form-control" readOnly value={form.phone} style={readOnlyFieldStyle} title="Contact support to change phone number" /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" readOnly value={form.email} style={readOnlyFieldStyle} title="Contact support to change email" /></div>
              </div>
              <div className="form-group"><label className="form-label">Drug license number</label><input className="form-control" readOnly value={form.license} style={readOnlyFieldStyle} title="License is set at registration" /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Operating Hours</label><input className="form-control" value={form.hours} onChange={e => set('hours', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}><option>Open</option><option>Closed</option><option>Holiday</option></select></div>
              </div>
              <div className="form-group"><label className="form-label">Logo Emoji</label><input className="form-control" value={form.logo} onChange={e => set('logo', e.target.value)} /></div>
            </>)}
            {tab === 'delivery' && (<>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Delivery Charge (PKR)</label><input className="form-control" type="number" value={form.deliveryCharge} onChange={e => set('deliveryCharge', Number(e.target.value))} /></div>
                <div className="form-group"><label className="form-label">Service Radius (km)</label><input className="form-control" type="number" value={form.deliveryRadius} onChange={e => set('deliveryRadius', Number(e.target.value))} /></div>
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Type</label>
                <select className="form-control" value={form.deliveryType || 'Self Delivery'} onChange={e => set('deliveryType', e.target.value)}>
                  <option>Self Delivery</option>
                  <option>Third-party (TCS)</option>
                  <option>Third-party (Leopards)</option>
                  <option>Both</option>
                </select>
              </div>
              <div className="alert alert-info">🗺 Map integration shows estimated delivery time based on customer location and distance radius.</div>
            </>)}
            {tab === 'photos' && <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 18, padding: '13px 15px', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 12, color: '#115e59' }}>
                <Camera size={19} style={{ flex: '0 0 auto', marginTop: 1 }} />
                <div><strong style={{ display: 'block', fontSize: 13 }}>Public pharmacy photos</strong><span style={{ display: 'block', marginTop: 3, fontSize: 11.5, lineHeight: 1.5 }}>These appear on your pharmacy page in the Marketplace. Use clear, recent photos without customer faces or private information.</span></div>
              </div>
              <div className="pharmacy-photo-grid pharmacy-profile-photo-grid">
                {[
                  ['outside', 'Outside photo', 'Storefront or main entrance'],
                  ['inside', 'Inside photo', 'Counter, shelves, or customer area'],
                ].map(([slot, label, description]) => {
                  const photo = pharmacyProfile?.photos?.[slot];
                  const busy = photoBusy === slot;
                  return <div className="pharmacy-photo-card" key={slot}>
                    <div className="pharmacy-photo-preview">{photo?.url ? <img src={photo.url} alt={label} /> : <><ImagePlus size={28} /><span>No photo uploaded</span></>}</div>
                    <div className="pharmacy-photo-copy"><strong>{label}</strong><span>{description}</span><small>JPEG, PNG or WebP · max 5 MB</small></div>
                    <div className="pharmacy-photo-actions">
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => handlePhotoUpload(slot)}><ImagePlus size={15} /> {busy ? 'Working…' : photo ? 'Replace' : 'Upload'}</button>
                      {photo && <button type="button" className="pharmacy-photo-remove" disabled={busy} onClick={() => handlePhotoRemove(slot)}><Trash2 size={15} /> Remove</button>}
                    </div>
                  </div>;
                })}
              </div>
            </>}
            {tab === 'payment' && (<>
              <div className="form-group"><label className="form-label">Bank Name</label><input className="form-control" value={form.bankName} onChange={e => set('bankName', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Account / IBAN</label><input className="form-control" value={form.accountNo} onChange={e => set('accountNo', e.target.value)} /></div>
            </>)}
            {tab !== 'photos' && <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>}
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}

export function ReviewsPage() {
  const { reviews, refreshReviews } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const validReviews = reviews.filter((review) => Number.isFinite(Number(review.rating)) && Number(review.rating) >= 1 && Number(review.rating) <= 5);
  const avg = validReviews.length
    ? (validReviews.reduce((sum, review) => sum + Number(review.rating), 0) / validReviews.length).toFixed(1)
    : '0.0';

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!refreshReviews) return;
      await refreshReviews();
      if (!active) return;
    };
    void refresh();
    const interval = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshReviews]);

  const handleRefresh = async () => {
    if (!refreshReviews || refreshing) return;
    setRefreshing(true);
    try {
      await refreshReviews();
    } finally {
      setRefreshing(false);
    }
  };

  const StarRating = ({ rating }) => (
    <span style={{ display: 'inline-flex', gap: 2, marginLeft: 10 }} aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={15} fill={index < Number(rating) ? '#f59e0b' : 'transparent'} color={index < Number(rating) ? '#f59e0b' : '#cbd5e1'} />
      ))}
    </span>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#0f172a' }}>Customer feedback</h2>
          <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: 13 }}>Ratings from verified DawaConnect marketplace orders.</p>
        </div>
        <button type="button" onClick={handleRefresh} disabled={refreshing} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 108, justifyContent: 'center' }}>
          <RefreshCw size={15} /> {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 20, padding: '24px 28px' }}>
        <div className="reviews-summary-grid">
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 56, fontWeight: 800, color: '#0f766e', fontFamily: 'Sora,sans-serif', lineHeight: 1 }}>{avg}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 9 }}>
              {Array.from({ length: 5 }, (_, index) => <Star key={index} size={20} fill={index < Math.round(Number(avg)) ? '#f59e0b' : 'transparent'} color={index < Math.round(Number(avg)) ? '#f59e0b' : '#cbd5e1'} />)}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 7 }}>{validReviews.length} verified review{validReviews.length === 1 ? '' : 's'}</div>
          </div>
          <div style={{ flex: 1 }}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = validReviews.filter(review => Number(review.rating) === star).length;
              const percentage = validReviews.length ? (count / validReviews.length) * 100 : 0;
              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 13, color: '#64748b', width: 30 }}>{star}<Star size={12} fill="#f59e0b" color="#f59e0b" /></span>
                  <div className="progress-bar" style={{ flex: 1 }}>
                    <div className="progress-fill" style={{ width: `${percentage}%`, background: '#f59e0b' }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#94a3b8', width: 20 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {validReviews.length === 0 ? (
        <div className="card" style={{ padding: '54px 24px', textAlign: 'center' }}>
          <div style={{ width: 62, height: 62, borderRadius: 20, background: '#ecfdf5', color: '#0f766e', display: 'grid', placeItems: 'center', margin: '0 auto' }}><MessageSquare size={28} /></div>
          <h3 style={{ margin: '18px 0 6px', fontSize: 17, color: '#0f172a' }}>No customer reviews yet</h3>
          <p style={{ margin: '0 auto', maxWidth: 440, color: '#64748b', fontSize: 13.5, lineHeight: 1.6 }}>Verified customers can leave a rating after their order is delivered. Their feedback will appear here automatically.</p>
        </div>
      ) : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {validReviews.map(review => (
          <div key={review.id} className="card" style={{ padding: '18px 22px' }}>
            <div className="review-card-header">
              <div className="review-card-identity">
                <span style={{ fontWeight: 700, fontSize: 14 }}>{review.customer || 'Verified customer'}</span>
                <StarRating rating={review.rating} />
                {review.verifiedPurchase && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 10, color: '#0f766e', fontSize: 11.5, fontWeight: 600 }}><BadgeCheck size={14} /> Verified purchase</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge badge-${review.status === 'Published' ? 'success' : 'warning'}`}>{review.status || 'Published'}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{review.date}</span>
              </div>
            </div>
            {review.comment ? <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, margin: 0 }}>{review.comment}</p> : <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>The customer left a rating without a written comment.</p>}
          </div>
        ))}
      </div>}
    </div>
  );
}

export function ReturnsPage() {
  const { returns, updateReturn } = useApp();

  return (
    <div>
      <div className="card">
        <div className="card-header"><span className="card-title">Return & Refund Requests</span></div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Return ID</th><th>Order ID</th><th>Customer</th><th>Item</th><th>Reason</th><th>Refund</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {returns.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700, color: '#0f766e', fontFamily: 'monospace' }}>{r.id}</td>
                  <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{r.orderId}</td>
                  <td>{r.customer}</td>
                  <td>{r.item} × {r.qty}</td>
                  <td style={{ fontSize: 12.5, color: '#64748b', maxWidth: 180 }}>{r.reason}</td>
                  <td style={{ fontWeight: 700, color: '#0f766e' }}>PKR {r.refundAmount}</td>
                  <td><span className={`badge badge-${r.status === 'Pending' ? 'warning' : r.status === 'Approved' ? 'success' : 'danger'}`}>{r.status}</span></td>
                  <td>
                    {r.status === 'Pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-success btn-xs" onClick={() => updateReturn(r.id, 'Approved')}>Approve</button>
                        <button className="btn btn-danger btn-xs" onClick={() => updateReturn(r.id, 'Rejected')}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
