import React from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useApp } from '../context/AppContext';

const COLORS = ['#14b8a6', '#0d9488', '#10b981', '#f59e0b', '#f43f5e'];

export default function Dashboard() {
  const { inventory, orders, lowStockItems, expiringItems, salesData, monthlyData } = useApp();

  const totalRevenue = orders.filter(o => o.status === 'Delivered').reduce((s, o) => s + o.total, 0);
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => o.date === todayIso).length;
  const pendingOrders = orders.filter(o => o.status === 'Pending').length;

  const categoryData = inventory.reduce((acc, item) => {
    const existing = acc.find(a => a.name === item.category);
    if (existing) existing.value++;
    else acc.push({ name: item.category, value: 1 });
    return acc;
  }, []);

  const topSelling = Object.values(orders.reduce((acc, order) => {
    for (const item of order.items || []) {
      if (!acc[item.name]) acc[item.name] = { name: item.name, sold: 0, revenue: 0 };
      acc[item.name].sold += Number(item.qty || 0);
      acc[item.name].revenue += Number(item.qty || 0) * Number(item.price || 0);
    }
    return acc;
  }, {})).sort((a, b) => b.sold - a.sold).slice(0, 5);

  return (
    <div className="page-shell">
      <div className="page-hero">
        <div>
          <h2>Business Snapshot</h2>
          <div className="page-subtitle">Live overview of revenue, orders, stock health, and top products.</div>
        </div>
        <div className="soft-panel">
          <div style={{ fontSize: 12, color: '#475569' }}>Updated from live database</div>
        </div>
      </div>
      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Total Revenue" value={`PKR ${totalRevenue.toLocaleString()}`} change="Live" up icon="💰" color="#14b8a6" bg="#f0fdfa" />
        <StatCard label="Today's Orders" value={todayOrders} change="Live" up icon="🛒" color="#0d9488" bg="#f0fdfa" />
        <StatCard label="Total Medicines" value={inventory.length} change="+3 this week" up icon="💊" color="#10b981" bg="#dcfce7" />
        <StatCard label="Pending Orders" value={pendingOrders} change="Needs attention" up={false} icon="⏳" color="#f59e0b" bg="#fef3c7" />
      </div>

      {/* Alerts */}
      {(lowStockItems.length > 0 || expiringItems.length > 0) && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {lowStockItems.length > 0 && (
            <div style={{ flex: 1, background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 8 }}>⚠️ Low Stock Alert ({lowStockItems.length} items)</div>
              {lowStockItems.slice(0, 3).map(i => (
                <div key={i.id} style={{ fontSize: 13, color: '#78350f', marginBottom: 4 }}>• {i.name}: {i.stock} units (min: {i.threshold})</div>
              ))}
            </div>
          )}
          {expiringItems.length > 0 && (
            <div style={{ flex: 1, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>🚨 Expiry Alert ({expiringItems.length} items)</div>
              {expiringItems.slice(0, 3).map(i => {
                const days = Math.ceil((new Date(i.expiry) - new Date()) / (1000*60*60*24));
                return <div key={i.id} style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 4 }}>• {i.name}: expires in {days} days</div>;
              })}
            </div>
          )}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Weekly Revenue Trend</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>This Week</span>
          </div>
          <div style={{ padding: '16px 16px 8px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`PKR ${v.toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                <Area type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={2.5} fill="url(#revGrad)" dot={{ fill: '#14b8a6', strokeWidth: 0, r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Monthly Sales (6 Months)</span>
          </div>
          <div style={{ padding: '16px 16px 8px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`PKR ${v.toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="revenue" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Top Selling Medicines</span></div>
          <div className="card-body" style={{ padding: '12px 0' }}>
            {topSelling.map((med, i) => (
              <div key={med.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 22px' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${COLORS[i]}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: COLORS[i] }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>{med.name}</div>
                  <div style={{ marginTop: 4 }}>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${(med.sold / Math.max(1, topSelling[0]?.sold || 1)) * 100}%`, background: COLORS[i] }} />
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f766e' }}>PKR {(med.revenue / 1000).toFixed(0)}k</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{med.sold} sold</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Inventory by Category</span></div>
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {categoryData.map((cat, i) => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: '#475569' }}>{cat.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{cat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Orders</span>
          <span style={{ marginLeft: 'auto', background: '#f0fdfa', color: '#0f766e', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6 }}>Live</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Order ID</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map(order => (
                <tr key={order.id}>
                  <td><span style={{ fontWeight: 600, color: '#0f766e' }}>{order.id}</span></td>
                  <td>{order.customer}</td>
                  <td style={{ fontWeight: 600 }}>PKR {order.total.toLocaleString()}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td style={{ color: '#94a3b8' }}>{order.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, change, up, icon, color, bg }) {
  return (
    <div className="stat-card">
      <div className="stat-card-accent" style={{ background: color }} />
      <div className="stat-icon" style={{ background: bg }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: 22 }}>{value}</div>
      <div className={`stat-change ${up ? 'up' : 'down'}`}>
        {up ? '↑' : '↓'} {change}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { Pending: 'warning', Confirmed: 'info', Dispatched: 'teal', Delivered: 'success', Cancelled: 'danger' };
  return <span className={`badge badge-${map[status] || 'gray'}`}>{status}</span>;
}
