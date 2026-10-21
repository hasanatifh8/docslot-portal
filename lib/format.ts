import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmt(instant: Date, tz: string, pattern: string) {
  return formatInTimeZone(instant, tz, pattern);
}

export function statusBadge(status: string) {
  switch (status) {
    case "booked":
      return "bg-emerald-100 text-emerald-800";
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "completed":
      return "bg-slate-200 text-slate-700";
    case "no_show":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

/** [start, end) of a calendar day in the hospital's timezone. Defaults to today. */
export function dayRange(tz: string, dateStr?: string) {
  const day = dateStr ?? formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const start = fromZonedTime(`${day}T00:00:00`, tz);
  return { day, start, end: new Date(start.getTime() + 24 * 3600_000) };
}

/** Date-only columns are stored as UTC midnight. */
export function parseDateOnly(s: string | null | undefined) {
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null;
}

export function dateOnlyValue(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}
