import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';

const STATUS_ORDER = ['Pending', 'Confirmed', 'Packed', 'Dispatched', 'Delivered', 'Cancelled'];
const NEXT_STATUS = {
  Pending: ['Confirmed', 'Cancelled'],
  Confirmed: ['Packed', 'Cancelled'],
  Packed: ['Dispatched', 'Cancelled'],
  Dispatched: ['Delivered'],
  Delivered: [],
  Cancelled: [],
};

export default function Orders() {
  const { orders, updateOrderStatus, pharmacyProfile, user } = useApp();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showInvoice, setShowInvoice] = useState(null);
  const approvalStatus = String(user?.approvalStatus || user?.status || pharmacyProfile?.approvalStatus || 'unapproved').toLowerCase();
  const accountStatus = String(user?.accountStatus || pharmacyProfile?.accountStatus || user?.status || '').toLowerCase();
  const isSuspended = accountStatus === 'suspended' || approvalStatus === 'suspended';
  const isRejected = !isSuspended && accountStatus === 'rejected';
  const isUnapproved = !isSuspended && approvalStatus === 'unapproved';
  const adminReason = isSuspended ? (user?.suspensionReason || pharmacyProfile?.suspensionReason) : isRejected ? (user?.rejectionReason || pharmacyProfile?.rejectionReason) : '';

  const filtered = useMemo(() => orders.filter(o => {
    const matchStatus = filter === 'All' || o.status === filter;
    const matchSearch = String(o.id || '').includes(search) || String(o.customer || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  }), [orders, filter, search]);

  const statusColor = { Pending: 'warning', Confirmed: 'info', Packed: 'info', Dispatched: 'teal', Delivered: 'success', Cancelled: 'danger' };

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
          <h2>Orders Control Center</h2>
          <div className="page-subtitle">Search, inspect invoices, and update order status quickly.</div>
        </div>
        <div className="soft-panel">
          <div style={{ fontSize: 12, color: '#475569' }}>{filtered.length} orders in current view</div>
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {['All', ...STATUS_ORDER].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
            background: filter === s ? (s === 'All' ? '#0d9488' : '#1e293b') : '#fff',
            color: filter === s ? '#fff' : '#64748b',
            boxShadow: filter === s ? '0 2px 8px rgba(0,0,0,.1)' : '0 1px 3px rgba(0,0,0,.05)',
          }}>
            {s}
            <span style={{ marginLeft: 6, background: filter === s ? 'rgba(255,255,255,.2)' : '#f1f5f9', color: filter === s ? '#fff' : '#64748b', borderRadius: 99, padding: '1px 7px', fontSize: 11 }}>
              {s === 'All' ? orders.length : orders.filter(o => o.status === s).length}
            </span>
          </button>
        ))}
      </div>

      <div className="card">
        <div style={{ padding: '14px 20px', display: 'flex', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
          <div className="search-bar" style={{ maxWidth: 300 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input placeholder="Search order ID or customer..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Delivery</th><th>Payment</th><th>Status</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9}><div className="empty-state"><p>No orders found</p></div></td></tr>}
              {filtered.map(order => (
                <tr key={order.id}>
                  <td><span style={{ fontWeight: 700, color: '#0f766e', fontFamily: 'monospace', fontSize: 13 }}>{order.id}</span></td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{order.customer}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{order.phone}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{(order.items || []).map(i => i.name).join(', ').substring(0, 40)}{(order.items || []).map(i => i.name).join(', ').length > 40 ? '...' : ''}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{(order.items || []).length} item(s)</div>
                  </td>
                  <td style={{ fontWeight: 700, color: '#0f766e' }}>PKR {order.total.toLocaleString()}</td>
                  <td><span className="badge badge-gray">{order.delivery}</span></td>
                  <td><span className="badge badge-teal">{order.payMethod}</span></td>
                  <td><span className={`badge badge-${statusColor[order.status]}`}>{order.status}</span></td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{order.date}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => setSelectedOrder(order)}>View</button>
                      <button className="btn btn-outline btn-xs" onClick={() => setShowInvoice(order)}>Invoice</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Order {selectedOrder.id}</span>
              <span className={`badge badge-${statusColor[selectedOrder.status]}`} style={{ marginLeft: 10 }}>{selectedOrder.status}</span>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row" style={{ marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Customer</div>
                  <div style={{ fontWeight: 700 }}>{selectedOrder.customer}</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{selectedOrder.phone}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{selectedOrder.address}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Order Info</div>
                  <div style={{ fontSize: 13 }}>Date: <strong>{selectedOrder.date}</strong></div>
                  <div style={{ fontSize: 13 }}>Delivery: <strong>{selectedOrder.delivery}</strong></div>
                  <div style={{ fontSize: 13 }}>Payment: <strong>{selectedOrder.payMethod}</strong></div>
                </div>
              </div>

              <table style={{ marginBottom: 16 }}>
                <thead>
                  <tr><th>Medicine</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((item, i) => (
                    <tr key={i}>
                      <td>{item.name}</td>
                      <td>{item.qty}</td>
                      <td>PKR {item.price}</td>
                      <td style={{ fontWeight: 600 }}>PKR {(item.qty * item.price).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, color: '#0f766e', paddingRight: 16 }}>Delivery Charge</td>
                    <td style={{ fontWeight: 700 }}>PKR {Number(selectedOrder.deliveryFee ?? pharmacyProfile.deliveryCharge ?? 0).toLocaleString()}</td>
                  </tr>
                  <tr style={{ background: '#f0fdfa' }}>
                    <td colSpan={3} style={{ textAlign: 'right', fontWeight: 800, color: '#0f766e', paddingRight: 16 }}>Total</td>
                    <td style={{ fontWeight: 800, fontSize: 16, color: '#0f766e' }}>PKR {selectedOrder.total.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#475569' }}>Update Status</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(NEXT_STATUS[selectedOrder.status] || []).map(s => (
                    <button key={s} className={`btn btn-sm ${s === 'Cancelled' ? 'btn-danger' : 'btn-primary'}`} onClick={async () => { await updateOrderStatus(selectedOrder.id, s); setSelectedOrder(null); }}>→ {s}</button>
                  ))}
                  {(NEXT_STATUS[selectedOrder.status] || []).length === 0 && <span style={{ fontSize: 13, color: '#64748b' }}>This order is in a final state.</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoice && <InvoiceModal order={showInvoice} pharmacy={pharmacyProfile} onClose={() => setShowInvoice(null)} />}
    </div>
  );
}

function InvoiceModal({ order, pharmacy, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <span className="modal-title">Invoice - {order.id}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 Print</button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="modal-body">
          <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 24 }}>💊</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Sora,sans-serif', color: '#0f766e' }}>{pharmacy.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{pharmacy.address}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>License: {pharmacy.license}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 13 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Bill To:</div>
              <div>{order.customer}</div>
              <div style={{ color: '#64748b' }}>{order.phone}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700 }}>{order.id}</div>
              <div style={{ color: '#64748b' }}>Date: {order.date}</div>
            </div>
          </div>
          <table style={{ fontSize: 13 }}>
            <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>
              {order.items.map((item, i) => <tr key={i}><td>{item.name}</td><td>{item.qty}</td><td>{item.price}</td><td style={{ fontWeight: 600 }}>PKR {item.qty * item.price}</td></tr>)}
              <tr><td colSpan={3} style={{ textAlign: 'right', fontWeight: 600 }}>Delivery</td><td>PKR {Number(order.deliveryFee ?? pharmacy.deliveryCharge ?? 0).toLocaleString()}</td></tr>
              <tr><td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, color: '#0f766e' }}>Tax</td><td>PKR {Number(order.tax ?? 0).toLocaleString()}</td></tr>
              <tr style={{ background: '#f0fdfa' }}><td colSpan={3} style={{ textAlign: 'right', fontWeight: 800 }}>TOTAL</td><td style={{ fontWeight: 800, color: '#0f766e' }}>PKR {order.total.toLocaleString()}</td></tr>
            </tbody>
          </table>
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#94a3b8' }}>Thank you for choosing {pharmacy.name} — DawaConnect</div>
        </div>
      </div>
    </div>
  );
}
