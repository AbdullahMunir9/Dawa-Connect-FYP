import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn, formatCompact, formatMoney, formatNumber } from "../../lib/format";

const SERIES = { 1: "var(--chart-1)", 2: "var(--chart-2)", 3: "var(--chart-3)" };

export function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-float">
      <p className="mb-1 font-semibold text-ink">{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center justify-between gap-4 text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: entry.color || entry.fill }} />{entry.name}</span>
          <span className="tabular font-medium text-ink">{formatter ? formatter(entry.value, entry.dataKey) : formatNumber(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** Single-series area chart for change-over-time (orders or revenue per day). */
export function TrendChart({ data, dataKey, name, money = false, height = 240, series = 1 }) {
  const color = SERIES[series];
  const id = `grad-${dataKey}`;
  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={28} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} tickFormatter={(value) => new Date(value).toLocaleDateString("en", { day: "numeric", month: "short" })} />
          <YAxis axisLine={false} tickLine={false} width={44} allowDecimals={false} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} tickFormatter={(value) => (money ? formatCompact(value) : value)} />
          <Tooltip cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} content={<ChartTooltip formatter={(v) => (money ? formatMoney(v) : formatNumber(v))} labelFormatter={(l) => new Date(l).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })} />} />
          <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} fill={`url(#${id})`} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars for a categorical magnitude (one hue). */
export function CategoryBars({ data, categoryKey, valueKey, name, height, money = false }) {
  const h = height || Math.max(120, data.length * 34 + 16);
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 4, bottom: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} tickFormatter={(v) => (money ? formatCompact(v) : v)} />
          <YAxis type="category" dataKey={categoryKey} axisLine={false} tickLine={false} width={104} tick={{ fill: "var(--ink-2)", fontSize: 12 }} />
          <Tooltip cursor={{ fill: "color-mix(in oklab, var(--ink) 5%, transparent)" }} content={<ChartTooltip formatter={(v) => (money ? formatMoney(v) : formatNumber(v))} />} />
          <Bar dataKey={valueKey} name={name} fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Compact HTML bar list – best for status breakdowns and top-N rankings. */
export function BarList({ items, total, valueFormatter = formatNumber, colorOf, className, emptyText = "No data yet" }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const sum = total ?? items.reduce((s, i) => s + i.value, 0);
  if (!items.length) return <p className={cn("py-6 text-center text-sm text-subtle", className)}>{emptyText}</p>;
  return (
    <ul className={cn("space-y-2.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="group">
          <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
            <span className="inline-flex min-w-0 items-center gap-2 text-ink-2">
              {item.icon && <item.icon className="h-3.5 w-3.5 shrink-0 text-muted" />}
              <span className="truncate">{item.label}</span>
              {item.tag}
            </span>
            <span className="tabular shrink-0 font-medium text-ink">{valueFormatter(item.value)}{sum > 0 && <span className="ml-1.5 text-[11px] font-normal text-subtle">{Math.round((item.value / sum) * 100)}%</span>}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(item.value / max) * 100}%`, background: colorOf ? colorOf(item) : "var(--chart-1)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
