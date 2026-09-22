import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';

const CATEGORIES = [
  ['order', 'Order problem'], ['delivery', 'Delivery'], ['product', 'Product / stock'], ['payment', 'Payment / settlement'],
  ['service', 'Customer behaviour'], ['platform', 'App or platform issue'], ['account', 'My account / approval'], ['other', 'Something else'],
];
const STATUS_LABEL = { open: 'Open', in_review: 'In review', resolved: 'Resolved', dismissed: 'Closed' };
const STATUS_BADGE = { open: 'badge-warning', in_review: 'badge-info', resolved: 'badge-success', dismissed: 'badge-gray' };
const ROLE_LABEL = { customer: 'Customer', pharmacy: 'You', admin: 'DawaConnect' };
const CLOSED = ['resolved', 'dismissed'];

const fmt = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

function Thread({ complaint, canManage, onBack, onReply, onStatus }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(null); // 'resolved' | 'dismissed'
  const [note, setNote] = useState('');
  const closed = CLOSED.includes(complaint.status);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const result = await onReply(complaint.id, text.trim());
    if (result.ok) setText('');
    setSending(false);
  };

  const finish = async () => {
    const result = await onStatus(complaint.id, closing, note.trim());
    if (result.ok) { setClosing(null); setNote(''); }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <button className="btn btn-outline btn-xs" onClick={onBack} style={{ marginBottom: 10 }}>← Back</button>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{complaint.complaintId}</div>
          <div className="card-title" style={{ fontSize: 17 }}>{complaint.subject}</div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
            {complaint.target === 'pharmacy' ? <>From customer <b>{complaint.reporter?.name}</b>{complaint.reporter?.email ? ` (${complaint.reporter.email})` : ''}</> : <>Sent to <b>DawaConnect</b></>}
            {' · '}{fmt(complaint.createdAt)}{complaint.orderId ? <> · Order <span style={{ fontFamily: 'monospace' }}>{complaint.orderId}</span></> : null}
            {' · '}{CATEGORIES.find(([v]) => v === complaint.category)?.[1] || complaint.category}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${STATUS_BADGE[complaint.status] || 'badge-gray'}`}>{STATUS_LABEL[complaint.status] || complaint.status}</span>
          {complaint.priority === 'high' && <span className="badge badge-danger">High priority</span>}
          {canManage && !closed && (
            <>
              {complaint.status === 'open' && <button className="btn btn-secondary btn-sm" onClick={() => onStatus(complaint.id, 'in_review', '')}>Start review</button>}
              <button className="btn btn-success btn-sm" onClick={() => setClosing('resolved')}>Resolve</button>
              <button className="btn btn-outline btn-sm" onClick={() => setClosing('dismissed')}>Close</button>
            </>
          )}
          {canManage && closed && <button className="btn btn-secondary btn-sm" onClick={() => onStatus(complaint.id, 'open', '')}>Reopen</button>}
        </div>
      </div>

      <div className="card-body">
        <div className="soft-panel" style={{ padding: 16, fontSize: 14, lineHeight: 1.65, color: '#1e293b', whiteSpace: 'pre-wrap' }}>{complaint.description}</div>
        {complaint.resolution?.note && (
          <div className="alert alert-success" style={{ marginTop: 12 }}><b>Outcome:</b> {complaint.resolution.note}</div>
        )}

        {closing && (
          <div className="soft-panel" style={{ marginTop: 14, padding: 16, border: '1px solid #fde68a', background: '#fffbeb' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{closing === 'resolved' ? 'Mark as resolved' : 'Close without action'}</div>
            <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 8 }}>The customer will see this note. Explain what you did (refund, replacement, clarification…).</div>
            <textarea className="form-control" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Replacement pack delivered on 14 Sept and the expired strip was collected." />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setClosing(null)}>Cancel</button>
              <button className={`btn btn-sm ${closing === 'resolved' ? 'btn-success' : 'btn-danger'}`} disabled={note.trim().length < 5} onClick={finish}>{closing === 'resolved' ? 'Confirm resolved' : 'Confirm close'}</button>
            </div>
          </div>
        )}

        <div style={{ fontWeight: 700, fontSize: 14, margin: '18px 0 10px' }}>Conversation <span style={{ color: '#94a3b8', fontWeight: 500 }}>({complaint.messages?.length || 0})</span></div>
        {complaint.messages?.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {complaint.messages.map((m, i) => {
              const mine = m.by?.role === 'pharmacy';
              return (
                <div key={i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '78%', background: mine ? '#0f766e' : m.by?.role === 'admin' ? '#eef2ff' : '#f1f5f9', color: mine ? '#fff' : '#0f172a', borderRadius: 14, padding: '10px 14px', fontSize: 13.5, lineHeight: 1.55 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, opacity: mine ? 0.85 : 0.7, marginBottom: 3 }}>{mine ? 'You' : `${m.by?.name || ROLE_LABEL[m.by?.role]} · ${ROLE_LABEL[m.by?.role] || m.by?.role}`}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                    <div style={{ fontSize: 10.5, opacity: 0.6, marginTop: 4 }}>{fmt(m.at)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="soft-panel" style={{ padding: 14, fontSize: 13, color: '#64748b' }}>
            {complaint.target === 'pharmacy' ? 'No replies yet. Your reply is shown to the customer on the Marketplace.' : 'No reply from DawaConnect yet. You will be notified when they respond.'}
          </div>
        )}

        <form onSubmit={send} style={{ marginTop: 14 }}>
          {closed && complaint.target === 'admin' && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>This complaint is closed. Sending a message reopens it.</div>}
          <textarea className="form-control" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={complaint.target === 'pharmacy' ? `Reply to ${complaint.reporter?.name || 'the customer'}…` : 'Add more details for DawaConnect…'} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" type="submit" disabled={sending || !text.trim()}>{sending ? 'Sending…' : 'Send reply'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewComplaint({ orders, onCancel, onSubmit }) {
  const [form, setForm] = useState({ category: 'platform', priority: 'medium', orderId: '', subject: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.subject.trim().length < 5) { setError('Give your complaint a short subject (at least 5 characters).'); return; }
    if (form.description.trim().length < 20) { setError('Describe the problem in at least 20 characters.'); return; }
    setSaving(true);
    const result = await onSubmit(form);
    setSaving(false);
    if (!result.ok) setError(result.error || 'Could not submit');
  };

  return (
    <div className="card">
      <div className="card-header"><span className="card-title">Contact DawaConnect</span><button className="btn btn-outline btn-xs" onClick={onCancel}>Cancel</button></div>
      <form onSubmit={submit} className="card-body">
        <div className="alert alert-info" style={{ marginBottom: 14 }}>Use this for payment settlements, customers behaving unfairly, approval or account problems, or bugs in the app. DawaConnect replies here and you get a notification.</div>
        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-control" value={form.category} onChange={set('category')}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="form-control" value={form.priority} onChange={set('priority')}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High – blocking my business</option></select>
          </div>
          <div className="form-group">
            <label className="form-label">Related order (optional)</label>
            <select className="form-control" value={form.orderId} onChange={set('orderId')}>
              <option value="">None</option>
              {orders.slice(0, 60).map((o) => <option key={o.id} value={o.marketplaceOrderId || o.id}>{o.id}{o.customer ? ` · ${o.customer}` : ''} · {o.status}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Subject</label>
          <input className="form-control" value={form.subject} onChange={set('subject')} maxLength={120} placeholder="e.g. COD settlement for order PH-7000 not received" />
        </div>
        <div className="form-group">
          <label className="form-label">Details</label>
          <textarea className="form-control" rows={6} value={form.description} onChange={set('description')} maxLength={2000} placeholder="What happened, when, and what you need from DawaConnect." />
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Sending…' : 'Send to DawaConnect'}</button>
        </div>
      </form>
    </div>
  );
}

export default function Complaints() {
  const { complaints, orders, fileComplaint, replyToComplaint, setComplaintStatus } = useApp();
  const [tab, setTab] = useState('inbox');
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [composing, setComposing] = useState(false);

  const list = tab === 'inbox' ? complaints.inbox : complaints.outbox;
  const selected = [...complaints.inbox, ...complaints.outbox].find((c) => c.id === selectedId) || null;
  const visible = useMemo(() => list.filter((c) => (filter === 'all' || (filter === 'active' ? !CLOSED.includes(c.status) : CLOSED.includes(c.status)))
    && (!search || `${c.complaintId} ${c.subject} ${c.reporter?.name || ''} ${c.orderId || ''}`.toLowerCase().includes(search.toLowerCase()))), [list, filter, search]);
  const openInbox = complaints.inbox.filter((c) => !CLOSED.includes(c.status)).length;
  const openOutbox = complaints.outbox.filter((c) => !CLOSED.includes(c.status)).length;

  if (composing) return <NewComplaint orders={orders} onCancel={() => setComposing(false)} onSubmit={async (form) => { const r = await fileComplaint(form); if (r.ok) { setComposing(false); setTab('outbox'); setSelectedId(r.data.id); } return r; }} />;
  if (selected) return <Thread complaint={selected} canManage={selected.target === 'pharmacy'} onBack={() => setSelectedId(null)} onReply={replyToComplaint} onStatus={setComplaintStatus} />;

  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Open from customers', value: openInbox, color: openInbox ? '#d97706' : '#0f766e' },
          { label: 'Total received', value: complaints.inbox.length, color: '#0f172a' },
          { label: 'Awaiting DawaConnect', value: openOutbox, color: openOutbox ? '#2563eb' : '#0f172a' },
          { label: 'Resolved (all)', value: [...complaints.inbox, ...complaints.outbox].filter((c) => c.status === 'resolved').length, color: '#059669' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: 'Sora,sans-serif' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <div className="tabs" style={{ margin: 0 }}>
            <button className={`tab ${tab === 'inbox' ? 'active' : ''}`} onClick={() => setTab('inbox')}>From customers {openInbox > 0 && <span className="nav-badge" style={{ marginLeft: 6 }}>{openInbox}</span>}</button>
            <button className={`tab ${tab === 'outbox' ? 'active' : ''}`} onClick={() => setTab('outbox')}>Sent to DawaConnect {openOutbox > 0 && <span className="nav-badge" style={{ marginLeft: 6, background: '#2563eb' }}>{openOutbox}</span>}</button>
          </div>
          <div className="search-bar" style={{ maxWidth: 240 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="form-control" style={{ width: 140 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="active">Open</option><option value="closed">Closed</option><option value="all">All</option>
          </select>
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setComposing(true)}>+ Contact DawaConnect</button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead><tr><th>Complaint</th><th>{tab === 'inbox' ? 'Customer' : 'Category'}</th><th>Order</th><th>Replies</th><th>Updated</th><th>Status</th></tr></thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state"><p>{tab === 'inbox' ? 'No customer complaints here. Customers can raise one from their Marketplace order history.' : 'You have not contacted DawaConnect about anything yet.'}</p></div></td></tr>
              )}
              {visible.map((c) => (
                <tr key={c.id} onClick={() => setSelectedId(c.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13.5 }}>{c.subject}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{c.complaintId}{c.priority === 'high' ? ' · HIGH' : ''}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>{tab === 'inbox' ? (c.reporter?.name || 'Customer') : (CATEGORIES.find(([v]) => v === c.category)?.[1] || c.category)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{c.orderId || '—'}</td>
                  <td style={{ fontSize: 13 }}>{c.messages?.length || 0}</td>
                  <td style={{ fontSize: 12.5, color: '#64748b' }}>{fmt(c.lastActivityAt || c.createdAt)}</td>
                  <td><span className={`badge ${STATUS_BADGE[c.status] || 'badge-gray'}`}>{STATUS_LABEL[c.status] || c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
