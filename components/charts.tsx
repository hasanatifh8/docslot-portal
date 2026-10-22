"use client";

// Interactive charts (Recharts). One y-axis per chart, thin marks, 4px rounded
// bar ends, recessive grid, legend whenever there are 2+ series, hover tooltip
// on every mark. Money arrives in paise.
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { INK, SERIES, inrShort } from "@/lib/chart-palette";
import { rupees } from "@/lib/money";

const dayTick = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const dayLong = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const axis = { stroke: INK.grid, tick: { fill: INK.muted, fontSize: 11 }, tickLine: false, axisLine: false } as const;

function TipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string; dashed?: boolean }[] }) {
  return (
    <div className="rounded-xl bg-white/95 px-3 py-2 text-xs shadow-xl ring-1 ring-slate-900/10 backdrop-blur">
      <div className="mb-1 font-semibold text-slate-900">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 py-0.5">
          {r.color && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.dashed ? "transparent" : r.color, border: r.dashed ? `2px dashed ${r.color}` : undefined }} />}
          <span className="text-slate-500">{r.label}</span>
          <span className="tabular ml-auto pl-4 font-semibold text-slate-900">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function LegendRow({ items }: { items: { label: string; color: string; dashed?: boolean; band?: boolean }[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-4 rounded-sm"
            style={i.dashed ? { borderTop: `2px dashed ${i.color}`, height: 0, marginTop: 2 } : i.band ? { background: i.color, opacity: 0.25 } : { background: i.color }}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ─── Daily money with forecast ─────────────────────────────────────────────

export type MoneyPoint = { date: string; actual?: number | null; forecast?: number | null; low?: number | null; high?: number | null };

/** Bars = what actually came in; dashed line + band = forecast and its likely range. */
export function MoneyTrendChart({ data, height = 260, label = "Collected" }: { data: MoneyPoint[]; height?: number; label?: string }) {
  const rows = data.map((d) => ({ ...d, band: d.low != null && d.high != null ? [d.low, d.high] : null }));
  const hasForecast = data.some((d) => d.forecast != null);
  return (
    <div>
      <LegendRow
        items={[
          { label, color: SERIES.teal },
          ...(hasForecast ? [{ label: "Forecast", color: SERIES.teal, dashed: true }, { label: "Likely range", color: SERIES.teal, band: true }] : []),
        ]}
      />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={INK.grid} strokeDasharray="0" />
            <XAxis dataKey="date" tickFormatter={dayTick} {...axis} minTickGap={24} />
            <YAxis tickFormatter={inrShort} {...axis} width={52} />
            <Tooltip
              cursor={{ fill: "rgb(15 148 136 / 0.06)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as MoneyPoint;
                return (
                  <TipBox
                    title={dayLong(p.date)}
                    rows={[
                      ...(p.actual != null ? [{ label, value: rupees(p.actual), color: SERIES.teal }] : []),
                      ...(p.forecast != null ? [{ label: "Forecast", value: rupees(p.forecast), color: SERIES.teal, dashed: true }] : []),
                      ...(p.low != null && p.high != null ? [{ label: "Likely range", value: `${inrShort(p.low)} – ${inrShort(p.high)}` }] : []),
                    ]}
                  />
                );
              }}
            />
            <Area dataKey="band" stroke="none" fill={SERIES.teal} fillOpacity={0.12} isAnimationActive={false} connectNulls={false} />
            <Bar dataKey="actual" fill={SERIES.teal} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line dataKey="forecast" stroke={SERIES.teal} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Revenue vs expenses by month ──────────────────────────────────────────

export type MonthPoint = { month: string; label: string; collected: number; expenses: number; profit: number };

export function RevenueExpenseChart({ data, height = 280 }: { data: MonthPoint[]; height?: number }) {
  return (
    <div>
      <LegendRow
        items={[
          { label: "Collected", color: SERIES.teal },
          { label: "Expenses", color: SERIES.orange },
        ]}
      />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={INK.grid} />
            <XAxis dataKey="label" {...axis} />
            <YAxis tickFormatter={inrShort} {...axis} width={52} />
            <Tooltip
              cursor={{ fill: "rgb(15 23 42 / 0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as MonthPoint;
                const margin = p.collected ? Math.round((p.profit / p.collected) * 100) : 0;
                return (
                  <TipBox
                    title={new Date(`${p.month}-15T12:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}
                    rows={[
                      { label: "Collected", value: rupees(p.collected), color: SERIES.teal },
                      { label: "Expenses", value: rupees(p.expenses), color: SERIES.orange },
                      { label: `Net profit (${margin}%)`, value: rupees(p.profit) },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="collected" fill={SERIES.teal} radius={[4, 4, 0, 0]} maxBarSize={26} />
            <Bar dataKey="expenses" fill={SERIES.orange} radius={[4, 4, 0, 0]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Patient volume: new vs follow-up, with forecast ───────────────────────

export type VolumePoint = { date: string; newVisits?: number | null; followUps?: number | null; forecast?: number | null; low?: number | null; high?: number | null };

export function VolumeChart({ data, height = 260 }: { data: VolumePoint[]; height?: number }) {
  const rows = data.map((d) => ({ ...d, band: d.low != null && d.high != null ? [d.low, d.high] : null }));
  const hasForecast = data.some((d) => d.forecast != null);
  return (
    <div>
      <LegendRow
        items={[
          { label: "New patients", color: SERIES.teal },
          { label: "Follow-ups", color: SERIES.violet },
          ...(hasForecast ? [{ label: "Forecast", color: SERIES.orange, dashed: true }] : []),
        ]}
      />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={INK.grid} />
            <XAxis dataKey="date" tickFormatter={dayTick} {...axis} minTickGap={24} />
            <YAxis allowDecimals={false} {...axis} width={32} />
            <Tooltip
              cursor={{ fill: "rgb(15 23 42 / 0.04)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as VolumePoint;
                return (
                  <TipBox
                    title={dayLong(p.date)}
                    rows={[
                      ...(p.newVisits != null ? [{ label: "New patients", value: String(p.newVisits), color: SERIES.teal }] : []),
                      ...(p.followUps != null ? [{ label: "Follow-ups", value: String(p.followUps), color: SERIES.violet }] : []),
                      ...(p.forecast != null ? [{ label: "Forecast", value: `${p.forecast} (${p.low}–${p.high})`, color: SERIES.orange, dashed: true }] : []),
                    ]}
                  />
                );
              }}
            />
            <Area dataKey="band" stroke="none" fill={SERIES.orange} fillOpacity={0.1} isAnimationActive={false} />
            <Bar dataKey="newVisits" stackId="v" fill={SERIES.teal} maxBarSize={22} />
            <Bar dataKey="followUps" stackId="v" fill={SERIES.violet} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line dataKey="forecast" stroke={SERIES.orange} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

