// Lab report presentation: flags, trend sparklines, AI insights, panel tables.
// Server-safe (no client JS).
import { AlertTriangle, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Sparkles } from "@/components/icons";
import { Badge, cn } from "@/components/ui";
import { FLAG_LABEL, isAbnormal, isCritical, panelLabel, type LabFlag, type LabInsights } from "@/lib/labs";
import { SERIES } from "@/lib/chart-palette";

const FLAG_STYLE: Record<string, string> = {
  normal: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  low: "bg-amber-50 text-amber-800 ring-amber-600/25",
  high: "bg-amber-50 text-amber-800 ring-amber-600/25",
  abnormal: "bg-amber-50 text-amber-800 ring-amber-600/25",
  critical_low: "bg-rose-600 text-white ring-rose-600",
  critical_high: "bg-rose-600 text-white ring-rose-600",
  unknown: "bg-slate-50 text-slate-400 ring-slate-200",
};

export function FlagChip({ flag }: { flag: string }) {
  const Icon = flag === "low" || flag === "critical_low" ? ArrowDown : flag === "high" || flag === "critical_high" ? ArrowUp : null;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", FLAG_STYLE[flag] ?? FLAG_STYLE.unknown)}>
      {Icon && <Icon className="h-3 w-3" />}
      {FLAG_LABEL[flag as LabFlag] ?? flag}
    </span>
  );
}

export function ReportStatus({ status }: { status: string }) {
  if (status === "ready") return <Badge tone="green">read</Badge>;
  if (status === "processing") return <Badge tone="brand">reading…</Badge>;
  if (status === "failed") return <Badge tone="red">couldn&apos;t read</Badge>;
  return <Badge tone="slate">original only</Badge>;
}

/** Tiny trend line, oldest → newest, with the reference band shaded. */
export function Sparkline({ values, low, high, width = 96, height = 28 }: { values: (number | null)[]; low: number | null; high: number | null; width?: number; height?: number }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (pts.length < 2) return <span className="text-[10px] text-slate-300">—</span>;
  const all = [...pts.map((p) => p.v), ...(low != null ? [low] : []), ...(high != null ? [high] : [])];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => 3 + (i / Math.max(1, values.length - 1)) * (width - 6);
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} role="img" aria-label={`Trend: ${pts.map((p) => p.v).join(", ")}`}>
      {low != null && high != null && <rect x={0} y={y(high)} width={width} height={Math.max(1, y(low) - y(high))} fill={SERIES.teal} opacity={0.1} rx={2} />}
      <polyline points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")} fill="none" stroke={SERIES.teal} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={3} fill={SERIES.teal} stroke="white" strokeWidth={1.5} />
    </svg>
  );
}

const SEVERITY = {
  urgent: { box: "bg-rose-50 ring-rose-300", dot: "bg-rose-600", label: "Urgent" },
  attention: { box: "bg-amber-50 ring-amber-200", dot: "bg-amber-500", label: "Needs attention" },
  info: { box: "bg-slate-50 ring-slate-200", dot: "bg-slate-400", label: "Note" },
};

