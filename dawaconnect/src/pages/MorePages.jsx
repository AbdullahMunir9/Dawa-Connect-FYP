import React, { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'

export function NotificationsPage() {
  const { notifications, markAllNotificationsRead } = useApp()
  const [preferences, setPreferences] = useState(null)
  const [preferenceError, setPreferenceError] = useState('')
  const iconMap = { order: '🛒', stock: '📦', expiry: '⏰', system: '⚙️' }

  useEffect(() => {
    let active = true
    window.electronAPI.notifications?.getPreferences().then((result) => {
      if (!active) return
      if (result.ok) setPreferences(result.data)
      else setPreferenceError(result.error || 'Notification settings could not be loaded.')
    })
    return () => { active = false }
  }, [])

  const updatePreference = async (key, value) => {
    setPreferenceError('')
    const result = await window.electronAPI.notifications.updatePreferences({ [key]: value })
    if (result.ok) setPreferences(result.data)
    else setPreferenceError(result.error || 'Notification settings could not be saved.')
  }

  const preferenceRows = [
    ['desktopEnabled', 'Windows desktop notifications', 'Show a Windows alert when a new order arrives.'],
    ['soundEnabled', 'Notification sound', 'Use the standard Windows notification sound.'],
    ['runInBackground', 'Keep running in the system tray', 'Closing the window keeps DawaConnect ready for new orders.'],
    ['startWithWindows', 'Start with Windows', 'Launch DawaConnect automatically when this computer starts.'],
  ]

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Desktop notification settings</span></div>
        <div style={{ padding: '4px 22px 14px' }}>
          {preferences && !preferences.supported && <div className="alert alert-warning" style={{ margin: '12px 0' }}>Native notifications are not supported on this Windows installation. In-app alerts will still appear.</div>}
          {preferenceError && <div className="alert alert-danger" style={{ margin: '12px 0' }}>{preferenceError}</div>}
          {preferences && preferenceRows.map(([key, label, description]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 2px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
              <span style={{ flex: 1 }}><strong style={{ display: 'block', color: '#1e293b', fontSize: 13.5 }}>{label}</strong><span style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: 12 }}>{description}</span></span>
              <input type="checkbox" checked={Boolean(preferences[key])} disabled={key === 'soundEnabled' && !preferences.desktopEnabled} onChange={(event) => updatePreference(key, event.target.checked)} style={{ width: 19, height: 19, accentColor: '#0d9488' }} />
            </label>
          ))}
        </div>
      </div>
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
