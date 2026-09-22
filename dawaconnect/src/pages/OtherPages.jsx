import React, { useState, useEffect } from 'react';
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
    taxRate: form.taxRate ?? 0,
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
    taxRate: p.taxRate ?? 5,
    bankName: p.bankName ?? '',
    accountNo: p.accountNo ?? '',
    approvalStatus: p.approvalStatus ?? 'unapproved'
  };
}

export function ProfilePage() {
  const { pharmacyProfile, setPharmacyProfile, user } = useApp();
  const [form, setForm] = useState(() => ({ ...pharmacyProfile }));
  const [tab, setTab] = useState('general');
  const [saving, setSaving] = useState(false);

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
            {[['general', 'General'], ['delivery', 'Delivery'], ['payment', 'Payment']].map(([k, l]) => (
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
            {tab === 'payment' && (<>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Tax Rate (%)</label><input className="form-control" type="number" value={form.taxRate} onChange={e => set('taxRate', Number(e.target.value))} /></div>
                <div className="form-group"><label className="form-label">Bank Name</label><input className="form-control" value={form.bankName} onChange={e => set('bankName', e.target.value)} /></div>
              </div>
              <div className="form-group"><label className="form-label">Account / IBAN</label><input className="form-control" value={form.accountNo} onChange={e => set('accountNo', e.target.value)} /></div>
            </>)}
            <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}

export function ReviewsPage() {
  const { reviews } = useApp();
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';

  const StarRating = ({ rating }) => (
    <span>{Array.from({ length: 5 }, (_, i) => <span key={i} style={{ color: i < rating ? '#f59e0b' : '#e2e8f0', fontSize: 16 }}>★</span>)}</span>
  );

  return (
    <div>
      {/* Summary */}
      <div className="card" style={{ marginBottom: 20, padding: '24px 28px' }}>
        <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, fontWeight: 800, color: '#0f766e', fontFamily: 'Sora,sans-serif', lineHeight: 1 }}>{avg}</div>
            <div style={{ color: '#f59e0b', fontSize: 22 }}>{'★'.repeat(Math.round(avg))}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{reviews.length} reviews</div>
          </div>
          <div style={{ flex: 1 }}>
            {[5, 4, 3, 2, 1].map(star => {
              const count = reviews.filter(r => r.rating === star).length;
              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: '#64748b', width: 16 }}>{star}★</span>
                  <div className="progress-bar" style={{ flex: 1 }}>
                    <div className="progress-fill" style={{ width: `${(count / reviews.length) * 100}%`, background: '#f59e0b' }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#94a3b8', width: 20 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {reviews.map(r => (
          <div key={r.id} className="card" style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{r.customer}</span>
                <StarRating rating={r.rating} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge badge-${r.status === 'Published' ? 'success' : 'warning'}`}>{r.status}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{r.date}</span>
              </div>
            </div>
            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>{r.comment}</p>
          </div>
        ))}
      </div>
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
