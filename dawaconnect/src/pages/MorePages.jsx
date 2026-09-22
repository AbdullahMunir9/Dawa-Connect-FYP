import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';

export function NotificationsPage() {
  const { notifications, markAllNotificationsRead } = useApp();

  const iconMap = { order: '🛒', stock: '📦', expiry: '⏰', system: '⚙️' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: '#64748b' }}>{notifications.filter(n => !n.read).length} unread notifications</div>
        <button className="btn btn-secondary btn-sm" onClick={markAllNotificationsRead}>Mark all as read</button>
      </div>
      <div className="card">
        {notifications.length === 0 && <div className="empty-state"><p>No notifications</p></div>}
        {notifications.map(n => (
          <div key={n.id} className="notif-item" style={{ background: n.read ? '#fff' : '#f0fdfa' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: n.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
              {iconMap[n.type] || '🔔'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: n.read ? 400 : 600, color: '#1e293b' }}>{n.message}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{n.time}</div>
            </div>
            {!n.read && <div className="notif-dot" style={{ background: n.color }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChatPage() {
  const { user, inventory, orders, pharmacyProfile, showToast } = useApp();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [messages, setMessages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [attachments, setAttachments] = useState([]);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) || null, [conversations, activeId]);

  const formatTime = (value) => new Date(value || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatRelative = (value) => {
    const ms = Date.now() - new Date(value || Date.now()).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const loadThreads = async () => {
    if (!user?.id) return;
    const result = await window.electronAPI.chat.syncThreads({ ownerId: user.id });
    if (!result.ok) return;
    const rows = result.data.map((d) => ({ ...d, id: d.id || d._id }));
    setConversations(rows);
    if (!activeId && rows[0]) setActiveId(rows[0].id);
  };

  const loadMessages = async (threadId) => {
    if (!user?.id || !threadId) return;
    const result = await window.electronAPI.chat.listMessages({ ownerId: user.id, threadId });
    if (!result.ok) return;
    const rows = result.data.map((d) => ({ ...d, id: d.id || d._id }));
    setMessages(rows);
  };

  const loadLogs = async () => {
    if (!user?.id) return;
    const result = await window.electronAPI.chat.logs({ ownerId: user.id, limit: 20 });
    if (result.ok) setLogs(result.data.map((d) => ({ ...d, id: d.id || d._id })));
  };

  useEffect(() => { loadThreads(); }, [user?.id]);
  useEffect(() => { loadMessages(activeId); }, [activeId, user?.id]);
  useEffect(() => { if (showDebug) loadLogs(); }, [showDebug, user?.id]);

  const toDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const sendMsg = async () => {
    const text = input.trim();
    if ((!text && !attachments.length) || !active || !user?.id || sending) return;
    setSending(true);
    setInput('');
    const currentAttachments = attachments;
    setAttachments([]);

    const createdUserMsg = await window.electronAPI.chat.sendMessage({
      ownerId: user.id,
      threadId: active.id,
      message: { from: 'customer', text, attachments: currentAttachments }
    });
    if (createdUserMsg.ok) {
      const row = { ...createdUserMsg.data, id: createdUserMsg.data.id || createdUserMsg.data._id };
      setMessages((p) => [...p, row]);
    }
    setTyping(true);

    const ai = await window.electronAPI.chat.ask({
      ownerId: user.id,
      threadId: active.id,
      question: text,
      inventory,
      orders,
      pharmacyProfile,
      history: messages.slice(-10).map((m) => ({ from: m.from, text: m.text }))
    });

    const reply = ai.ok ? ai.data.reply : `I could not answer right now: ${ai.error || 'Unknown error'}`;
    let animated = '';
    for (const ch of reply) {
      animated += ch;
      setMessages((p) => {
        const temp = [...p];
        const last = temp[temp.length - 1];
        if (last?.id === '__typing__') {
          temp[temp.length - 1] = { ...last, text: animated };
          return temp;
        }
        return [...temp, { id: '__typing__', from: 'assistant', text: animated, createdAt: new Date().toISOString() }];
      });
      await new Promise((r) => setTimeout(r, 10));
    }

    const createdAssistantMsg = await window.electronAPI.chat.sendMessage({
      ownerId: user.id,
      threadId: active.id,
      message: { from: 'assistant', text: reply }
    });
    if (createdAssistantMsg.ok) {
      const row = { ...createdAssistantMsg.data, id: createdAssistantMsg.data.id || createdAssistantMsg.data._id };
      setMessages((p) => [...p.filter((m) => m.id !== '__typing__'), row]);
      loadThreads();
      if (showDebug) loadLogs();
    } else {
      setMessages((p) => p.filter((m) => m.id !== '__typing__'));
      showToast('Failed to save assistant reply', 'error');
    }
    setTyping(false);
    setSending(false);
  };

  return (
    <div className="page-shell">
      <div className="page-hero">
        <div>
          <h2>Live Customer Chat</h2>
          <div className="page-subtitle">AI-assisted replies with history, attachments, and debug visibility.</div>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary btn-sm" onClick={loadThreads}>Refresh Threads</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowDebug((v) => !v)}>{showDebug ? 'Hide AI Debug' : 'AI Debug'}</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: showDebug ? '280px 1fr 340px' : '280px 1fr', gap: 0, height: 'calc(100vh - 240px)', minHeight: 520 }}>
      {/* Sidebar */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px 0 0 12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontFamily: 'Sora,sans-serif', fontSize: 15 }}>Live Support Chats</div>
        {conversations.map(c => (
          <div key={c.id} onClick={() => setActiveId(c.id)} style={{ padding: '14px 16px', cursor: 'pointer', background: active?.id === c.id ? '#f0fdfa' : 'transparent', borderLeft: active?.id === c.id ? '3px solid #14b8a6' : '3px solid transparent', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#0d9488', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>{(c.customerName || 'C').charAt(0)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.customerName || 'Customer'}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lastMessage || 'No messages yet'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>{formatRelative(c.updatedAt)}</div>
              {Number(c.unread || 0) > 0 && <div style={{ background: '#14b8a6', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 99, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', marginTop: 4 }}>{c.unread}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Chat Window */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: 'none', borderRadius: showDebug ? 0 : '0 12px 12px 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, alignItems: 'center', background: 'linear-gradient(90deg, #f0fdfa, #fff)' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#0d9488', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{(active?.customerName || 'A').charAt(0)}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{active?.customerName || 'Assistant'}</div>
            <div style={{ fontSize: 11, color: '#10b981' }}>● Online</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>{messages.length} messages</div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14, background: '#fafafa' }}>
          {messages.map((m, i) => (
            <div key={m.id || i} style={{ display: 'flex', justifyContent: m.from === 'assistant' ? 'flex-end' : 'flex-start' }}>
              <div className={`chat-msg ${m.from === 'assistant' ? 'pharmacy' : 'customer'}`} style={{ maxWidth: '70%' }}>
                <div>{m.text}</div>
                {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                  <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                    {m.attachments.map((att, idx) => (
                      <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, background: '#fff' }}>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{att.name}</div>
                        {String(att.type || '').startsWith('image/') && att.dataUrl && (
                          <img src={att.dataUrl} alt={att.name} style={{ marginTop: 6, maxWidth: 220, borderRadius: 6 }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 10, opacity: .6, marginTop: 4, textAlign: m.from === 'assistant' ? 'right' : 'left' }}>{formatTime(m.createdAt)}</div>
              </div>
            </div>
          ))}
          {typing && <div style={{ fontSize: 12, color: '#94a3b8' }}>Assistant is typing...</div>}
        </div>
        {attachments.length > 0 && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {attachments.map((att, idx) => <span key={idx} className="badge badge-gray">{att.name}</span>)}
          </div>
        )}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            +
            <input
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []).slice(0, 3);
                const parsed = [];
                for (const file of files) {
                  const dataUrl = file.size <= 1024 * 1024 ? await toDataUrl(file) : '';
                  parsed.push({ name: file.name, type: file.type, size: file.size, dataUrl });
                }
                setAttachments(parsed);
              }}
            />
          </label>
          <input className="form-control" placeholder="Ask anything..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} />
          <button className="btn btn-primary" onClick={sendMsg} disabled={sending}>{sending ? 'Sending...' : 'Send'}</button>
        </div>
      </div>
      {showDebug && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: 'none', borderRadius: '0 12px 12px 0', overflow: 'auto' }}>
          <div style={{ padding: 12, borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>AI Debug Logs</div>
          {logs.map((log) => (
            <div key={log.id} style={{ padding: 12, borderBottom: '1px solid #f8fafc' }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>{new Date(log.createdAt).toLocaleString()} • {log.model || 'fallback'} • {log.latencyMs || 0}ms</div>
              <div style={{ marginTop: 6, fontSize: 12 }}><strong>Q:</strong> {log.question}</div>
              <div style={{ marginTop: 4, fontSize: 12 }}><strong>A:</strong> {log.response || log.error || '-'}</div>
              {log.blocked && <span className="badge badge-danger" style={{ marginTop: 6 }}>Guardrail Blocked</span>}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
