"use client";

import type { ReactElement } from "react";
import { Activity, BarChart, DollarSign, Percent, TrendingDown, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PanelProps } from "@hewa/app-shell";
import { KeyValues, Panel } from "./primitives";

interface Indicator {
  id: string;
  label: string;
  value: string;
  caption: string;
  tint: string;
  trend?: "up" | "down";
}

const KES_PER_USD = 153.25;
const KES_CHANGE = 0.15;
const INFLATION = 6.8;
const GDP_GROWTH = 5.1;
const UNEMPLOYMENT = 12.8;

const INDICATORS: Indicator[] = [
  {
    id: "fx",
    label: "KES/USD",
    value: KES_PER_USD.toFixed(2),
    caption: `+${KES_CHANGE}%`,
    tint: "text-green-400",
    trend: "up",
  },
  {
    id: "cpi",
    label: "Inflation",
    value: `${INFLATION}%`,
    caption: "Year over year",
    tint: "text-red-400",
    trend: "down",
  },
  {
    id: "gdp",
    label: "GDP growth",
    value: `${GDP_GROWTH}%`,
    caption: "Q4 2025",
    tint: "text-blue-400",
  },
  {
    id: "jobs",
    label: "Unemployment",
    value: `${UNEMPLOYMENT}%`,
    caption: "National rate",
    tint: "text-orange-400",
  },
];

const GDP_SERIES = [
  { month: "Jan", value: 9.2 },
  { month: "Feb", value: 9.5 },
  { month: "Mar", value: 9.8 },
  { month: "Apr", value: 10.1 },
  { month: "May", value: 10.4 },
  { month: "Jun", value: 10.2 },
  { month: "Jul", value: 10.5 },
  { month: "Aug", value: 10.8 },
  { month: "Sep", value: 11.0 },
  { month: "Oct", value: 11.2 },
  { month: "Nov", value: 11.5 },
  { month: "Dec", value: 11.8 },
];

const SECTORS = [
  { name: "Agriculture", value: 35 },
  { name: "Services", value: 45 },
  { name: "Industry", value: 20 },
];

const SECTOR_COLOURS = ["#3b82f6", "#22c55e", "#f59e0b"];

const RAIL: Record<string, { title: string; rows: { label: string; value: string }[] }> = {
  overview: {
    title: "Overview",
    rows: [
      { label: "GDP growth", value: "5.2%" },
      { label: "Inflation", value: "4.3%" },
      { label: "Unemployment", value: "5.5%" },
    ],
  },
  currency: {
    title: "Currency",
    rows: [
      { label: "KES/USD", value: "153.45" },
      { label: "KES/EUR", value: "168.20" },
      { label: "KES/GBP", value: "195.30" },
    ],
  },
  gdp: { title: "GDP", rows: [{ label: "Latest quarter", value: "11.8 B USD" }] },
  trade: { title: "Trade", rows: [{ label: "Balance", value: "-2.4 B USD" }] },
  markets: { title: "Markets", rows: [{ label: "NSE 20", value: "1,842.15" }] },
};

export function EconomyRailPanel({ item }: PanelProps): ReactElement {
  const entry = RAIL[item ?? "overview"] ?? RAIL["overview"];
  return (
    <Panel title={entry?.title ?? "Economy"}>
      <KeyValues rows={entry?.rows ?? []} />
    </Panel>
  );
}

/**
 * The main column. The chart colours are the literal hexes recharts needs: SVG
 * `stroke` and `fill` attributes take no Tailwind class, and a chart drawn in
 * theme-token greys is a chart that cannot be themed without rewriting it.
 */
export function EconomicIndicators(): ReactElement {
  const axis = { stroke: "#64748b", fontSize: 12 };
  const tooltip = {
    contentStyle: { backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 },
    labelStyle: { color: "#f1f5f9" },
  };

  return (
    <div className="h-full overflow-auto bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <BarChart className="h-5 w-5 text-cyan-400" />
        <h1 className="text-lg font-semibold text-ink">Economic indicators</h1>
      </header>

      <div className="p-4">
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {INDICATORS.map((indicator) => (
            <article
              key={indicator.id}
              className="rounded-lg border border-line bg-surface-raised p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-ink-muted">{indicator.label}</span>
                <span className={indicator.tint}>
                  {indicator.id === "fx" ? (
                    <DollarSign className="h-4 w-4" />
                  ) : indicator.id === "gdp" ? (
                    <Activity className="h-4 w-4" />
                  ) : (
                    <Percent className="h-4 w-4" />
                  )}
                </span>
              </div>
              <p className="text-xl font-bold text-ink">{indicator.value}</p>
              <p className={`mt-1 flex items-center gap-1 text-xs ${indicator.tint}`}>
                {indicator.trend === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : indicator.trend === "down" ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                {indicator.caption}
              </p>
            </article>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Chart title="GDP growth (billions USD)">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={GDP_SERIES}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" {...axis} />
                <YAxis {...axis} />
                <Tooltip {...tooltip} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Chart>

          <Chart title="GDP by sector">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={SECTORS}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name ?? ""}: ${String(value ?? "")}%`}
                >
                  {SECTORS.map((sector, index) => (
                    <Cell key={sector.name} fill={SECTOR_COLOURS[index % SECTOR_COLOURS.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltip} />
              </PieChart>
            </ResponsiveContainer>
          </Chart>
        </div>
      </div>
    </div>
  );
}

function Chart({ title, children }: { title: string; children: ReactElement }): ReactElement {
  return (
    <article className="rounded-lg border border-line bg-surface-raised p-4">
      <h2 className="mb-4 text-sm font-medium text-ink">{title}</h2>
      <div className="h-64">{children}</div>
    </article>
  );
}

export function ForecastPanel(): ReactElement {
  return (
    <Panel title="Forecasts">
      <KeyValues
        rows={[
          { label: "GDP growth 2026", value: "5.4%" },
          { label: "Inflation 2026", value: "6.2%" },
          { label: "KES/USD 2026", value: "156.00" },
        ]}
      />
    </Panel>
  );
}
