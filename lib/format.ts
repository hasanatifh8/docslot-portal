import { formatInTimeZone } from "date-fns-tz";

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
