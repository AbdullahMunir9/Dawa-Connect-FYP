import React, { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useApp } from '../context/AppContext';

const currency = (value) => `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

function pakistanMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit',
  }).formatToParts(date);
  const read = (type) => parts.find((part) => part.type === type)?.value;
  return `${read('year')}-${read('month')}`;
}

function shiftMonth(month, offset) {
  const [year, monthNumber] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-PK', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function comparisonText(value, noun = 'previous month') {
  if (value === null || value === undefined) return `No ${noun} baseline`;
  if (value === 0) return `No change from ${noun}`;
  return `${value > 0 ? '+' : ''}${value}% vs ${noun}`;
}

function MetricCard({ label, value, comparison, color, note }) {
  return <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className="stat-value" style={{ color, fontSize: 24 }}>{value}</div>
    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{note || comparisonText(comparison)}</div>
  </div>;
}

function EmptyPanel({ children }) {
  return <div style={{ padding: '36px 22px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{children}</div>;
}

function opportunityStatus(status) {
  if (status === 'consider_expansion') return { label: 'Expansion signal', background: '#dcfce7', color: '#166534' };
  if (status === 'keep_current_radius') return { label: 'Keep current radius', background: '#e0f2fe', color: '#075985' };
  if (status === 'missing_location') return { label: 'Location required', background: '#fee2e2', color: '#991b1b' };
  return { label: 'Collecting data', background: '#fef3c7', color: '#92400e' };
}

function shortDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function generatedTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));
}

function priorityColors(priority) {
  if (priority === 'high') return { background: '#fee2e2', color: '#991b1b' };
  if (priority === 'medium') return { background: '#fef3c7', color: '#92400e' };
  return { background: '#e0f2fe', color: '#075985' };
}

function Evidence({ factKeys, evidence }) {
  const facts = factKeys.map((key) => evidence.get(key)).filter(Boolean);
  if (!facts.length) return null;
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
    {facts.map((fact) => <span key={fact.key} title={fact.key} style={{ border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', borderRadius: 999, padding: '4px 8px', fontSize: 10.5 }}>
      {fact.label}: <strong style={{ color: '#0f172a' }}>{fact.display}</strong>
    </span>)}
  </div>;
}

function NarrativeSection({ title, items, evidence }) {
  return <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
    <div style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: 750, color: '#1e293b', fontSize: 13 }}>{title}</div>
    <div>{items.map((item, index) => {
      const colors = priorityColors(item.priority);
      return <div key={`${item.title}:${index}`} style={{ padding: '14px 15px', borderBottom: index === items.length - 1 ? 0 : '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <strong style={{ color: '#0f172a', fontSize: 13, lineHeight: 1.45 }}>{item.title}</strong>
          <span className="badge" style={{ marginLeft: 'auto', flexShrink: 0, ...colors }}>{item.priority}</span>
        </div>
        <div style={{ color: '#475569', fontSize: 11.5, lineHeight: 1.65, marginTop: 6 }}>{item.explanation}</div>
        <Evidence factKeys={item.factKeys} evidence={evidence} />
      </div>;
    })}</div>
  </div>;
}

export default function Analytics() {
  const { user } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(() => pakistanMonth());
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [narrativeState, setNarrativeState] = useState(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState('');
  const [exporting, setExporting] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [exportError, setExportError] = useState('');

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const month = shiftMonth(pakistanMonth(), -index);
    return { month, label: monthLabel(month) };
  }), []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await window.electronAPI.analytics.get({ month: selectedMonth });
        if (!active) return;
        if (!result.ok) throw new Error(result.error || 'Analytics could not be loaded.');
        setAnalytics(result.data);
      } catch (loadError) {
        if (active) {
          setAnalytics(null);
          setError(loadError?.message || 'Analytics could not be loaded.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    if (user?.id) void load();
    return () => { active = false; };
  }, [selectedMonth, user?.id]);

  useEffect(() => {
    if (!user?.id || analytics?.meta?.month !== selectedMonth) return undefined;
    let active = true;
    const loadNarrative = async () => {
      setNarrativeState(null);
      setNarrativeError('');
      setNarrativeLoading(true);
      try {
        const result = await window.electronAPI.analytics.getNarrative({ month: selectedMonth });
        if (!active) return;
        if (!result.ok) throw new Error(result.error || 'The recommendation report could not be loaded.');
        setNarrativeState(result.data);
      } catch (loadError) {
        if (active) setNarrativeError(loadError?.message || 'The recommendation report could not be loaded.');
      } finally {
        if (active) setNarrativeLoading(false);
      }
    };
    void loadNarrative();
    return () => { active = false; };
  }, [analytics?.meta?.month, selectedMonth, user?.id]);

  const generateNarrative = async (force = false) => {
    setNarrativeLoading(true);
    setNarrativeError('');
    try {
      const result = await window.electronAPI.analytics.generateNarrative({ month: selectedMonth, force });
      if (!result.ok) throw new Error(result.error || 'The recommendation report could not be generated.');
      setNarrativeState(result.data);
    } catch (generationError) {
      setNarrativeError(generationError?.message || 'The recommendation report could not be generated.');
    } finally {
      setNarrativeLoading(false);
    }
  };

  const downloadReport = async (format) => {
    setExporting(format);
    setExportNotice('');
    setExportError('');
    try {
      const result = await window.electronAPI.analytics.downloadReport({ month: selectedMonth, format });
      if (!result.ok) throw new Error(result.error || 'The report could not be downloaded.');
      if (!result.cancelled) setExportNotice(`${format === 'pdf' ? 'PDF report' : 'Excel workbook'} saved to ${result.data.filePath}`);
    } catch (downloadError) {
      setExportError(downloadError?.message || 'The report could not be downloaded.');
    } finally {
      setExporting('');
    }
  };

  if (loading) return <div className="card"><EmptyPanel>Loading measured pharmacy analytics…</EmptyPanel></div>;
  if (error) return <div className="card" style={{ borderColor: '#fecaca' }}><EmptyPanel>{error}</EmptyPanel></div>;
  if (!analytics) return <div className="card"><EmptyPanel>No analytics are available.</EmptyPanel></div>;

  const { summary, comparisons, products, dataQuality, forecast, cityOpportunity } = analytics;
  const peakHours = [...analytics.hourly].sort((left, right) => right.orders - left.orders).slice(0, 8)
    .sort((left, right) => left.hour - right.hour);
  const topProducts = products.slice(0, 6);
  const statusTotal = analytics.statuses.reduce((sum, row) => sum + row.count, 0);

  return <div>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: 0 }}>Monthly Analytics</h2>
        <div className="page-subtitle">Measured performance, weekly demand planning, privacy-safe delivery insights and a validated owner recommendation report.</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <select className="form-control" style={{ width: 190 }} value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
          {monthOptions.map((option) => <option key={option.month} value={option.month}>{option.label}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" disabled={Boolean(exporting)} onClick={() => downloadReport('pdf')}>
          {exporting === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
        </button>
        <button className="btn btn-secondary btn-sm" disabled={Boolean(exporting)} onClick={() => downloadReport('xlsx')}>
          {exporting === 'xlsx' ? 'Preparing Excel…' : 'Download Excel'}
        </button>
      </div>
    </div>

    {exportNotice && <div className="alert alert-success" style={{ marginBottom: 16, overflowWrap: 'anywhere' }}>{exportNotice}</div>}
    {exportError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{exportError}</div>}

    <div style={{ marginBottom: 18, padding: '12px 16px', borderRadius: 10, background: '#ecfeff', border: '1px solid #a5f3fc', color: '#155e75', fontSize: 12.5 }}>
      <strong>Measured data:</strong> Figures below come from authenticated pharmacy orders and current inventory. No AI-generated number or demonstration value is displayed.
    </div>

    <div className="stats-grid" style={{ marginBottom: 24 }}>
      <MetricCard label="Product Revenue" value={currency(summary.productRevenue)} comparison={comparisons.productRevenuePercent} color="#0d9488" />
      <MetricCard label="Delivered Orders" value={summary.deliveredOrders.toLocaleString()} comparison={comparisons.deliveredOrdersPercent} color="#10b981" />
      <MetricCard label="Average Order Value" value={currency(summary.averageOrderValue)} comparison={comparisons.averageOrderValuePercent} color="#f59e0b" />
      <MetricCard label="Units Sold" value={summary.unitsSold.toLocaleString()} color="#8b5cf6" note={`${summary.cancelledOrders} cancelled · ${summary.cancellationRate}% cancellation rate`} />
    </div>

    <div className="grid-2" style={{ marginBottom: 20 }}>
      <div className="card">
        <div className="card-header"><span className="card-title">Six-month product revenue</span><span className="badge badge-teal">Measured</span></div>
        <div style={{ padding: '16px 8px 8px' }}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={analytics.monthlyTrend}>
              <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#14b8a6" stopOpacity={0.24} /><stop offset="95%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
              <Tooltip formatter={(value) => [currency(value), 'Product revenue']} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
              <Area type="monotone" dataKey="productRevenue" stroke="#14b8a6" strokeWidth={2.5} fill="url(#revenueFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Orders by day</span></div>
        <div style={{ padding: '16px 8px 8px' }}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={analytics.daily} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={2} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip labelFormatter={(label) => `Day ${label}`} contentStyle={{ borderRadius: 8, fontSize: 13 }} />
              <Bar dataKey="orders" name="Orders placed" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>

    {forecast && <div className="card" style={{ marginBottom: 20, borderColor: '#c4b5fd' }}>
      <div className="card-header" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <span className="card-title">Weekly restock plan for {forecast.forecastMonthLabel}</span>
          <div style={{ marginTop: 4, fontSize: 11.5, color: '#64748b' }}>Next-month demand forecast converted into one-week stock targets. Purchase expense and profit are not calculated.</div>
        </div>
        <span className="badge" style={{ marginLeft: 'auto', background: '#ede9fe', color: '#6d28d9' }}>Forecast · owner review</span>
      </div>
      <div className="card-body">
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <MetricCard label="Forecast Units" value={forecast.summary.forecastUnits.toLocaleString()} color="#7c3aed" note={`${forecast.summary.productsWithDemand} product${forecast.summary.productsWithDemand === 1 ? '' : 's'} with measured demand`} />
          <MetricCard label="Estimated Sales Revenue" value={currency(forecast.summary.estimatedProductRevenue)} color="#0d9488" note="Uses current selling prices — not profit" />
          <MetricCard label="Reorder This Week" value={forecast.summary.productsToReorder.toLocaleString()} color="#e11d48" note="Below weekly target plus safety stock" />
          <MetricCard label="Suggested Units" value={forecast.summary.suggestedReorderUnits.toLocaleString()} color="#d97706" note="Combined immediate weekly reorder quantity" />
        </div>

        {forecast.products.some((product) => product.forecastUnits > 0) ? <div className="table-wrapper">
          <table>
            <thead><tr><th>Product</th><th>Next month</th><th>Weekly target</th><th>Stock now</th><th>Suggested reorder</th><th>Confidence</th></tr></thead>
            <tbody>{forecast.products.filter((product) => product.forecastUnits > 0).slice(0, 12).map((product) => <tr key={product.productId}>
              <td><div style={{ fontWeight: 650 }}>{product.name}</div><div style={{ fontSize: 10.5, color: '#64748b', marginTop: 3 }}>{product.explanation}</div></td>
              <td><strong>{product.forecastUnits}</strong> {product.unit || 'units'}<div style={{ fontSize: 10.5, color: '#64748b' }}>{currency(product.estimatedProductRevenue)}</div></td>
              <td>{product.recommendedWeeklyTarget}<div style={{ fontSize: 10.5, color: '#64748b' }}>{product.expectedWeeklyDemand} demand + {product.safetyStock} buffer</div></td>
              <td>{product.currentStock}<div style={{ fontSize: 10.5, color: '#64748b' }}>{product.weeksOfCover === null ? 'No demand baseline' : `${product.weeksOfCover} weeks cover`}</div></td>
              <td><strong style={{ color: product.suggestedReorderQuantity > 0 ? '#e11d48' : '#059669' }}>{product.suggestedReorderQuantity > 0 ? product.suggestedReorderQuantity : 'No reorder'}</strong></td>
              <td><span className="badge" style={{ background: product.confidence === 'high' ? '#dcfce7' : product.confidence === 'medium' ? '#fef3c7' : '#fee2e2', color: product.confidence === 'high' ? '#166534' : product.confidence === 'medium' ? '#92400e' : '#991b1b' }}>{product.confidence}</span><div style={{ fontSize: 10.5, color: '#64748b', marginTop: 4 }}>{product.demandMonths} demand month{product.demandMonths === 1 ? '' : 's'}</div></td>
            </tr>)}</tbody>
          </table>
        </div> : <EmptyPanel>No delivered product demand is available yet. Recommendations will appear after completed sales are recorded.</EmptyPanel>}

        <div style={{ marginTop: 18, padding: '11px 14px', borderRadius: 9, background: '#f8fafc', color: '#475569', fontSize: 11.5, lineHeight: 1.6 }}>
          <strong>Method:</strong> the most recent three months receive 50%, 30% and 20% weight. The monthly forecast is converted to seven days of demand and given a 15–50% variability/confidence safety buffer. Backtest: {forecast.backtest.samples ? `${forecast.backtest.samples} historical predictions · MAE ${forecast.backtest.meanAbsoluteError} units${forecast.backtest.weightedAbsolutePercentageError === null ? '' : ` · WAPE ${forecast.backtest.weightedAbsolutePercentageError}%`}` : 'not enough historical months yet'}.
        </div>
        <ul style={{ margin: '12px 0 0', paddingLeft: 18, color: '#64748b', fontSize: 11.5, lineHeight: 1.6 }}>{forecast.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
      </div>
    </div>}

    {cityOpportunity && (() => {
      const status = opportunityStatus(cityOpportunity.status);
      const selectedRadius = cityOpportunity.selectedScenario?.radiusKm;
      return <div className="card" style={{ marginBottom: 20, borderColor: '#99f6e4' }}>
        <div className="card-header" style={{ alignItems: 'flex-start', gap: 12 }}>
          <div>
            <span className="card-title">City delivery opportunity{cityOpportunity.city ? ` — ${cityOpportunity.city}` : ''}</span>
            <div style={{ marginTop: 4, fontSize: 11.5, color: '#64748b' }}>
              Privacy-safe delivered-order patterns from the last {cityOpportunity.analysisDays} days. This is market evidence, not guaranteed future orders.
            </div>
          </div>
          <span className="badge" style={{ marginLeft: 'auto', background: status.background, color: status.color }}>{status.label}</span>
        </div>
        <div className="card-body">
          <div className="stats-grid" style={{ marginBottom: 18 }}>
            <MetricCard label="Current Radius" value={`${cityOpportunity.currentRadiusKm} km`} color="#0f766e" note="Your active pharmacy setting" />
            <MetricCard label="Published Zones" value={cityOpportunity.summary.publishedZones.toLocaleString()} color="#0369a1" note={`${cityOpportunity.summary.hiddenZones} low-volume zone${cityOpportunity.summary.hiddenZones === 1 ? '' : 's'} hidden`} />
            <MetricCard label="Inside Radius" value={cityOpportunity.summary.insideRadiusOrders.toLocaleString()} color="#059669" note="Observed delivered city orders" />
            <MetricCard label="Beyond Radius" value={cityOpportunity.summary.outsideRadiusOrders.toLocaleString()} color="#d97706" note="Only from privacy-qualified zones" />
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 10, background: cityOpportunity.status === 'consider_expansion' ? '#ecfdf5' : '#f8fafc', border: `1px solid ${cityOpportunity.status === 'consider_expansion' ? '#a7f3d0' : '#e2e8f0'}`, color: '#334155', fontSize: 12.5, lineHeight: 1.55 }}>
            <strong>Recommendation:</strong> {cityOpportunity.recommendation}
          </div>

          {cityOpportunity.zones.length > 0 ? <div className="table-wrapper" style={{ marginTop: 18 }}>
            <table>
              <thead><tr><th>Privacy-safe zone</th><th>From pharmacy</th><th>Delivered orders</th><th>Units</th><th>Current coverage</th></tr></thead>
              <tbody>{cityOpportunity.zones.slice(0, 12).map((zone, index) => <tr key={`${zone.label}:${zone.distanceKm}:${index}`}>
                <td><strong>{zone.label}</strong></td>
                <td>{zone.distanceKm} km</td>
                <td>{zone.orders}</td>
                <td>{zone.units}</td>
                <td><span className="badge" style={{ background: zone.insideCurrentRadius ? '#dcfce7' : '#ffedd5', color: zone.insideCurrentRadius ? '#166534' : '#9a3412' }}>{zone.insideCurrentRadius ? 'Inside radius' : 'Beyond radius'}</span></td>
              </tr>)}</tbody>
            </table>
          </div> : <EmptyPanel>{cityOpportunity.status === 'missing_location'
            ? 'Confirm the pharmacy city and exact map location to enable this analysis.'
            : `No zone currently meets the privacy threshold of ${cityOpportunity.privacy.minimumOrdersPerZone} delivered orders from at least ${cityOpportunity.privacy.minimumPharmaciesPerZone} pharmacies.`}</EmptyPanel>}

          {cityOpportunity.scenarios.length > 0 && <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 9 }}>Radius scenarios for owner review</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
              {cityOpportunity.scenarios.map((scenario) => {
                const selected = scenario.radiusKm === selectedRadius;
                return <div key={scenario.radiusKm} style={{ border: `1px solid ${selected ? '#14b8a6' : '#e2e8f0'}`, background: selected ? '#f0fdfa' : '#fff', borderRadius: 10, padding: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <strong style={{ color: '#0f172a' }}>{scenario.radiusKm} km radius</strong>
                    {selected && <span className="badge badge-teal">Suggested test</span>}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 11.5, lineHeight: 1.65, marginTop: 7 }}>
                    +{scenario.additionalReachKm} km reach<br />
                    {scenario.opportunityZones} additional zone{scenario.opportunityZones === 1 ? '' : 's'} · {scenario.opportunityOrders} observed orders<br />
                    {scenario.opportunityUnits} units · {scenario.confidence} confidence
                  </div>
                </div>;
              })}
            </div>
          </div>}

          <div style={{ marginTop: 18, padding: '11px 14px', borderRadius: 9, background: '#f8fafc', color: '#475569', fontSize: 11.5, lineHeight: 1.6 }}>
            <strong>Privacy method:</strong> orders are grouped into approximately {cityOpportunity.privacy.gridKm} km zones. A zone is published only after at least {cityOpportunity.privacy.minimumOrdersPerZone} delivered orders from {cityOpportunity.privacy.minimumPharmaciesPerZone} different pharmacies. Exact customer coordinates, addresses and competitor identities never reach this screen.
            {cityOpportunity.periodStart && <div style={{ marginTop: 4 }}>Analysis window: {shortDate(cityOpportunity.periodStart)} to {shortDate(cityOpportunity.periodEnd)}.</div>}
          </div>
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, color: '#64748b', fontSize: 11.5, lineHeight: 1.6 }}>{cityOpportunity.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
        </div>
      </div>;
    })()}

    <div className="card" style={{ marginBottom: 20, borderColor: '#bfdbfe', overflow: 'hidden' }}>
      <div className="card-header" style={{ alignItems: 'flex-start', gap: 12, background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)' }}>
        <div>
          <span className="card-title">Monthly recommendation report</span>
          <div style={{ marginTop: 4, fontSize: 11.5, color: '#64748b', maxWidth: 720 }}>
            A plain-language explanation of measured performance, calculated forecasts and privacy-safe delivery opportunities. Exact values always come from verified source facts shown below each recommendation.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={narrativeLoading}
          onClick={() => void generateNarrative(Boolean(narrativeState?.available))}
          style={{ marginLeft: 'auto', flexShrink: 0 }}
        >
          {narrativeLoading ? 'Preparing report...' : narrativeState?.available ? 'Regenerate report' : 'Generate report'}
        </button>
      </div>

      {narrativeError && <div style={{ margin: '16px 20px 0', padding: '10px 13px', borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 11.5 }}>{narrativeError}</div>}

      {narrativeLoading && !narrativeState?.available ? <EmptyPanel>Preparing the secure report context...</EmptyPanel>
        : !narrativeState?.available ? <div className="card-body">
          <div style={{ padding: '24px', border: '1px dashed #bfdbfe', borderRadius: 12, textAlign: 'center', background: '#f8fbff' }}>
            <div style={{ fontWeight: 750, color: '#1e3a8a' }}>No report has been generated for this analytics version.</div>
            <div style={{ margin: '7px auto 0', maxWidth: 650, color: '#64748b', fontSize: 12, lineHeight: 1.65 }}>
              Generate it once to create a versioned report. If the AI provider is unavailable, DawaConnect immediately creates a rules-based fallback with the same sections and verified evidence.
            </div>
          </div>
        </div> : (() => {
          const record = narrativeState.report;
          const report = record.report;
          const evidence = new Map((record.evidence || []).map((fact) => [fact.key, fact]));
          const methodLabel = record.generationMethod === 'ai' ? 'AI-explained · validated' : 'Rules-based fallback';
          return <div className="card-body">
            {record.generationWarning && <div style={{ marginBottom: 14, padding: '10px 13px', borderRadius: 9, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: 11.5 }}>{record.generationWarning}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <span className="badge" style={{ background: record.generationMethod === 'ai' ? '#dcfce7' : '#fef3c7', color: record.generationMethod === 'ai' ? '#166534' : '#92400e' }}>{methodLabel}</span>
              <span style={{ fontSize: 10.5, color: '#64748b' }}>{record.provider} · {record.model}</span>
              <span style={{ fontSize: 10.5, color: '#94a3b8' }}>Generated {generatedTime(record.generatedAt)}</span>
              <span style={{ fontSize: 10.5, color: '#94a3b8' }}>Prompt {record.promptVersion}</span>
            </div>

            <div style={{ padding: '18px 20px', borderRadius: 12, background: 'linear-gradient(135deg, #0f766e 0%, #1d4ed8 100%)', color: '#fff', marginBottom: 16 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', opacity: 0.78 }}>{record.title}</div>
              <h3 style={{ margin: '8px 0 5px', fontSize: 20, color: '#fff' }}>{report.executiveSummary.headline}</h3>
              <div style={{ fontSize: 12.5, lineHeight: 1.7, opacity: 0.92 }}>{report.executiveSummary.overview}</div>
              <div style={{ marginTop: 4 }}><Evidence factKeys={report.executiveSummary.factKeys} evidence={evidence} /></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14 }}>
              <NarrativeSection title="Sales insights" items={report.salesInsights} evidence={evidence} />
              <NarrativeSection title="Inventory actions" items={report.inventoryActions} evidence={evidence} />
              <NarrativeSection title="Delivery opportunities" items={report.deliveryOpportunities} evidence={evidence} />
              <NarrativeSection title="Risks and limitations" items={report.risksAndLimitations} evidence={evidence} />
              <NarrativeSection title="Next-month action plan" items={report.nextMonthActionPlan} evidence={evidence} />
            </div>

            <div style={{ marginTop: 16, padding: '11px 14px', borderRadius: 9, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontSize: 10.5, lineHeight: 1.6 }}>
              <strong style={{ color: '#475569' }}>Important:</strong> {record.disclaimer}
              {record.generationMethod === 'template' && <div style={{ marginTop: 4 }}>The AI service was not used for this version. The report was created from deterministic DawaConnect rules{record.fallbackReason ? ` (${record.fallbackReason.replaceAll('_', ' ')})` : ''}.</div>}
            </div>
          </div>;
        })()}
    </div>

    <div className="grid-2" style={{ marginBottom: 20 }}>
      <div className="card">
        <div className="card-header"><span className="card-title">Peak ordering hours</span><span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>Pakistan time</span></div>
        {peakHours.some((row) => row.orders > 0) ? <div style={{ padding: '16px 8px 8px' }}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 13 }} />
              <Area type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2} fill="#ede9fe" />
            </AreaChart>
          </ResponsiveContainer>
        </div> : <EmptyPanel>No orders were placed in this month.</EmptyPanel>}
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Order status</span><span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>{statusTotal} placed</span></div>
        <div className="card-body">
          {analytics.statuses.length ? analytics.statuses.map((row) => {
            const percentage = statusTotal ? Math.round((row.count / statusTotal) * 100) : 0;
            return <div key={row.status} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}><span style={{ fontWeight: 600 }}>{row.status}</span><span>{row.count} ({percentage}%)</span></div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${percentage}%`, background: '#14b8a6' }} /></div>
            </div>;
          }) : <EmptyPanel>No orders were placed in this month.</EmptyPanel>}
        </div>
      </div>
    </div>

    <div className="grid-2" style={{ marginBottom: 20 }}>
      <div className="card">
        <div className="card-header"><span className="card-title">Top products</span><span className="badge badge-teal">Delivered units</span></div>
        <div className="card-body" style={{ padding: topProducts.length ? '8px 0' : 0 }}>
          {topProducts.length ? topProducts.map((product, index) => <div key={product.productId || product.name} style={{ padding: '11px 22px', borderBottom: index === topProducts.length - 1 ? 0 : '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
              <div><div style={{ fontWeight: 650, fontSize: 13.5 }}>{product.name}</div><div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{product.orderCount} delivered order{product.orderCount === 1 ? '' : 's'} · {currency(product.revenue)}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ color: '#0f766e', fontWeight: 750 }}>{product.unitsSold} units</div><div style={{ fontSize: 11, color: product.stockStatus === 'healthy' ? '#059669' : '#e11d48' }}>{product.currentStock === null ? 'Stock unavailable' : `${product.currentStock} now in stock`}</div></div>
            </div>
          </div>) : <EmptyPanel>No delivered-product data exists for this month.</EmptyPanel>}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Inventory health now</span><span className="badge badge-warning">Live balance</span></div>
        <div className="card-body">
          {[
            ['Products listed', summary.inventoryProducts, '#334155'],
            ['Available products', summary.activeProducts, '#059669'],
            ['Low-stock products', summary.lowStockProducts, '#d97706'],
            ['Out-of-stock products', summary.outOfStockProducts, '#e11d48'],
          ].map(([label, value, color]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ fontSize: 13 }}>{label}</span><strong style={{ color }}>{value}</strong></div>)}
          <div style={{ marginTop: 16, fontSize: 11.5, lineHeight: 1.6, color: '#64748b' }}>Current inventory is intentionally separated from historical sales. Month-end stock reconstruction becomes available after the inventory ledger has accumulated sufficient history.</div>
        </div>
      </div>
    </div>

    <div className="card">
      <div className="card-header"><span className="card-title">Payment collection</span></div>
      <div className="card-body">
        {analytics.paymentMethods.length ? analytics.paymentMethods.map((payment) => {
          const percentage = summary.grossCollected ? Math.round((payment.amount / summary.grossCollected) * 100) : 0;
          return <div key={payment.method} style={{ marginBottom: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span style={{ fontWeight: 600 }}>{payment.method}</span><span style={{ color: '#0f766e', fontWeight: 700 }}>{currency(payment.amount)} · {percentage}%</span></div><div className="progress-bar"><div className="progress-fill" style={{ width: `${percentage}%`, background: '#0d9488' }} /></div></div>;
        }) : <EmptyPanel>No delivered payments were recorded in this month.</EmptyPanel>}
      </div>
      <div style={{ padding: '0 22px 18px', fontSize: 11.5, color: '#64748b' }}>Gross collected: {currency(summary.grossCollected)} · Product revenue: {currency(summary.productRevenue)} · Delivery fees: {currency(summary.deliveryFees)} · Tax: {currency(summary.tax)}</div>
    </div>

    {dataQuality?.warnings?.length > 0 && <div style={{ marginTop: 18, padding: '14px 18px', borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: 12 }}>
      <strong>Data-quality status</strong>
      <ul style={{ margin: '7px 0 0', paddingLeft: 18 }}>{dataQuality.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </div>}
  </div>;
}
