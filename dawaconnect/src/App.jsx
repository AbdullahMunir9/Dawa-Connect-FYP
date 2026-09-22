import React, { useState } from 'react';
import { useApp } from './context/AppContext';
import AuthPage, { RegisterPage } from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Analytics from './pages/Analytics';
import { ProfilePage, ReviewsPage, ReturnsPage } from './pages/OtherPages';
import { NotificationsPage, ChatPage } from './pages/MorePages';
import Complaints from './pages/Complaints';

const NAV_ITEMS = [
  { section: 'Main', items: [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'orders', label: 'Orders', icon: '🛒', badge: true },
    { id: 'inventory', label: 'Inventory', icon: '💊' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
  ]},
  { section: 'Operations', items: [
    { id: 'returns', label: 'Returns & Refunds', icon: '↩️' },
    { id: 'chat', label: 'Live Customer Chat', icon: '💬', badge: true },
    { id: 'complaints', label: 'Complaints', icon: '📣', badge: true },
  ]},
  { section: 'Management', items: [
    { id: 'reviews', label: 'Reviews & Ratings', icon: '⭐' },
    { id: 'notifications', label: 'Notifications', icon: '🔔', badge: true },
    { id: 'profile', label: 'Pharmacy Profile', icon: '🏥' },
  ]},
];

const PAGE_TITLES = {
  dashboard: 'Dashboard', orders: 'Order Management', inventory: 'Inventory Management',
  analytics: 'Sales Analytics & Reports',
  returns: 'Returns & Refunds',
  chat: 'Live Customer Chat',
  complaints: 'Complaints & Support',
  reviews: 'Reviews & Ratings',
  notifications: 'Notifications', profile: 'Pharmacy Profile',
};

export default function App() {
  const { user, logout, unreadCount, notifications, markAllNotificationsRead, toasts, pharmacyProfile, orders, openComplaintCount } = useApp();
  const [page, setPage] = useState('dashboard');
  const [walkthroughDone, setWalkthroughDone] = useState(() => localStorage.getItem('onboardingDone') === '1');
  const [showRegister, setShowRegister] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const handleLogout = () => {
    logout();
    setShowRegister(false);
    setPage('dashboard');
    setShowNotifPanel(false);
  };

  if (!user) {
    if (!walkthroughDone) {
      return (
        <OnboardingPage
          onFinish={() => {
            localStorage.setItem('onboardingDone', '1');
            setWalkthroughDone(true);
            setShowRegister(true);
          }}
        />
      );
    }
    if (showRegister) return <RegisterPage onBack={() => setShowRegister(false)} />;
    return <AuthPage onRegister={() => setShowRegister(true)} />;
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'orders': return <Orders />;
      case 'inventory': return <Inventory />;
      case 'analytics': return <Analytics />;
      case 'returns': return <ReturnsPage />;
      case 'chat': return <ChatPage />;
      case 'complaints': return <Complaints />;
      case 'reviews': return <ReviewsPage />;
      case 'notifications': return <NotificationsPage />;
      case 'profile': return <ProfilePage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon">💊</div>
            <div className="logo-text">
              <div className="name">DawaConnect</div>
              <div className="tag">Pharmacy Module</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(section => (
            <div className="nav-section" key={section.section}>
              <div className="nav-label">{section.section}</div>
              {section.items.map(item => (
                <div
                  key={item.id}
                  className={`nav-item ${page === item.id ? 'active' : ''}`}
                  onClick={() => setPage(item.id)}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge && item.id === 'orders' && orders.filter(o => o.status === 'Pending').length > 0 && (
                    <span className="nav-badge">{orders.filter(o => o.status === 'Pending').length}</span>
                  )}
                  {item.badge && item.id === 'notifications' && unreadCount > 0 && (
                    <span className="nav-badge">{unreadCount}</span>
                  )}
                  {item.badge && item.id === 'chat' && (
                    <span className="nav-badge">3</span>
                  )}
                  {item.badge && item.id === 'complaints' && openComplaintCount > 0 && (
                    <span className="nav-badge">{openComplaintCount}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {/* Pharmacy Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: pharmacyProfile.status === 'Open' ? '#10b981' : '#f43f5e' }} />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{pharmacyProfile.name} · {pharmacyProfile.status}</span>
          </div>
          <div className="user-card">
            <div className="user-avatar">{user.name.charAt(0)}</div>
            <div className="user-info">
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role}</div>
            </div>
            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, marginLeft: 'auto', padding: 4 }}
              title="Logout"
            >⏻</button>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div>
            <div className="topbar-title">{PAGE_TITLES[page]}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <div className="topbar-actions">
            {/* Search */}
            <div className="search-bar" style={{ maxWidth: 240 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input placeholder="Quick search..." />
            </div>

            {/* Notifications Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifPanel(p => !p)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, width: 40, height: 40, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, background: '#f43f5e', borderRadius: '50%', border: '2px solid #fff' }} />
                )}
              </button>
              {showNotifPanel && (
                <div className="notifications-panel">
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Notifications</span>
                    <button onClick={() => { markAllNotificationsRead(); setShowNotifPanel(false); }} style={{ background: 'none', border: 'none', color: '#0d9488', fontSize: 12, cursor: 'pointer' }}>Mark all read</button>
                  </div>
                  {notifications.slice(0, 5).map(n => (
                    <div key={n.id} className="notif-item" style={{ background: n.read ? '#fff' : '#f0fdfa' }}>
                      <div className="notif-dot" style={{ background: n.color }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.message}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{n.time}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: '10px', textAlign: 'center' }}>
                    <button onClick={() => { setPage('notifications'); setShowNotifPanel(false); }} style={{ background: 'none', border: 'none', color: '#0d9488', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>View all →</button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile avatar */}
            <div
              onClick={() => setPage('profile')}
              style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              {user.name.charAt(0)}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          {renderPage()}
        </main>
      </div>

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : '⚠️'}</span>
            {t.message}
          </div>
        ))}
      </div>

      {/* Click outside to close notif panel */}
      {showNotifPanel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 140 }} onClick={() => setShowNotifPanel(false)} />
      )}
    </div>
  );
}
