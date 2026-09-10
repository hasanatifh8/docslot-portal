import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";

// ─── Types ─────────────────────────────────────────────────────────────────

export type WorkingWindow = { weekday: number; startMin: number; endMin: number };

export type BusyInterval = { startAt: Date; endAt: Date };

export type SlotEngineInput = {
  timezone: string;
  slotMinutes: number;
  bufferMinutes: number;
  workingHours: WorkingWindow[];
  /** "yyyy-MM-dd" (clinic-local) */
  date: string;
  /** existing booked appointments for this doctor */
  busy: BusyInterval[];
  /** clinic-local dates that are full-day closures, as "yyyy-MM-dd" */
  holidays: string[];
  /** now, for filtering past slots (defaults to new Date()) */
  now?: Date;
  /** minimum minutes between now and a bookable slot */
  minLeadMinutes?: number;
};

export type Slot = {
  startAt: Date;
  endAt: Date;
  /** e.g. "09:30" clinic-local */
  label: string;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");

/** minutes-from-midnight -> "HH:mm" */
export function minToHHMM(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/** Build a UTC Date from a clinic-local date + minutes-from-midnight. */
export function localToUtc(date: string, minutes: number, timezone: string): Date {
  const wall = `${date}T${minToHHMM(minutes)}:00`;
  return fromZonedTime(wall, timezone);
}

/** Clinic-local "yyyy-MM-dd" for a given instant. */
export function localDateString(instant: Date, timezone: string): string {
  return formatInTimeZone(instant, timezone, "yyyy-MM-dd");
}

/** Weekday (0=Sun..6=Sat) of a clinic-local date string. */
export function weekdayOf(date: string, timezone: string): number {
  // noon avoids any DST edge at midnight
  const d = toZonedTime(fromZonedTime(`${date}T12:00:00`, timezone), timezone);
  return d.getDay();
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ─── Engine ────────────────────────────────────────────────────────────────

/**
 * Return every bookable slot for one doctor on one clinic-local date.
 * Pure — no I/O. Callers pass config + existing appointments.
 */
export function generateSlots(input: SlotEngineInput): Slot[] {
  const {
    timezone,
    slotMinutes,
    bufferMinutes,
    workingHours,
    date,
    busy,
    holidays,
    now = new Date(),
    minLeadMinutes = 0,
  } = input;

  if (holidays.includes(date)) return [];

  const weekday = weekdayOf(date, timezone);
  const windows = workingHours.filter((w) => w.weekday === weekday);
  if (windows.length === 0) return [];

  const step = slotMinutes + bufferMinutes;
  const earliest = new Date(now.getTime() + minLeadMinutes * 60_000);

  const slots: Slot[] = [];
  for (const w of windows) {
    for (let m = w.startMin; m + slotMinutes <= w.endMin; m += step) {
      const startAt = localToUtc(date, m, timezone);
      const endAt = localToUtc(date, m + slotMinutes, timezone);

      if (startAt < earliest) continue;
      if (busy.some((b) => overlaps(startAt, endAt, b.startAt, b.endAt))) continue;

      slots.push({ startAt, endAt, label: minToHHMM(m) });
    }
  }
  return slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/**
 * Next N clinic-local dates (as "yyyy-MM-dd") that have at least one working
 * window for the doctor and are not holidays — used to offer the patient days.
 */
export function upcomingWorkingDates(opts: {
  timezone: string;
  workingHours: WorkingWindow[];
  holidays: string[];
  count: number;
  from?: Date;
}): string[] {
  const { timezone, workingHours, holidays, count, from = new Date() } = opts;
  const weekdays = new Set(workingHours.map((w) => w.weekday));
  const out: string[] = [];
  const cursor = new Date(from);
  for (let i = 0; i < 60 && out.length < count; i++) {
    const dateStr = localDateString(cursor, timezone);
    const wd = weekdayOf(dateStr, timezone);
    if (weekdays.has(wd) && !holidays.includes(dateStr)) out.push(dateStr);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** Human label for a day offered to the patient, e.g. "Fri, 12 Sep". */
export function dayLabel(date: string, timezone: string): string {
  return formatInTimeZone(
    fromZonedTime(`${date}T12:00:00`, timezone),
    timezone,
    "EEE, d MMM"
  );
}
