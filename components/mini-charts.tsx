// Lightweight, server-rendered visuals: ranked bars with direct labels,
// part-to-whole strip, weekday × hour heat map, target ring, delta badge.
// No client JS; hover detail via native titles; values are always printed.
import { cn } from "@/components/ui";
import { SERIES, SERIES_ORDER, TEAL_RAMP, inrShort } from "@/lib/chart-palette";
import { modeLabel, rupees } from "@/lib/money";

/** Ranked horizontal bars — one colour (identity is the row label, not the hue). */
export function BarList({
  items,
  format = rupees,
  color = SERIES.teal,
  max = 8,
  empty = "No data for this period",
}: {
  items: { name: string; value: number }[];
  format?: (n: number) => string;
  color?: string;
  max?: number;
  empty?: string;
}) {
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>;
  const shown = items.slice(0, max);
  const rest = items.slice(max).reduce((s, i) => s + i.value, 0);
  const rows = rest ? [...shown, { name: "Other", value: rest }] : shown;
  const top = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.name} title={`${r.name}: ${format(r.value)} (${total ? Math.round((r.value / total) * 100) : 0}%)`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-slate-700">{r.name}</span>
            <span className="tabular shrink-0 font-semibold text-slate-900">
              {format(r.value)} <span className="font-normal text-slate-400">{total ? Math.round((r.value / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, (r.value / top) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Payment-mode mix: one stacked strip + labelled legend (≤ 4 parts). */
export function ModeMix({ items }: { items: { mode: string; value: number }[] }) {
  const order = ["cash", "upi", "card", "other", "bank", "cheque"];
  const rows = items.filter((i) => i.value > 0).sort((a, b) => order.indexOf(a.mode) - order.indexOf(b.mode));
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) return <p className="py-6 text-center text-sm text-slate-400">No payments in this period</p>;
  const color = (m: string) => SERIES_ORDER[Math.max(0, order.indexOf(m)) % SERIES_ORDER.length];
  return (
    <div>
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-full">
        {rows.map((r) => (
          <div key={r.mode} title={`${modeLabel(r.mode)}: ${rupees(r.value)}`} style={{ width: `${(r.value / total) * 100}%`, background: color(r.mode) }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {rows.map((r) => (
          <li key={r.mode} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color(r.mode) }} />
            <span className="text-slate-600">{modeLabel(r.mode)}</span>
            <span className="tabular ml-auto font-semibold text-slate-900">{Math.round((r.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** When patients arrive: weekday × hour, one-hue ramp, with a scale legend. */
export function Heatmap({ grid, hours }: { grid: number[][]; hours: number[] }) {
  const max = Math.max(1, ...grid.flat());
  const shade = (v: number) => (v === 0 ? "#f8fafc" : TEAL_RAMP[Math.min(TEAL_RAMP.length - 1, 1 + Math.floor((v / max) * (TEAL_RAMP.length - 2)))]);
  const h12 = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px] text-[10px]">
        <thead>
          <tr>
            <th />
            {hours.map((h) => (
              <th key={h} className="font-normal text-slate-400">
                {h12(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, wd) => (
            <tr key={wd}>
              <th className="pr-1 text-right font-medium text-slate-500">{WEEKDAYS[wd]}</th>
              {row.map((v, i) => (
                <td
                  key={i}
                  title={`${WEEKDAYS[wd]} ${h12(hours[i])}: ${v} check-in${v === 1 ? "" : "s"}`}
                  className="h-6 min-w-6 rounded-[4px] text-center font-medium"
                  style={{ background: shade(v), color: v / max > 0.55 ? "white" : "transparent" }}
                >
                  {v || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
        Fewer
        {TEAL_RAMP.slice(1).map((c) => (
          <span key={c} className="h-2.5 w-4 rounded-sm" style={{ background: c }} />
        ))}
        More
      </div>
    </div>
  );
}

/** Progress toward a target, with the projected month-end marked. */
export function TargetRing({ value, target, projected, size = 132 }: { value: number; target: number; projected?: number; size?: number }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const pct = target ? Math.min(1, value / target) : 0;
  const proj = target && projected ? Math.min(1, projected / target) : 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={10} />
        {proj > pct && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={SERIES.teal} strokeOpacity={0.25} strokeWidth={10} strokeDasharray={`${proj * c} ${c}`} strokeLinecap="round" />
        )}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={SERIES.teal} strokeWidth={10} strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="tabular text-2xl font-bold text-slate-900">{Math.round(pct * 100)}%</span>
        <span className="text-[10px] text-slate-500">of {inrShort(target)}</span>
      </div>
    </div>
  );
}

/** ▲ 12% / ▼ 4% vs previous period. `goodWhenUp=false` for costs. */
export function Delta({ pct, goodWhenUp = true, suffix = "vs last month" }: { pct: number | null; goodWhenUp?: boolean; suffix?: string }) {
  if (pct == null) return <span className="text-[11px] text-slate-400">No previous data</span>;
  const up = pct >= 0;
  const good = up === goodWhenUp;
  return (
    <span className={cn("text-[11px] font-medium", pct === 0 ? "text-slate-500" : good ? "text-emerald-700" : "text-rose-600")}>
      {pct === 0 ? "→" : up ? "▲" : "▼"} {Math.abs(pct)}% <span className="font-normal text-slate-400">{suffix}</span>
    </span>
  );
}
