// Short-term forecasting for daily volumes (visits, collections). Pure module.
//
// Hospital OPD demand is dominated by the day of the week (Mondays are busy,
// Sundays quiet) plus a slower trend. The model is deliberately simple and
// explainable to a hospital owner:
//   forecast(day) = average of the last N same-weekday values × trend
//   trend         = last 28 days ÷ previous 28 days (clamped to ±25 %)
//   range         = ± 1.28 × spread of those same-weekday values (≈ 80 % band)
// Closed days (holidays, no OPD hours) forecast to zero.

export type Point = { date: string; value: number };
export type ForecastPoint = { date: string; value: number; low: number; high: number; closed?: boolean };

const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stdev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function nextDates(from: string, n: number) {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00Z`);
  for (let i = 0; i < n; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Trend multiplier from the last 8 weeks (1 = flat). */
export function trendFactor(history: Point[]) {
  const vals = history.map((p) => p.value);
  if (vals.length < 56) return 1;
  const recent = mean(vals.slice(-28));
  const prior = mean(vals.slice(-56, -28));
  if (prior <= 0) return 1;
  return Math.min(1.25, Math.max(0.8, recent / prior));
}

export function forecast(history: Point[], dates: string[], opts: { closed?: Set<string>; weeks?: number } = {}): ForecastPoint[] {
  const weeks = opts.weeks ?? 6;
  const trend = trendFactor(history);
  // Ignore leading zero-only stretch (before the hospital went live).
  const firstActive = history.findIndex((p) => p.value > 0);
  const usable = firstActive < 0 ? [] : history.slice(firstActive);
  const byWeekday = new Map<number, number[]>();
  for (const p of usable) {
    const wd = weekday(p.date);
    const arr = byWeekday.get(wd) ?? [];
    arr.push(p.value);
    byWeekday.set(wd, arr);
  }
  return dates.map((date) => {
    if (opts.closed?.has(date)) return { date, value: 0, low: 0, high: 0, closed: true };
    const same = (byWeekday.get(weekday(date)) ?? []).slice(-weeks);
    // Never open on this weekday (e.g. Sunday OPD closed) → no forecast.
    if (!same.length || same.every((v) => v === 0)) return { date, value: 0, low: 0, high: 0, closed: true };
    const base = mean(same) * trend;
    const spread = 1.28 * stdev(same);
    return { date, value: Math.round(base), low: Math.max(0, Math.round(base - spread)), high: Math.round(base + spread) };
  });
}

/** % change, or null when there's no baseline. */
export function pctChange(now: number, before: number) {
  // A % change against zero or a loss isn't meaningful (e.g. "−1089 %").
  if (!before || before < 0) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}
