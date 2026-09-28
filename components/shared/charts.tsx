"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber, formatPercent, formatRwf } from "@/lib/utils/format";

/* ═══════════════════════════════════════════════════════════════════
   Shared Recharts wrappers. Light/dark aware, responsive, and
   keyboard-accessible via a visually hidden data table fallback.
   ═══════════════════════════════════════════════════════════════════ */

const CHART_COLORS = [
  "var(--color-orange)",
  "var(--color-navy)",
  "var(--color-green)",
  "var(--color-amber)",
  "var(--color-navy-2)",
];

const AXIS = {
  stroke: "var(--color-ink-2)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

function ChartFrame({
  children,
  height = 260,
  label,
  table,
}: {
  children: React.ReactElement;
  height?: number;
  label: string;
  table?: React.ReactNode;
}) {
  return (
    <figure className="m-0 w-full">
      <div style={{ height }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
      {table ? (
        <details className="mt-2 no-print">
          <summary className="cursor-pointer text-xs text-ink-2 hover:text-ink">
            View data table
          </summary>
          <div className="mt-2 overflow-x-auto">{table}</div>
        </details>
      ) : null}
    </figure>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v: number) => formatNumber(v),
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string | number }>;
  label?: string | number;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-popover px-3 py-2 shadow-md">
      {label !== undefined ? (
        <p className="mb-1 text-xs font-medium text-ink">{String(label)}</p>
      ) : null}
      <ul className="space-y-0.5">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-ink-2">{entry.name}</span>
            <span className="ml-auto font-mono text-ink">
              {typeof entry.value === "number" ? valueFormatter(entry.value) : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({
  data,
  height = 40,
  label = "Trend",
  stroke = "var(--color-orange)",
}: {
  data: number[];
  height?: number;
  label?: string;
  stroke?: string;
}) {
  const points = React.useMemo(
    () => data.map((v, i) => ({ i, v })),
    [data],
  );
  if (points.length < 2) return <div style={{ height }} />;
  return (
    <div style={{ height }} role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface SimpleDatum {
  label: string;
  value: number;
}

export function BarTrendChart({
  data,
  height = 260,
  valueFormatter = formatNumber,
  color = "var(--color-orange)",
  showLegend = false,
  seriesKeys,
  valueLabel = "Value",
}: {
  data: Array<Record<string, string | number>>;
  height?: number;
  valueFormatter?: (v: number) => string;
  color?: string;
  showLegend?: boolean;
  seriesKeys?: string[];
  valueLabel?: string;
}) {
  const keys = seriesKeys ?? Object.keys(data[0] ?? {}).filter((k) => k !== "label");
  return (
    <ChartFrame height={height} label={`${valueLabel} by label`}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
        <YAxis {...AXIS} width={44} tickFormatter={(v) => valueFormatter(Number(v))} />
        <Tooltip
          cursor={{ fill: "var(--color-muted)" }}
          content={<ChartTooltip valueFormatter={valueFormatter} />}
        />
        {showLegend ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
        {keys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={keys.length === 1 ? color : CHART_COLORS[i % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
          />
        ))}
      </BarChart>
    </ChartFrame>
  );
}

export function CategoryPieChart({
  data,
  height = 260,
  valueLabel = "Trainees",
  colors = CHART_COLORS,
}: {
  data: SimpleDatum[];
  height?: number;
  valueLabel?: string;
  colors?: string[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ChartFrame height={height} label={`${valueLabel} by category`}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="55%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="var(--color-card)"
          strokeWidth={2}
        >
          {data.map((entry, i) => (
            <Cell key={entry.label} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip valueFormatter={(v) => `${formatNumber(v)} (${formatPercent(total ? v / total : 0)})`} />} />
        <Legend
          verticalAlign="bottom"
          height={44}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ChartFrame>
  );
}

export function RevenueAreaChart({
  data,
  height = 280,
}: {
  data: Array<{ month: string; collected: number; invoiced: number }>;
  height?: number;
}) {
  return (
    <ChartFrame height={height} label="Revenue collected versus invoiced by month">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="grad-collected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-orange)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-orange)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="month" {...AXIS} />
        <YAxis
          {...AXIS}
          width={56}
          tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
        />
        <Tooltip
          content={<ChartTooltip valueFormatter={formatRwf} />}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="invoiced"
          name="Invoiced"
          stroke="var(--color-navy)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          fill="transparent"
        />
        <Area
          type="monotone"
          dataKey="collected"
          name="Collected"
          stroke="var(--color-orange)"
          strokeWidth={2}
          fill="url(#grad-collected)"
        />
      </AreaChart>
    </ChartFrame>
  );
}

export function PassRateBarChart({
  data,
  height = 280,
}: {
  data: Array<{ label: string; passRate: number; averageScore: number }>;
  height?: number;
}) {
  return (
    <ChartFrame height={height} label="Pass rate and average score by course">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 0, left: 8 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" domain={[0, 100]} {...AXIS} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="label" {...AXIS} width={150} />
        <Tooltip
          cursor={{ fill: "var(--color-muted)" }}
          content={<ChartTooltip valueFormatter={(v) => `${formatNumber(v)}%`} />}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="passRate" name="Pass rate" fill="var(--color-orange)" radius={[0, 4, 4, 0]} maxBarSize={18} />
        <Bar dataKey="averageScore" name="Average score" fill="var(--color-navy)" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ChartFrame>
  );
}

export function LineTrendChart({
  data,
  height = 240,
  valueKey = "value",
  valueFormatter = formatNumber,
  seriesKeys,
  valueLabel = "Value",
}: {
  data: Array<Record<string, string | number>>;
  height?: number;
  valueKey?: string;
  valueFormatter?: (v: number) => string;
  seriesKeys?: string[];
  valueLabel?: string;
}) {
  const keys = seriesKeys ?? [valueKey];
  return (
    <ChartFrame height={height} label={`${valueLabel} over time`}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} width={44} tickFormatter={(v) => valueFormatter(Number(v))} />
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
        {keys.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
        {keys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={key}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ChartFrame>
  );
}
