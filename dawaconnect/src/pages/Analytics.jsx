import React, { useState } from 'react';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useApp } from '../context/AppContext';

export default function Analytics() {
  const { salesData, monthlyData, orders, inventory } = useApp();
  const [period, setPeriod] = useState('week');

  const deliveredOrders = orders.filter(o => o.status === 'Delivered');
  const totalRevenue = deliveredOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;

  const hourlyData = [
    { hour: '8am', orders: 4 }, { hour: '9am', orders: 8 }, { hour: '10am', orders: 15 },
    { hour: '11am', orders: 22 }, { hour: '12pm', orders: 18 }, { hour: '1pm', orders: 12 },
    { hour: '2pm', orders: 19 }, { hour: '3pm', orders: 28 }, { hour: '4pm', orders: 35 },
    { hour: '5pm', orders: 42 }, { hour: '6pm', orders: 38 }, { hour: '7pm', orders: 30 },
    { hour: '8pm', orders: 22 }, { hour: '9pm', orders: 14 },
  ];

  const forecastData = [
    { month: 'May', actual: null, predicted: 420000 },
    { month: 'Jun', actual: null, predicted: 465000 },
    { month: 'Jul', actual: null, predicted: 390000 },
    { month: 'Aug', actual: null, predicted: 480000 },
  ];

  const combinedForecast = [
    ...monthlyData.map(d => ({ ...d, actual: d.revenue, predicted: null })),
    ...forecastData,
  ];

  const paymentSummary = deliveredOrders.reduce((acc, order) => {
    const key = order.payMethod || 'Other';
    acc[key] = (acc[key] || 0) + Number(order.total || 0);
    return acc;
  }, {});
  const paymentData = Object.entries(paymentSummary).map(([method, amount]) => ({
    method,
    amount,
    pct: totalRevenue ? Math.round((amount / totalRevenue) * 100) : 0
  }));

  const handleDownload = (format) => {
    alert(`Downloading ${format.toUpperCase()} report... (demo)`);
  };

  return (
    <div>
      {/* KPIs */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Revenue', value: `PKR ${(totalRevenue / 1000).toFixed(0)}k`, sub: '+18.2% vs last month', color: '#0d9488' },
          { label: 'Total Orders', value: totalOrders, sub: '+24 this week', color: '#10b981' },
          { label: 'Avg Order Value', value: `PKR ${avgOrderValue}`, sub: 'Across all orders', color: '#f59e0b' },
          { label: 'Customer Satisfaction', value: '4.6/5', sub: 'Based on 89 reviews', color: '#8b5cf6' },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <div className="stat-label">{k.label}</div>
            <div className="stat-value" style={{ color: k.color, fontSize: 24 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Period Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="tabs" style={{ width: 'auto', marginBottom: 0 }}>
          {['week', 'month', 'year'].map(p => (
            <button key={p} className={`tab ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)} style={{ flex: 'none', padding: '8px 20px' }}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handleDownload('pdf')}>⬇ PDF Report</button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleDownload('excel')}>⬇ Excel Report</button>
        </div>
      </div>

      {/* Revenue + Orders Charts */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Revenue Trend ({period === 'week' ? 'This Week' : period === 'month' ? 'Last 6 Months' : 'This Year'})</span></div>
          <div style={{ padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={period === 'week' ? salesData : monthlyData}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey={period === 'week' ? 'day' : 'month'} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [`PKR ${v.toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                <Area type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={2.5} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Daily Orders (This Week)</span></div>
          <div style={{ padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={salesData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="orders" fill="#0d9488" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Forecast + Hourly */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Revenue Forecast (AI-powered)</span>
            <span style={{ marginLeft: 'auto' }} className="badge badge-teal">AI Prediction</span>
          </div>
          <div style={{ padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={combinedForecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => v ? [`PKR ${v.toLocaleString()}`, ''] : [null, '']} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 4 }} name="Actual" connectNulls={false} />
                <Line type="monotone" dataKey="predicted" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4 }} name="Predicted" connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ padding: '0 22px 16px', fontSize: 12, color: '#64748b' }}>
            💡 AI forecasts based on sales patterns, seasonality & demand trends
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Peak Hours Today</span></div>
          <div style={{ padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
                <Area type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2} fill="url(#g2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Payment Methods + Restocking */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><span className="card-title">Payment Method Breakdown</span></div>
          <div className="card-body">
            {paymentData.map((p, i) => (
              <div key={p.method} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13.5 }}>
                  <span style={{ fontWeight: 600 }}>{p.method}</span>
                  <span style={{ color: '#0f766e', fontWeight: 700 }}>PKR {(p.amount / 1000).toFixed(0)}k ({p.pct}%)</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${p.pct}%`, background: ['#14b8a6', '#0d9488', '#10b981'][i] }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Restocking Suggestions (AI)</span>
            <span style={{ marginLeft: 'auto' }} className="badge badge-warning">AI Insights</span>
          </div>
          <div className="card-body" style={{ padding: '12px 0' }}>
            {[
              { name: 'Metformin 500mg', current: 25, suggested: 200, reason: 'High demand + low stock' },
              { name: 'Cetirizine 10mg', current: 18, suggested: 150, reason: 'Seasonal demand increase' },
              { name: 'Pantoprazole 40mg', current: 12, suggested: 100, reason: 'Expiry & recall alert' },
              { name: 'Azithromycin 500mg', current: 45, suggested: 120, reason: 'Trending in marketplace' },
            ].map(s => (
              <div key={s.name} style={{ padding: '10px 22px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#f59e0b' }}>⚡ {s.reason}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Current: {s.current}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0d9488' }}>→ Order {s.suggested}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
