import React from 'react'
import { useApp } from '../context/AppContext'

export function NotificationsPage() {
  const { notifications, markAllNotificationsRead } = useApp()
  const iconMap = { order: '🛒', stock: '📦', expiry: '⏰', system: '⚙️' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: '#64748b' }}>{notifications.filter((notification) => !notification.read).length} unread notifications</div>
        <button className="btn btn-secondary btn-sm" onClick={markAllNotificationsRead}>Mark all as read</button>
      </div>
      <div className="card">
        {notifications.length === 0 && <div className="empty-state"><p>No notifications</p></div>}
        {notifications.map((notification) => (
          <div key={notification.id} className="notif-item" style={{ background: notification.read ? '#fff' : '#f0fdfa' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${notification.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
              {iconMap[notification.type] || '🔔'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: notification.read ? 400 : 600, color: '#1e293b' }}>{notification.message}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{notification.time}</div>
            </div>
            {!notification.read && <div className="notif-dot" style={{ background: notification.color }} />}
          </div>
        ))}
      </div>
    </div>
  )
}
