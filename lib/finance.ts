// Finance analytics: daily/monthly money and volume series plus breakdowns.
// All money in paise. Days and months are hospital-local.
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { doctorSlots, upcomingDoctorDates } from "@/lib/availability";
export { EXPENSE_CATEGORIES, categoryLabel, shiftMonth, monthLabel } from "@/lib/finance-shared";

export type DayRow = {
  date: string;
  collected: number; // net of refunds
  billed: number;
  expenses: number;
  visits: number; // completed
  newVisits: number;
  followUps: number;
};

const local = (d: Date, tz: string) => formatInTimeZone(d, tz, "yyyy-MM-dd");

export function monthBounds(month: string, tz: string) {
  const [y, m] = month.split("-").map(Number);
  const startDay = `${month}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: fromZonedTime(`${startDay}T00:00:00`, tz), end: fromZonedTime(`${next}T00:00:00`, tz), startDay, days };
}

/** One row per local day in [fromDay, toDay] inclusive. */
export async function dailySeries(clinicId: string, tz: string, fromDay: string, toDay: string): Promise<DayRow[]> {
  const start = fromZonedTime(`${fromDay}T00:00:00`, tz);
  const end = new Date(fromZonedTime(`${toDay}T00:00:00`, tz).getTime() + 24 * 3600_000);
  const [payments, invoices, visits, expenses] = await Promise.all([
    prisma.payment.findMany({ where: { invoice: { clinicId }, createdAt: { gte: start, lt: end } }, select: { kind: true, amount: true, createdAt: true } }),
    prisma.invoice.findMany({ where: { clinicId, status: { not: "void" }, createdAt: { gte: start, lt: end } }, select: { total: true, createdAt: true } }),
    prisma.visit.findMany({ where: { clinicId, status: "COMPLETED", checkedInAt: { gte: start, lt: end } }, select: { checkedInAt: true, visitType: true } }),
    prisma.expense.findMany({ where: { clinicId, date: { gte: new Date(`${fromDay}T00:00:00Z`), lte: new Date(`${toDay}T00:00:00Z`) } }, select: { date: true, amount: true } }),
  ]);
  const rows = new Map<string, DayRow>();
  for (let d = new Date(`${fromDay}T12:00:00Z`); d.toISOString().slice(0, 10) <= toDay; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    rows.set(k, { date: k, collected: 0, billed: 0, expenses: 0, visits: 0, newVisits: 0, followUps: 0 });
  }
  for (const p of payments) {
    const r = rows.get(local(p.createdAt, tz));
    if (r) r.collected += p.kind === "refund" ? -p.amount : p.amount;
  }
  for (const i of invoices) {
    const r = rows.get(local(i.createdAt, tz));
    if (r) r.billed += i.total;
  }
  for (const v of visits) {
    const r = rows.get(local(v.checkedInAt, tz));
    if (!r) continue;
    r.visits++;
    if (v.visitType === "follow_up") r.followUps++;
    else r.newVisits++;
  }
  for (const e of expenses) {
    const r = rows.get(e.date.toISOString().slice(0, 10));
    if (r) r.expenses += e.amount;
  }
  return [...rows.values()];
}

export type MonthRow = { month: string; collected: number; billed: number; expenses: number; profit: number; visits: number };

export function toMonths(days: DayRow[]): MonthRow[] {
  const m = new Map<string, MonthRow>();
  for (const d of days) {
    const k = d.date.slice(0, 7);
    const r = m.get(k) ?? { month: k, collected: 0, billed: 0, expenses: 0, profit: 0, visits: 0 };
    r.collected += d.collected;
    r.billed += d.billed;
    r.expenses += d.expenses;
    r.visits += d.visits;
    r.profit = r.collected - r.expenses;
    m.set(k, r);
  }
  return [...m.values()];
}

/** Breakdowns for one period: by doctor, by service line, by payment mode, by expense category. */
export async function breakdowns(clinicId: string, start: Date, end: Date, fromDay: string, toDay: string) {
  const [payments, items, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { invoice: { clinicId }, createdAt: { gte: start, lt: end } },
      select: { kind: true, amount: true, mode: true, invoice: { select: { visit: { select: { doctor: { select: { id: true, name: true } } } } } } },
    }),
    prisma.invoiceItem.findMany({
      where: { invoice: { clinicId, status: { not: "void" }, createdAt: { gte: start, lt: end } } },
      select: { description: true, amount: true },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { clinicId, date: { gte: new Date(`${fromDay}T00:00:00Z`), lte: new Date(`${toDay}T00:00:00Z`) } },
      _sum: { amount: true },
    }),
  ]);
  const net = (p: { kind: string; amount: number }) => (p.kind === "refund" ? -p.amount : p.amount);

  const doctors = new Map<string, { name: string; value: number }>();
  for (const p of payments) {
    const d = p.invoice.visit?.doctor;
    const key = d?.id ?? "services";
    const cur = doctors.get(key) ?? { name: d?.name ?? "Walk-in services", value: 0 };
    cur.value += net(p);
    doctors.set(key, cur);
  }
  const services = new Map<string, number>();
  for (const i of items) {
    const key = /^(follow-up )?consultation/i.test(i.description) ? (i.description.toLowerCase().startsWith("follow") ? "Follow-up consultations" : "Consultations") : i.description;
    services.set(key, (services.get(key) ?? 0) + i.amount);
  }
  const modes = new Map<string, number>();
  for (const p of payments) modes.set(p.mode, (modes.get(p.mode) ?? 0) + net(p));

  const sorted = <T extends { value: number }>(xs: T[]) => xs.filter((x) => x.value !== 0).sort((a, b) => b.value - a.value);
  return {
    byDoctor: sorted([...doctors.values()]),
    byService: sorted([...services.entries()].map(([name, value]) => ({ name, value }))),
    byMode: [...modes.entries()].map(([mode, value]) => ({ mode, value })),
    byCategory: sorted(expenses.map((e) => ({ name: e.category, value: e._sum.amount ?? 0 }))),
  };
}

/** Clinic-local "yyyy-MM-dd" days the OPD is closed (holidays) — forecast zeros. */
export async function hospitalClosedDays(clinicId: string, tz: string) {
  const holidays = await prisma.holiday.findMany({ where: { clinicId } });
  return new Set(holidays.map((h) => formatInTimeZone(h.date, tz, "yyyy-MM-dd")));
}

/** Free vs booked OPD slots across all doctors for the next `days` days. */
export async function capacity(clinicId: string, tz: string, days: number) {
  const doctors = await prisma.doctor.findMany({ where: { clinicId, active: true }, include: { workingHours: true } });
  let total = 0;
  let free = 0;
  for (const d of doctors) {
    const dates = await upcomingDoctorDates(d, tz, days);
    for (const date of dates) {
      const r = await doctorSlots(d, date, tz);
      total += r.all.length;
      free += r.free.length;
    }
  }
  return { total, booked: total - free, utilisation: total ? Math.round(((total - free) / total) * 100) : 0 };
}
