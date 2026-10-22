import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarRange } from "@/components/icons";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { dayRange, fmt } from "@/lib/format";
import { PAYMENT_MODES, rupees } from "@/lib/money";
import { categoryLabel } from "@/lib/finance";
import { avg, mins } from "@/lib/reports";
import { Card, CardBody, CardHeader, CardTitle, KeyValue, PageHeader, buttonClass, cn } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

function shift(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** End-of-day summary for the owner: patients, money in, money out, cash to bank. */
export default async function DailyReportPage({ searchParams }: PageProps<"/reports/daily">) {
  const user = await requirePermission("reports.view");
  const tz = user.clinic.timezone;
  const sp = await searchParams;
  const { day, start, end } = dayRange(tz, typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined);
  const where = { clinicId: user.clinicId };

  const [visits, appts, invoices, payments, expenses, outstanding, patientsNew] = await Promise.all([
    prisma.visit.findMany({
      where: { ...where, checkedInAt: { gte: start, lt: end } },
      select: { status: true, visitType: true, priority: true, checkedInAt: true, consultStartedAt: true, completedAt: true, diagnosis: true, icdCode: true, doctor: { select: { id: true, name: true } } },
    }),
    prisma.appointment.findMany({ where: { ...where, startAt: { gte: start, lt: end } }, select: { status: true, source: true } }),
    prisma.invoice.findMany({ where: { ...where, createdAt: { gte: start, lt: end }, status: { not: "void" } }, select: { total: true, discount: true, subtotal: true } }),
    prisma.payment.findMany({ where: { invoice: where, createdAt: { gte: start, lt: end } }, select: { kind: true, amount: true, mode: true, invoice: { select: { visit: { select: { doctorId: true } } } } } }),
    prisma.expense.findMany({ where: { ...where, date: new Date(`${day}T00:00:00Z`) } }),
    prisma.invoice.findMany({ where: { ...where, status: { in: ["unpaid", "partial"] }, createdAt: { lt: end } }, select: { total: true, paid: true } }),
    prisma.patient.count({ where: { ...where, createdAt: { gte: start, lt: end } } }),
  ]);

  const done = visits.filter((v) => v.status === "COMPLETED");
  const net = (p: { kind: string; amount: number }) => (p.kind === "refund" ? -p.amount : p.amount);
  const collected = payments.reduce((s, p) => s + net(p), 0);
  const refunds = payments.filter((p) => p.kind === "refund").reduce((s, p) => s + p.amount, 0);
  const cashIn = payments.filter((p) => p.mode === "cash").reduce((s, p) => s + net(p), 0);
  const cashOut = expenses.filter((e) => e.mode === "cash").reduce((s, e) => s + e.amount, 0);
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const due = outstanding.reduce((s, i) => s + i.total - i.paid, 0);
  const wait = avg(done.map((v) => mins(v.checkedInAt, v.consultStartedAt)).filter((x): x is number => x != null));

  const doctors = new Map<string, { name: string; seen: number; fresh: number; follow: number; revenue: number }>();
  for (const v of visits) {
    const r = doctors.get(v.doctor.id) ?? { name: v.doctor.name, seen: 0, fresh: 0, follow: 0, revenue: 0 };
    if (v.status === "COMPLETED") {
      r.seen++;
      if (v.visitType === "follow_up") r.follow++;
      else r.fresh++;
    }
    doctors.set(v.doctor.id, r);
  }
  for (const p of payments) {
    const id = p.invoice.visit?.doctorId;
    if (id && doctors.has(id)) doctors.get(id)!.revenue += net(p);
  }
  const dx = new Map<string, number>();
  for (const v of done) if (v.diagnosis) dx.set(v.icdCode ? `${v.diagnosis} (${v.icdCode})` : v.diagnosis, (dx.get(v.icdCode ? `${v.diagnosis} (${v.icdCode})` : v.diagnosis) ?? 0) + 1);

  return (
    <div className="space-y-5 print:space-y-3">
      <PageHeader
        icon={CalendarRange}
        title="Daily report"
        description={`${user.clinic.name} · ${fmt(start, tz, "EEEE, d MMMM yyyy")}`}
        actions={
          <div className="no-print flex items-center gap-1">
            <Link href={`/reports/daily?date=${shift(day, -1)}`} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link href={`/reports/daily?date=${shift(day, 1)}`} className={buttonClass("secondary", "sm", "w-8 px-0")} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </Link>
            <PrintButton />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Patients seen", String(done.length), `${done.filter((v) => v.visitType === "new").length} new · ${done.filter((v) => v.visitType === "follow_up").length} follow-up`],
          ["Collected (net)", rupees(collected), refunds ? `${rupees(refunds)} refunded` : "No refunds"],
          ["Spent today", rupees(spent), `${expenses.length} expense${expenses.length === 1 ? "" : "s"}`],
          ["Net for the day", rupees(collected - spent), collected - spent >= 0 ? "Surplus" : "Deficit"],
        ].map(([l, v, s]) => (
          <Card key={l} className="p-4">
            <div className="text-xs font-medium text-slate-500">{l}</div>
            <div className="tabular mt-1 text-xl font-semibold text-slate-900">{v}</div>
            <div className="text-[11px] text-slate-400">{s}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>OPD</CardTitle>
          </CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <KeyValue label="Checked in" value={visits.length} />
              <KeyValue label="Completed" value={done.length} />
              <KeyValue label="Cancelled" value={visits.filter((v) => v.status === "CANCELLED").length} />
              <KeyValue label="Emergencies" value={visits.filter((v) => v.priority === "emergency").length} />
              <KeyValue label="New registrations" value={patientsNew} />
              <KeyValue label="Avg wait to doctor" value={wait != null ? `${wait} min` : "—"} />
              <KeyValue label="Appointments" value={appts.length} />
              <KeyValue label="No-shows" value={appts.filter((a) => a.status === "no_show").length} />
              <KeyValue label="Booked on WhatsApp" value={appts.filter((a) => a.source === "whatsapp").length} />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Money</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <Row label="Billed" value={rupees(invoices.reduce((s, i) => s + i.total, 0))} />
            <Row label="Discounts given" value={rupees(invoices.reduce((s, i) => s + i.discount, 0))} />
            {PAYMENT_MODES.map((m) => {
              const v = payments.filter((p) => p.mode === m.value).reduce((s, p) => s + net(p), 0);
              return v ? <Row key={m.value} label={`Received · ${m.label}`} value={rupees(v)} /> : null;
            })}
            <Row label="Collected (net)" value={rupees(collected)} strong />
            <div className="border-t border-dashed border-slate-200 pt-3">
              <Row label="Cash received" value={rupees(cashIn)} />
              <Row label="Cash spent" value={`− ${rupees(cashOut)}`} />
              <Row label="Cash to hand over / bank" value={rupees(cashIn - cashOut)} strong />
            </div>
            <Row label="Outstanding dues (all bills)" value={rupees(due)} tone={due ? "text-amber-700" : undefined} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By doctor</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-2 font-medium">Doctor</th>
                <th className="px-3 py-2 text-right font-medium">Seen</th>
                <th className="px-3 py-2 text-right font-medium">New</th>
                <th className="px-3 py-2 text-right font-medium">Follow-up</th>
                <th className="px-5 py-2 text-right font-medium">Collected</th>
              </tr>
            </thead>
            <tbody>
              {[...doctors.values()].map((d) => (
                <tr key={d.name} className="border-b border-slate-50">
                  <td className="px-5 py-2 font-medium text-slate-800">{d.name}</td>
                  <td className="tabular px-3 py-2 text-right">{d.seen}</td>
                  <td className="tabular px-3 py-2 text-right">{d.fresh}</td>
                  <td className="tabular px-3 py-2 text-right">{d.follow}</td>
                  <td className="tabular px-5 py-2 text-right font-semibold">{rupees(d.revenue)}</td>
                </tr>
              ))}
              {doctors.size === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-4 text-center text-slate-400">
                    No OPD activity
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expenses today</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-slate-100 text-sm">
            {expenses.length === 0 && <li className="px-5 py-4 text-slate-400">None recorded</li>}
            {expenses.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 px-5 py-2">
                <span className="text-slate-700">
                  {e.description} <span className="text-xs text-slate-400">· {categoryLabel(e.category)}</span>
                </span>
                <span className="tabular font-medium">{rupees(e.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top diagnoses</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-slate-100 text-sm">
            {dx.size === 0 && <li className="px-5 py-4 text-slate-400">None recorded</li>}
            {[...dx.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([name, n]) => (
                <li key={name} className="flex justify-between gap-3 px-5 py-2">
                  <span className="text-slate-700">{name}</span>
                  <span className="tabular font-medium">{n}</span>
                </li>
              ))}
          </ul>
        </Card>
      </div>
      <p className="hidden pt-6 text-xs text-slate-500 print:block">
        Prepared by {user.name} · {fmt(new Date(), tz, "d MMM yyyy, h:mm a")} · Signature: ____________________
      </p>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn("text-slate-500", strong && "font-semibold text-slate-800")}>{label}</span>
      <span className={cn("tabular", strong ? "font-semibold text-slate-900" : "text-slate-800", tone)}>{value}</span>
    </div>
  );
}
