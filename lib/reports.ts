// Report window parsing shared by the reports page and the CSV export.
import { fromZonedTime } from "date-fns-tz";
import { dayRange } from "@/lib/format";

export const PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
] as const;

export function reportWindow(tz: string, sp: { range?: string; from?: string; to?: string }) {
  const today = dayRange(tz).day;
  const back = (n: number) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  let from = today;
  let to = today;
  let range: string = sp.range ?? "7d";
  if (ok(sp.from) && ok(sp.to)) {
    from = sp.from! <= sp.to! ? sp.from! : sp.to!;
    to = sp.from! <= sp.to! ? sp.to! : sp.from!;
    range = "custom";
  } else if (range === "today") from = today;
  else if (range === "30d") from = back(29);
  else if (range === "month") from = `${today.slice(0, 8)}01`;
  else {
    range = "7d";
    from = back(6);
  }
  const start = fromZonedTime(`${from}T00:00:00`, tz);
  const end = new Date(fromZonedTime(`${to}T00:00:00`, tz).getTime() + 24 * 3600_000);
  const days: string[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
  return { from, to, start, end, range, days };
}

export const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
export const mins = (a: Date | null, b: Date | null) => (a && b ? (b.getTime() - a.getTime()) / 60_000 : null);
