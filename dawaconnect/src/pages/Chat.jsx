import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'

const mergeMessage = (messages, message) => {
  if (!message?.id || messages.some((item) => item.id === message.id)) return messages
  return [...messages, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
}

const formatRelative = (value) => {
  if (!value) return 'No messages'
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}

export default function ChatPage() {
  const { user, showToast } = useApp()
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState('')
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [connection, setConnection] = useState('connecting')
  const [error, setError] = useState('')
  const messagesRef = useRef(null)
  const activeIdRef = useRef('')

  const active = useMemo(() => conversations.find((conversation) => conversation.id === activeId) || null, [conversations, activeId])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const loadConversations = useCallback(async () => {
    const result = await window.electronAPI.chat.listConversations()
    if (!result.ok) throw new Error(result.error || 'Could not load conversations.')
    const rows = result.data || []
    setConversations(rows)
    setActiveId((current) => rows.some((row) => row.id === current) ? current : (rows[0]?.id || ''))
    return rows
  }, [])

  useEffect(() => {
    let activeEffect = true
    const unsubscribe = window.electronAPI.chat.onEvent(({ type, data }) => {
      if (!activeEffect) return
      if (type === 'connection') {
        setConnection(data?.state || 'offline')
        if (data?.error) setError(data.error)
      }
      if (type === 'message:new') {
        setConversations((current) => current.map((item) => item.id === data?.conversation?.id ? { ...item, ...data.conversation } : item))
        if (data?.message?.conversationId === activeIdRef.current) {
          setMessages((current) => mergeMessage(current, data.message))
          void window.electronAPI.chat.markRead({ conversationId: activeIdRef.current })
        } else {
          void loadConversations().catch(() => {})
        }
      }
      if (type === 'conversation:updated') {
        setConversations((current) => current.map((item) => item.id === data?.id ? { ...item, ...data } : item))
      }
    })

    async function connect() {
      if (!user?.sessionToken) {
        setError('Your pharmacy session is missing. Sign in again.')
        setLoading(false)
        return
      }
      const result = await window.electronAPI.chat.connect({ sessionToken: user.sessionToken })
      if (!activeEffect) return
      if (!result.ok) {
        setError(result.error || 'Live chat could not connect.')
        setConnection('offline')
        setLoading(false)
        return
      }
      setConnection('connected')
      try {
        await loadConversations()
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        if (activeEffect) setLoading(false)
      }
    }
    connect()
    return () => {
      activeEffect = false
      unsubscribe?.()
    }
  }, [user?.sessionToken, loadConversations])

  useEffect(() => {
    let activeEffect = true
    async function loadMessages() {
      if (!activeId) {
        setMessages([])
        return
      }
      setError('')
      const joined = await window.electronAPI.chat.join({ conversationId: activeId })
      if (!joined.ok) {
        if (activeEffect) setError(joined.error)
        return
      }
      const result = await window.electronAPI.chat.listMessages({ conversationId: activeId, limit: 50 })
      if (!activeEffect) return
      if (!result.ok) {
        setError(result.error)
        return
      }
      setMessages(result.data?.messages || [])
      await window.electronAPI.chat.markRead({ conversationId: activeId })
      setConversations((current) => current.map((conversation) => conversation.id === activeId ? { ...conversation, pharmacyUnreadCount: 0 } : conversation))
    }
    loadMessages()
    return () => { activeEffect = false }
  }, [activeId])

  useEffect(() => {
    const element = messagesRef.current
    if (!element) return
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    if (distance < 180) element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const sendMessage = async () => {
    const text = draft.trim()
    if (!text || !active?.canSend || sending || connection !== 'connected') return
    setSending(true)
    setError('')
    const result = await window.electronAPI.chat.sendMessage({ conversationId: active.id, text })
    if (result.ok) {
      setDraft('')
      setMessages((current) => mergeMessage(current, result.data.message))
      setConversations((current) => current.map((conversation) => conversation.id === active.id ? { ...conversation, ...result.data.conversation } : conversation))
    } else {
      setError(result.error || 'Message could not be sent.')
      showToast(result.error || 'Message could not be sent.', 'error')
    }
    setSending(false)
  }

  return (
    <div className="page-shell">
      <div className="page-hero">
        <div>
          <h2>Live Customer Chat</h2>
          <div className="page-subtitle">Private, human-to-human text conversations for active marketplace orders.</div>
        </div>
        <div className="action-row">
          <span className={`badge ${connection === 'connected' ? 'badge-success' : 'badge-warning'}`}>{connection === 'connected' ? '● Connected' : connection}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => loadConversations().catch((loadError) => setError(loadError.message))}>Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', height: 'calc(100vh - 235px)', minHeight: 560 }}>
        <aside style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px 0 0 16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 18, borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 800, fontFamily: 'Sora,sans-serif' }}>Order conversations</div>
            <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>{conversations.length} customer {conversations.length === 1 ? 'chat' : 'chats'}</div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && <div className="empty-state"><p>Connecting to live chat…</p></div>}
            {!loading && conversations.length === 0 && <div className="empty-state"><p>No customer has started an order chat yet.</p></div>}
            {conversations.map((conversation) => (
              <button key={conversation.id} type="button" onClick={() => setActiveId(conversation.id)} style={{ width: '100%', border: 0, borderBottom: '1px solid #f1f5f9', borderLeft: activeId === conversation.id ? '4px solid #0d9488' : '4px solid transparent', padding: '15px 16px', background: activeId === conversation.id ? '#f0fdfa' : '#fff', textAlign: 'left', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: '#0f766e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{(conversation.customerName || 'C').charAt(0).toUpperCase()}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ fontSize: 13.5 }}>{conversation.customerName}</strong><span style={{ fontSize: 10, color: '#94a3b8' }}>{formatRelative(conversation.lastMessageAt)}</span></div>
                    <div style={{ marginTop: 3, fontSize: 11, color: '#64748b' }}>Order #{conversation.orderId} · {conversation.orderStatus}</div>
                    <div style={{ marginTop: 5, fontSize: 12, color: '#94a3b8', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{conversation.lastMessagePreview || 'No messages yet'}</div>
                  </div>
                  {Number(conversation.pharmacyUnreadCount || 0) > 0 && <span className="badge badge-success">{conversation.pharmacyUnreadCount}</span>}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderLeft: 0, borderRadius: '0 16px 16px 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!active ? (
            <div className="empty-state" style={{ margin: 'auto' }}><div style={{ fontSize: 38 }}>💬</div><h3>Select a conversation</h3><p>Customer chats appear after they open chat from an order.</p></div>
          ) : (
            <>
              <header style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(90deg,#f0fdfa,#fff)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><strong>{active.customerName}</strong><div style={{ marginTop: 3, fontSize: 12, color: '#64748b' }}>Order #{active.orderId} · {active.orderStatus}</div></div>
                <span className={`badge ${active.canSend ? 'badge-success' : 'badge-gray'}`}>{active.canSend ? 'Active' : 'Read only'}</span>
              </header>
              <div ref={messagesRef} style={{ flex: 1, overflowY: 'auto', padding: 22, background: '#f8fafc' }}>
                {messages.length === 0 && <div className="empty-state"><p>No messages yet.</p></div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {messages.map((message) => {
                    const mine = message.senderType === 'pharmacy'
                    return <div key={message.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}><div className={`chat-msg ${mine ? 'pharmacy' : 'customer'}`} style={{ maxWidth: '72%' }}><div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{message.text}</div><div style={{ marginTop: 5, opacity: 0.6, fontSize: 10, textAlign: 'right' }}>{mine ? 'You' : 'Customer'} · {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div></div>
                  })}
                </div>
              </div>
              {active.canSend ? (
                <div style={{ borderTop: '1px solid #e2e8f0', padding: 15 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                    <textarea className="form-control" rows={2} maxLength={2000} placeholder="Reply to the customer…" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() } }} style={{ resize: 'none' }} />
                    <button className="btn btn-primary" onClick={sendMessage} disabled={sending || !draft.trim() || connection !== 'connected'}>{sending ? 'Sending…' : 'Send'}</button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: '#94a3b8', fontSize: 10 }}><span>Human reply · Text only · Visible only to this customer</span><span>{draft.length}/2000</span></div>
                </div>
              ) : <div style={{ padding: 18, borderTop: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: 13, textAlign: 'center' }}>This order is {active.orderStatus.toLowerCase()}. Its chat history is read-only.</div>}
            </>
          )}
          {error && <div style={{ padding: '10px 16px', borderTop: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 12 }}>{error}</div>}
        </section>
      </div>
    </div>
  )
}