export function InsightsCard({ insights, model }: { insights: LabInsights; model?: string | null }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-br from-violet-50 to-white p-4 ring-1 ring-violet-200/70">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-md">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[11px] font-semibold tracking-wide text-violet-800 uppercase">At a glance</div>
          <p className="mt-0.5 text-base leading-snug font-semibold text-slate-900">{insights.headline}</p>
        </div>
      </div>
      {insights.nameMismatch && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 ring-1 ring-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {insights.nameMismatch}
        </div>
      )}
      {insights.keyFindings.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Key findings</div>
          <ul className="space-y-2">
            {insights.keyFindings.map((f, i) => {
              const s = SEVERITY[f.severity] ?? SEVERITY.info;
              return (
                <li key={i} className={cn("rounded-xl p-3 ring-1", s.box)}>
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", s.dot)} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-900">{f.finding}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {s.label}
                        {f.tests.length > 0 && ` · ${f.tests.join(", ")}`}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {insights.patterns.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">Consistent with</div>
            <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700">
              {insights.patterns.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {insights.followUp.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">Consider</div>
            <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700">
              {insights.followUp.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="text-[11px] leading-snug text-slate-400">
        AI-extracted by {model ?? "Claude"} as decision support for a qualified doctor — verify against the original report before acting. Values are copied as printed; flags are re-checked against the printed reference ranges.
      </p>
    </div>
  );
}

export type ResultRow = {
  id: string;
  panel: string;
  test: string;
  testOnReport: string | null;
  value: string;
  numeric: number | null;
  unit: string | null;
  refText: string | null;
  flag: string;
  page: number | null;
  previous?: { value: string; numeric: number | null; date: string } | null;
};

/** Results grouped by panel in clinical order; abnormal rows stand out. */
export function ResultsByPanel({ rows, fileHref }: { rows: ResultRow[]; fileHref?: string }) {
  const panels = [...new Set(rows.map((r) => r.panel))];
  return (
    <div className="space-y-5">
      {panels.map((panel) => {
        const list = rows.filter((r) => r.panel === panel);
        const abnormal = list.filter((r) => isAbnormal(r.flag)).length;
        return (
          <section key={panel}>
            <div className="mb-1.5 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{panelLabel(panel)}</h3>
              <span className="text-xs text-slate-400">{list.length} tests</span>
              {abnormal > 0 && <Badge tone="amber">{abnormal} abnormal</Badge>}
            </div>
            <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80">
                  <tr className="text-left text-[11px] tracking-wide text-slate-500 uppercase">
                    <th className="px-3 py-2 font-medium">Test</th>
                    <th className="px-3 py-2 text-right font-medium">Result</th>
                    <th className="px-3 py-2 font-medium">Reference</th>
                    <th className="px-3 py-2 font-medium">Flag</th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell">Previous</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id} className={cn("border-t border-slate-100", isCritical(r.flag) ? "bg-rose-50/70" : isAbnormal(r.flag) && "bg-amber-50/40")}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{r.test}</div>
                        {r.testOnReport && r.testOnReport.toLowerCase() !== r.test.toLowerCase() && <div className="text-[11px] text-slate-400">as “{r.testOnReport}”</div>}
                      </td>
                      <td className={cn("tabular px-3 py-2 text-right whitespace-nowrap", isAbnormal(r.flag) ? "font-bold text-slate-900" : "text-slate-700")}>
                        {r.value} <span className="text-xs font-normal text-slate-400">{r.unit}</span>
                      </td>
                      <td className="tabular px-3 py-2 text-xs whitespace-nowrap text-slate-500">{r.refText ?? "—"}</td>
                      <td className="px-3 py-2">
                        <FlagChip flag={r.flag} />
                      </td>
                      <td className="hidden px-3 py-2 text-xs whitespace-nowrap text-slate-500 md:table-cell">
                        {r.previous ? (
                          <span className="inline-flex items-center gap-1">
                            <Change now={r.numeric} prev={r.previous.numeric} />
                            {r.previous.value} <span className="text-slate-400">· {r.previous.date}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                        {fileHref && r.page && (
                          <a href={`${fileHref}#page=${r.page}`} target="_blank" rel="noreferrer" className="ml-2 text-brand-600 hover:underline">
                            p.{r.page}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Change({ now, prev }: { now: number | null; prev: number | null }) {
  if (now == null || prev == null) return null;
  if (now === prev) return <Minus className="h-3 w-3 text-slate-400" aria-label="unchanged" />;
  return now > prev ? <ArrowUp className="h-3 w-3 text-slate-500" aria-label="up from" /> : <ArrowDown className="h-3 w-3 text-slate-500" aria-label="down from" />;
}
